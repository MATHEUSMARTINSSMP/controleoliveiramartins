import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WhatsAppCampaign, CampaignStats } from "./types";

export function useCampaigns(profileId: string | undefined) {
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    if (!profileId) return;

    try {
      setLoading(true);

      // Buscar campanhas das lojas do admin
      const { data: stores } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id")
        .eq("admin_id", profileId)
        .eq("active", true);

      if (!stores || stores.length === 0) {
        setCampaigns([]);
        return;
      }

      const storeIds = stores.map(s => s.id);

      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaigns")
        .select(`
          id,
          name,
          status,
          total_recipients,
          sent_count,
          failed_count,
          created_at,
          started_at,
          completed_at,
          scheduled_start_at,
          store_id,
          start_hour,
          end_hour,
          min_interval_minutes,
          daily_limit,
          category,
          stores:store_id (
            name
          )
        `)
        .in("store_id", storeIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transformar dados (stores é um array)
      const transformedCampaigns = (data || []).map(campaign => ({
        ...campaign,
        store: Array.isArray(campaign.stores) && campaign.stores[0] 
          ? { name: campaign.stores[0].name }
          : undefined,
      }));

      setCampaigns(transformedCampaigns as WhatsAppCampaign[]);
    } catch (error: any) {
      console.error("Erro ao buscar campanhas:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [profileId]);

  return { campaigns, loading, refetch: fetchCampaigns };
}

export function useCampaignStats(campaignId: string | null) {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    if (!campaignId) {
      setStats(null);
      return;
    }

    try {
      setLoading(true);

      const { data: messages, error } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_message_queue")
        .select("status")
        .eq("campaign_id", campaignId);

      if (error) throw error;

      const campaignStats: CampaignStats = {
        total: messages?.length || 0,
        pending: messages?.filter(m => m.status === 'PENDING' || m.status === 'SCHEDULED').length || 0,
        sending: messages?.filter(m => m.status === 'SENDING').length || 0,
        sent: messages?.filter(m => m.status === 'SENT').length || 0,
        failed: messages?.filter(m => m.status === 'FAILED').length || 0,
        cancelled: messages?.filter(m => m.status === 'CANCELLED' || m.status === 'SKIPPED').length || 0,
      };

      setStats(campaignStats);
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Polling automático: atualizar stats a cada 10 segundos se campanha estiver ativa
    const interval = setInterval(() => {
      fetchStats();
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return { stats, loading, refetch: fetchStats };
}

