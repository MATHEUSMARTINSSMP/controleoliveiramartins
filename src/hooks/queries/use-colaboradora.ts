/**
 * Colaboradora Queries Hook
 * Enterprise-grade hooks for colaboradora dashboard data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QUERY_KEYS, type Adiantamento, type Purchase, type Parcela } from './types';

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

      const mesAtual = new Date().toISOString().slice(0, 7);

      const [profileResult, purchasesResult, adiantamentosResult] = await Promise.all([
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
        supabase
          .schema('sistemaretiradas')
          .from('adiantamentos')
          .select('valor, status, competencia')
          .eq('colaboradora_id', profileId)
          .in('status', ['PENDENTE', 'APROVADO']),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (purchasesResult.error) throw purchasesResult.error;

      const profileData = profileResult.data;
      const purchases = purchasesResult.data || [];
      const adiantamentos = adiantamentosResult.data || [];
      const purchaseIds = purchases.map(p => p.id);

      const adiantamentosTotalPendente = adiantamentos
        .reduce((acc, a) => acc + Number(a.valor || 0), 0);

      const adiantamentosMesPendente = adiantamentos
        .filter(a => a.competencia === mesAtual)
        .reduce((acc, a) => acc + Number(a.valor || 0), 0);

      const limiteTotal = Number(profileData?.limite_total) || 0;
      const limiteMensal = Number(profileData?.limite_mensal) || 0;
      
      if (purchaseIds.length === 0) {
        return {
          totalPendente: adiantamentosTotalPendente,
          proximasParcelas: adiantamentosMesPendente,
          totalPago: 0,
          limiteTotal,
          limiteDisponivel: Math.max(0, limiteTotal - adiantamentosTotalPendente),
          limiteMensal,
          limiteDisponivelMensal: Math.max(0, limiteMensal - adiantamentosMesPendente),
        };
      }
      
      const { data: parcelas, error: parcelasError } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .select('valor_parcela, status_parcela, compra_id, competencia')
        .in('compra_id', purchaseIds);

      if (parcelasError) throw parcelasError;

      const minhasParcelas = parcelas || [];

      const parcelasPendentes = minhasParcelas
        .filter(p => p.status_parcela === 'PENDENTE')
        .reduce((acc, p) => acc + Number(p.valor_parcela || 0), 0);

      const totalPago = minhasParcelas
        .filter(p => p.status_parcela === 'PAGO')
        .reduce((acc, p) => acc + Number(p.valor_parcela || 0), 0);

      const parcelasMesPendentes = minhasParcelas
        .filter(p => p.competencia === mesAtual && p.status_parcela === 'PENDENTE')
        .reduce((acc, p) => acc + Number(p.valor_parcela || 0), 0);

      const totalPendente = parcelasPendentes + adiantamentosTotalPendente;
      const proximasParcelas = parcelasMesPendentes + adiantamentosMesPendente;

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

export function useCancelAdiantamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ adiantamentoId, colaboradoraId }: { adiantamentoId: string; colaboradoraId: string }) => {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('adiantamentos')
        .update({ status: 'CANCELADO' })
        .eq('id', adiantamentoId)
        .eq('colaboradora_id', colaboradoraId)
        .eq('status', 'PENDENTE');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.adiantamentos] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.kpis] });
      toast({ title: 'Sucesso', description: 'Adiantamento cancelado com sucesso!' });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar o adiantamento.',
        variant: 'destructive',
      });
    },
  });
}

export interface ColaboradoraPerformance {
  goal: {
    id: string;
    meta_valor: number;
    mes_referencia: string;
    tipo: string;
  } | null;
  totalMes: number;
  totalHoje: number;
  qtdVendasHoje: number;
  qtdPecasHoje: number;
  ticketMedioHoje: number;
  paHoje: number;
  percentualMeta: number;
  dailyGoal: number;
  dailyProgress: number;
  ranking: number | null;
}

export function useColaboradoraPerformance(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'performance', profileId],
    queryFn: async (): Promise<ColaboradoraPerformance | null> => {
      if (!profileId) return null;

      const now = new Date();
      const mesAtual = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];
      const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      const [goalResult, salesMonthResult, salesTodayResult, rankingResult] = await Promise.all([
        supabase
          .schema('sistemaretiradas')
          .from('goals')
          .select('id, meta_valor, mes_referencia, tipo')
          .eq('colaboradora_id', profileId)
          .eq('mes_referencia', mesAtual)
          .eq('tipo', 'INDIVIDUAL')
          .maybeSingle(),
        supabase
          .schema('sistemaretiradas')
          .from('sales')
          .select('valor, qtd_pecas')
          .eq('colaboradora_id', profileId)
          .gte('data_venda', `${startOfMonth}T00:00:00`),
        supabase
          .schema('sistemaretiradas')
          .from('sales')
          .select('valor, qtd_pecas')
          .eq('colaboradora_id', profileId)
          .gte('data_venda', `${today}T00:00:00`)
          .lte('data_venda', `${today}T23:59:59`),
        supabase
          .schema('sistemaretiradas')
          .from('sales')
          .select('colaboradora_id, valor')
          .gte('data_venda', `${startOfMonth}T00:00:00`),
      ]);

      const goal = goalResult.data;
      const salesMonth = salesMonthResult.data || [];
      const salesToday = salesTodayResult.data || [];
      const rankingData = rankingResult.data || [];

      const totalMes = salesMonth.reduce((sum, s) => sum + Number(s.valor || 0), 0);
      const totalHoje = salesToday.reduce((sum, s) => sum + Number(s.valor || 0), 0);
      const qtdVendasHoje = salesToday.length;
      const qtdPecasHoje = salesToday.reduce((sum, s) => sum + Number(s.qtd_pecas || 0), 0);
      const ticketMedioHoje = qtdVendasHoje > 0 ? totalHoje / qtdVendasHoje : 0;
      const paHoje = qtdVendasHoje > 0 ? qtdPecasHoje / qtdVendasHoje : 0;

      const metaValor = Number(goal?.meta_valor || 0);
      const percentualMeta = metaValor > 0 ? (totalMes / metaValor) * 100 : 0;
      const dailyGoal = metaValor > 0 ? metaValor / daysInMonth : 0;
      const dailyProgress = dailyGoal > 0 ? (totalHoje / dailyGoal) * 100 : 0;

      const grouped = rankingData.reduce((acc, sale) => {
        acc[sale.colaboradora_id] = (acc[sale.colaboradora_id] || 0) + Number(sale.valor || 0);
        return acc;
      }, {} as Record<string, number>);
      
      const sortedIds = Object.keys(grouped).sort((a, b) => grouped[b] - grouped[a]);
      const ranking = sortedIds.indexOf(profileId) + 1;

      return {
        goal,
        totalMes,
        totalHoje,
        qtdVendasHoje,
        qtdPecasHoje,
        ticketMedioHoje,
        paHoje,
        percentualMeta,
        dailyGoal,
        dailyProgress,
        ranking: ranking > 0 ? ranking : null,
      };
    },
    enabled: !!profileId,
    staleTime: 1000 * 60,
  });
}
