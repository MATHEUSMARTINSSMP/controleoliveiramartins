/**
 * Hook customizado para gerenciar Lista de Desejos
 * Centraliza lógica de busca, criação, atualização e exclusão de itens
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WishlistItem {
  id: string;
  store_id: string;
  cliente_nome: string;
  produto: string;
  especificacao: string | null;
  telefone: string;
  cpf_cnpj: string | null;
  contact_id: string | null;
  data_cadastro: string;
  data_limite_aviso: string | null;
  contact?: {
    id: string;
    nome: string;
    telefone: string | null;
  };
}

interface UseWishlistOptions {
  storeId: string | null;
  searchTerm?: string;
  autoFetch?: boolean;
}

interface UseWishlistReturn {
  items: WishlistItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createItem: (data: Omit<WishlistItem, 'id' | 'data_cadastro'>) => Promise<boolean>;
  updateItem: (id: string, data: Partial<WishlistItem>) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  searchByProduct: (product: string) => Promise<WishlistItem[]>;
}

export function useWishlist({
  storeId,
  searchTerm = '',
  autoFetch = true
}: UseWishlistOptions): UseWishlistReturn {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!storeId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .schema('sistemaretiradas')
        .from('wishlist_items')
        .select(`
          *,
          contact:contacts(id, nome, telefone)
        `)
        .eq('store_id', storeId)
        .order('data_cadastro', { ascending: false });

      if (searchTerm && searchTerm.trim().length > 0) {
        query = query.ilike('produto', `%${searchTerm.trim()}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setItems(data || []);
    } catch (err: any) {
      console.error('[useWishlist] Erro ao buscar itens:', err);
      setError(err.message || 'Erro ao carregar lista de desejos');
      toast.error('Erro ao carregar lista de desejos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, searchTerm]);

  const createItem = useCallback(async (data: Omit<WishlistItem, 'id' | 'data_cadastro'>): Promise<boolean> => {
    if (!storeId) {
      toast.error('Loja não identificada');
      return false;
    }

    try {
      const { error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('wishlist_items')
        .insert([{
          ...data,
          store_id: storeId
        }]);

      if (insertError) throw insertError;

      toast.success('Item adicionado à lista de desejos');
      
      // Atualizar lista localmente
      await fetchItems();
      
      return true;
    } catch (err: any) {
      console.error('[useWishlist] Erro ao criar item:', err);
      toast.error(err.message || 'Erro ao adicionar item');
      return false;
    }
  }, [storeId, fetchItems]);

  const updateItem = useCallback(async (id: string, data: Partial<WishlistItem>): Promise<boolean> => {
    if (!storeId) {
      toast.error('Loja não identificada');
      return false;
    }

    try {
      const { error: updateError } = await supabase
        .schema('sistemaretiradas')
        .from('wishlist_items')
        .update(data)
        .eq('id', id)
        .eq('store_id', storeId);

      if (updateError) throw updateError;

      toast.success('Item atualizado com sucesso');
      
      // Atualizar lista localmente
      await fetchItems();
      
      return true;
    } catch (err: any) {
      console.error('[useWishlist] Erro ao atualizar item:', err);
      toast.error(err.message || 'Erro ao atualizar item');
      return false;
    }
  }, [storeId, fetchItems]);

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    if (!storeId) {
      toast.error('Loja não identificada');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .schema('sistemaretiradas')
        .from('wishlist_items')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId);

      if (deleteError) throw deleteError;

      toast.success('Item removido com sucesso');
      
      // Atualizar lista localmente
      await fetchItems();
      
      return true;
    } catch (err: any) {
      console.error('[useWishlist] Erro ao deletar item:', err);
      toast.error(err.message || 'Erro ao remover item');
      return false;
    }
  }, [storeId, fetchItems]);

  const searchByProduct = useCallback(async (product: string): Promise<WishlistItem[]> => {
    if (!storeId || !product || product.trim().length < 1) {
      return [];
    }

    try {
      const searchLower = product.toLowerCase().trim();

      const { data, error: searchError } = await supabase
        .schema('sistemaretiradas')
        .from('wishlist_items')
        .select(`
          *,
          contact:contacts(id, nome, telefone)
        `)
        .eq('store_id', storeId)
        .ilike('produto', `%${searchLower}%`)
        .order('data_cadastro', { ascending: false })
        .limit(50);

      if (searchError) throw searchError;

      return data || [];
    } catch (err: any) {
      console.error('[useWishlist] Erro ao buscar produto:', err);
      toast.error('Erro ao buscar produto');
      return [];
    }
  }, [storeId]);

  useEffect(() => {
    if (autoFetch) {
      fetchItems();
    }
  }, [autoFetch, fetchItems]);

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
    createItem,
    updateItem,
    deleteItem,
    searchByProduct
  };
}


