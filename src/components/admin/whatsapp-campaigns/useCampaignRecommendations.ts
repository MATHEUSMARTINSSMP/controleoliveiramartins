import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CampaignRecommendation {
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  recommended_category: string;
  recommendation_score: number;
  reason: string;
  alternative_categories?: Array<{
    category: string;
    score: number;
    campaigns_received: number;
    times_returned: number;
  }>;
}

/**
 * Hook para obter recomendação de categoria de campanha para um cliente específico
 * @param contactId - ID do contato/cliente
 * @param storeId - ID da loja (opcional, será obtido do contato se não fornecido)
 * @returns Objeto com dados da recomendação, loading e error
 */
export function useCampaignRecommendation(
  contactId: string | null,
  storeId?: string
) {
  const [data, setData] = useState<CampaignRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    if (!contactId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase.rpc(
        'get_campaign_recommendation_for_customer',
        {
          p_contact_id: contactId,
          p_store_id: storeId || null,
        }
      );

      if (err) throw err;
      setData(result && result.length > 0 ? result[0] : null);
    } catch (err: any) {
      console.error("Erro ao buscar recomendação:", err);
      setError(err.message || "Erro ao carregar recomendação");
      toast.error("Erro ao carregar recomendação: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, storeId]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook para obter recomendações em massa para múltiplos clientes
 * @param storeId - ID da loja
 * @param limit - Limite de clientes (padrão: 100)
 * @returns Array de recomendações, loading e error
 */
export function useBulkCampaignRecommendations(
  storeId: string | null,
  limit: number = 100
) {
  const [data, setData] = useState<CampaignRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    if (!storeId) {
      setData([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase.rpc(
        'get_bulk_campaign_recommendations',
        {
          p_store_id: storeId,
          p_limit: limit,
        }
      );

      if (err) throw err;
      setData(result || []);
    } catch (err: any) {
      console.error("Erro ao buscar recomendações em massa:", err);
      setError(err.message || "Erro ao carregar recomendações");
      toast.error("Erro ao carregar recomendações: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, limit]);

  return { data, loading, error, refetch: fetch };
}

