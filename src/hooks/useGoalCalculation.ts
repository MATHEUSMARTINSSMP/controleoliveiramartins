import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns';

interface Goal {
  id: string;
  tipo: string;
  mes_referencia: string;
  store_id: string | null;
  colaboradora_id: string | null;
  meta_valor: number;
  super_meta_valor: number;
  ativo: boolean;
  daily_weights?: Record<string, number>;
}

interface SalesData {
  data_venda: string;
  valor: number;
  qtd_pecas: number;
}

interface GoalCalculationResult {
  // Meta mensal
  metaMensal: number;
  superMetaMensal: number;
  
  // Realizado
  realizadoMensal: number;
  percentualMensal: number;
  
  // Meta diária padrão (distribuição simples)
  metaDiariaPadrao: number;
  
  // Meta diária ajustada (considerando déficit/poupança)
  metaDiariaAjustada: number;
  
  // Super meta diária padrão
  superMetaDiariaPadrao: number;
  
  // Super meta diária ajustada
  superMetaDiariaAjustada: number;
  
  // Progresso super meta hoje
  percentualSuperMetaHoje: number;
  
  // Progresso hoje
  progressoHoje: number;
  vendidoHoje: number;
  percentualHoje: number;
  
  // Status
  status: 'ahead' | 'behind' | 'on-track';
  mensagem: string;
  
  // Déficit/Poupança
  deficit: number;
  diasRestantes: number;
  
  // Ritmo necessário
  ritmoNecessario: number;
  
  // Projeção
  projecaoMensal: number;
  
  // Super meta
  necessidadeSuperMeta: number;
  ritmoSuperMeta: number;
}

