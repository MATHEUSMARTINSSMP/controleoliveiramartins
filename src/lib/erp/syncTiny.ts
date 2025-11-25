/**
 * Sincronização Tiny ERP
 * 
 * Foco: Pedidos de venda (aprovados/faturados) e Clientes
 * NÃO sincroniza: Produtos, Estoque
 */

import { supabase } from '@/integrations/supabase/client';
import { callERPAPI } from '@/lib/erpIntegrations';

interface TinyPedido {
  pedido: {
    id: string;
    numero: string;
    numero_ecommerce?: string;
    situacao: string;
    data_pedido: string;
    data_prevista?: string;
    cliente: {
      nome: string;
      tipo: string; // 'F' ou 'J'
      cpf_cnpj?: string;
      email?: string;
      fone?: string;
      celular?: string;
      endereco?: any;
    };
    valor_total: string;
    valor_desconto?: string;
    valor_frete?: string;
    forma_pagamento?: string;
    forma_envio?: string;
    endereco_entrega?: any;
    itens: Array<{
      item: {
        codigo?: string;
        descricao: string;
        quantidade: string;
        valor_unitario: string;
        valor_total: string;
        categoria?: string;
        subcategoria?: string;
        dados_extras?: any;
      };
    }>;
    observacoes?: string;
    vendedor?: {
      nome?: string;
    };
    dados_extras?: any;
  };
}

interface TinyContato {
  contato: {
    id: string;
    nome: string;
    tipo: string; // 'F' ou 'J'
    cpf_cnpj?: string;
    email?: string;
    fone?: string;
    celular?: string;
    endereco?: any;
    observacoes?: string;
    dados_extras?: any;
  };
}

/**
 * Sincroniza pedidos de venda do Tiny ERP
 * Apenas pedidos com status 'aprovado' ou 'faturado'
 */
