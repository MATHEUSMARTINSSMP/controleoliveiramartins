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
 * Apenas pedidos com status 'faturado' (vendidos)
 * 
 * PASSO 6: Verificado endpoint correto na documentação
 * PASSO 7: Implementada paginação
 * PASSO 8: Mapeamento de categorias/subcategorias dos itens
 * PASSO 9: Logs detalhados
 * PASSO 10: Sincronização incremental (usa data da última sync)
 */
export async function syncTinyOrders(
  storeId: string,
  options: {
    dataInicio?: string; // YYYY-MM-DD
    dataFim?: string; // YYYY-MM-DD
    limit?: number;
    maxPages?: number; // Limite de páginas para paginação
    incremental?: boolean; // Sincronização incremental (apenas novos)
  } = {}
): Promise<{
  success: boolean;
  message: string;
  synced: number;
  updated: number;
  errors: number;
  totalPages: number;
  executionTime: number;
}> {
  const startTime = Date.now();
  
  try {
    const { dataInicio, dataFim, limit = 100, maxPages = 50, incremental = true } = options;

    // PASSO 10: Sincronização incremental - buscar última data de sincronização
    let dataInicioSync = dataInicio;
    if (incremental && !dataInicio) {
      const { data: lastSync } = await supabase
        .schema('sistemaretiradas')
        .from('erp_sync_logs')
        .select('data_fim')
        .eq('store_id', storeId)
        .eq('sistema_erp', 'TINY')
        .eq('tipo_sync', 'PEDIDOS')
        .eq('status', 'SUCCESS')
        .order('sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSync?.data_fim) {
        // Sincronizar desde a última data (inclusive)
        const lastDate = new Date(lastSync.data_fim);
        lastDate.setDate(lastDate.getDate() - 1); // 1 dia antes para garantir que não perde nada
        dataInicioSync = lastDate.toISOString().split('T')[0];
        console.log(`[SyncTiny] Sincronização incremental desde: ${dataInicioSync}`);
      }
    }

    // PASSO 6: Endpoint verificado na documentação oficial
    // Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Pedidos
    // Endpoint: GET /pedidos com query parameters
    // Filtro de situação: 'faturado' para pedidos vendidos
    
    let allPedidos: TinyPedido[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    let totalPages = 0;

    // PASSO 7: Implementar paginação
    while (hasMorePages && currentPage <= maxPages) {
      const params: Record<string, any> = {
        pagina: currentPage,
        limite: limit,
        situacao: 'faturado', // Apenas pedidos faturados (vendidos)
      };

      if (dataInicioSync) {
        params.dataInicial = dataInicioSync; // Formato: YYYY-MM-DD
      }
      if (dataFim) {
        params.dataFinal = dataFim; // Formato: YYYY-MM-DD
      }

      console.log(`[SyncTiny] Buscando página ${currentPage}...`);

      // API v3 usa GET para listar pedidos
      const response = await callERPAPI(storeId, '/pedidos', params);
      
      // Verificar estrutura da resposta conforme documentação
      let pedidos: TinyPedido[] = [];
      
      if (response.pedidos && Array.isArray(response.pedidos)) {
        pedidos = response.pedidos;
      } else if (response.retorno?.pedidos && Array.isArray(response.retorno.pedidos)) {
        pedidos = response.retorno.pedidos;
      } else if (response.data?.pedidos && Array.isArray(response.data.pedidos)) {
        pedidos = response.data.pedidos;
      } else {
        console.warn(`[SyncTiny] Página ${currentPage}: Resposta inesperada:`, response);
        // Se não tem pedidos, pode ser fim da paginação
        if (currentPage === 1) {
          return {
            success: false,
            message: 'Resposta inválida da API Tiny. Verifique a estrutura da resposta.',
            synced: 0,
            updated: 0,
            errors: 0,
            totalPages: 0,
            executionTime: Date.now() - startTime,
          };
        }
        break;
      }

      if (pedidos.length === 0) {
        hasMorePages = false;
        break;
      }

      allPedidos = allPedidos.concat(pedidos);
      totalPages = currentPage;

      // Se retornou menos que o limite, é a última página
      if (pedidos.length < limit) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    console.log(`[SyncTiny] Total de ${allPedidos.length} pedidos encontrados em ${totalPages} página(s)`);

    let synced = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Processar cada pedido
    for (const pedidoData of allPedidos) {
      try {
        const pedido = pedidoData.pedido;
        const cliente = pedido.cliente || {};

        // PASSO 8: Extrair categorias e subcategorias dos itens
        const itensComCategorias = pedido.itens?.map((item: any) => {
          const itemData = item.item || item;
          return {
            ...itemData,
            // Extrair categoria e subcategoria do item
            categoria: itemData.categoria || itemData.categoria_produto || itemData.categoria_id || null,
            subcategoria: itemData.subcategoria || itemData.subcategoria_produto || itemData.subcategoria_id || null,
            // Manter todos os dados originais
            dados_originais: itemData,
          };
        }) || [];

        // Preparar dados do pedido
        const orderData = {
          store_id: storeId,
          tiny_id: String(pedido.id || pedido.numero || `temp_${Date.now()}`),
          numero_pedido: pedido.numero?.toString() || null,
          numero_ecommerce: pedido.numero_ecommerce?.toString() || null,
          situacao: pedido.situacao || null,
          data_pedido: pedido.data_pedido 
            ? (pedido.data_pedido.includes('T') ? pedido.data_pedido : `${pedido.data_pedido}T00:00:00`)
            : null,
          data_prevista: pedido.data_prevista 
            ? (pedido.data_prevista.includes('T') ? pedido.data_prevista : `${pedido.data_prevista}T00:00:00`)
            : null,
          cliente_nome: cliente.nome || null,
          cliente_cpf_cnpj: cliente.cpf_cnpj || null,
          cliente_email: cliente.email || null,
          cliente_telefone: cliente.fone || cliente.celular || null,
          valor_total: parseFloat(String(pedido.valor_total || '0').replace(',', '.')),
          valor_desconto: parseFloat(String(pedido.valor_desconto || '0').replace(',', '.')),
          valor_frete: parseFloat(String(pedido.valor_frete || '0').replace(',', '.')),
          forma_pagamento: pedido.forma_pagamento || null,
          forma_envio: pedido.forma_envio || null,
          endereco_entrega: pedido.endereco_entrega ? JSON.stringify(pedido.endereco_entrega) : null,
          // PASSO 8: Itens com categorias/subcategorias mapeadas
          itens: JSON.stringify(itensComCategorias),
          observacoes: pedido.observacoes || null,
          vendedor_nome: pedido.vendedor?.nome || null,
          dados_extras: pedido.dados_extras ? JSON.stringify(pedido.dados_extras) : null,
          sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Verificar se pedido já existe
        const { data: existingOrder } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .select('id')
          .eq('store_id', storeId)
          .eq('tiny_id', orderData.tiny_id)
          .maybeSingle();

        // Upsert pedido (insert ou update se já existir)
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .upsert(orderData, {
            onConflict: 'store_id,tiny_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`Erro ao salvar pedido ${orderData.tiny_id}:`, error);
          errors++;
          errorDetails.push(`Pedido ${orderData.numero_pedido || orderData.tiny_id}: ${error.message}`);
        } else {
          if (existingOrder) {
            updated++;
          } else {
            synced++;
          }

          // Sincronizar cliente também
          if (cliente.nome) {
            await syncTinyContact(storeId, cliente, orderData.tiny_id);
          }
        }
      } catch (error: any) {
        console.error(`Erro ao processar pedido:`, error);
        errors++;
        errorDetails.push(`Erro genérico: ${error.message}`);
      }
    }

    const executionTime = Date.now() - startTime;
    const dataFimSync = dataFim || new Date().toISOString().split('T')[0];

    // PASSO 9: Logs detalhados de sincronização
    await supabase
      .schema('sistemaretiradas')
      .from('erp_sync_logs')
      .insert({
        store_id: storeId,
        sistema_erp: 'TINY',
        tipo_sync: 'PEDIDOS',
        registros_sincronizados: synced,
        registros_atualizados: updated,
        registros_com_erro: errors,
        status: errors === 0 ? 'SUCCESS' : (synced + updated > 0 ? 'PARTIAL' : 'ERROR'),
        error_message: errorDetails.length > 0 ? errorDetails.slice(0, 5).join('; ') : null, // Primeiros 5 erros
        data_inicio: dataInicioSync || null,
        data_fim: dataFimSync,
        tempo_execucao_ms: executionTime,
        total_paginas: totalPages,
        sync_at: new Date().toISOString(),
      });

    return {
      success: errors === 0,
      message: `Sincronizados ${synced} novos, ${updated} atualizados${errors > 0 ? `, ${errors} erros` : ''} (${totalPages} página(s), ${(executionTime / 1000).toFixed(1)}s)`,
      synced,
      updated,
      errors,
      totalPages,
      executionTime,
    };

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

