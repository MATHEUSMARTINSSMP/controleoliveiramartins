/**
 * Netlify Function: Sincronização de Pedidos Tiny ERP (Background)
 * 
 * Esta função é chamada pela Supabase Edge Function para sincronizar pedidos.
 * Implementa a lógica completa de sincronização adaptada para Node.js
 * 
 * Endpoint: /.netlify/functions/sync-tiny-orders-background
 * Método: POST
 * 
 * Body esperado:
 * {
 *   "store_id": "uuid",
 *   "data_inicio": "YYYY-MM-DD",
 *   "incremental": true,
 *   "limit": 50,
 *   "max_pages": 2
 * }
 */

const { createClient } = require('@supabase/supabase-js');

// Configuração Tiny ERP
const TINY_API_V3_URL = 'https://erp.tiny.com.br/public-api/v3';

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { store_id, data_inicio, incremental = true, limit = 50, max_pages = 2, hard_sync = false } = body;

    if (!store_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'store_id é obrigatório' }),
      };
    }

    console.log(`[SyncBackground] 🔄 Sincronizando loja ${store_id}...`);

    // Inicializar Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Configuração Supabase não encontrada' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar integração da loja
    const { data: integration, error: integrationError } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('*')
      .eq('store_id', store_id)
      .eq('sistema_erp', 'TINY')
      .single();

    if (integrationError || !integration) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Integração não encontrada para esta loja' 
        }),
      };
    }

    if (!integration.access_token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Token de acesso não encontrado' 
        }),
      };
    }

    // ✅ IMPLEMENTAÇÃO: Chamar a API do Tiny ERP para sincronizar pedidos
    // Usar o proxy Netlify Function para evitar CORS
    const proxyUrl = `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-api-proxy`;
    
    // ✅ Calcular data de início se não fornecida
    let dataInicioSync = data_inicio;
    if (!dataInicioSync) {
      if (hard_sync) {
        // Hard sync: desde 2010-01-01
        dataInicioSync = '2010-01-01';
        console.log(`[SyncBackground] 🔥 HARD SYNC: Buscando desde ${dataInicioSync}`);
      } else {
        // Sincronização normal: últimas 12 horas
        const dozeHorasAtras = new Date();
        dozeHorasAtras.setHours(dozeHorasAtras.getHours() - 12);
        dataInicioSync = dozeHorasAtras.toISOString().split('T')[0];
      }
    }

    console.log(`[SyncBackground] 📅 Buscando pedidos desde: ${dataInicioSync} (hard_sync: ${hard_sync}, max_pages: ${max_pages})`);

    // Buscar pedidos do Tiny ERP
    let allPedidos = [];
    let currentPage = 1;
    const maxPages = max_pages || (hard_sync ? 99999 : 2); // Hard sync: muito mais páginas
    let hasMore = true;

    while (hasMore && currentPage <= maxPages) {
      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            store_id: store_id,
            endpoint: '/pedidos',
            method: 'GET',
            params: {
              dataInicio: dataInicioSync,
              pagina: currentPage,
              limite: limit || 50,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ao buscar pedidos: ${errorText}`);
        }

        const result = await response.json();
        
        // Tiny ERP v3 retorna dados em { itens: [...], paginacao: {...} }
        const pedidos = result.itens || result.pedidos || [];
        allPedidos = allPedidos.concat(pedidos);

        // Verificar se há mais páginas
        const paginacao = result.paginacao || {};
        hasMore = paginacao.paginaAtual < paginacao.totalPaginas && currentPage < maxPages;
        currentPage++;

        console.log(`[SyncBackground] 📄 Página ${currentPage - 1}: ${pedidos.length} pedidos encontrados`);

      } catch (error) {
        console.error(`[SyncBackground] ❌ Erro ao buscar página ${currentPage}:`, error);
        hasMore = false;
      }
    }

    console.log(`[SyncBackground] 📊 Total de ${allPedidos.length} pedidos encontrados`);

    // Filtrar apenas pedidos faturados (situacao = 1 ou 3)
    const pedidosFaturados = allPedidos.filter(p => {
      const situacao = p.situacao || p.pedido?.situacao;
      return situacao === 1 || situacao === 3 || situacao === 'faturado' || situacao === 'Faturado';
    });

    console.log(`[SyncBackground] ✅ ${pedidosFaturados.length} pedidos faturados para processar`);

    // Processar e salvar pedidos
    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const pedido of pedidosFaturados) {
      try {
        // Extrair dados do pedido
        const pedidoData = pedido.pedido || pedido;
        const pedidoId = pedidoData.id || pedidoData.numeroPedido;
        const numeroPedido = pedidoData.numero || pedidoData.numeroPedido;
        const dataPedido = pedidoData.data || pedidoData.dataPedido || pedidoData.data_pedido;
        const valorTotal = parseFloat(pedidoData.valorTotalPedido || pedidoData.valor_total || pedidoData.valor || 0);
        const clienteNome = pedidoData.cliente?.nome || pedidoData.clienteNome || '';
        const clienteCpf = pedidoData.cliente?.cpfCnpj || pedidoData.clienteCpf || '';
        const vendedorNome = pedidoData.vendedor?.nome || pedidoData.vendedorNome || '';

        // Upsert do pedido
        const { error: upsertError } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .upsert({
            tiny_id: pedidoId?.toString(),
            store_id: store_id,
            numero_pedido: numeroPedido?.toString(),
            data_pedido: dataPedido ? new Date(dataPedido).toISOString() : null,
            valor_total: valorTotal,
            cliente_nome: clienteNome,
            cliente_cpf_cnpj: clienteCpf,
            vendedor_nome: vendedorNome,
            situacao: pedidoData.situacao || 1,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tiny_id,store_id',
          });

        if (upsertError) {
          console.error(`[SyncBackground] ❌ Erro ao salvar pedido ${pedidoId}:`, upsertError);
          errors++;
        } else {
          // Verificar se foi inserção ou atualização
          const { data: existing } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .select('id')
            .eq('tiny_id', pedidoId?.toString())
            .eq('store_id', store_id)
            .single();

          if (existing) {
            updated++;
          } else {
            synced++;
          }
        }

      } catch (error) {
        console.error(`[SyncBackground] ❌ Erro ao processar pedido:`, error);
        errors++;
      }
    }

    console.log(`[SyncBackground] ✅ Sincronização concluída: ${synced} novos, ${updated} atualizados, ${errors} erros`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${synced} novos, ${updated} atualizados`,
        synced,
        updated,
        errors,
      }),
    };

  } catch (error) {
    console.error('[SyncBackground] ❌ Erro:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
    };
  }
};
