/**
 * Hook para calcular a meta diária redistribuída quando há colaboradoras de folga
 * 
 * REGRAS:
 * 1. Meta da loja do dia = meta_mensal * peso_do_dia / 100
 * 2. Meta redistribuída = Meta da loja do dia / número de colaboradoras trabalhando
 * 3. Colaboradoras de folga: sua meta do dia vai para os próximos dias DELA (não afeta outras)
 * 4. Colaboradoras trabalhando: cobrem a meta da loja dividida igualmente
 * 5. Meta mensal individual NÃO MUDA - cálculo apenas no frontend
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, getDaysInMonth } from 'date-fns';

interface ColaboradoraGoalInfo {
  colaboradoraId: string;
  colaboradoraName: string;
  isOnLeave: boolean;
  metaDiariaOriginal: number;
  metaDiariaRedistribuida: number;
  metaMensal: number;
}

interface UseRedistributedDailyGoalResult {
  metaDiariaLoja: number;
  metaDiariaLojaRedistribuida: number;
  colaboradorasGoals: ColaboradoraGoalInfo[];
  totalColaboradorasTrabalhando: number;
  totalColaboradorasFolga: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

interface UseRedistributedDailyGoalOptions {
  storeId: string | null;
  date?: string;
}

export function useRedistributedDailyGoal({
  storeId,
  date = format(new Date(), 'yyyy-MM-dd')
}: UseRedistributedDailyGoalOptions): UseRedistributedDailyGoalResult {
  const [isLoading, setIsLoading] = useState(true);
  const [metaDiariaLoja, setMetaDiariaLoja] = useState(0);
  const [colaboradorasGoals, setColaboradorasGoals] = useState<ColaboradoraGoalInfo[]>([]);

  const calculate = useCallback(async () => {
    if (!storeId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const dateObj = new Date(date + 'T12:00:00');
      const mesReferencia = format(dateObj, 'yyyyMM');
      const daysInMonth = getDaysInMonth(dateObj);

      const [
        { data: metaLoja },
        { data: colaboradoras },
        { data: folgas },
        { data: metasIndividuais }
      ] = await Promise.all([
        supabase
          .schema('sistemaretiradas')
          .from('goals')
          .select('meta_valor, super_meta_valor, daily_weights')
          .eq('store_id', storeId)
          .eq('mes_referencia', mesReferencia)
          .eq('tipo', 'MENSAL')
          .is('colaboradora_id', null)
          .maybeSingle(),
        supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .select('id, name')
          .eq('store_id', storeId)
          .eq('role', 'COLABORADORA')
          .eq('active', true),
        supabase
          .schema('sistemaretiradas')
          .from('collaborator_off_days')
          .select('colaboradora_id')
          .eq('store_id', storeId)
          .eq('off_date', date),
        supabase
          .schema('sistemaretiradas')
          .from('goals')
          .select('colaboradora_id, meta_valor, super_meta_valor, daily_weights')
          .eq('store_id', storeId)
          .eq('mes_referencia', mesReferencia)
          .eq('tipo', 'INDIVIDUAL')
          .is('semana_referencia', null)
      ]);

      if (!colaboradoras || colaboradoras.length === 0) {
        setMetaDiariaLoja(0);
        setColaboradorasGoals([]);
        setIsLoading(false);
        return;
      }

      const folgasSet = new Set((folgas || []).map(f => f.colaboradora_id));
      const colaboradorasTrabalhando = colaboradoras.filter(c => !folgasSet.has(c.id));
      const numTrabalhando = colaboradorasTrabalhando.length;

      const metasMap = new Map(
        (metasIndividuais || []).map(m => [m.colaboradora_id, m])
      );

      let metaDiariaLojaCalculada = 0;
      const usandoMetaLoja = metaLoja && Number(metaLoja.meta_valor) > 0;

      const metasIndividuaisMap = new Map<string, number>();
      colaboradoras.forEach(colab => {
        const meta = metasMap.get(colab.id);
        if (meta) {
          let metaDia = Number(meta.meta_valor) / daysInMonth;
          if (meta.daily_weights && Object.keys(meta.daily_weights).length > 0) {
            const pesoDia = (meta.daily_weights as Record<string, number>)[date] || 0;
            if (pesoDia > 0) {
              metaDia = (Number(meta.meta_valor) * pesoDia) / 100;
            }
          }
          metasIndividuaisMap.set(colab.id, metaDia);
        } else {
          metasIndividuaisMap.set(colab.id, 0);
        }
      });

      if (usandoMetaLoja) {
        metaDiariaLojaCalculada = Number(metaLoja.meta_valor) / daysInMonth;
        if (metaLoja.daily_weights && Object.keys(metaLoja.daily_weights).length > 0) {
          const pesoDia = (metaLoja.daily_weights as Record<string, number>)[date] || 0;
          if (pesoDia > 0) {
            metaDiariaLojaCalculada = (Number(metaLoja.meta_valor) * pesoDia) / 100;
          }
        }
      } else {
        let somaTodasMetas = 0;
        metasIndividuaisMap.forEach(valor => {
          somaTodasMetas += valor;
        });
        metaDiariaLojaCalculada = somaTodasMetas;
      }

      setMetaDiariaLoja(metaDiariaLojaCalculada);

      const metaPorColaboradoraTrabalhando = numTrabalhando > 0 ? metaDiariaLojaCalculada / numTrabalhando : 0;

      const goals: ColaboradoraGoalInfo[] = colaboradoras.map(colab => {
        const isOnLeave = folgasSet.has(colab.id);
        const metaIndividual = metasMap.get(colab.id);
        const metaMensal = metaIndividual ? Number(metaIndividual.meta_valor) : 0;
        const metaDiariaOriginal = metasIndividuaisMap.get(colab.id) || 0;

        return {
          colaboradoraId: colab.id,
          colaboradoraName: colab.name,
          isOnLeave,
          metaDiariaOriginal,
          metaDiariaRedistribuida: isOnLeave ? 0 : metaPorColaboradoraTrabalhando,
          metaMensal
        };
      });

      setColaboradorasGoals(goals);
    } catch (error) {
      console.error('[useRedistributedDailyGoal] Erro:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, date]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  const stats = useMemo(() => {
    const trabalhando = colaboradorasGoals.filter(c => !c.isOnLeave);
    const folga = colaboradorasGoals.filter(c => c.isOnLeave);
    const metaRedistribuida = trabalhando.reduce((sum, c) => sum + c.metaDiariaRedistribuida, 0);

    return {
      totalColaboradorasTrabalhando: trabalhando.length,
      totalColaboradorasFolga: folga.length,
      metaDiariaLojaRedistribuida: metaRedistribuida
    };
  }, [colaboradorasGoals]);

  return {
    metaDiariaLoja,
    metaDiariaLojaRedistribuida: stats.metaDiariaLojaRedistribuida,
    colaboradorasGoals,
    totalColaboradorasTrabalhando: stats.totalColaboradorasTrabalhando,
    totalColaboradorasFolga: stats.totalColaboradorasFolga,
    isLoading,
    refetch: calculate
  };
}

export function getRedistributedGoalForColaboradora(
  colaboradoraId: string,
  colaboradorasGoals: ColaboradoraGoalInfo[]
): ColaboradoraGoalInfo | null {
  return colaboradorasGoals.find(c => c.colaboradoraId === colaboradoraId) || null;
}
