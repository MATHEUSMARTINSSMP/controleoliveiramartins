/**
 * Utilitários para cálculo de totais de vendas
 * 
 * IMPORTANTE: Sempre use estas funções para calcular totais de vendas
 * para evitar duplicação de valores.
 * 
 * Padrão: EXCLUIR a venda atual da query e depois SEMPRE adicionar
 */

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface SalesTotalParams {
    storeId: string;
    currentSaleId?: string; // ID da venda atual para excluir
    currentSaleValue?: number; // Valor da venda atual para adicionar
    date?: Date; // Data para calcular (padrão: hoje)
}

/**
 * Calcula o total de vendas do dia, garantindo que a venda atual
 * seja contada exatamente UMA vez (sem duplicatas)
 * 
 * @param params - Parâmetros para o cálculo
 * @returns Total do dia em reais
 */
export async function calculateDailyTotal(params: SalesTotalParams): Promise<number> {
    const { storeId, currentSaleId, currentSaleValue = 0, date = new Date() } = params;

    const dateStr = format(date, 'yyyy-MM-dd');

    // Buscar vendas do dia EXCLUINDO a venda atual (se fornecida)
    let query = supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor')
        .eq('store_id', storeId)
        .gte('data_venda', `${dateStr}T00:00:00`)
        .lte('data_venda', `${dateStr}T23:59:59`);

    // EXCLUIR a venda atual se fornecida
    if (currentSaleId) {
        query = query.neq('id', currentSaleId);
    }

    const { data: sales, error } = await query;

    if (error) {
        console.error('Erro ao calcular total do dia:', error);
        return currentSaleValue; // Retornar apenas a venda atual em caso de erro
    }

    // Somar todas as vendas (SEM a venda atual)
    const totalWithoutCurrent = sales?.reduce((sum, sale) => sum + parseFloat(sale.valor || '0'), 0) || 0;

    // SEMPRE adicionar a venda atual (se fornecida)
    const total = totalWithoutCurrent + currentSaleValue;

    console.log('📊 [calculateDailyTotal] Total sem venda atual:', totalWithoutCurrent.toFixed(2));
    console.log('📊 [calculateDailyTotal] Venda atual:', currentSaleValue.toFixed(2));
    console.log('📊 [calculateDailyTotal] Total FINAL:', total.toFixed(2));

    return total;
}

/**
 * Calcula o total de vendas do mês, garantindo que a venda atual
 * seja contada exatamente UMA vez (sem duplicatas)
 * 
 * @param params - Parâmetros para o cálculo
 * @returns Total do mês em reais
 */
export async function calculateMonthlyTotal(params: SalesTotalParams): Promise<number> {
    const { storeId, currentSaleId, currentSaleValue = 0, date = new Date() } = params;

    const monthStr = date.toISOString().slice(0, 7); // Formato: yyyy-MM
    const firstDay = `${monthStr}-01T00:00:00`;
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const lastDayStr = format(lastDay, 'yyyy-MM-dd');

    // Buscar vendas do mês EXCLUINDO a venda atual (se fornecida)
    let query = supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor')
        .eq('store_id', storeId)
        .gte('data_venda', firstDay)
        .lte('data_venda', `${lastDayStr}T23:59:59`);

    // EXCLUIR a venda atual se fornecida
    if (currentSaleId) {
        query = query.neq('id', currentSaleId);
    }

    const { data: sales, error } = await query;

    if (error) {
        console.error('Erro ao calcular total do mês:', error);
        return currentSaleValue; // Retornar apenas a venda atual em caso de erro
    }

    // Somar todas as vendas (SEM a venda atual)
    const totalWithoutCurrent = sales?.reduce((sum, sale) => sum + parseFloat(sale.valor || '0'), 0) || 0;

    // SEMPRE adicionar a venda atual (se fornecida)
    const total = totalWithoutCurrent + currentSaleValue;

    console.log('📊 [calculateMonthlyTotal] Total sem venda atual:', totalWithoutCurrent.toFixed(2));
    console.log('📊 [calculateMonthlyTotal] Venda atual:', currentSaleValue.toFixed(2));
    console.log('📊 [calculateMonthlyTotal] Total FINAL:', total.toFixed(2));

    return total;
}

/**
 * Calcula ambos os totais (dia e mês) de uma vez
 * 
 * @param params - Parâmetros para o cálculo
 * @returns Objeto com totalDia e totalMes
 */
export async function calculateSalesTotals(params: SalesTotalParams): Promise<{
    totalDia: number;
    totalMes: number;
}> {
    const [totalDia, totalMes] = await Promise.all([
        calculateDailyTotal(params),
        calculateMonthlyTotal(params),
    ]);

    return { totalDia, totalMes };
}

/**
 * EXEMPLO DE USO:
 * 
 * // Ao criar uma nova venda
 * const { totalDia, totalMes } = await calculateSalesTotals({
 *   storeId: 'store-123',
 *   currentSaleId: 'sale-456',  // ID da venda recém-criada
 *   currentSaleValue: 228.00,   // Valor da venda
 * });
 * 
 * // Usar nos totais do WhatsApp
 * const message = formatVendaMessage({
 *   ...otherParams,
 *   totalDia,
 *   totalMes,
 * });
 */
