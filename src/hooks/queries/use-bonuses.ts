/**
 * Bonuses Queries Hook
 * Enterprise-grade hooks for bonus and goals data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QUERY_KEYS, serializeDateRange, type Bonus, type DateRange } from './types';

export function useBonuses(storeId: string | null | undefined, options?: { activeOnly?: boolean }) {
  const { activeOnly = true } = options ?? {};

  return useQuery({
    queryKey: [QUERY_KEYS.bonuses, storeId, { activeOnly }],
    queryFn: async () => {
      if (!storeId) return [];

      let query = supabase
        .schema('sistemaretiradas')
        .from('bonuses')
        .select('*')
        .eq('store_id', storeId);

      if (activeOnly) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query.order('data_inicio', { ascending: false });
      if (error) throw error;
      return data as Bonus[];
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useActiveBonus(storeId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.bonuses, 'active', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('bonuses')
        .select('*')
        .eq('store_id', storeId)
        .eq('ativo', true)
        .lte('data_inicio', today)
        .gte('data_fim', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Bonus | null;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60,
  });
}

export function useBonusProgress(
  storeId: string | null | undefined,
  colaboradoraId: string | null | undefined,
  dateRange?: DateRange
) {
  const serializedRange = serializeDateRange(dateRange);
  return useQuery({
    queryKey: [QUERY_KEYS.bonuses, 'progress', storeId, colaboradoraId, serializedRange],
    queryFn: async () => {
      if (!storeId || !colaboradoraId) return null;

      const { data: bonus } = await supabase
        .schema('sistemaretiradas')
        .from('bonuses')
        .select('*')
        .eq('store_id', storeId)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!bonus) return null;

      let salesQuery = supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor')
        .eq('colaboradora_id', colaboradoraId)
        .eq('store_id', storeId);

      if (dateRange?.start) {
        salesQuery = salesQuery.gte('data_venda', `${dateRange.start}T00:00:00`);
      } else {
        salesQuery = salesQuery.gte('data_venda', `${bonus.data_inicio}T00:00:00`);
      }

      if (dateRange?.end) {
        salesQuery = salesQuery.lte('data_venda', `${dateRange.end}T23:59:59`);
      } else {
        salesQuery = salesQuery.lte('data_venda', `${bonus.data_fim}T23:59:59`);
      }

      const { data: sales } = await salesQuery;

      const totalSales = sales?.reduce((acc, s) => acc + Number(s.valor), 0) || 0;
      const metaMinima = Number(bonus.meta_minima) || 0;
      const metaMaxima = Number(bonus.meta_maxima) || 0;
      const progress = metaMinima > 0 ? (totalSales / metaMinima) * 100 : 0;

      return {
        bonus,
        totalSales,
        metaMinima,
        metaMaxima,
        progress: Math.min(progress, 100),
        achieved: totalSales >= metaMinima,
        remainingToGoal: Math.max(0, metaMinima - totalSales),
      };
    },
    enabled: !!storeId && !!colaboradoraId,
    staleTime: 1000 * 60,
  });
}

interface CreateBonusData {
  store_id: string;
  mes_referencia: string;
  data_inicio: string;
  data_fim: string;
  meta_minima: number;
  meta_maxima: number;
  tipo?: string;
}

export function useCreateBonus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateBonusData) => {
      const { data: result, error } = await supabase
        .schema('sistemaretiradas')
        .from('bonuses')
        .insert({ ...data, ativo: true })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bonuses] });
      toast({ title: 'Sucesso', description: 'Bônus criado com sucesso!' });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o bônus.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateBonus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Bonus> & { id: string }) => {
      const { data: result, error } = await supabase
        .schema('sistemaretiradas')
        .from('bonuses')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bonuses] });
      toast({ title: 'Sucesso', description: 'Bônus atualizado!' });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o bônus.',
        variant: 'destructive',
      });
    },
  });
}
