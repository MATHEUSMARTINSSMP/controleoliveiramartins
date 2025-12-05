/**
 * Hook customizado para gerenciar folgas de colaboradoras
 * Centraliza lógica de buscar, adicionar e remover folgas
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OffDay {
  id: string;
  colaboradora_id: string;
  store_id: string;
  data_folga: string;
  created_at: string;
}

interface UseFolgasReturn {
  offDays: OffDay[];
  loading: boolean;
  fetchFolgas: (data: string) => Promise<void>;
  toggleFolga: (colaboradoraId: string, dataFolga: string) => Promise<boolean>;
  isOnLeave: (colaboradoraId: string, dataFolga: string) => boolean;
  refetch: () => Promise<void>;
}

interface UseFolgasOptions {
  storeId: string | null;
  date?: string; // Data para buscar folgas (opcional, se não fornecido busca todas)
}

export function useFolgas({ storeId, date }: UseFolgasOptions): UseFolgasReturn {
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState<string | undefined>(date);

  const fetchFolgas = useCallback(async (data?: string) => {
    if (!storeId) {
      setOffDays([]);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .schema('sistemaretiradas')
        .from('collaborator_off_days')
        .select('*')
        .eq('store_id', storeId);

      if (data) {
        query = query.eq('data_folga', data);
      }

      const { data: folgasData, error } = await query.order('data_folga', { ascending: false });

      if (error) throw error;
      setOffDays(folgasData || []);
      setCurrentDate(data);
    } catch (err: any) {
      console.error('[useFolgas] Erro ao buscar folgas:', err);
      toast.error('Erro ao carregar folgas');
      setOffDays([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const toggleFolga = useCallback(async (colaboradoraId: string, dataFolga: string): Promise<boolean> => {
    if (!storeId) {
      toast.error('Erro: ID da loja não identificado');
      return false;
    }

    try {
      // Verificar se já existe folga para essa colaboradora nessa data
      const { data: existingFolga, error: checkError } = await supabase
        .schema('sistemaretiradas')
        .from('collaborator_off_days')
        .select('id')
        .eq('colaboradora_id', colaboradoraId)
        .eq('data_folga', dataFolga)
        .eq('store_id', storeId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingFolga) {
        // Remover folga (desmarcar)
        const { error: deleteError } = await supabase
          .schema('sistemaretiradas')
          .from('collaborator_off_days')
          .delete()
          .eq('id', existingFolga.id);

        if (deleteError) throw deleteError;
        toast.success('Folga removida com sucesso!');
        
        // Atualizar lista local
        setOffDays(prev => prev.filter(f => f.id !== existingFolga.id));
      } else {
        // Adicionar folga (marcar)
        const { data: newFolga, error: insertError } = await supabase
          .schema('sistemaretiradas')
          .from('collaborator_off_days')
          .insert([{
            colaboradora_id: colaboradoraId,
            data_folga: dataFolga,
            store_id: storeId
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        toast.success('Folga marcada com sucesso!');
        
        // Atualizar lista local
        if (newFolga) {
          setOffDays(prev => [...prev, newFolga]);
        }
      }

      return true;
    } catch (error: any) {
      console.error('[useFolgas] Erro ao alterar folga:', error);
      toast.error('Erro ao alterar folga: ' + (error.message || 'Erro desconhecido'));
      return false;
    }
  }, [storeId]);

  const isOnLeave = useCallback((colaboradoraId: string, dataFolga: string): boolean => {
    return offDays.some(
      offDay => offDay.colaboradora_id === colaboradoraId && offDay.data_folga === dataFolga
    );
  }, [offDays]);

  return {
    offDays,
    loading,
    fetchFolgas,
    toggleFolga,
    isOnLeave,
    refetch: () => fetchFolgas(currentDate),
  };
}

