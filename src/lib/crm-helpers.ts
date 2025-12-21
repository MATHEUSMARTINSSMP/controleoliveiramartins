import { supabase } from '@/integrations/supabase/client';
import { addDays, format } from 'date-fns';

/**
 * Cria automaticamente uma pós-venda agendada quando uma venda é registrada
 * @param saleId ID da venda criada
 * @param storeId ID da loja
 * @param colaboradoraId ID da colaboradora que fez a venda
 * @param clienteNome Nome do cliente (pode ser null se não houver)
 * @param saleDate Data da venda
 * @param daysUntilFollowUp Número de dias até o follow-up (padrão: 7 dias)
 */
export async function createPostSaleFromSale(
  saleId: string,
  storeId: string,
  colaboradoraId: string | null,
  clienteNome: string | null,
  saleDate: string,
  daysUntilFollowUp: number = 7
): Promise<void> {
  try {
    // Verificar se o CRM está ativo para esta loja
    const { data: storeData, error: storeError } = await supabase
      .schema('sistemaretiradas')
      .from('stores')
      .select('crm_ativo')
      .eq('id', storeId)
      .single();

    if (storeError || !storeData?.crm_ativo) {
      // CRM não está ativo para esta loja, não criar pós-venda
      console.log('[createPostSaleFromSale] CRM não está ativo para esta loja, pulando criação de pós-venda');
      return;
    }

    // Se não houver nome do cliente, tentar buscar do tiny_order ou usar um padrão
    let clienteNomeFinal = clienteNome || 'Cliente não identificado';

    // Se a venda veio do ERP (Tiny), tentar buscar nome do cliente
    // ✅ Usar external_order_id + order_source (nova estrutura genérica)
    if (!clienteNome) {
      const { data: saleData } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('external_order_id, order_source, tiny_order_id')
        .eq('id', saleId)
        .single();

      // ✅ Usar external_order_id com fallback para tiny_order_id (compatibilidade)
      const tinyOrderId = (saleData?.order_source === 'TINY' && saleData?.external_order_id) 
        ? saleData.external_order_id 
        : saleData?.tiny_order_id;
      if (tinyOrderId) {
        const { data: tinyOrderData } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .select('cliente_nome')
          .eq('id', tinyOrderId)
          .single();

        if (tinyOrderData?.cliente_nome) {
          clienteNomeFinal = tinyOrderData.cliente_nome;
        }
      }
    }

    // Calcular data do follow-up (7 dias após a venda)
    const saleDateObj = new Date(saleDate);
    const followUpDate = addDays(saleDateObj, daysUntilFollowUp);

    // Criar pós-venda
    const { error: postSaleError } = await supabase
      .schema('sistemaretiradas')
      .from('crm_post_sales')
      .insert({
        store_id: storeId,
        sale_id: saleId,
        colaboradora_id: colaboradoraId,
        cliente_nome: clienteNomeFinal,
        sale_date: saleDate.split('T')[0], // Apenas a data (sem hora)
        scheduled_follow_up: format(followUpDate, 'yyyy-MM-dd'),
        details: `Pós-venda automática criada para venda realizada em ${format(saleDateObj, 'dd/MM/yyyy')}`,
        status: 'AGENDADA'
      });

    if (postSaleError) {
      console.error('[createPostSaleFromSale] Erro ao criar pós-venda:', postSaleError);
      // Não lançar erro para não interromper o fluxo de criação da venda
    } else {
      console.log('[createPostSaleFromSale] ✅ Pós-venda criada automaticamente para venda:', saleId);
    }
  } catch (error) {
    console.error('[createPostSaleFromSale] Erro inesperado ao criar pós-venda:', error);
    // Não lançar erro para não interromper o fluxo de criação da venda
  }
}

