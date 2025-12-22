/**
 * React Query hooks for purchases (compras)
 * Provides mutations with automatic cache invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PURCHASES_QUERY_KEY = ['purchases'] as const;

/**
 * Fetch purchases with optional filters
 */
export function usePurchases(filters?: {
  colaboradora_id?: string;
  loja_id?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: [...PURCHASES_QUERY_KEY, filters],
    queryFn: async () => {
      let query = supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select(`
          *,
          parcelas(
            id,
            n_parcela,
            competencia,
            valor_parcela,
            status_parcela,
            data_baixa
          )
        `)
        .order('data_compra', { ascending: false });

      if (filters?.colaboradora_id) {
        query = query.eq('colaboradora_id', filters.colaboradora_id);
      }
      if (filters?.loja_id) {
        query = query.eq('loja_id', filters.loja_id);
      }
      if (filters?.status) {
        query = query.eq('status_compra', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Create a new purchase with automatic cache invalidation
 */
export function useCreatePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchaseData: {
      colaboradora_id: string;
      loja_id: string;
      data_compra: string;
      item: string;
      preco_venda: number;
      desconto_beneficio: number;
      preco_final: number;
      num_parcelas: number;
      status_compra?: string;
      observacoes?: string | null;
      created_by_id: string;
      parcelas: Array<{
        compra_id: string;
        n_parcela: number;
        competencia: string;
        valor_parcela: number;
        status_parcela: string;
      }>;
    }) => {
      // Insert purchase (compras de colaboradoras - sem cliente_id)
      const insertData = {
        colaboradora_id: purchaseData.colaboradora_id,
        loja_id: purchaseData.loja_id,
        data_compra: purchaseData.data_compra,
        item: purchaseData.item,
        preco_venda: purchaseData.preco_venda,
        desconto_beneficio: purchaseData.desconto_beneficio,
        preco_final: purchaseData.preco_final,
        num_parcelas: purchaseData.num_parcelas,
        status_compra: purchaseData.status_compra || 'PENDENTE',
        observacoes: purchaseData.observacoes || null,
        created_by_id: purchaseData.created_by_id,
      };

      const { data: purchase, error: purchaseError } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .insert(insertData)
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Insert parcelas with the correct compra_id
      const parcelasWithCompraId = purchaseData.parcelas.map(parcela => ({
        ...parcela,
        compra_id: purchase.id, // Use the newly created purchase ID
      }));

      const { error: parcelasError } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .insert(parcelasWithCompraId);

      if (parcelasError) throw parcelasError;

      return purchase;
    },
    onSuccess: () => {
      // Invalidate all purchase-related queries
      queryClient.invalidateQueries({ queryKey: PURCHASES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['parcelas'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradora'] }); // For dashboard updates
      
      // Invalidate sales and daily revenue queries (for ERP integration)
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['loja'] }); // For store dashboard metrics
      
      toast.success('Compra criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar compra: ' + (error.message || String(error)));
    },
  });
}

/**
 * Delete a purchase with automatic cache invalidation
 */
export function useDeletePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ purchaseId, deleteParcelas = true }: { purchaseId: string; deleteParcelas?: boolean }) => {
      // Delete parcelas first if requested
      if (deleteParcelas) {
        const { error: parcelasError } = await supabase
          .schema('sistemaretiradas')
          .from('parcelas')
          .delete()
          .eq('compra_id', purchaseId);

        if (parcelasError) throw parcelasError;
      }

      // Delete purchase
      const { error: purchaseError } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (purchaseError) throw purchaseError;

      return { purchaseId };
    },
    onSuccess: () => {
      // Invalidate all purchase-related queries
      queryClient.invalidateQueries({ queryKey: PURCHASES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['parcelas'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      queryClient.invalidateQueries({ queryKey: ['colaboradora'] });
      toast.success('Compra excluída com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir compra: ' + (error.message || String(error)));
    },
  });
}