export const useGoalCalculation = (
  colaboradoraId: string | undefined,
  storeId: string | undefined
): GoalCalculationResult | null => {
  const [result, setResult] = useState<GoalCalculationResult | null>(null);

  useEffect(() => {
    if (!colaboradoraId || !storeId) {
      setResult(null);
      return;
    }

    const calculate = async () => {
      try {
        const hoje = new Date();
        const mesAtual = format(hoje, 'yyyyMM');
        const hojeStr = format(hoje, 'yyyy-MM-dd');

        // 1. Buscar meta individual
        const { data: goal } = await supabase
          .schema("sistemaretiradas")
          .from('goals')
          .select('*')
          .eq('colaboradora_id', colaboradoraId)
          .eq('store_id', storeId)
          .eq('mes_referencia', mesAtual)
          .eq('tipo', 'INDIVIDUAL')
          .single();

        if (!goal) {
          setResult(null);
          return;
        }

        // 2. Buscar vendas do mês
        const inicioMes = startOfMonth(hoje);
        const fimMes = endOfMonth(hoje);
        
        const { data: sales } = await supabase
          .schema("sistemaretiradas")
          .from('sales')
          .select('data_venda, valor, qtd_pecas')
          .eq('colaboradora_id', colaboradoraId)
          .gte('data_venda', format(inicioMes, "yyyy-MM-dd'T'00:00:00"))
          .lte('data_venda', format(fimMes, "yyyy-MM-dd'T'23:59:59"))
          .order('data_venda', { ascending: true });

        const vendas: SalesData[] = (sales || []).map(s => ({
          data_venda: s.data_venda,
          valor: Number(s.valor),
          qtd_pecas: Number(s.qtd_pecas)
        }));

        // 3. Calcular realizado mensal
        const realizadoMensal = vendas.reduce((sum, v) => sum + v.valor, 0);
        const metaMensal = Number(goal.meta_valor);
        const superMetaMensal = Number(goal.super_meta_valor);
        const percentualMensal = metaMensal > 0 ? (realizadoMensal / metaMensal) * 100 : 0;

        // 4. Calcular vendido hoje
        const vendidoHoje = vendas
          .filter(v => v.data_venda.startsWith(hojeStr))
          .reduce((sum, v) => sum + v.valor, 0);

        // 5. Calcular dias do mês e dias restantes (todos os dias, incluindo finais de semana)
        const totalDias = getDaysInMonth(hoje);
        const diaAtual = hoje.getDate();
        const diasRestantes = totalDias - diaAtual;

        // 6. Calcular meta diária padrão usando daily_weights
        let metaDiariaPadrao = metaMensal / totalDias;
        const dailyWeights = goal.daily_weights || {};
        
        if (Object.keys(dailyWeights).length > 0) {
          // Se tem daily_weights, calcular meta do dia atual baseado no peso
          const hojePeso = dailyWeights[hojeStr] || 0;
          metaDiariaPadrao = (metaMensal * hojePeso) / 100;
        }

        // 6.1. Calcular super meta diária padrão
        let superMetaDiariaPadrao = superMetaMensal / totalDias;
        if (Object.keys(dailyWeights).length > 0) {
          const hojePeso = dailyWeights[hojeStr] || 0;
          superMetaDiariaPadrao = (superMetaMensal * hojePeso) / 100;
        }

        // 7. Calcular déficit acumulado ATÉ ONTEM (considerando daily_weights)
        // CORREÇÃO: Calcular meta esperada ATÉ ONTEM (dia 1 até dia-1, não inclui hoje)
        let deficit = 0;
        const diasRestantesComHoje = diasRestantes + 1; // Inclui hoje na distribuição
        
        const metaEsperadaAteOntem = goal.daily_weights && Object.keys(goal.daily_weights).length > 0
          ? (() => {
              // Somar metas esperadas até ONTEM usando daily_weights
              let soma = 0;
              for (let dia = 1; dia < diaAtual; dia++) {
                const dataDia = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
                const dataStr = format(dataDia, 'yyyy-MM-dd');
                const peso = dailyWeights[dataStr] || 0;
                soma += (metaMensal * peso) / 100;
              }
              return soma;
            })()
          : metaDiariaPadrao * (diaAtual - 1); // Distribuição simples até ontem

        // Calcular vendido acumulado total no mês (para comparar com metaEsperadaAteOntem)
        const vendidoMes = vendas.reduce((sum, v) => sum + v.valor, 0);

        deficit = Math.max(0, metaEsperadaAteOntem - vendidoMes);

        // 8. Calcular meta diária ajustada
        // CORREÇÃO: Distribuir déficit incluindo HOJE nos dias restantes
        let metaDiariaAjustada = metaDiariaPadrao;
        
        if (diasRestantesComHoje > 0 && deficit > 0) {
          // Se está atrasada, distribuir déficit nos dias restantes INCLUINDO hoje
          metaDiariaAjustada = metaDiariaPadrao + (deficit / diasRestantesComHoje);
        }

        // 8.1. Calcular super meta diária ajustada (mesma lógica corrigida)
        let superMetaDiariaAjustada = superMetaDiariaPadrao;
        const metaEsperadaSuperMetaAteOntem = goal.daily_weights && Object.keys(goal.daily_weights).length > 0
          ? (() => {
              let soma = 0;
              for (let dia = 1; dia < diaAtual; dia++) {
                const dataDia = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
                const dataStr = format(dataDia, 'yyyy-MM-dd');
                const peso = dailyWeights[dataStr] || 0;
                soma += (superMetaMensal * peso) / 100;
              }
              return soma;
            })()
          : superMetaDiariaPadrao * (diaAtual - 1);
        const deficitSuperMeta = Math.max(0, metaEsperadaSuperMetaAteOntem - vendidoMes);

        if (diasRestantesComHoje > 0 && deficitSuperMeta > 0) {
          superMetaDiariaAjustada = superMetaDiariaPadrao + (deficitSuperMeta / diasRestantesComHoje);
        }

        // 9. Calcular progresso hoje
        const percentualHoje = metaDiariaAjustada > 0 ? (vendidoHoje / metaDiariaAjustada) * 100 : 0;
        const percentualSuperMetaHoje = superMetaDiariaAjustada > 0 ? (vendidoHoje / superMetaDiariaAjustada) * 100 : 0;

        // 10. Determinar status
        let status: 'ahead' | 'behind' | 'on-track' = 'on-track';
        let mensagem = '';

        if (deficit > 0) {
          status = 'behind';
          const deficitFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deficit);
          const metaAjustadaFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metaDiariaAjustada);
          mensagem = `Você está ${deficitFormatted} atrás. Precisa vender ${metaAjustadaFormatted}/dia para recuperar.`;
        } else if (deficit < -metaDiariaPadrao * 2) {
          status = 'ahead';
          const poupancaFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(deficit));
          mensagem = `Parabéns! Você está ${poupancaFormatted} à frente da meta. Continue assim!`;
        } else {
          status = 'on-track';
          mensagem = 'Você está no ritmo certo! Continue assim.';
        }

        // 11. Calcular ritmo necessário
        const ritmoNecessario = diasRestantes > 0 
          ? (metaMensal - realizadoMensal) / diasRestantes
          : 0;

        // 12. Calcular projeção mensal
        const mediaDiaria = diaAtual > 0 ? realizadoMensal / diaAtual : 0;
        const projecaoMensal = mediaDiaria * totalDias;

        // 13. Calcular necessidade para super meta
        const restanteSuperMeta = superMetaMensal - realizadoMensal;
        const necessidadeSuperMeta = diasRestantes > 0 
          ? restanteSuperMeta / diasRestantes
          : 0;
        const ritmoSuperMeta = diasRestantes > 0
          ? restanteSuperMeta / diasRestantes
          : 0;

        setResult({
          metaMensal,
          superMetaMensal,
          realizadoMensal,
          percentualMensal,
          metaDiariaPadrao,
          metaDiariaAjustada,
          superMetaDiariaPadrao,
          superMetaDiariaAjustada,
          progressoHoje: vendidoHoje,
          vendidoHoje,
          percentualHoje,
          percentualSuperMetaHoje,
          status,
          mensagem,
          deficit,
          diasRestantes,
          ritmoNecessario,
          projecaoMensal,
          necessidadeSuperMeta,
          ritmoSuperMeta
        });

      } catch (error) {
        console.error('Error calculating goal:', error);
        setResult(null);
      }
    };

    calculate();
  }, [colaboradoraId, storeId]);

  return result;
};

