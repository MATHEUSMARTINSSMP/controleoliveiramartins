/**
 * Hook customizado para redistribuir metas quando colaboradoras estão de folga
 * Centraliza lógica de cálculo e redistribuição automática
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, getYear, getWeek, startOfWeek } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/hooks/queries/types';

interface UseGoalRedistributionReturn {
  redistributeGoalsForDate: (dataFolga: string) => Promise<boolean>;
  calculateDailyGoal: (data: string) => Promise<{ metaDiaria: number; superMetaDiaria: number } | null>;
  getActiveColaboradoras: (data: string) => Promise<string[]>;
}

interface UseGoalRedistributionOptions {
  storeId: string | null;
}

export function useGoalRedistribution({ storeId }: UseGoalRedistributionOptions): UseGoalRedistributionReturn {
  const queryClient = useQueryClient();
  
  const redistributeGoalsForDate = useCallback(async (dataFolga: string): Promise<boolean> => {
    if (!storeId) {
      console.warn('[useGoalRedistribution] StoreId não fornecido');
      return false;
    }

    try {
      // Buscar todas as colaboradoras ativas da loja
      const { data: colaboradoras, error: colabError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name')
        .eq('store_id', storeId)
        .eq('role', 'COLABORADORA')
        .eq('active', true);

      if (colabError) throw colabError;
      if (!colaboradoras || colaboradoras.length === 0) {
        console.warn('[useGoalRedistribution] Nenhuma colaboradora ativa encontrada');
        return false;
      }

      // Buscar folgas do dia
      const { data: folgas, error: folgasError } = await supabase
        .schema('sistemaretiradas')
        .from('collaborator_off_days')
        .select('colaboradora_id')
        .eq('store_id', storeId)
        .eq('off_date', dataFolga);

      if (folgasError) throw folgasError;

      const colaboradorasEmFolga = new Set(folgas?.map(f => f.colaboradora_id) || []);
      const colaboradorasAtivas = colaboradoras.filter(c => !colaboradorasEmFolga.has(c.id));

      if (colaboradorasAtivas.length === 0) {
        toast.warning('Todas as colaboradoras estão de folga neste dia');
        return false;
      }

      // Buscar meta mensal da loja para o mês da folga
      const dataFolgaObj = new Date(dataFolga);
      const mesReferencia = format(dataFolgaObj, 'yyyyMM');
      
      const { data: metaLoja, error: metaError } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('meta_valor, super_meta_valor, daily_weights')
        .eq('store_id', storeId)
        .eq('mes_referencia', mesReferencia)
        .eq('tipo', 'MENSAL')
        .is('colaboradora_id', null)
        .maybeSingle();

      if (metaError || !metaLoja) {
        console.warn('[useGoalRedistribution] Meta mensal não encontrada para redistribuição');
        return false;
      }

      // Calcular meta do dia usando daily_weights se disponível
      const daysInMonth = new Date(dataFolgaObj.getFullYear(), dataFolgaObj.getMonth() + 1, 0).getDate();
      let metaDiaria = Number(metaLoja.meta_valor) / daysInMonth;
      let superMetaDiaria = Number(metaLoja.super_meta_valor) / daysInMonth;

      if (metaLoja.daily_weights && Object.keys(metaLoja.daily_weights).length > 0) {
        const pesoDia = metaLoja.daily_weights[dataFolga] || 0;
        if (pesoDia > 0) {
          metaDiaria = (Number(metaLoja.meta_valor) * pesoDia) / 100;
          superMetaDiaria = (Number(metaLoja.super_meta_valor) * pesoDia) / 100;
        }
      }

      // Buscar metas das colaboradoras de folga para redistribuir APENAS A META DO DIA
      const colaboradorasEmFolgaIds = Array.from(colaboradorasEmFolga);
      let metaFolgaTotal = 0;
      let superMetaFolgaTotal = 0;
      
      if (colaboradorasEmFolgaIds.length > 0) {
        for (const colabFolgaId of colaboradorasEmFolgaIds) {
          const { data: metaFolga } = await supabase
            .schema('sistemaretiradas')
            .from('goals')
            .select('meta_valor, super_meta_valor, daily_weights')
            .eq('store_id', storeId)
            .eq('colaboradora_id', colabFolgaId)
            .eq('mes_referencia', mesReferencia)
            .eq('tipo', 'INDIVIDUAL')
            .is('semana_referencia', null)
            .maybeSingle();
          
          if (metaFolga) {
            // Calcular APENAS a meta diária da colaboradora de folga (não a mensal)
            let metaDiariaFolga = Number(metaFolga.meta_valor) / daysInMonth;
            let superMetaDiariaFolga = Number(metaFolga.super_meta_valor) / daysInMonth;
            
            if (metaFolga.daily_weights && Object.keys(metaFolga.daily_weights).length > 0) {
              const pesoDia = metaFolga.daily_weights[dataFolga] || 0;
              if (pesoDia > 0) {
                metaDiariaFolga = (Number(metaFolga.meta_valor) * pesoDia) / 100;
                superMetaDiariaFolga = (Number(metaFolga.super_meta_valor) * pesoDia) / 100;
              }
            }
            
            metaFolgaTotal += metaDiariaFolga;
            superMetaFolgaTotal += superMetaDiariaFolga;
          }
        }
      }
      
      // Total a redistribuir = meta do dia da loja + metas do dia das colaboradoras de folga
      const totalMetaRedistribuir = metaDiaria + metaFolgaTotal;
      const totalSuperMetaRedistribuir = superMetaDiaria + superMetaFolgaTotal;
      
      // Redistribuir APENAS A META DO DIA entre as colaboradoras ativas
      const metaPorColaboradora = colaboradorasAtivas.length > 0 ? totalMetaRedistribuir / colaboradorasAtivas.length : 0;
      const superMetaPorColaboradora = colaboradorasAtivas.length > 0 ? totalSuperMetaRedistribuir / colaboradorasAtivas.length : 0;

      // Atualizar metas mensais individuais das colaboradoras ativas
      // Ajustar a meta mensal para que a meta diária calculada inclua a parte redistribuída
      let successCount = 0;
      for (const colab of colaboradorasAtivas) {
        try {
          // Buscar meta mensal individual
          const { data: metaExistente, error: metaExistenteError } = await supabase
            .schema('sistemaretiradas')
            .from('goals')
            .select('id, meta_valor, super_meta_valor, daily_weights')
            .eq('store_id', storeId)
            .eq('colaboradora_id', colab.id)
            .eq('mes_referencia', mesReferencia)
            .eq('tipo', 'INDIVIDUAL')
            .is('semana_referencia', null)
            .maybeSingle();

          if (metaExistenteError && metaExistenteError.code !== 'PGRST116') {
            console.error(`[useGoalRedistribution] Erro ao buscar meta de ${colab.name}:`, metaExistenteError);
            continue;
          }

          if (!metaExistente) {
            console.warn(`[useGoalRedistribution] Meta mensal não encontrada para ${colab.name}`);
            continue;
          }

          // Calcular fator de ajuste baseado em daily_weights
          let fatorDia = 1 / daysInMonth; // Default: proporcional
          if (metaExistente.daily_weights && Object.keys(metaExistente.daily_weights).length > 0) {
            const pesoDia = metaExistente.daily_weights[dataFolga] || 0;
            if (pesoDia > 0) {
              fatorDia = pesoDia / 100;
            }
          }

          // Ajustar meta mensal: adicionar a parte redistribuída convertida para mensal
          // Se o dia tem peso X%, então a parte redistribuída deve aumentar a meta mensal proporcionalmente
          const ajusteMensal = metaPorColaboradora / fatorDia;
          const ajusteSuperMensal = superMetaPorColaboradora / fatorDia;
          
          const novaMetaMensal = Number(metaExistente.meta_valor) + ajusteMensal;
          const novaSuperMetaMensal = Number(metaExistente.super_meta_valor) + ajusteSuperMensal;

          // Atualizar meta mensal
          const { error: updateError } = await supabase
            .schema('sistemaretiradas')
            .from('goals')
            .update({
              meta_valor: novaMetaMensal,
              super_meta_valor: novaSuperMetaMensal
            })
            .eq('id', metaExistente.id);

          if (updateError) {
            console.error(`[useGoalRedistribution] Erro ao atualizar meta de ${colab.name}:`, updateError);
            continue;
          }

          console.log(`[useGoalRedistribution] ✅ Meta redistribuída para ${colab.name}: +R$ ${metaPorColaboradora.toFixed(2)} no dia`);
          successCount++;
        } catch (err: any) {
          console.error(`[useGoalRedistribution] Erro ao processar ${colab.name}:`, err);
        }
      }

      if (successCount > 0) {
        // Invalidar todas as queries relacionadas a goals para atualizar UI automaticamente
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.goals] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.sales] });
        queryClient.invalidateQueries({ queryKey: ['loja'] });
        queryClient.invalidateQueries({ queryKey: ['colaboradora'] });
        
        toast.success(`Metas redistribuídas automaticamente para ${successCount} colaboradora(s) ativa(s)`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[useGoalRedistribution] Erro ao redistribuir metas:', error);
      toast.error('Erro ao redistribuir metas: ' + (error.message || 'Erro desconhecido'));
      return false;
    }
  }, [storeId]);

  const calculateDailyGoal = useCallback(async (data: string): Promise<{ metaDiaria: number; superMetaDiaria: number } | null> => {
    if (!storeId) return null;

    try {
      const dataObj = new Date(data);
      const mesReferencia = format(dataObj, 'yyyyMM');
      
      const { data: metaLoja, error: metaError } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('meta_valor, super_meta_valor, daily_weights')
        .eq('store_id', storeId)
        .eq('mes_referencia', mesReferencia)
        .eq('tipo', 'MENSAL')
        .is('colaboradora_id', null)
        .maybeSingle();

      if (metaError || !metaLoja) return null;

      const daysInMonth = new Date(dataObj.getFullYear(), dataObj.getMonth() + 1, 0).getDate();
      let metaDiaria = Number(metaLoja.meta_valor) / daysInMonth;
      let superMetaDiaria = Number(metaLoja.super_meta_valor) / daysInMonth;

      if (metaLoja.daily_weights && Object.keys(metaLoja.daily_weights).length > 0) {
        const pesoDia = metaLoja.daily_weights[data] || 0;
        if (pesoDia > 0) {
          metaDiaria = (Number(metaLoja.meta_valor) * pesoDia) / 100;
          superMetaDiaria = (Number(metaLoja.super_meta_valor) * pesoDia) / 100;
        }
      }

      return { metaDiaria, superMetaDiaria };
    } catch (error: any) {
      console.error('[useGoalRedistribution] Erro ao calcular meta diária:', error);
      return null;
    }
  }, [storeId]);

  const getActiveColaboradoras = useCallback(async (data: string): Promise<string[]> => {
    if (!storeId) return [];

    try {
      // Buscar todas as colaboradoras ativas
      const { data: colaboradoras, error: colabError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id')
        .eq('store_id', storeId)
        .eq('role', 'COLABORADORA')
        .eq('active', true);

      if (colabError) throw colabError;

      // Buscar folgas do dia
      const { data: folgas, error: folgasError } = await supabase
        .schema('sistemaretiradas')
        .from('collaborator_off_days')
        .select('colaboradora_id')
        .eq('store_id', storeId)
        .eq('off_date', data);

      if (folgasError) throw folgasError;

      const colaboradorasEmFolga = new Set(folgas?.map(f => f.colaboradora_id) || []);
      const colaboradorasAtivas = colaboradoras
        ?.filter(c => !colaboradorasEmFolga.has(c.id))
        .map(c => c.id) || [];

      return colaboradorasAtivas;
    } catch (error: any) {
      console.error('[useGoalRedistribution] Erro ao buscar colaboradoras ativas:', error);
      return [];
    }
  }, [storeId]);

  return {
    redistributeGoalsForDate,
    calculateDailyGoal,
    getActiveColaboradoras,
  };
}

