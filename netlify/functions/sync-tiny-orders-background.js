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

// Importar funções auxiliares
const {
  fetchPedidoCompletoFromTiny,
  fetchProdutoCompletoFromTiny,
  fetchContatoCompletoFromTiny,
  fetchVendedorCompletoFromTiny,
  clearCache,
} = require('./utils/erpApiHelpers');

const {
  normalizeTamanho,
  normalizeCor,
  normalizeCPFCNPJ,
  normalizeTelefone,
  normalizeNome,
  extrairCorDaDescricao,
} = require('./utils/normalization');

const {
  shouldUpdateOrder,
  shouldUpdateContact,
  mergeDataPreservingExisting,
} = require('./utils/updateLogic');

exports.handler = async (event, context) => {
  // ✅ IMPORTANTE: Netlify Functions têm timeout limitado
  // Para trabalhos longos, retornar imediatamente e continuar em background
  // Usar context.callbackWaitsForEmptyEventLoop = false para permitir execução assíncrona
  context.callbackWaitsForEmptyEventLoop = false;

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
    // ✅ Para trabalhos muito longos (hard sync), executar de forma assíncrona
    // Retornar imediatamente e continuar processamento em background
    let body;
    try {
      const bodyText = event.body || '{}';
      if (!bodyText || bodyText.trim() === '') {
        body = {};
      } else {
        body = JSON.parse(bodyText);
      }
    } catch (parseError) {
      console.error('[SyncBackground] ❌ Erro ao fazer parse do body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Body inválido ou vazio',
          details: parseError.message
        }),
      };
    }

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

    // ✅ HARD SYNC: Retornar imediatamente e processar em background
    if (hard_sync) {
      console.log(`[SyncBackground] 🔥 HARD SYNC ABSOLUTO: Retornando imediatamente e processando em background...`);
      
      // Processar em background sem bloquear
      (async () => {
        try {
          await processarSyncCompleta(store_id, dataInicioSync, limit, max_pages, supabase, proxyUrl, true);
        } catch (error) {
          console.error('[SyncBackground] ❌ Erro no processamento em background:', error);
        }
      })();
      
      // Retornar imediatamente
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Sincronização iniciada em background. Isso pode levar várias horas. Você pode fechar a página.',
          hard_sync: true,
        }),
      };
    }

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
            storeId: store_id, // ✅ CORREÇÃO: proxy espera storeId (camelCase)
            endpoint: '/pedidos',
            method: 'GET',
            params: {
              dataInicio: dataInicioSync,
              pagina: currentPage,
              limite: limit || 50,
            },
          }),
        });

        console.log(`[SyncBackground] 📡 Chamando API Tiny - Página ${currentPage}, Data: ${dataInicioSync}, Limite: ${limit || 50}`);

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

    // Limpar cache no início da sincronização
    clearCache();

    // Processar e salvar pedidos
    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const pedidoData of pedidosFaturados) {
      try {
        const pedido = pedidoData.pedido || pedidoData;
        const tinyId = String(pedido.id || pedido.numeroPedido || `temp_${Date.now()}`);

        console.log(`[SyncBackground] 📦 Processando pedido ${tinyId}...`);

        // ✅ TAREFA 1: Buscar detalhes completos do pedido
        console.log(`[SyncBackground] 🔍 Buscando detalhes completos do pedido ${pedido.id}...`);
        let pedidoCompleto = null;

        try {
          pedidoCompleto = await fetchPedidoCompletoFromTiny(store_id, pedido.id);

          if (pedidoCompleto) {
            // Mesclar dados do pedido completo com o pedido da listagem
            Object.assign(pedido, pedidoCompleto);
            console.log(`[SyncBackground] ✅ Detalhes completos recebidos, dados mesclados`);
          }
        } catch (error) {
          console.error(`[SyncBackground] ❌ Erro ao buscar detalhes do pedido ${pedido.id}:`, error);
        }

        // ✅ TAREFA 2: Buscar itens do pedido completo
        let itensParaProcessar = [];
        if (pedidoCompleto && pedidoCompleto.itens && Array.isArray(pedidoCompleto.itens) && pedidoCompleto.itens.length > 0) {
          itensParaProcessar = pedidoCompleto.itens;
          console.log(`[SyncBackground] ✅ Encontrados ${itensParaProcessar.length} itens nos detalhes completos`);
        } else {
          console.warn(`[SyncBackground] ⚠️ Pedido ${pedido.id} não tem itens nos detalhes completos`);
        }

        // ✅ TAREFA 3: Sincronizar cliente ANTES de salvar pedido
        let clienteId = null;
        if (pedido.cliente) {
          console.log(`[SyncBackground] 👤 Sincronizando cliente: ${pedido.cliente.nome || 'Sem nome'}`);

          clienteId = await syncTinyContact(supabase, store_id, pedido.cliente, tinyId);

          if (clienteId) {
            console.log(`[SyncBackground] ✅ Cliente sincronizado com ID: ${clienteId.substring(0, 8)}...`);
          } else {
            console.warn(`[SyncBackground] ⚠️ Cliente não foi sincronizado`);
          }
        }

        // ✅ TAREFA 4: Processar itens completos com extração de dados
        const itensProcessados = await Promise.all(
          (itensParaProcessar || []).map(async (item) => {
            return await processarItemCompleto(store_id, item, pedidoCompleto?.id || pedido.id);
          })
        );

        console.log(`[SyncBackground] ✅ Pedido ${pedido.id} processado: ${itensProcessados.length} itens com categorias`);

        // ✅ TAREFA 5: Buscar colaboradora pelo vendedor
        let colaboradoraId = null;
        if (pedido.vendedor && pedido.vendedor.id) {
          colaboradoraId = await findCollaboratorByVendedor(supabase, store_id, pedido.vendedor);
          if (colaboradoraId) {
            console.log(`[SyncBackground] ✅ Colaboradora encontrada: ${colaboradoraId.substring(0, 8)}...`);
          }
        }

        // ✅ TAREFA 6: Preparar dados do pedido completo
        const orderData = prepararDadosPedidoCompleto(store_id, pedido, pedidoCompleto, clienteId, colaboradoraId, itensProcessados, tinyId);

        // ✅ TAREFA 7: Verificar se precisa atualizar
        const { data: existingOrder } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .select('*')
          .eq('store_id', store_id)
          .eq('tiny_id', tinyId)
          .maybeSingle();

        const precisaAtualizar = !existingOrder || shouldUpdateOrder(existingOrder, orderData);

        if (!precisaAtualizar && existingOrder) {
          console.log(`[SyncBackground] ℹ️ Pedido ${tinyId} não precisa ser atualizado`);
          continue;
        }

        // ✅ TAREFA 8: Salvar pedido completo
        const { error: upsertError } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .upsert(orderData, {
            onConflict: 'tiny_id,store_id',
          });

        if (upsertError) {
          console.error(`[SyncBackground] ❌ Erro ao salvar pedido ${tinyId}:`, upsertError);
          errors++;
        } else {
          if (existingOrder) {
            updated++;
            console.log(`[SyncBackground] ✅ Pedido ${tinyId} atualizado`);
          } else {
            synced++;
            console.log(`[SyncBackground] ✅ Pedido ${tinyId} criado`);
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

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Processa um item completo do pedido, extraindo tamanho, cor, categoria, marca
 */
/**
 * Função auxiliar para processar sincronização completa (usado em background para hard sync)
 */
async function processarSyncCompleta(storeId, dataInicioSync, limit, maxPages, supabase, proxyUrl, hardSync = false) {
  console.log(`[SyncBackground] 🔄 Iniciando processamento completo em background... (hardSync: ${hardSync})`);
  
  // Buscar pedidos do Tiny ERP
  let allPedidos = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore && currentPage <= maxPages) {
    try {
      // ✅ Adicionar timeout maior e retry logic para evitar ConnectTimeoutError
      const fetchWithRetry = async (retries = 3, delay = 5000) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout
            
            const response = await fetch(proxyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                storeId: storeId,
                endpoint: '/pedidos',
                method: 'GET',
                params: {
                  dataInicio: dataInicioSync,
                  pagina: currentPage,
                  limite: limit || 50,
                },
              }),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            return response;
          } catch (error) {
            if (attempt === retries) throw error;
            console.log(`[SyncBackground] ⚠️ Tentativa ${attempt}/${retries} falhou, aguardando ${delay}ms antes de tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5; // Aumentar delay exponencialmente
          }
        }
      };
      
      console.log(`[SyncBackground] 📡 Chamando API Tiny - Página ${currentPage}, Data: ${dataInicioSync}, Limite: ${limit || 50}`);
      
      const response = await fetchWithRetry();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar pedidos (status ${response.status}): ${errorText}`);
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
      console.error(`[SyncBackground] ❌ Erro ao buscar página ${currentPage} após todas as tentativas:`, error);
      
      // ✅ Para hard sync, continuar tentando próximas páginas ao invés de parar completamente
      // Isso permite que mesmo com alguns timeouts, o processo continue sincronizando o que conseguir
      if (hardSync && currentPage < maxPages) {
        console.log(`[SyncBackground] ⚠️ Continuando para próxima página mesmo com erro (hard sync)...`);
        currentPage++;
        // Aguardar um pouco antes de continuar para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Não definir hasMore = false, continuar loop
      } else {
        hasMore = false;
      }
    }
  }

  console.log(`[SyncBackground] 📊 Total de ${allPedidos.length} pedidos encontrados`);

  // Filtrar apenas pedidos faturados (situacao = 1 ou 3)
  const pedidosFaturados = allPedidos.filter(p => {
    const situacao = p.situacao || p.pedido?.situacao;
    return situacao === 1 || situacao === 3 || situacao === 'faturado' || situacao === 'Faturado';
  });

  console.log(`[SyncBackground] ✅ ${pedidosFaturados.length} pedidos faturados para processar`);

  // Limpar cache no início da sincronização
  clearCache();

  // Processar e salvar pedidos
  let synced = 0;
  let updated = 0;
  let errors = 0;

  for (const pedidoData of pedidosFaturados) {
    try {
      const pedido = pedidoData.pedido || pedidoData;
      const tinyId = String(pedido.id || pedido.numeroPedido || `temp_${Date.now()}`);

      console.log(`[SyncBackground] 📦 Processando pedido ${tinyId}...`);

      // Buscar detalhes completos do pedido
      let pedidoCompleto = null;
      try {
        pedidoCompleto = await fetchPedidoCompletoFromTiny(storeId, pedido.id);
        if (pedidoCompleto) {
          Object.assign(pedido, pedidoCompleto);
          console.log(`[SyncBackground] ✅ Detalhes completos recebidos, dados mesclados`);
        }
      } catch (error) {
        console.error(`[SyncBackground] ❌ Erro ao buscar detalhes do pedido ${pedido.id}:`, error);
      }

      // Buscar itens do pedido completo
      let itensParaProcessar = [];
      if (pedidoCompleto && pedidoCompleto.itens && Array.isArray(pedidoCompleto.itens) && pedidoCompleto.itens.length > 0) {
        itensParaProcessar = pedidoCompleto.itens;
        console.log(`[SyncBackground] ✅ Encontrados ${itensParaProcessar.length} itens nos detalhes completos`);
      } else {
        console.warn(`[SyncBackground] ⚠️ Pedido ${pedido.id} não tem itens nos detalhes completos`);
      }

      // Sincronizar cliente ANTES de salvar pedido
      let clienteId = null;
      if (pedido.cliente) {
        console.log(`[SyncBackground] 👤 Sincronizando cliente: ${pedido.cliente.nome || 'Sem nome'}`);
        clienteId = await syncTinyContact(supabase, storeId, pedido.cliente, tinyId);
        if (clienteId) {
          console.log(`[SyncBackground] ✅ Cliente sincronizado com ID: ${clienteId.substring(0, 8)}...`);
        } else {
          console.warn(`[SyncBackground] ⚠️ Cliente não foi sincronizado`);
        }
      }

      // Processar itens completos com extração de dados
      const itensProcessados = await Promise.all(
        (itensParaProcessar || []).map(async (item) => {
          return await processarItemCompleto(storeId, item, pedidoCompleto?.id || pedido.id);
        })
      );

      console.log(`[SyncBackground] ✅ Pedido ${pedido.id} processado: ${itensProcessados.length} itens com categorias`);

      // Buscar colaboradora pelo vendedor
      let colaboradoraId = null;
      if (pedido.vendedor && pedido.vendedor.id) {
        colaboradoraId = await findCollaboratorByVendedor(supabase, storeId, pedido.vendedor);
        if (colaboradoraId) {
          console.log(`[SyncBackground] ✅ Colaboradora encontrada: ${colaboradoraId.substring(0, 8)}...`);
        }
      }

      // Preparar dados do pedido completo
      const orderData = prepararDadosPedidoCompleto(storeId, pedido, pedidoCompleto, clienteId, colaboradoraId, itensProcessados, tinyId);

      // Verificar se precisa atualizar
      const { data: existingOrder } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('tiny_id', tinyId)
        .maybeSingle();

      const precisaAtualizar = !existingOrder || shouldUpdateOrder(existingOrder, orderData);

      if (!precisaAtualizar && existingOrder) {
        console.log(`[SyncBackground] ℹ️ Pedido ${tinyId} não precisa ser atualizado`);
        continue;
      }

      // Salvar pedido completo
      const { error: upsertError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .upsert(orderData, {
          onConflict: 'tiny_id,store_id',
        });

      if (upsertError) {
        console.error(`[SyncBackground] ❌ Erro ao salvar pedido ${tinyId}:`, upsertError);
        errors++;
      } else {
        if (existingOrder) {
          updated++;
          console.log(`[SyncBackground] ✅ Pedido ${tinyId} atualizado`);
        } else {
          synced++;
          console.log(`[SyncBackground] ✅ Pedido ${tinyId} criado`);
        }
      }

    } catch (error) {
      console.error(`[SyncBackground] ❌ Erro ao processar pedido:`, error);
      errors++;
    }
  }

  console.log(`[SyncBackground] ✅ Sincronização concluída: ${synced} novos, ${updated} atualizados, ${errors} erros`);
}

async function processarItemCompleto(storeId, itemData, pedidoId) {
  console.log(`[SyncBackground] 🚀 v2.2 - VERSÃO COM EXTRAÇÃO ATIVA`);
  console.log(`[SyncBackground] 📄 Processando item:`, itemData);
  const produto = itemData.produto || {};
  const quantidade = itemData.quantidade || 0;
  const valorUnitario = itemData.valorUnitario || 0;
  const infoAdicional = itemData.infoAdicional || null;

  const codigo = produto.sku || itemData.sku || produto.codigo || itemData.codigo || null;
  const descricao = produto.descricao || itemData.descricao || produto.nome || itemData.nome || null;
  const produtoId = produto.id || itemData.produto_id || itemData.produto?.id || itemData.idProduto || itemData.produtoId || null;

  // Variáveis para dados extraídos
  let categoria = null;
  let subcategoria = null;
  let marca = null;
  let tamanho = null;
  let cor = null;
  let genero = null;
  let faixa_etaria = null;
  let material = null;

  // Tentar extrair do item diretamente
  if (itemData.categoria) {
    categoria = typeof itemData.categoria === 'string' ? itemData.categoria : (itemData.categoria.nome || itemData.categoria.descricao || null);
  }
  if (itemData.marca) {
    marca = typeof itemData.marca === 'string' ? itemData.marca : (itemData.marca.nome || itemData.marca.descricao || null);
  }
  if (itemData.tamanho) {
    tamanho = normalizeTamanho(itemData.tamanho);
  }
  if (itemData.cor) {
    cor = normalizeCor(itemData.cor);
  }

  // Extrair ID da variação
  const variacaoId = itemData.variacao?.id || itemData.variacaoId || itemData.idVariacao || itemData.variacao_id || null;

  // ✅ BUSCAR DETALHES COMPLETOS DO PRODUTO se tivermos produtoId
  if (produtoId) {
    try {
      console.log(`[SyncBackground] 🔍 Buscando detalhes completos do produto ${produtoId}...`);
      const produtoCompleto = await fetchProdutoCompletoFromTiny(storeId, produtoId);

      if (produtoCompleto) {
        // Extrair categoria e subcategoria
        // Extrair categoria e subcategoria
        if (!categoria && produtoCompleto.categoria) {
          categoria = produtoCompleto.categoria.nome || produtoCompleto.categoria.descricao || null;

          // Separar categoria e subcategoria do caminhoCompleto
          if (produtoCompleto.categoria.caminhoCompleto) {
            const caminhoCompletoStr = String(produtoCompleto.categoria.caminhoCompleto).trim();
            console.log(`[SyncBackground] 📂 Caminho completo original: "${caminhoCompletoStr}"`);

            // ✅ CORREÇÃO ROBUSTA: Suportar TODOS os formatos de separador
            // Formatos suportados: "A > B", "A >> B", "A->B", "A->>B", "A>B", "A>>B"
            const caminho = caminhoCompletoStr
              .split(/\s*-?>>?\s*/)  // Split por >, >>, ->, ->>
              .map(s => s.trim())
              .filter(s => s.length > 0);

            console.log(`[SyncBackground] 📂 Caminho separado: [${caminho.join(', ')}]`);

            if (caminho.length > 1) {
              subcategoria = caminho[caminho.length - 1];
              categoria = caminho.slice(0, -1).join(' > ');
              console.log(`[SyncBackground] ✅ Categoria: "${categoria}" | Subcategoria: "${subcategoria}"`);
            } else if (caminho.length === 1) {
              categoria = caminho[0];
              subcategoria = null;
              console.log(`[SyncBackground] ✅ Categoria única: "${categoria}"`);
            }
          }
        }

        // Extrair marca
        if (!marca && produtoCompleto.marca) {
          marca = produtoCompleto.marca.nome || produtoCompleto.marca.descricao || null;
        }

        // ✅ NOVA LÓGICA: Verificar se o produto retornado JÁ É A VARIAÇÃO (Produto Filho)
        // Isso acontece quando o ID do item do pedido aponta diretamente para a variação
        // Nesse caso, o objeto produtoCompleto terá 'grade', 'tamanho' ou 'cor' diretamente

        let isVariacaoDireta = false;

        // Verificar se tem grade direta (formato comum de variação)
        if (produtoCompleto.grade) {
          let gradeArray = null;
          if (Array.isArray(produtoCompleto.grade)) {
            gradeArray = produtoCompleto.grade;
          } else if (typeof produtoCompleto.grade === 'object') {
            gradeArray = Object.values(produtoCompleto.grade);
          }

          if (gradeArray && gradeArray.length > 0) {
            console.log(`[SyncBackground] 🎯 Produto ${produtoId} é uma VARIAÇÃO DIRETA (tem grade)`);
            isVariacaoDireta = true;

            for (const atributo of gradeArray) {
              const chave = String(atributo.chave || atributo.key || atributo.nome || '').toLowerCase().trim();
              const valor = String(atributo.valor || atributo.value || atributo.descricao || '').trim();

              if (!tamanho && (chave.includes('tamanho') || chave.includes('size') || chave === 'tam')) {
                tamanho = normalizeTamanho(valor);
                console.log(`[SyncBackground] ✅ Tamanho extraído da variação direta: "${tamanho}"`);
              }
              if (!cor && (chave.includes('cor') || chave.includes('color') || chave.includes('colour'))) {
                cor = normalizeCor(valor);
                console.log(`[SyncBackground] ✅ Cor extraída da variação direta: "${cor}"`);
              }
              if (!genero && (chave.includes('genero') || chave.includes('gender'))) {
                genero = valor;
              }
            }
          }
        }

        // Verificar campos diretos de tamanho/cor (algumas APIs retornam assim)
        if (!isVariacaoDireta) {
          if (!tamanho && produtoCompleto.tamanho) {
            tamanho = normalizeTamanho(produtoCompleto.tamanho);
            console.log(`[SyncBackground] ✅ Tamanho extraído do campo direto: "${tamanho}"`);
            isVariacaoDireta = true;
          }
          if (!cor && produtoCompleto.cor) {
            cor = normalizeCor(produtoCompleto.cor);
            console.log(`[SyncBackground] ✅ Cor extraída do campo direto: "${cor}"`);
            isVariacaoDireta = true;
          }
        }

        // Se NÃO for variação direta, procurar na lista de variações (Produto Pai)
        // ✅ EXTRAIR TAMANHO E COR DAS VARIAÇÕES
        // IMPORTANTE: variações podem vir como ARRAY ou como OBJETO JSON
        let variacoesArray = null;

        if (!isVariacaoDireta && produtoCompleto.variacoes) {
          if (Array.isArray(produtoCompleto.variacoes)) {
            // Caso 1: Variações como array
            variacoesArray = produtoCompleto.variacoes;
            console.log(`[SyncBackground] ✅ Variações recebidas como ARRAY (${variacoesArray.length} variações)`);
          } else if (typeof produtoCompleto.variacoes === 'object') {
            // Caso 2: Variações como objeto JSON - converter para array
            console.log(`[SyncBackground] ⚠️ Variações recebidas como OBJETO JSON, convertendo para array...`);
            variacoesArray = Object.values(produtoCompleto.variacoes);
            console.log(`[SyncBackground] ✅ Convertido para array (${variacoesArray.length} variações)`);
          }
        }

        if (variacoesArray && variacoesArray.length > 0) {
          let variacaoEncontrada = null;

          // 1. Tentar buscar por ID da variação (se disponível)
          if (variacaoId) {
            variacaoEncontrada = variacoesArray.find(v =>
              v.id === variacaoId || v.idVariacao === variacaoId || String(v.id) === String(variacaoId)
            );
            if (variacaoEncontrada) {
              console.log(`[SyncBackground] ✅ Variação encontrada por ID: ${variacaoId}`);
            }
          }

          // 2. ✅ CORREÇÃO: Tentar buscar por SKU/Código (se ID falhar ou não existir)
          if (!variacaoEncontrada && codigo) {
            variacaoEncontrada = variacoesArray.find(v =>
              String(v.codigo || v.sku || '').trim() === String(codigo).trim()
            );
            if (variacaoEncontrada) {
              console.log(`[SyncBackground] ✅ Variação encontrada por SKU: ${codigo}`);
            }
          }

          // 3. Se encontrou a variação específica, extrair dados dela
          if (variacaoEncontrada) {
            let gradeArray = null;
            if (variacaoEncontrada.grade) {
              if (Array.isArray(variacaoEncontrada.grade)) {
                gradeArray = variacaoEncontrada.grade;
              } else if (typeof variacaoEncontrada.grade === 'object') {
                gradeArray = Object.values(variacaoEncontrada.grade);
              }
            }

            if (gradeArray && gradeArray.length > 0) {
              for (const atributo of gradeArray) {
                const chave = String(atributo.chave || atributo.key || atributo.nome || '').toLowerCase().trim();
                const valor = String(atributo.valor || atributo.value || atributo.descricao || '').trim();

                if (!tamanho && (chave.includes('tamanho') || chave.includes('size') || chave === 'tam')) {
                  tamanho = normalizeTamanho(valor);
                  console.log(`[SyncBackground] ✅ Tamanho extraído da variação (SKU/ID): "${tamanho}"`);
                }
                if (!cor && (chave.includes('cor') || chave.includes('color') || chave.includes('colour'))) {
                  cor = normalizeCor(valor);
                  console.log(`[SyncBackground] ✅ Cor extraída da variação (SKU/ID): "${cor}"`);
                }
                if (!genero && (chave.includes('genero') || chave.includes('gender'))) {
                  genero = valor;
                }
              }
            }
          }

          // 4. Se ainda não tem tamanho/cor, tentar extrair de QUALQUER variação que tenha o mesmo código base?
          // Não, isso seria arriscado. Melhor confiar na descrição se o match exato falhar.
        }
      }
    } catch (error) {
      console.warn(`[SyncBackground] ⚠️ Erro ao buscar detalhes do produto ${produtoId}:`, error.message);
    }
  }

  // Fallbacks dos dados do item
  if (!categoria) {
    categoria = itemData.categoria || produto.categoria?.nome || produto.categoria || null;
  }
  if (!marca) {
    marca = itemData.marca?.nome || itemData.marca || produto.marca?.nome || produto.marca || null;
  }
  if (!tamanho) {
    tamanho = normalizeTamanho(itemData.tamanho || produto.tamanho || null);
  }
  if (!cor) {
    cor = normalizeCor(itemData.cor || produto.cor || null);
  }

  // ✅ ESTRATÉGIA FINAL: Extrair tamanho e cor da descrição do produto
  // Exemplo: "VESTIDO TIVOLI OFF-WHITE - 42" -> Tamanho: 42, Cor: OFF-WHITE
  // ⚠️ FORÇAR EXECUÇÃO SEMPRE para debug
  if (descricao) {
    console.log(`[SyncBackground] 🔍 TENTANDO EXTRAÇÃO - Descrição: "${descricao}"`);
    console.log(`[SyncBackground] 🔍 Estado atual - Tamanho: ${tamanho}, Cor: ${cor}`);
  }

  if ((!tamanho || !cor) && descricao) {
    console.log(`[SyncBackground] 🔍 Tentando extrair variações da descrição: "${descricao}"`);
    console.log(`[SyncBackground] 🔍 Condição atendida - !tamanho: ${!tamanho}, !cor: ${!cor}, descricao: ${!!descricao}`);

    // 1. Tentar extrair TAMANHO no final
    // ✅ CORREÇÃO: Regex mais flexível (aceita espaço opcional antes do hífen, ou "Tam:", ou apenas o número no fim)
    // Padrões suportados: " - 42", " - P", " Tam: 42", " 42" (arriscado, mas comum)

    // ✅ REGEX ULTRA-ROBUSTO: Suporta TODOS os formatos comuns
    // Formatos: " - 42", " -42", "- 42", "-42", " 42", "Tam: 42", "Tam:42", "Tamanho: 42"

    let regexTamanho = null;
    let matchTamanho = null;

    // Regex 1: Padrão com hífen (mais comum): " - X", " -X", "- X", "-X"
    regexTamanho = /[\s-]*-[\s]*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i;
    matchTamanho = descricao.match(regexTamanho);

    // Regex 2: Padrão "Tam:" ou "Tamanho:"
    if (!matchTamanho) {
      regexTamanho = /Tam(?:anho)?:?\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)/i;
      matchTamanho = descricao.match(regexTamanho);
    }

    // Regex 3: Padrão sem hífen no final (arriscado, mas comum): " X" no final
    if (!matchTamanho) {
      regexTamanho = /\s+([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i;
      matchTamanho = descricao.match(regexTamanho);
    }

    if (matchTamanho && matchTamanho[1]) {
      if (!tamanho) {
        tamanho = normalizeTamanho(matchTamanho[1]);
        console.log(`[SyncBackground] ✅ Tamanho extraído da descrição (Regex): "${tamanho}"`);
      }

      // 2. Tentar extrair COR (o que vem antes do tamanho)
      if (!cor) {
        // Pegar tudo antes do match do tamanho
        const parteSemTamanho = descricao.substring(0, matchTamanho.index).trim();
        console.log(`[SyncBackground] 🎨 Parte sem tamanho: "${parteSemTamanho}"`);

        // ✅ ESTRATÉGIA MELHORADA: Tentar múltiplos padrões de separação

        // Padrão 1: Separar por hífen com espaços: " - "
        let partesPorHifen = parteSemTamanho.split(/\s+-\s+/);

        // Padrão 2: Se não funcionou, tentar hífen sem espaços obrigatórios: "-"
        if (partesPorHifen.length === 1) {
          partesPorHifen = parteSemTamanho.split(/-/);
        }

        console.log(`[SyncBackground] 🎨 Partes separadas por hífen: [${partesPorHifen.join(', ')}]`);

        // ✅ ESTRATÉGIA MELHORADA: Buscar cor válida na parte sem tamanho
        // Tentar de trás para frente (última parte primeiro, depois partes anteriores)
        let corEncontrada = null;
        
        if (partesPorHifen.length > 1) {
          // Tentar as partes de trás para frente até encontrar uma cor válida
          for (let i = partesPorHifen.length - 1; i >= 0; i--) {
            const parte = partesPorHifen[i].trim();
            
            // Validar tamanho básico
            if (parte.length < 30 && parte.length > 2 && !/^\d+$/.test(parte)) {
              // ✅ VALIDAÇÃO: Usar normalizeCor que valida contra o mapa de cores válidas
              const corValidada = normalizeCor(parte);
              if (corValidada) {
                corEncontrada = corValidada;
                console.log(`[SyncBackground] ✅ Cor extraída e validada (parte ${i + 1}/${partesPorHifen.length}): "${corEncontrada}"`);
                break; // Encontrou cor válida, parar
              }
            }
          }
        }
        
        // ✅ Se não encontrou na separação por hífen, buscar na descrição completa
        if (!corEncontrada) {
          console.log(`[SyncBackground] ⚠️ Não encontrou cor válida nas partes separadas, tentando busca na descrição completa`);
          
          // Tentar primeiro na parte sem tamanho
          corEncontrada = extrairCorDaDescricao(parteSemTamanho);
          
          // Se não encontrou, tentar na descrição completa
          if (!corEncontrada) {
            corEncontrada = extrairCorDaDescricao(descricao);
          }
          
          if (corEncontrada) {
            console.log(`[SyncBackground] ✅ Cor encontrada na descrição: "${corEncontrada}"`);
          } else {
            console.log(`[SyncBackground] ❌ Nenhuma cor válida encontrada na descrição`);
          }
        }
        
        if (corEncontrada) {
          cor = corEncontrada;
        }
      }
    }
  }

  return {
    ...itemData,
    produto_id: produtoId,
    codigo,
    descricao,
    quantidade,
    valorUnitario,
    infoAdicional,
    categoria,
    subcategoria,
    marca,
    tamanho,
    cor,
    genero,
    faixa_etaria,
    material,
  };
}

/**
 * Sincroniza um cliente/contato do Tiny ERP
 */
async function syncTinyContact(supabase, storeId, cliente, pedidoId) {
  try {
    if (!cliente.nome) {
      console.warn(`[SyncBackground] ⚠️ Cliente sem nome, ignorando sincronização`);
      return null;
    }

    let clienteCompleto = cliente;
    const clienteId = cliente.id || cliente.idContato || null;

    // ✅ SEMPRE buscar detalhes completos se tivermos ID
    if (clienteId) {
      try {
        const clienteDetalhes = await fetchContatoCompletoFromTiny(storeId, clienteId);
        if (clienteDetalhes) {
          clienteCompleto = {
            ...clienteDetalhes,
            ...cliente,
            dataNascimento: clienteDetalhes.dataNascimento || cliente.dataNascimento,
            telefone: cliente.telefone || clienteDetalhes.telefone,
            celular: cliente.celular || clienteDetalhes.celular,
            email: cliente.email || clienteDetalhes.email,
            cpfCnpj: cliente.cpfCnpj || clienteDetalhes.cpfCnpj,
          };
        }
      } catch (error) {
        console.error(`[SyncBackground] ❌ Erro ao buscar detalhes completos do cliente ${clienteId}:`, error);
      }
    }

    // Normalizar dados
    const dataNascimento = clienteCompleto.dataNascimento || clienteCompleto.data_nascimento || null;
    const cpfCnpj = normalizeCPFCNPJ(clienteCompleto.cpfCnpj || clienteCompleto.cpf_cnpj || clienteCompleto.cpf || clienteCompleto.cnpj || null);
    const telefone = normalizeTelefone(clienteCompleto.telefone || clienteCompleto.celular || null);
    const email = clienteCompleto.email || null;
    const nome = normalizeNome(clienteCompleto.nome);

    // Normalizar data de nascimento
    let dataNascimentoNormalizada = null;
    if (dataNascimento) {
      try {
        const date = new Date(dataNascimento);
        if (!isNaN(date.getTime())) {
          dataNascimentoNormalizada = date.toISOString().split('T')[0];
        }
      } catch (error) {
        console.warn(`[SyncBackground] ⚠️ Erro ao parsear data de nascimento:`, error);
      }
    }

    // Preparar dados do contato
    const contatoData = {
      store_id: storeId,
      tiny_id: clienteId?.toString() || null,
      nome,
      cpf_cnpj: cpfCnpj,
      telefone,
      email,
      data_nascimento: dataNascimentoNormalizada,
      updated_at: new Date().toISOString(),
    };

    // Verificar se já existe
    let existingContact = null;
    if (cpfCnpj) {
      const { data } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('*')
        .eq('store_id', storeId)
        .eq('cpf_cnpj', cpfCnpj)
        .maybeSingle();
      existingContact = data;
    }

    if (!existingContact && clienteId) {
      const { data } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('*')
        .eq('store_id', storeId)
        .eq('tiny_id', clienteId.toString())
        .maybeSingle();
      existingContact = data;
    }

    // Mesclar dados preservando existentes
    if (existingContact) {
      contatoData.id = existingContact.id;
      const merged = mergeDataPreservingExisting(existingContact, contatoData);
      Object.assign(contatoData, merged);
    }

    // Upsert
    const { data: savedContact, error: upsertError } = await supabase
      .schema('sistemaretiradas')
      .from('tiny_contacts')
      .upsert(contatoData, {
        onConflict: existingContact && existingContact.id ? 'id' : (cpfCnpj ? 'store_id,cpf_cnpj' : 'store_id,tiny_id'),
      })
      .select()
      .single();

    if (upsertError) {
      console.error(`[SyncBackground] ❌ Erro ao salvar contato:`, upsertError);
      return null;
    }

    return savedContact.id;

  } catch (error) {
    console.error(`[SyncBackground] ❌ Erro ao sincronizar contato:`, error);
    return null;
  }
}

/**
 * Busca colaboradora pelo vendedor
 */
async function findCollaboratorByVendedor(supabase, storeId, vendedor) {
  try {
    if (!vendedor.nome && !vendedor.email && !vendedor.cpf && !vendedor.id) {
      return null;
    }

    // Buscar dados completos do vendedor se tiver ID
    let vendedorCompleto = { ...vendedor };
    if (vendedor.id && !vendedor.cpf) {
      try {
        const dadosCompletos = await fetchVendedorCompletoFromTiny(storeId, vendedor.id);
        if (dadosCompletos) {
          vendedorCompleto = {
            ...vendedor,
            cpf: dadosCompletos.cpf || vendedor.cpf,
            email: dadosCompletos.email || vendedor.email,
            nome: dadosCompletos.nome || vendedor.nome,
          };
        }
      } catch (error) {
        console.warn(`[SyncBackground] ⚠️ Erro ao buscar vendedor completo:`, error);
      }
    }

    // Buscar colaboradoras da loja
    const { data: colaboradoras } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, name, email, cpf')
      .eq('role', 'COLABORADORA')
      .eq('active', true)
      .eq('store_id', storeId);

    if (!colaboradoras || colaboradoras.length === 0) {
      return null;
    }

    const normalizeCPF = (cpf) => cpf ? String(cpf).replace(/\D/g, '') : null;
    const normalizedVendedorCPF = normalizeCPF(vendedorCompleto.cpf);

    // Tentar matching por CPF primeiro
    if (normalizedVendedorCPF && normalizedVendedorCPF.length >= 11) {
      const matchByCPF = colaboradoras.find((colab) => {
        const colabCPF = normalizeCPF(colab.cpf);
        return colabCPF && colabCPF === normalizedVendedorCPF;
      });
      if (matchByCPF) {
        return matchByCPF.id;
      }
    }

    // Tentar matching por email
    if (vendedorCompleto.email) {
      const matchByEmail = colaboradoras.find(
        (colab) => colab.email && colab.email.toLowerCase() === vendedorCompleto.email?.toLowerCase()
      );
      if (matchByEmail) {
        return matchByEmail.id;
      }
    }

    // Tentar matching por nome
    if (vendedorCompleto.nome) {
      const normalizeName = (name) => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
      };

      const normalizedVendedorNome = normalizeName(vendedorCompleto.nome);
      const matchByName = colaboradoras.find((colab) => {
        const normalizedColabNome = normalizeName(colab.name || '');
        return normalizedColabNome === normalizedVendedorNome;
      });

      if (matchByName) {
        return matchByName.id;
      }
    }

    return null;

  } catch (error) {
    console.error(`[SyncBackground] ❌ Erro ao buscar colaboradora:`, error);
    return null;
  }
}

/**
 * Prepara dados completos do pedido para salvar
 */
function prepararDadosPedidoCompleto(storeId, pedido, pedidoCompleto, clienteId, colaboradoraId, itensComCategorias, tinyId) {
  // ✅ EXTRAÇÃO ROBUSTA DE DATA/HORA: Tentar múltiplas fontes antes de usar fallback
  let dataPedido = null;
  let temHoraReal = false;
  let dataBase = null;

  // 1. Priorizar dataCriacao do pedido completo (mais confiável)
  if (pedidoCompleto?.dataCriacao) {
    dataBase = pedidoCompleto.dataCriacao;
    const horaPart = dataBase.split('T')?.[1]?.split(/[+\-Z]/)?.[0];
    temHoraReal = horaPart && !horaPart.startsWith('00:00:00');
    if (temHoraReal) {
      dataPedido = dataBase;
    }
  }

  // 2. Se não tem hora real, tentar dataAtualizacao do pedido completo
  if (!temHoraReal && pedidoCompleto?.dataAtualizacao) {
    const dataAtualizacao = pedidoCompleto.dataAtualizacao;
    if (dataAtualizacao.includes('T')) {
      const horaPart = dataAtualizacao.split('T')[1]?.split(/[+\-Z]/)?.[0];
      if (horaPart && !horaPart.startsWith('00:00:00')) {
        // Usar data base do pedido mas com hora de atualização
        const dataPart = (dataBase || dataAtualizacao).split('T')[0];
        dataPedido = `${dataPart}T${horaPart}-03:00`;
        temHoraReal = true;
      }
    }
  }

  // 3. Tentar outras datas do pedido completo (data, dataFaturamento)
  if (!temHoraReal) {
    const datasAlternativas = [
      pedidoCompleto?.data,
      pedidoCompleto?.dataFaturamento,
      pedidoCompleto?.dataEnvio,
    ].filter(Boolean);

    for (const dataAlt of datasAlternativas) {
      if (dataAlt && typeof dataAlt === 'string' && dataAlt.includes('T')) {
        const horaPart = dataAlt.split('T')[1]?.split(/[+\-Z]/)?.[0];
        if (horaPart && !horaPart.startsWith('00:00:00')) {
          const dataPart = (dataBase || dataAlt).split('T')[0];
          dataPedido = `${dataPart}T${horaPart}-03:00`;
          temHoraReal = true;
          break;
        }
      }
    }
  }

  // 4. Se ainda não tem, tentar do pedido original
  if (!dataPedido) {
    const datasOriginais = [
      pedido.dataCriacao,
      pedido.data_criacao,
      pedido.data,
      pedido.dataFaturamento,
      pedido.data_faturamento,
    ].filter(Boolean);

    for (const dataOrig of datasOriginais) {
      if (dataOrig && typeof dataOrig === 'string') {
        if (dataOrig.includes('T')) {
          const horaPart = dataOrig.split('T')[1]?.split(/[+\-Z]/)?.[0];
          if (horaPart && !horaPart.startsWith('00:00:00')) {
            dataPedido = dataOrig;
            temHoraReal = true;
            break;
          } else {
            // Tem data mas sem hora real, usar como base
            if (!dataBase) {
              dataBase = dataOrig;
            }
          }
        } else {
          // Apenas data, usar como base
          if (!dataBase) {
            dataBase = dataOrig;
          }
        }
      }
    }
  }

  // 5. Se temos data base mas não tem hora real, adicionar timezone
  if (dataPedido && dataPedido.includes('T')) {
    if (!dataPedido.includes('Z') && !dataPedido.includes('+') && !dataPedido.includes('-', 10)) {
      dataPedido = `${dataPedido}-03:00`;
    }
  } else if (dataBase) {
    // 6. Último recurso: usar data base com meia-noite (mas logar aviso)
    const dataPart = dataBase.includes('T') ? dataBase.split('T')[0] : dataBase;
    dataPedido = `${dataPart}T00:00:00-03:00`;
    console.warn(`[SyncBackground] ⚠️ Pedido ${tinyId}: Data sem hora real disponível, usando 00:00:00 como fallback`);
  }

  // Calcular valor total
  let valorTotal = 0;
  if (pedidoCompleto?.valorTotalPedido) {
    valorTotal = parseFloat(pedidoCompleto.valorTotalPedido);
  } else if (pedido.valorTotalPedido) {
    valorTotal = parseFloat(pedido.valorTotalPedido);
  } else if (itensComCategorias && itensComCategorias.length > 0) {
    valorTotal = itensComCategorias.reduce((sum, item) => {
      return sum + (parseFloat(item.valorUnitario || 0) * parseFloat(item.quantidade || 0));
    }, 0);
  }

  // Preparar objeto do pedido
  const orderData = {
    store_id: storeId,
    tiny_id: tinyId,
    numero_pedido: (pedido.numeroPedido || pedido.numero)?.toString() || null,
    numero_ecommerce: (pedido.ecommerce?.numeroPedidoEcommerce || pedido.numero_ecommerce)?.toString() || null,
    situacao: pedido.situacao?.toString() || null,
    data_pedido: dataPedido,
    cliente_id: clienteId,
    cliente_nome: pedido.cliente?.nome || null,
    cliente_cpf_cnpj: normalizeCPFCNPJ(pedido.cliente?.cpfCnpj || pedido.cliente?.cpf || pedido.cliente?.cnpj || null),
    cliente_telefone: normalizeTelefone(pedido.cliente?.telefone || pedido.cliente?.celular || null),
    valor_total: valorTotal || 0,
    valor_desconto: parseFloat(pedido.valorDesconto || pedido.valor_desconto || 0),
    valor_frete: parseFloat(pedido.valorFrete || pedido.valor_frete || 0),
    forma_pagamento: pedido.pagamento?.formaPagamento?.nome || null,
    forma_envio: pedido.transportador?.formaEnvio?.nome || null,
    endereco_entrega: pedido.enderecoEntrega || null,
    itens: (itensComCategorias && itensComCategorias.length > 0) ? itensComCategorias : null,
    observacoes: pedido.observacoes || null,
    vendedor_nome: pedido.vendedor?.nome || pedido.vendedor_nome || null,
    vendedor_tiny_id: pedido.vendedor?.id?.toString() || null,
    colaboradora_id: colaboradoraId,
    dados_extras: pedido.dados_extras || null,
    sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return orderData;
}
