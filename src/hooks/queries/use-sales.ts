/**
 * Sales Queries Hook
 * Enterprise-grade hooks for sales data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QUERY_KEYS, serializeDateRange, type Sale, type DateRange } from './types';

interface SalesFilters {
  storeId?: string;
  colaboradoraId?: string;
  dateRange?: DateRange;
}

export function useSales(filters: SalesFilters) {
  const { storeId, colaboradoraId, dateRange } = filters;
  const serializedRange = serializeDateRange(dateRange);

  return useQuery({
    queryKey: [QUERY_KEYS.sales, { storeId, colaboradoraId, dateRange: serializedRange }],
    queryFn: async () => {
      let query = supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select(`
          id,
          colaboradora_id,
          store_id,
          data_venda,
          valor,
          comissao,
          profiles!sales_colaboradora_id_fkey(name),
          stores(name)
        `);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }
      if (colaboradoraId) {
        query = query.eq('colaboradora_id', colaboradoraId);
      }
      if (dateRange?.start) {
        query = query.gte('data_venda', `${dateRange.start}T00:00:00`);
      }
      if (dateRange?.end) {
        query = query.lte('data_venda', `${dateRange.end}T23:59:59`);
      }

      const { data, error } = await query.order('data_venda', { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!(storeId || colaboradoraId),
    staleTime: 1000 * 60,
  });
}

export function useSalesStats(storeId: string | null | undefined, dateRange?: DateRange) {
  const serializedRange = serializeDateRange(dateRange);
  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'stats', storeId, serializedRange],
    queryFn: async () => {
      if (!storeId) return null;

      let query = supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor, data_venda, colaboradora_id')
        .eq('store_id', storeId);

      if (dateRange?.start) {
        query = query.gte('data_venda', `${dateRange.start}T00:00:00`);
      }
      if (dateRange?.end) {
        query = query.lte('data_venda', `${dateRange.end}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalSales = data?.reduce((acc, s) => acc + Number(s.valor), 0) || 0;
      const salesCount = data?.length || 0;
      const avgTicket = salesCount > 0 ? totalSales / salesCount : 0;
      const uniqueSellers = new Set(data?.map(s => s.colaboradora_id)).size;

      return {
        totalSales,
        salesCount,
        avgTicket,
        uniqueSellers,
      };
    },
    enabled: !!storeId,
    staleTime: 1000 * 60,
  });
}

export function useSalesRanking(storeId: string | null | undefined, dateRange?: DateRange, limit = 10) {
  const serializedRange = serializeDateRange(dateRange);
  return useQuery({
    queryKey: [QUERY_KEYS.sales, 'ranking', storeId, serializedRange, limit],
    queryFn: async () => {
      if (!storeId) return [];

      let query = supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select(`
          colaboradora_id,
          valor,
          profiles!sales_colaboradora_id_fkey(name)
        `)
        .eq('store_id', storeId);

      if (dateRange?.start) {
        query = query.gte('data_venda', `${dateRange.start}T00:00:00`);
      }
      if (dateRange?.end) {
        query = query.lte('data_venda', `${dateRange.end}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = (data || []).reduce((acc, sale) => {
        const id = sale.colaboradora_id;
        if (!acc[id]) {
          acc[id] = {
            colaboradoraId: id,
            name: (sale.profiles as { name: string } | null)?.name || 'Desconhecido',
            total: 0,
            count: 0,
          };
        }
        acc[id].total += Number(sale.valor);
        acc[id].count += 1;
        return acc;
      }, {} as Record<string, { colaboradoraId: string; name: string; total: number; count: number }>);

      const values = Object.values(grouped) as { colaboradoraId: string; name: string; total: number; count: number }[];
      return values
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
        .map((item, index) => ({ ...item, rank: index + 1 }));
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}

interface CreateSaleData {
  colaboradora_id: string;
  store_id: string;
  data_venda: string;
  valor: number;
  comissao?: number;
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSaleData) => {
      const { data: result, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.sales] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.kpis] });
      toast({ title: 'Sucesso', description: 'Venda registrada com sucesso!' });
    },
    onError: () => {
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível registrar a venda.',
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.kpis] });
      toast({ title: 'Sucesso', description: 'Venda removida com sucesso!' });
    },
    onError: () => {
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível remover a venda.',
        variant: 'destructive',
      });
    },
  });
}
