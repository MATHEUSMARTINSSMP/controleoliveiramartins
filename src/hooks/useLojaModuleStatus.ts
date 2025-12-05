/**
 * Hook para verificar status de módulos da loja
 * Retorna quais módulos estão ativos (wishlist, ponto, cashback, crm)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ModuleStatus {
  wishlistAtivo: boolean;
  pontoAtivo: boolean;
  cashbackAtivo: boolean;
  crmAtivo: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useLojaModuleStatus(storeId: string | null): ModuleStatus {
  const [wishlistAtivo, setWishlistAtivo] = useState<boolean>(false);
  const [pontoAtivo, setPontoAtivo] = useState<boolean>(false);
  const [cashbackAtivo, setCashbackAtivo] = useState<boolean>(false);
  const [crmAtivo, setCrmAtivo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchModuleStatus = useCallback(async () => {
    if (!storeId) {
      setWishlistAtivo(false);
      setPontoAtivo(false);
      setCashbackAtivo(false);
      setCrmAtivo(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('wishlist_ativo, ponto_ativo, cashback_ativo, crm_ativo')
        .eq('id', storeId)
        .single();

      if (error) throw error;

      setWishlistAtivo(data?.wishlist_ativo || false);
      setPontoAtivo(data?.ponto_ativo || false);
      setCashbackAtivo(data?.cashback_ativo || false);
      setCrmAtivo(data?.crm_ativo || false);
    } catch (err: any) {
      console.error('[useLojaModuleStatus] Erro ao buscar status dos módulos:', err);
      setWishlistAtivo(false);
      setPontoAtivo(false);
      setCashbackAtivo(false);
      setCrmAtivo(false);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchModuleStatus();
  }, [fetchModuleStatus]);

  return {
    wishlistAtivo,
    pontoAtivo,
    cashbackAtivo,
    crmAtivo,
    loading,
    refetch: fetchModuleStatus,
  };
}

