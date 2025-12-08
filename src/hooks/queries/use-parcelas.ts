/**
 * React Query hooks for parcelas
 * Provides mutations with automatic cache invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PARCELAS_QUERY_KEY = ['parcelas'] as const;

/**
 * Fetch parcelas with optional filters
 */
export function useParcelas(filters?: {
  colaboradora_id?: string;
  loja_id?: string;
  competencia?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: [...PARCELAS_QUERY_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .select(`
          *,
          purchases!inner(
            id,
            colaboradora_id,
            item,
            num_parcelas,
            data_compra,
            preco_final,
            loja_id
          )
        `)
        .order('competencia', { ascending: true })
        .order('n_parcela', { ascending: true });

      if (filters?.colaboradora_id) {
        query = query.eq('purchases.colaboradora_id', filters.colaboradora_id);
      }
      if (filters?.loja_id) {
        query = query.eq('purchases.loja_id', filters.loja_id);
      }
      if (filters?.competencia) {
        query = query.eq('competencia', filters.competencia);
      }
      if (filters?.status) {
        query = query.eq('status_parcela', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles separately for better performance
      const colaboradoraIds = [...new Set((data || []).map((p: any) => p.purchases?.colaboradora_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name')
        .in('id', colaboradoraIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      // Format data with collaborator names
      return (data || []).map((p: any) => ({
        ...p,
        purchases: {
          ...p.purchases,
          profiles: {
            name: profilesMap.get(p.purchases?.colaboradora_id) || 'Desconhecido',
          },
        },
      }));
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Update parcela status with automatic cache invalidation
 */
export function useUpdateParcela() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updateData,
    }: {
      id: string;
      updateData: {
        status_parcela?: string;
        data_baixa?: string | null;
        valor_parcela?: number;
      };
    }) => {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all parcela-related queries
      queryClient.invalidateQueries({ queryKey: PARCELAS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradora'] });
      toast.success('Parcela atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar parcela: ' + (error.message || String(error)));
    },
  });
}

/**
 * Delete a parcela with automatic cache invalidation
 */
export function useDeleteParcela() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      // Invalidate all parcela-related queries
      queryClient.invalidateQueries({ queryKey: PARCELAS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradora'] });
      toast.success('Parcela excluída com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir parcela: ' + (error.message || String(error)));
    },
  });
}

