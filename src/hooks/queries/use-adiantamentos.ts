/**
 * React Query hooks for adiantamentos
 * Provides mutations with automatic cache invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ADIANTAMENTOS_QUERY_KEY = ['adiantamentos'] as const;

/**
 * Fetch adiantamentos with optional filters
 */
export function useAdiantamentos(filters?: {
  colaboradora_id?: string;
  status?: string;
  mes_competencia?: string;
}) {
  return useQuery({
    queryKey: [...ADIANTAMENTOS_QUERY_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .schema('sistemaretiradas')
        .from('adiantamentos')
        .select(`
          *,
          profiles!adiantamentos_colaboradora_id_fkey(
            id,
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.colaboradora_id) {
        query = query.eq('colaboradora_id', filters.colaboradora_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.mes_competencia) {
        query = query.eq('mes_competencia', filters.mes_competencia);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Create a new adiantamento with automatic cache invalidation
 */
export function useCreateAdiantamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (adiantamentoData: {
      colaboradora_id: string;
      valor: number;
      mes_competencia: string;
      status?: string;
      aprovado_por_id?: string;
      data_aprovacao?: string;
      observacoes?: string | null;
    }) => {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('adiantamentos')
        .insert({
          colaboradora_id: adiantamentoData.colaboradora_id,
          valor: adiantamentoData.valor,
          mes_competencia: adiantamentoData.mes_competencia,
          status: adiantamentoData.status || 'PENDENTE',
          aprovado_por_id: adiantamentoData.aprovado_por_id || null,
          data_aprovacao: adiantamentoData.data_aprovacao || null,
          observacoes: adiantamentoData.observacoes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all adiantamento-related queries
      queryClient.invalidateQueries({ queryKey: ADIANTAMENTOS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradora'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] }); // For pending count
      toast.success('Adiantamento criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar adiantamento: ' + (error.message || String(error)));
    },
  });
}

/**
 * Update adiantamento status with automatic cache invalidation
 */
export function useUpdateAdiantamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updateData,
    }: {
      id: string;
      updateData: {
        status?: string;
        aprovado_por_id?: string;
        data_aprovacao?: string;
        motivo_recusa?: string;
        descontado_por_id?: string | null;
        data_desconto?: string | null;
      };
    }) => {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('adiantamentos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all adiantamento-related queries
      queryClient.invalidateQueries({ queryKey: ADIANTAMENTOS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradora'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Adiantamento atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar adiantamento: ' + (error.message || String(error)));
    },
  });
}

/**
 * Delete an adiantamento with automatic cache invalidation
 */
export function useDeleteAdiantamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('adiantamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      // Invalidate all adiantamento-related queries
      queryClient.invalidateQueries({ queryKey: ADIANTAMENTOS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradora'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Adiantamento excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir adiantamento: ' + (error.message || String(error)));
    },
  });
}

