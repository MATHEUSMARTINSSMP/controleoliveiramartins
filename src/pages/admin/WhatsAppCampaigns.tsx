import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCampaigns, useCampaignStats } from "@/components/admin/whatsapp-campaigns/useCampaigns";
import { useCampaignActions } from "@/components/admin/whatsapp-campaigns/useCampaignActions";
import { CampaignCard } from "@/components/admin/whatsapp-campaigns/CampaignCard";
import { CampaignFilters } from "@/components/admin/whatsapp-campaigns/CampaignFilters";
import { CampaignDetailsModal } from "@/components/admin/whatsapp-campaigns/CampaignDetailsModal";
import { WhatsAppCampaign, CampaignStats } from "@/components/admin/whatsapp-campaigns/types";
import { EmptyState } from "@/components/admin/whatsapp-campaigns/EmptyState";
import { CampaignListSkeleton } from "@/components/admin/whatsapp-campaigns/LoadingSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function WhatsAppCampaigns() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { campaigns, loading: campaignsLoading, refetch } = useCampaigns(profile?.id);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [detailsModalCampaign, setDetailsModalCampaign] = useState<WhatsAppCampaign | null>(null);
  const { stats, loading: loadingStats, refetch: refetchStats } = useCampaignStats(selectedCampaign);
  const [allCampaignsStats, setAllCampaignsStats] = useState<Record<string, CampaignStats>>({});
  const [loadingAllStats, setLoadingAllStats] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<WhatsAppCampaign | null>(null);
  const [campaignToDuplicate, setCampaignToDuplicate] = useState<WhatsAppCampaign | null>(null);
  
  // Buscar stats para todas as campanhas ativas
  useEffect(() => {
    const activeCampaignIds = campaigns
      .filter(c => c.status === 'RUNNING' || c.status === 'PAUSED')
      .map(c => c.id);

    if (activeCampaignIds.length === 0) {
      setAllCampaignsStats({});
      return;
    }

    const fetchAllStats = async () => {
      setLoadingAllStats(true);
      try {
        const { data: messages, error } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_message_queue")
          .select("campaign_id, status")
          .in("campaign_id", activeCampaignIds);

        if (error) throw error;

        // Agrupar por campaign_id e calcular stats
        const statsMap: Record<string, CampaignStats> = {};
        activeCampaignIds.forEach(campaignId => {
          const campaignMessages = messages?.filter(m => m.campaign_id === campaignId) || [];
          statsMap[campaignId] = {
            total: campaignMessages.length,
            pending: campaignMessages.filter(m => m.status === 'PENDING' || m.status === 'SCHEDULED').length,
            sending: campaignMessages.filter(m => m.status === 'SENDING').length,
            sent: campaignMessages.filter(m => m.status === 'SENT').length,
            failed: campaignMessages.filter(m => m.status === 'FAILED').length,
            cancelled: campaignMessages.filter(m => m.status === 'CANCELLED' || m.status === 'SKIPPED').length,
          };
        });

        setAllCampaignsStats(statsMap);
      } catch (error: any) {
        console.error("Erro ao buscar estatísticas de todas as campanhas:", error);
      } finally {
        setLoadingAllStats(false);
      }
    };

    fetchAllStats();

    // Polling: atualizar stats a cada 10 segundos para campanhas ativas
    const interval = setInterval(fetchAllStats, 10000);
    return () => clearInterval(interval);
  }, [campaigns]);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_desc");
  
  // Estados para loading das ações
  const [loadingActions, setLoadingActions] = useState<Record<string, 'pause' | 'resume' | 'cancel' | null>>({});

  // Obter lojas únicas para filtro
  const stores = useMemo(() => {
    const storeMap = new Map<string, { id: string; name: string }>();
    campaigns.forEach(c => {
      if (c.store?.name && !storeMap.has(c.store_id)) {
        storeMap.set(c.store_id, { id: c.store_id, name: c.store.name });
      }
    });
    return Array.from(storeMap.values());
  }, [campaigns]);

  const { pauseCampaign, resumeCampaign, cancelCampaign } = useCampaignActions({
    onSuccess: () => {
      refetch();
      if (selectedCampaign) {
        refetchStats();
      }
    },
  });

  // Filtrar e ordenar campanhas
  const filteredAndSortedCampaigns = useMemo(() => {
    let filtered = [...campaigns];

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Filtro por loja
    if (storeFilter !== 'all') {
      filtered = filtered.filter(c => c.store_id === storeFilter);
    }

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'progress_desc':
          const progressA = a.total_recipients > 0 ? a.sent_count / a.total_recipients : 0;
          const progressB = b.total_recipients > 0 ? b.sent_count / b.total_recipients : 0;
          return progressB - progressA;
        case 'progress_asc':
          const progressA2 = a.total_recipients > 0 ? a.sent_count / a.total_recipients : 0;
          const progressB2 = b.total_recipients > 0 ? b.sent_count / b.total_recipients : 0;
          return progressA2 - progressB2;
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [campaigns, searchTerm, statusFilter, storeFilter, sortBy]);

  const handleToggleCampaign = (campaignId: string) => {
    setSelectedCampaign(selectedCampaign === campaignId ? null : campaignId);
  };

  const handlePause = async (campaignId: string, currentStatus: string) => {
    setLoadingActions(prev => ({ ...prev, [campaignId]: 'pause' }));
    try {
      await pauseCampaign(campaignId, currentStatus);
    } finally {
      setLoadingActions(prev => {
        const next = { ...prev };
        delete next[campaignId];
        return next;
      });
    }
  };

  const handleResume = async (campaignId: string, currentStatus: string) => {
    setLoadingActions(prev => ({ ...prev, [campaignId]: 'resume' }));
    try {
      await resumeCampaign(campaignId, currentStatus);
    } finally {
      setLoadingActions(prev => {
        const next = { ...prev };
        delete next[campaignId];
        return next;
      });
    }
  };

  const handleCancel = async (campaignId: string, currentStatus: string) => {
    setLoadingActions(prev => ({ ...prev, [campaignId]: 'cancel' }));
    try {
      await cancelCampaign(campaignId, currentStatus);
    } finally {
      setLoadingActions(prev => {
        const next = { ...prev };
        delete next[campaignId];
        return next;
      });
    }
  };

  const handleDuplicateCampaign = async (campaign: WhatsAppCampaign) => {
    try {
      // Buscar templates e mensagens da campanha original
      const { data: templates, error: templatesError } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaign_templates")
        .select("*")
        .eq("campaign_id", campaign.id);

      if (templatesError) throw templatesError;

      const { data: messages, error: messagesError } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaign_messages")
        .select("*")
        .eq("campaign_id", campaign.id);

      if (messagesError) throw messagesError;

      // Criar nova campanha como rascunho
      const { data: newCampaign, error: campaignError } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaigns")
        .insert({
          name: `${campaign.name} (Cópia)`,
          status: 'DRAFT',
          store_id: campaign.store_id,
          total_recipients: 0,
          sent_count: 0,
          failed_count: 0,
          scheduled_start_at: null,
          start_hour: campaign.start_hour,
          end_hour: campaign.end_hour,
          min_interval_minutes: campaign.min_interval_minutes,
          daily_limit: campaign.daily_limit,
          category: campaign.category,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Duplicar templates
      if (templates && templates.length > 0) {
        const templatesToInsert = templates.map(t => ({
          campaign_id: newCampaign.id,
          template_content: t.template_content,
          order_index: t.order_index,
        }));

        const { error: insertTemplatesError } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_campaign_templates")
          .insert(templatesToInsert);

        if (insertTemplatesError) throw insertTemplatesError;
      }

      // Duplicar mensagens (variations)
      if (messages && messages.length > 0) {
        const messagesToInsert = messages.map(m => ({
          campaign_id: newCampaign.id,
          content: m.content,
          order_index: m.order_index,
        }));

        const { error: insertMessagesError } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_campaign_messages")
          .insert(messagesToInsert);

        if (insertMessagesError) throw insertMessagesError;
      }

      toast.success("Campanha duplicada com sucesso!");
      refetch();
      setCampaignToDuplicate(null);
      navigate(`/admin/whatsapp-bulk-send?campaignId=${newCampaign.id}`);
    } catch (error: any) {
      console.error("Erro ao duplicar campanha:", error);
      toast.error("Erro ao duplicar campanha: " + (error.message || "Erro desconhecido"));
    }
  };

  const handleDeleteCampaign = async (campaign: WhatsAppCampaign) => {
    try {
      // Só pode deletar se for DRAFT ou CANCELLED
      if (campaign.status !== 'DRAFT' && campaign.status !== 'CANCELLED') {
        toast.error("Apenas campanhas em rascunho ou canceladas podem ser deletadas");
        setCampaignToDelete(null);
        return;
      }

      // Deletar templates, messages, queue messages relacionados
      await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaign_templates")
        .delete()
        .eq("campaign_id", campaign.id);

      await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaign_messages")
        .delete()
        .eq("campaign_id", campaign.id);

      await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_message_queue")
        .delete()
        .eq("campaign_id", campaign.id);

      // Deletar campanha
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaigns")
        .delete()
        .eq("id", campaign.id);

      if (error) throw error;

      toast.success("Campanha deletada com sucesso!");
      refetch();
      setCampaignToDelete(null);
    } catch (error: any) {
      console.error("Erro ao deletar campanha:", error);
      toast.error("Erro ao deletar campanha: " + (error.message || "Erro desconhecido"));
    }
  };

  if (authLoading || campaignsLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campanhas WhatsApp</h1>
            <p className="text-muted-foreground">Gerencie suas campanhas de envio em massa</p>
          </div>
        </div>
        <CampaignListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campanhas WhatsApp</h1>
          <p className="text-muted-foreground">Gerencie suas campanhas de envio em massa</p>
        </div>
        <Button onClick={refetch} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <CampaignFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        storeFilter={storeFilter}
        onStoreFilterChange={setStoreFilter}
        stores={stores}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {filteredAndSortedCampaigns.length === 0 ? (
        <EmptyState
          type={campaigns.length === 0 ? 'no-campaigns' : 'no-results'}
          searchTerm={searchTerm}
        />
      ) : (
        <div className="grid gap-4">
          {filteredAndSortedCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              isExpanded={selectedCampaign === campaign.id}
              onToggleExpand={() => handleToggleCampaign(campaign.id)}
              onPause={() => handlePause(campaign.id, campaign.status)}
              onResume={() => handleResume(campaign.id, campaign.status)}
              onCancel={() => handleCancel(campaign.id, campaign.status)}
              onDuplicate={() => setCampaignToDuplicate(campaign)}
              onDelete={() => setCampaignToDelete(campaign)}
              onEdit={() => navigate(`/admin/whatsapp-bulk-send?campaignId=${campaign.id}`)}
              stats={selectedCampaign === campaign.id ? (stats || undefined) : (allCampaignsStats[campaign.id] || undefined)}
              loadingStats={selectedCampaign === campaign.id ? loadingStats : loadingAllStats}
              loadingPause={loadingActions[campaign.id] === 'pause'}
              loadingResume={loadingActions[campaign.id] === 'resume'}
              loadingCancel={loadingActions[campaign.id] === 'cancel'}
              onViewDetails={() => setDetailsModalCampaign(campaign)}
            />
          ))}
        </div>
      )}

      {/* Modal de detalhes */}
      <CampaignDetailsModal
        campaign={detailsModalCampaign}
        open={!!detailsModalCampaign}
        onOpenChange={(open) => !open && setDetailsModalCampaign(null)}
      />

      {/* Dialog para confirmar deleção */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a campanha "{campaignToDelete?.name}"? 
              Esta ação não pode ser desfeita e todos os dados relacionados serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => campaignToDelete && handleDeleteCampaign(campaignToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para confirmar duplicação */}
      <AlertDialog open={!!campaignToDuplicate} onOpenChange={(open) => !open && setCampaignToDuplicate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova campanha será criada como rascunho com o nome "{campaignToDuplicate?.name} (Cópia)". 
              Todos os templates e mensagens serão copiados. Você poderá editar a campanha depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => campaignToDuplicate && handleDuplicateCampaign(campaignToDuplicate)}
            >
              Duplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
