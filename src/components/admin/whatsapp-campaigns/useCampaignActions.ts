import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { retryWithBackoff } from "./useRetryLogic";

interface CampaignActionOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useCampaignActions(options?: CampaignActionOptions) {
  const pauseCampaign = async (campaignId: string, currentStatus: string) => {
    // Validação: só pode pausar se estiver RUNNING
    if (currentStatus !== 'RUNNING') {
      toast.error(`Não é possível pausar uma campanha com status "${currentStatus}". Apenas campanhas em andamento podem ser pausadas.`);
      return;
    }

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_campaigns")
          .update({ status: 'PAUSED', updated_at: new Date().toISOString() })
          .eq("id", campaignId);

        if (error) {
          if (error.code === 'PGRST301') {
            throw new Error("Campanha não encontrada ou você não tem permissão para editá-la");
          }
          if (error.code === 'PGRST301' || error.code === 'PGRST116') {
            throw error; // Não retry em erros de permissão/not found
          }
          throw error;
        }
      }, { maxRetries: 2, initialDelay: 500 });

      // Pausar mensagens pendentes na fila (sem retry pois é menos crítico)
      try {
        await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_message_queue")
          .update({ status: 'CANCELLED' })
          .eq("campaign_id", campaignId)
          .in("status", ['PENDING', 'SCHEDULED']);
      } catch (queueError) {
        console.warn("Erro ao pausar mensagens na fila (não crítico):", queueError);
      }

      toast.success("Campanha pausada com sucesso");
      options?.onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao pausar campanha:", error);
      
      // Mensagens de erro mais específicas e acionáveis
      let errorMessage = "Erro ao pausar campanha";
      if (error.code === 'PGRST301') {
        errorMessage = "Campanha não encontrada. Pode ter sido deletada por outro usuário. Recarregue a página.";
      } else if (error.code === 'PGRST116') {
        errorMessage = "Você não tem permissão para pausar esta campanha. Verifique se a campanha pertence à sua loja.";
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      options?.onError?.(error);
      throw error;
    }
  };

  const resumeCampaign = async (campaignId: string, currentStatus: string) => {
    // Validação: só pode retomar se estiver PAUSED
    if (currentStatus !== 'PAUSED') {
      toast.error(`Não é possível retomar uma campanha com status "${currentStatus}". Apenas campanhas pausadas podem ser retomadas.`);
      return;
    }

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_campaigns")
          .update({ 
            status: 'RUNNING', 
            updated_at: new Date().toISOString(),
            started_at: new Date().toISOString()
          })
          .eq("id", campaignId);

        if (error) {
          if (error.code === 'PGRST301') {
            throw new Error("Campanha não encontrada ou você não tem permissão para editá-la");
          }
          if (error.code === 'PGRST301' || error.code === 'PGRST116') {
            throw error; // Não retry em erros de permissão/not found
          }
          throw error;
        }
      }, { maxRetries: 2, initialDelay: 500 });

      toast.success("Campanha retomada com sucesso");
      options?.onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao retomar campanha:", error);
      
      // Mensagens de erro mais específicas e acionáveis
      let errorMessage = "Erro ao retomar campanha";
      if (error.code === 'PGRST301') {
        errorMessage = "Campanha não encontrada. Pode ter sido deletada por outro usuário. Recarregue a página.";
      } else if (error.code === 'PGRST116') {
        errorMessage = "Você não tem permissão para retomar esta campanha. Verifique se a campanha pertence à sua loja.";
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      options?.onError?.(error);
      throw error;
    }
  };

  const cancelCampaign = async (campaignId: string, currentStatus: string) => {
    // Validação: não pode cancelar se já estiver cancelada ou concluída
    if (currentStatus === 'CANCELLED') {
      toast.error("Esta campanha já está cancelada");
      return;
    }
    if (currentStatus === 'COMPLETED') {
      toast.error("Não é possível cancelar uma campanha já concluída");
      return;
    }

    if (!confirm("Tem certeza que deseja cancelar esta campanha? Todas as mensagens pendentes serão canceladas.")) {
      return;
    }

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_campaigns")
          .update({ 
            status: 'CANCELLED', 
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
          .eq("id", campaignId);

        if (error) {
          if (error.code === 'PGRST301') {
            throw new Error("Campanha não encontrada ou você não tem permissão para editá-la");
          }
          if (error.code === 'PGRST301' || error.code === 'PGRST116') {
            throw error; // Não retry em erros de permissão/not found
          }
          throw error;
        }
      }, { maxRetries: 2, initialDelay: 500 });

      // Cancelar mensagens pendentes na fila (sem retry pois é menos crítico)
      try {
        await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_message_queue")
          .update({ status: 'CANCELLED' })
          .eq("campaign_id", campaignId)
          .in("status", ['PENDING', 'SCHEDULED', 'SENDING']);
      } catch (queueError) {
        console.warn("Erro ao cancelar mensagens na fila (não crítico):", queueError);
      }

      toast.success("Campanha cancelada com sucesso");
      options?.onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao cancelar campanha:", error);
      
      // Mensagens de erro mais específicas e acionáveis
      let errorMessage = "Erro ao cancelar campanha";
      if (error.code === 'PGRST301') {
        errorMessage = "Campanha não encontrada. Pode ter sido deletada por outro usuário. Recarregue a página.";
      } else if (error.code === 'PGRST116') {
        errorMessage = "Você não tem permissão para cancelar esta campanha. Verifique se a campanha pertence à sua loja.";
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      options?.onError?.(error);
      throw error;
    }
  };

  return { pauseCampaign, resumeCampaign, cancelCampaign };
}

