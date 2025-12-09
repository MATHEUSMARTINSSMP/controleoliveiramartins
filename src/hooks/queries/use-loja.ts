/**
 * Loja Dashboard Queries Hook
 * Enterprise-grade hooks for store dashboard data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QUERY_KEYS } from './types';
import { format, startOfWeek, getWeek, getYear } from 'date-fns';

interface Sale {
  id: string;
  colaboradora_id: string;
  valor: number;
  qtd_pecas: number;
  data_venda: string;
  observacoes: string | null;
  tiny_order_id: string | null;
  forma_pagamento: string | null;
  colaboradora: {
    name: string;
  };
}

interface Colaboradora {
  id: string;
  name: string;
  active: boolean;
}

interface StoreGoals {
  id: string;
  meta_valor: number;
  mes_referencia: string;
  tipo: string;
  ativo: boolean;
}

interface StoreMetrics {
  totalVendas: number;
  qtdVendas: number;
  qtdPecas: number;
  ticketMedio: number;
  pa: number;
}

interface ColaboradoraPerformance {
  id: string;
  name: string;
  totalVendas: number;
  qtdVendas: number;
  qtdPecas: number;
  ticketMedio: number;
  pa: number;
  metaIndividual: number | null;
  percentualMeta: number;
}

interface RankingItem {
  colaboradoraId: string;
  colaboradoraName: string;
  total: number;
  position: number;
}

interface DailyHistory {
  day: string;
  total: number;
  qtdVendas: number;
  qtdPecas: number;
}

export function useStoreSettings(storeId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.stores, 'settings', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, cashback_ativo, crm_ativo, ponto_ativo, wishlist_ativo, ajustes_condicionais_ativo')
        .eq('id', storeId)
        .maybeSingle(); // ✅ Usar maybeSingle() para evitar erro quando não encontrar

      if (error) {
        console.error('[useStoreSettings] Erro ao buscar store settings:', error);
        throw error;
      }
      
      if (!data) {
        console.warn('[useStoreSettings] Loja não encontrada para storeId:', storeId);
        return null;
      }
      
      return data;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useStoreSales(storeId: string | null | undefined, filterDate?: string) {
  const dateFilter = filterDate || format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'store', storeId, dateFilter],
    queryFn: async (): Promise<Sale[]> => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select(`
          id,
          colaboradora_id,
          valor,
          qtd_pecas,
          data_venda,
          observacoes,
          tiny_order_id,
          forma_pagamento,
          colaboradora:profiles!colaboradora_id(name)
        `)
        .eq('store_id', storeId)
        .gte('data_venda', `${dateFilter}T00:00:00`)
        .lte('data_venda', `${dateFilter}T23:59:59`)
        .order('data_venda', { ascending: false });

      if (error) throw error;
      return (data || []).map((sale: any) => ({
        ...sale,
        colaboradora: sale.colaboradora || { name: 'Desconhecido' },
        forma_pagamento: sale.forma_pagamento || null,
      }));
    },
    enabled: !!storeId,
    staleTime: 1000 * 60,
  });
}

export function useStoreColaboradoras(storeId: string | null | undefined, storeName?: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.profiles, 'colaboradoras', storeId, storeName],
    queryFn: async (): Promise<Colaboradora[]> => {
      if (!storeId) return [];

      console.log('[useStoreColaboradoras] Buscando colaboradoras para storeId:', storeId, 'storeName:', storeName);

      // Estrategia 1: Buscar por store_id (UUID)
      let { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, active, store_id, store_default')
        .eq('role', 'COLABORADORA')
        .eq('active', true)
        .eq('store_id', storeId)
        .order('name');

      if (error) {
        console.error('[useStoreColaboradoras] Erro na busca por store_id:', error);
        throw error;
      }

      console.log('[useStoreColaboradoras] Encontradas por store_id:', data?.length || 0);

      // Se encontrou por store_id, retornar
      if (data && data.length > 0) {
        return data;
      }

      // Estrategia 2: Buscar por store_default (nome da loja)
      if (storeName) {
        console.log('[useStoreColaboradoras] Tentando busca por store_default:', storeName);
        
        const { data: dataByName, error: errorByName } = await supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .select('id, name, active, store_id, store_default')
          .eq('role', 'COLABORADORA')
          .eq('active', true)
          .ilike('store_default', `%${storeName}%`)
          .order('name');

        if (errorByName) {
          console.error('[useStoreColaboradoras] Erro na busca por store_default:', errorByName);
        } else if (dataByName && dataByName.length > 0) {
          console.log('[useStoreColaboradoras] Encontradas por store_default:', dataByName.length);
          return dataByName;
        }
      }

      // Estrategia 3: Buscar todas e filtrar (fallback)
      console.log('[useStoreColaboradoras] Nenhuma encontrada, buscando todas para debug...');
      const { data: allColabs } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, active, store_id, store_default')
        .eq('role', 'COLABORADORA')
        .eq('active', true)
        .order('name');

      console.log('[useStoreColaboradoras] Total de colaboradoras ativas no sistema:', allColabs?.length || 0);
      if (allColabs) {
        allColabs.forEach((c: any) => {
          console.log(`[useStoreColaboradoras]   - ${c.name}: store_id=${c.store_id || 'NULL'}, store_default=${c.store_default || 'NULL'}`);
        });
      }

      return [];
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useStoreGoals(storeId: string | null | undefined) {
  const mesAtual = format(new Date(), 'yyyyMM');

  return useQuery({
    queryKey: [QUERY_KEYS.goals, 'store', storeId, mesAtual],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('*')
        .eq('store_id', storeId)
        .eq('mes_referencia', mesAtual)
        .eq('tipo', 'LOJA')
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      return data as StoreGoals | null;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useStoreMetrics(storeId: string | null | undefined) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'metrics', storeId, today],
    queryFn: async (): Promise<StoreMetrics> => {
      if (!storeId) {
        return { totalVendas: 0, qtdVendas: 0, qtdPecas: 0, ticketMedio: 0, pa: 0 };
      }

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor, qtd_pecas')
        .eq('store_id', storeId)
        .gte('data_venda', `${today}T00:00:00`)
        .lte('data_venda', `${today}T23:59:59`);

      if (error) throw error;

      const sales = data || [];
      const totalVendas = sales.reduce((sum, s) => sum + Number(s.valor || 0), 0);
      const qtdVendas = sales.length;
      const qtdPecas = sales.reduce((sum, s) => sum + Number(s.qtd_pecas || 0), 0);
      const ticketMedio = qtdVendas > 0 ? totalVendas / qtdVendas : 0;
      const pa = qtdVendas > 0 ? qtdPecas / qtdVendas : 0;

      return { totalVendas, qtdVendas, qtdPecas, ticketMedio, pa };
    },
    enabled: !!storeId,
    staleTime: 1000 * 60,
  });
}

export function useStoreMonthlyProgress(storeId: string | null | undefined, metaValor: number = 0) {
  const mesAtual = format(new Date(), 'yyyyMM');
  const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;

  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'monthly-progress', storeId, mesAtual],
    queryFn: async () => {
      if (!storeId) return { realizado: 0, percentual: 0 };

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor')
        .eq('store_id', storeId)
        .gte('data_venda', `${startOfMonth}T00:00:00`);

      if (error) throw error;

      const realizado = (data || []).reduce((sum, s) => sum + Number(s.valor || 0), 0);
      const percentual = metaValor > 0 ? (realizado / metaValor) * 100 : 0;

      return { realizado, percentual };
    },
    enabled: !!storeId,
    staleTime: 1000 * 60,
  });
}

export function useStore7DayHistory(storeId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'history-7d', storeId],
    queryFn: async (): Promise<DailyHistory[]> => {
      if (!storeId) return [];

      const startDate = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('data_venda, valor, qtd_pecas')
        .eq('store_id', storeId)
        .gte('data_venda', `${startDate}T00:00:00`)
        .order('data_venda', { ascending: true });

      if (error) throw error;

      const grouped: Record<string, DailyHistory> = {};
      (data || []).forEach((sale) => {
        const day = sale.data_venda.split('T')[0];
        if (!grouped[day]) {
          grouped[day] = { day, total: 0, qtdVendas: 0, qtdPecas: 0 };
        }
        grouped[day].total += Number(sale.valor || 0);
        grouped[day].qtdVendas += 1;
        grouped[day].qtdPecas += Number(sale.qtd_pecas || 0);
      });

      return Object.values(grouped);
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useStoreColaboradorasPerformance(
  storeId: string | null | undefined,
  colaboradoras: Colaboradora[]
) {
  const mesAtual = format(new Date(), 'yyyyMM');
  const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;

  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'colaboradoras-performance', storeId, mesAtual, colaboradoras.map(c => c.id).join(',')],
    queryFn: async (): Promise<ColaboradoraPerformance[]> => {
      if (!storeId || colaboradoras.length === 0) return [];

      const colaboradoraIds = colaboradoras.map(c => c.id);

      const [salesResult, goalsResult] = await Promise.all([
        supabase
          .schema('sistemaretiradas')
          .from('sales')
          .select('colaboradora_id, valor, qtd_pecas')
          .eq('store_id', storeId)
          .in('colaboradora_id', colaboradoraIds)
          .gte('data_venda', `${startOfMonth}T00:00:00`),
        supabase
          .schema('sistemaretiradas')
          .from('goals')
          .select('colaboradora_id, meta_valor')
          .eq('mes_referencia', mesAtual)
          .eq('tipo', 'INDIVIDUAL')
          .eq('ativo', true)
          .in('colaboradora_id', colaboradoraIds),
      ]);

      if (salesResult.error) throw salesResult.error;

      const goalsMap = new Map(
        (goalsResult.data || []).map((g) => [g.colaboradora_id, Number(g.meta_valor)])
      );

      const performanceMap = new Map<string, ColaboradoraPerformance>();

      colaboradoras.forEach((colab) => {
        performanceMap.set(colab.id, {
          id: colab.id,
          name: colab.name,
          totalVendas: 0,
          qtdVendas: 0,
          qtdPecas: 0,
          ticketMedio: 0,
          pa: 0,
          metaIndividual: goalsMap.get(colab.id) || null,
          percentualMeta: 0,
        });
      });

      (salesResult.data || []).forEach((sale) => {
        const perf = performanceMap.get(sale.colaboradora_id);
        if (perf) {
          perf.totalVendas += Number(sale.valor || 0);
          perf.qtdVendas += 1;
          perf.qtdPecas += Number(sale.qtd_pecas || 0);
        }
      });

      return Array.from(performanceMap.values()).map((perf) => ({
        ...perf,
        ticketMedio: perf.qtdVendas > 0 ? perf.totalVendas / perf.qtdVendas : 0,
        pa: perf.qtdVendas > 0 ? perf.qtdPecas / perf.qtdVendas : 0,
        percentualMeta: perf.metaIndividual ? (perf.totalVendas / perf.metaIndividual) * 100 : 0,
      }));
    },
    enabled: !!storeId && colaboradoras.length > 0,
    staleTime: 1000 * 60,
  });
}

export function useStoreRankingTop3(storeId: string | null | undefined) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekNumber = getWeek(now, { weekStartsOn: 1 });
  const year = getYear(now);

  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'ranking-top3', storeId, year, weekNumber],
    queryFn: async (): Promise<RankingItem[]> => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('colaboradora_id, valor, profiles!colaboradora_id(name)')
        .eq('store_id', storeId)
        .gte('data_venda', weekStart.toISOString());

      if (error) throw error;

      const grouped = (data || []).reduce((acc: Record<string, { name: string; total: number }>, sale: any) => {
        const id = sale.colaboradora_id;
        if (!acc[id]) {
          acc[id] = { name: sale.profiles?.name || 'Desconhecido', total: 0 };
        }
        acc[id].total += Number(sale.valor || 0);
        return acc;
      }, {});

      return Object.entries(grouped)
        .sort(([, a], [, b]) => (b as { total: number }).total - (a as { total: number }).total)
        .slice(0, 3)
        .map(([id, info], index) => ({
          colaboradoraId: id,
          colaboradoraName: (info as { name: string; total: number }).name,
          total: (info as { name: string; total: number }).total,
          position: index + 1,
        }));
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useStoreMonthlyRanking(storeId: string | null | undefined) {
  const mesAtual = format(new Date(), 'yyyyMM');
  const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;

  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'ranking-monthly', storeId, mesAtual],
    queryFn: async (): Promise<RankingItem[]> => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('colaboradora_id, valor, profiles!colaboradora_id(name)')
        .eq('store_id', storeId)
        .gte('data_venda', `${startOfMonth}T00:00:00`);

      if (error) throw error;

      const grouped = (data || []).reduce((acc: Record<string, { name: string; total: number }>, sale: any) => {
        const id = sale.colaboradora_id;
        if (!acc[id]) {
          acc[id] = { name: sale.profiles?.name || 'Desconhecido', total: 0 };
        }
        acc[id].total += Number(sale.valor || 0);
        return acc;
      }, {});

      return Object.entries(grouped)
        .sort(([, a], [, b]) => (b as { total: number }).total - (a as { total: number }).total)
        .map(([id, info], index) => ({
          colaboradoraId: id,
          colaboradoraName: (info as { name: string; total: number }).name,
          total: (info as { name: string; total: number }).total,
          position: index + 1,
        }));
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateSale(storeId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (saleData: {
      colaboradora_id: string;
      valor: number;
      qtd_pecas: number;
      data_venda: string;
      observacoes?: string;
      formas_pagamento?: any[];
    }) => {
      if (!storeId) throw new Error('Store ID is required');

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .insert({
          ...saleData,
          store_id: storeId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.sales] });
      toast({ title: 'Sucesso', description: 'Venda registrada com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível registrar a venda.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.sales] });
      toast({ title: 'Sucesso', description: 'Venda excluída com sucesso!' });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a venda.',
        variant: 'destructive',
      });
    },
  });
}

