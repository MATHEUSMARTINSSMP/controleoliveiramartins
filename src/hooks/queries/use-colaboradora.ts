/**
 * Colaboradora Queries Hook
 * Enterprise-grade hooks for colaboradora dashboard data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS, type Profile, type Adiantamento, type Purchase, type Parcela } from './types';

interface ColaboradoraKPIs {
  totalPendente: number;
  proximasParcelas: number;
  totalPago: number;
  limiteTotal: number;
  limiteDisponivel: number;
  limiteMensal: number;
  limiteDisponivelMensal: number;
}

export function useColaboradoraKPIs(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.kpis, 'colaboradora', profileId],
    queryFn: async (): Promise<ColaboradoraKPIs | null> => {
      if (!profileId) return null;

      const [profileResult, purchasesResult] = await Promise.all([
        supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .select('limite_total, limite_mensal')
          .eq('id', profileId)
          .single(),
        supabase
          .schema('sistemaretiradas')
          .from('purchases')
          .select('id, preco_final, status_compra')
          .eq('colaboradora_id', profileId),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (purchasesResult.error) throw purchasesResult.error;

      const profileData = profileResult.data;
      const purchases = purchasesResult.data || [];
      const purchaseIds = purchases.map(p => p.id);
      
      if (purchaseIds.length === 0) {
        const limiteTotal = Number(profileData?.limite_total) || 0;
        const limiteMensal = Number(profileData?.limite_mensal) || 0;
        return {
          totalPendente: 0,
          proximasParcelas: 0,
          totalPago: 0,
          limiteTotal,
          limiteDisponivel: limiteTotal,
          limiteMensal,
          limiteDisponivelMensal: limiteMensal,
        };
      }

      const mesAtual = new Date().toISOString().slice(0, 7);
      
      const { data: parcelas, error: parcelasError } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .select('valor_parcela, status_parcela, compra_id, competencia')
        .in('compra_id', purchaseIds);

      if (parcelasError) throw parcelasError;

      const minhasParcelas = parcelas || [];

      const totalPendente = minhasParcelas
        .filter(p => p.status_parcela === 'PENDENTE')
        .reduce((acc, p) => acc + Number(p.valor_parcela || 0), 0);

      const totalPago = minhasParcelas
        .filter(p => p.status_parcela === 'PAGO')
        .reduce((acc, p) => acc + Number(p.valor_parcela || 0), 0);

      const proximasParcelas = minhasParcelas
        .filter(p => p.competencia === mesAtual && p.status_parcela === 'PENDENTE')
        .reduce((acc, p) => acc + Number(p.valor_parcela || 0), 0);

      const limiteTotal = Number(profileData?.limite_total) || 0;
      const limiteMensal = Number(profileData?.limite_mensal) || 0;

      return {
        totalPendente,
        proximasParcelas,
        totalPago,
        limiteTotal,
        limiteDisponivel: Math.max(0, limiteTotal - totalPendente),
        limiteMensal,
        limiteDisponivelMensal: Math.max(0, limiteMensal - proximasParcelas),
      };
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useColaboradoraAdiantamentos(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.adiantamentos, profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('adiantamentos')
        .select('*')
        .eq('colaboradora_id', profileId)
        .order('data_solicitacao', { ascending: false });

      if (error) throw error;
      return data as Adiantamento[];
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useColaboradoraCompras(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.purchases, profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select(`
          id,
          data_compra,
          item,
          preco_final,
          num_parcelas,
          status_compra,
          stores(name)
        `)
        .eq('colaboradora_id', profileId)
        .order('data_compra', { ascending: false });

      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useColaboradoraParcelas(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.parcelas, profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data: purchases } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select('id')
        .eq('colaboradora_id', profileId);

      const purchaseIds = purchases?.map(p => p.id) || [];
      if (purchaseIds.length === 0) return [];

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .select(`
          id,
          n_parcela,
          competencia,
          valor_parcela,
          status_parcela,
          compra_id,
          purchases(item, stores(name))
        `)
        .in('compra_id', purchaseIds)
        .order('competencia', { ascending: false });

      if (error) throw error;
      return data as Parcela[];
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useColaboradoraGoals(profileId: string | null | undefined, storeId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.goals, profileId, storeId],
    queryFn: async () => {
      if (!profileId || !storeId) return null;

      const today = new Date().toISOString().split('T')[0];

      const { data: bonuses } = await supabase
        .schema('sistemaretiradas')
        .from('bonuses')
        .select('*')
        .eq('store_id', storeId)
        .eq('ativo', true)
        .lte('data_inicio', today)
        .gte('data_fim', today);

      const { data: sales } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor, data_venda')
        .eq('colaboradora_id', profileId)
        .eq('store_id', storeId)
        .gte('data_venda', `${today}T00:00:00`)
        .lte('data_venda', `${today}T23:59:59`);

      const dailySales = sales?.reduce((acc, s) => acc + Number(s.valor), 0) || 0;
      const activeBonus = bonuses?.[0];

      return {
        dailySales,
        activeBonus,
        dailyGoal: activeBonus?.meta_minima ? Number(activeBonus.meta_minima) / 30 : 0,
      };
    },
    enabled: !!profileId && !!storeId,
    staleTime: 1000 * 60,
  });
}

export function useColaboradoraSalesHistory(
  profileId: string | null | undefined,
  storeId: string | null | undefined,
  days = 7
) {
  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'history', profileId, storeId, days],
    queryFn: async () => {
      if (!profileId || !storeId) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('id, valor, data_venda')
        .eq('colaboradora_id', profileId)
        .eq('store_id', storeId)
        .gte('data_venda', startDate.toISOString())
        .order('data_venda', { ascending: false });

      if (error) throw error;

      const grouped = (data || []).reduce((acc, sale) => {
        const date = sale.data_venda.split('T')[0];
        if (!acc[date]) acc[date] = 0;
        acc[date] += Number(sale.valor);
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([date, total]) => ({ date, total }));
    },
    enabled: !!profileId && !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}