export async function syncTinyOrders(
  storeId: string,
  options: {
    dataInicio?: string; // YYYY-MM-DD
    dataFim?: string; // YYYY-MM-DD
    limit?: number;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  synced: number;
  errors: number;
}> {
  try {
    const { dataInicio, dataFim, limit = 100 } = options;

    // Buscar pedidos do Tiny
    // Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Pedidos
    // Endpoint: GET /pedidos com query parameters
    const params: Record<string, any> = {
      pagina: 1,
      limite: limit,
      // Filtro de situação: consultar documentação para valores corretos
      // Possíveis valores: 'aberto', 'atendido', 'cancelado', 'faturado', etc
      situacao: 'faturado', // Focado em pedidos faturados (vendidos)
    };

    if (dataInicio) {
      params.dataInicial = dataInicio; // Formato: YYYY-MM-DD
    }
    if (dataFim) {
      params.dataFinal = dataFim; // Formato: YYYY-MM-DD
    }

    // API v3 usa GET para listar pedidos
    // API v3: GET /pedidos retorna { pedidos: [...] }
    const response = await callERPAPI(storeId, '/pedidos', params);
    
    // Verificar estrutura da resposta conforme documentação
    // Pode ser: { pedidos: [...] } ou { retorno: { pedidos: [...] } }
    let pedidos: TinyPedido[] = [];
    
    if (response.pedidos && Array.isArray(response.pedidos)) {
      pedidos = response.pedidos;
    } else if (response.retorno?.pedidos && Array.isArray(response.retorno.pedidos)) {
      pedidos = response.retorno.pedidos;
    } else {
      console.error('Resposta inesperada da API:', response);
      return {
        success: false,
        message: 'Resposta inválida da API Tiny. Verifique a estrutura da resposta.',
        synced: 0,
        errors: 0,
      };
    }
    let synced = 0;
    let errors = 0;

    // Processar cada pedido
    for (const pedidoData of pedidos) {
      try {
        const pedido = pedidoData.pedido;
        const cliente = pedido.cliente || {};

        // Preparar dados do pedido
        const orderData = {
          store_id: storeId,
          tiny_id: pedido.id.toString(),
          numero_pedido: pedido.numero?.toString() || null,
          numero_ecommerce: pedido.numero_ecommerce?.toString() || null,
          situacao: pedido.situacao || null,
          data_pedido: pedido.data_pedido ? new Date(pedido.data_pedido).toISOString() : null,
          data_prevista: pedido.data_prevista ? new Date(pedido.data_prevista).toISOString() : null,
          cliente_nome: cliente.nome || null,
          cliente_cpf_cnpj: cliente.cpf_cnpj || null,
          cliente_email: cliente.email || null,
          cliente_telefone: cliente.fone || cliente.celular || null,
          valor_total: parseFloat(pedido.valor_total?.toString() || '0'),
          valor_desconto: parseFloat(pedido.valor_desconto?.toString() || '0'),
          valor_frete: parseFloat(pedido.valor_frete?.toString() || '0'),
          forma_pagamento: pedido.forma_pagamento || null,
          forma_envio: pedido.forma_envio || null,
          endereco_entrega: pedido.endereco_entrega ? JSON.stringify(pedido.endereco_entrega) : null,
          itens: pedido.itens ? JSON.stringify(pedido.itens) : null, // Inclui categorias/subcategorias
          observacoes: pedido.observacoes || null,
          vendedor_nome: pedido.vendedor?.nome || null,
          dados_extras: pedido.dados_extras ? JSON.stringify(pedido.dados_extras) : null,
          sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Upsert pedido (insert ou update se já existir)
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .upsert(orderData, {
            onConflict: 'store_id,tiny_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`Erro ao salvar pedido ${pedido.id}:`, error);
          errors++;
        } else {
          synced++;

          // Sincronizar cliente também
          if (cliente.nome) {
            await syncTinyContact(storeId, cliente, pedido.id.toString());
          }
        }
      } catch (error: any) {
        console.error(`Erro ao processar pedido:`, error);
        errors++;
      }
    }

    // Atualizar log de sincronização
    await supabase
      .schema('sistemaretiradas')
      .from('erp_sync_logs')
      .insert({
        store_id: storeId,
        sistema_erp: 'TINY',
        tipo_sync: 'PEDIDOS',
        registros_sincronizados: synced,
        registros_com_erro: errors,
        status: errors === 0 ? 'SUCCESS' : 'PARTIAL',
        sync_at: new Date().toISOString(),
      });

    return {
      success: errors === 0,
      message: `Sincronizados ${synced} pedidos${errors > 0 ? `, ${errors} erros` : ''}`,
      synced,
      errors,
    };
  } catch (error: any) {
    console.error('Erro na sincronização de pedidos:', error);
    
    // Log de erro
    await supabase
      .schema('sistemaretiradas')
      .from('erp_sync_logs')
      .insert({
        store_id: storeId,
        sistema_erp: 'TINY',
        tipo_sync: 'PEDIDOS',
        registros_sincronizados: 0,
        registros_com_erro: 0,
        status: 'ERROR',
        error_message: error.message,
        sync_at: new Date().toISOString(),
      });

    return {
      success: false,
      message: error.message || 'Erro ao sincronizar pedidos',
      synced: 0,
      errors: 0,
    };
  }
}

/**
 * Sincroniza um cliente/contato do Tiny ERP
 */
async function syncTinyContact(
  storeId: string,
  cliente: any,
  pedidoId?: string
): Promise<void> {
  try {
    // Se não tem CPF/CNPJ ou nome, não sincroniza
    if (!cliente.nome) {
      return;
    }

    const contactData = {
      store_id: storeId,
      tiny_id: cliente.id?.toString() || cliente.cpf_cnpj || `temp_${Date.now()}`,
      nome: cliente.nome,
      tipo: cliente.tipo || 'F',
      cpf_cnpj: cliente.cpf_cnpj || null,
      email: cliente.email || null,
      telefone: cliente.fone || null,
      celular: cliente.celular || null,
      endereco: cliente.endereco ? JSON.stringify(cliente.endereco) : null,
      observacoes: cliente.observacoes || null,
      dados_extras: cliente.dados_extras ? JSON.stringify(cliente.dados_extras) : null,
      sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .schema('sistemaretiradas')
      .from('tiny_contacts')
      .upsert(contactData, {
        onConflict: 'store_id,tiny_id',
        ignoreDuplicates: false,
      });
  } catch (error: any) {
    console.error('Erro ao sincronizar contato:', error);
    // Não falha a sincronização de pedidos por causa de contato
  }
}

/**
 * Sincroniza todos os clientes do Tiny ERP
 * Útil para sincronização inicial completa
 */
export async function syncTinyContacts(
  storeId: string,
  options: {
    limit?: number;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  synced: number;
  errors: number;
}> {
  try {
    const { limit = 100 } = options;

    // Buscar contatos do Tiny
    const params: Record<string, any> = {
      pagina: 1,
      limite: limit,
    };

    const response = await callERPAPI(storeId, '/contatos', params);
    
    if (!response.contatos || !Array.isArray(response.contatos)) {
      return {
        success: false,
        message: 'Resposta inválida da API Tiny',
        synced: 0,
        errors: 0,
      };
    }

    const contatos: TinyContato[] = response.contatos;
    let synced = 0;
    let errors = 0;

    // Processar cada contato
    for (const contatoData of contatos) {
      try {
        const contato = contatoData.contato;

        if (!contato.nome) {
          continue; // Pula contatos sem nome
        }

        await syncTinyContact(storeId, contato);
        synced++;
      } catch (error: any) {
        console.error(`Erro ao processar contato:`, error);
        errors++;
      }
    }

    // Atualizar log de sincronização
    await supabase
      .schema('sistemaretiradas')
      .from('erp_sync_logs')
      .insert({
        store_id: storeId,
        sistema_erp: 'TINY',
        tipo_sync: 'CONTATOS',
        registros_sincronizados: synced,
        registros_com_erro: errors,
        status: errors === 0 ? 'SUCCESS' : 'PARTIAL',
        sync_at: new Date().toISOString(),
      });

    return {
      success: errors === 0,
      message: `Sincronizados ${synced} clientes${errors > 0 ? `, ${errors} erros` : ''}`,
      synced,
      errors,
    };
  } catch (error: any) {
    console.error('Erro na sincronização de contatos:', error);
    
    return {
      success: false,
      message: error.message || 'Erro ao sincronizar contatos',
      synced: 0,
      errors: 0,
    };
  }
}

