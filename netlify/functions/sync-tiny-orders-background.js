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

/**
 * ✅ FUNÇÃO AUXILIAR: Detectar se é vale troca (com todas as variações)
 * Variações suportadas:
 * - vale troca, vale-troca
 * - vales trocas, vale-trocas
 * - troca
 * - cupom de troca, cupons de troca
 */
function isValeTroca(texto) {
  if (!texto) return false;
  const textoLower = texto.toString().toLowerCase().replace(/[-\s]/g, '');

  const variacoes = [
    'valetroca', 'valestrocas', 'troca',
    'cupomdetroca', 'cuponsdetroca'
  ];

  return variacoes.some(variacao => textoLower.includes(variacao));
}

const {
  shouldUpdateOrder,
  shouldUpdateContact,
  mergeDataPreservingExisting,
} = require('./utils/updateLogic');

exports.handler = async (event, context) => {
  // ✅ IMPORTANTE: Para hard sync, manter o contexto vivo para garantir processamento
  // Netlify Functions têm timeout de 26 segundos (free tier) ou mais (paid)
  // Para hard sync, vamos tentar processar pelo menos uma parte antes de retornar
  context.callbackWaitsForEmptyEventLoop = true; // Manter contexto vivo para hard sync

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

    const {
      store_id,
      storeId: inputStoreId,
      data_inicio,
      incremental = true,
      limit = 500,
      max_pages = 999999,
      hard_sync = false,
      mode,
      ultimo_numero_conhecido, // ✅ NOVO: Último número de pedido conhecido no banco
      modo_incremental_otimizado = false, // ✅ NOVO: Flag para modo otimizado
      tipo_sync, // ✅ NOVO: Tipo de sincronização (incremental_1min, ultima_hora, etc.)
      apenas_novas_vendas = false, // ✅ NOVO: Apenas vendas novas (não atualizar existentes)
      apenas_atualizacoes = false, // ✅ NOVO: Apenas atualizações (não criar novos)
    } = body;

    // ✅ CORREÇÃO: Unificar store_id e storeId numa única variável válida
    const storeId = store_id || inputStoreId;
    const finalStoreId = storeId; // Manter alias se necessário

    console.log('[SyncBackground] 📋 Parâmetros recebidos:', {
      store_id,
      storeId,
      finalStoreId,
      mode,
      incremental,
      limit,
      max_pages,
      hard_sync,
      ultimo_numero_conhecido,
      modo_incremental_otimizado
    });

    if (!finalStoreId) {
      console.error('[SyncBackground] ❌ store_id/storeId não fornecido!');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'store_id ou storeId é obrigatório',
          received: { store_id, storeId, body: Object.keys(body) }
        }),
      };
    }

    console.log(`[SyncBackground] 🔄 Sincronizando loja ${finalStoreId}...`);

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

    // ✅ Validação de segurança
    if (!finalStoreId) {
      console.error('[SyncBackground] ❌ Store ID não fornecido');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Store ID é obrigatório' }),
      };
    }

    // Buscar integração da loja
    const { data: integration, error: integrationError } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('*')
      .eq('store_id', finalStoreId)
      .eq('sistema_erp', 'TINY')
      .maybeSingle(); // ✅ Usar maybeSingle para evitar erro PGRST116 quando não encontrar

    if (integrationError || !integration) {
      console.warn(`[SyncBackground] ⚠️ Integração não encontrada para store_id: ${finalStoreId}`);
      if (integrationError) console.error('[SyncBackground] Detalhes do erro:', integrationError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Integração não encontrada para esta loja',
          store_id: finalStoreId
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

    // ✅ NOVA LÓGICA: Modo incremental otimizado busca apenas pedidos novos
    let dataInicioSync = data_inicio;

    // ✅ CORREÇÃO CRÍTICA: Se modo_incremental_otimizado está ativo mas ultimo_numero_conhecido não foi passado,
    // buscar automaticamente do banco de dados
    let ultimoNumeroConhecido = ultimo_numero_conhecido;

    if (modo_incremental_otimizado && (ultimoNumeroConhecido === null || ultimoNumeroConhecido === undefined)) {
      console.log(`[SyncBackground] 🔍 Modo incremental otimizado ativo, mas ultimo_numero_conhecido não foi passado. Buscando do banco...`);

      try {
        const { data: ultimoPedido } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .select('numero_pedido, numero_ecommerce')
          .eq('store_id', finalStoreId)
          .order('numero_pedido', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (ultimoPedido) {
          ultimoNumeroConhecido = parseInt(ultimoPedido.numero_pedido || ultimoPedido.numero_ecommerce || '0');
          console.log(`[SyncBackground] ✅ Último número encontrado no banco: ${ultimoNumeroConhecido}`);
        } else {
          console.log(`[SyncBackground] ⚠️ Nenhum pedido encontrado no banco. Iniciando do zero.`);
          ultimoNumeroConhecido = 0;
        }
      } catch (error) {
        console.error(`[SyncBackground] ❌ Erro ao buscar último número do banco:`, error);
        ultimoNumeroConhecido = 0;
      }
    }

    let usarBuscaIncrementalOtimizada = modo_incremental_otimizado && ultimoNumeroConhecido !== null && ultimoNumeroConhecido !== undefined;

    if (usarBuscaIncrementalOtimizada) {
      console.log(`[SyncBackground] 🎯 MODO INCREMENTAL OTIMIZADO: Buscando apenas pedidos com número > ${ultimoNumeroConhecido}`);
      // Não usar data_inicio no modo otimizado, vamos buscar por número de pedido
      dataInicioSync = null; // Será ignorado, vamos usar filtro por número
    } else if (!dataInicioSync) {
      if (hard_sync) {
        // Hard sync: desde 01/01/2000 (formato dd/mm/yyyy para Tiny API)
        dataInicioSync = '01/01/2000';
        console.log(`[SyncBackground] 🔥 HARD SYNC: Buscando desde ${dataInicioSync}`);
      } else {
        // ✅ SINCRONIZAÇÃO MANUAL: Se não especificou data e não é hard sync, usar últimos 7 dias
        // Isso é para sincronizações manuais do frontend, não para automáticas
        // Sincronizações automáticas usam modo_incremental_otimizado (sem filtro de data)
        // Motivo: Pedidos podem ser criados num dia e aprovados dias depois.
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

        // Formatar para dd/mm/yyyy
        const dia = String(seteDiasAtras.getDate()).padStart(2, '0');
        const mes = String(seteDiasAtras.getMonth() + 1).padStart(2, '0');
        const ano = seteDiasAtras.getFullYear();
        dataInicioSync = `${dia}/${mes}/${ano}`;
        console.log(`[SyncBackground] 📅 SINCRONIZAÇÃO MANUAL: Buscando últimos 7 dias (desde ${dataInicioSync})`);
      }
    }

    console.log(`[SyncBackground] 📅 Buscando pedidos desde: ${dataInicioSync || 'modo incremental otimizado'} (hard_sync: ${hard_sync}, max_pages: ${max_pages}, ultimo_conhecido: ${ultimoNumeroConhecido || 'N/A'})`);

    // ✅ HARD SYNC: Processar diretamente chamando a função normalmente
    // O problema do background assíncrono é que Netlify pode encerrar o contexto
    // Então vamos processar diretamente, mas otimizar para não dar timeout
    if (hard_sync) {
      console.log(`[SyncBackground] 🔥 HARD SYNC ABSOLUTO: Processando todos os pedidos... Isso pode levar várias horas.`);

      // ✅ Para hard sync, sempre usar 100 por página (máximo permitido pela API Tiny v3)
      const hardSyncLimit = 100;
      console.log(`[SyncBackground] 🔥 HARD SYNC: Usando limite de ${hardSyncLimit} pedidos por página (ignorando limit=${limit} do body)`);

      // Retornar status 202 primeiro para o frontend saber que iniciou
      // Mas processar diretamente depois (isso mantém o contexto vivo)
      // Processar diretamente na função principal garante execução
      try {
        // Processar diretamente (isso vai demorar muito, mas garante que executa)
        // Passar hardSyncLimit ao invés de limit para garantir 200 por página
        const resultado = await processarSyncCompleta(store_id, dataInicioSync, hardSyncLimit, max_pages, supabase, proxyUrl, true);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Hard sync concluído: ${resultado.synced || 0} novos, ${resultado.updated || 0} atualizados`,
            hard_sync: true,
            synced: resultado.synced || 0,
            updated: resultado.updated || 0,
            errors: resultado.errors || 0,
          }),
        };
      } catch (error) {
        console.error('[SyncBackground] ❌ Erro no hard sync:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: error.message || 'Erro ao processar hard sync',
            hard_sync: true,
          }),
        };
      }
    }

    // ✅ BUSCA INCREMENTAL OTIMIZADA: Buscar apenas pedidos novos desde último conhecido
    let allPedidos = [];
    let currentPage = 1;
    const maxPages = max_pages || (hard_sync ? 999999 : 999999);
    let hasMore = true;
    let encontrouUltimoConhecido = false;

    if (usarBuscaIncrementalOtimizada) {
      // 🛑 FREIO DE EMERGÊNCIA: No modo incremental (1 min), nunca deve precisar de muitas páginas
      // Usuário solicitou MAX 20 pedidos NO TOTAL. Então 1 página de 20 é suficiente.
      const LIMIT_PAGINAS_INCREMENTAL = 1;

      // ✅ CORREÇÃO: Buscar pedidos dos últimos 7 dias (não apenas hoje)
      // Isso garante que pedidos do final do mês anterior ou início do novo mês sejam capturados
      const hoje = new Date();
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      
      const diaInicio = String(seteDiasAtras.getDate()).padStart(2, '0');
      const mesInicio = String(seteDiasAtras.getMonth() + 1).padStart(2, '0');
      const anoInicio = seteDiasAtras.getFullYear();
      const dataInicio = `${diaInicio}/${mesInicio}/${anoInicio}`; // Formato DD/MM/YYYY
      
      const diaFim = String(hoje.getDate()).padStart(2, '0');
      const mesFim = String(hoje.getMonth() + 1).padStart(2, '0');
      const anoFim = hoje.getFullYear();
      const dataFim = `${diaFim}/${mesFim}/${anoFim}`; // Formato DD/MM/YYYY

      console.log(`[SyncBackground] 🎯 MODO INCREMENTAL OTIMIZADO: Buscando pedidos dos últimos 7 dias (${dataInicio} até ${dataFim}) em ordem DECRESCENTE`);
      console.log(`[SyncBackground] 🛡️ FREIO DE SEGURANÇA ATIVO: Limite máximo de ${LIMIT_PAGINAS_INCREMENTAL} página(s) e 20 pedidos totais.`);

      // ✅ MODO INCREMENTAL OTIMIZADO: 
      // 1. Busca pedidos dos últimos 7 dias (para capturar mudança de mês)
      // 2. Ordem DECRESCENTE (DESC) para pegar os mais recentes primeiro
      // 3. Para assim que encontrar um pedido <= ultimoNumeroConhecido
      while (hasMore && currentPage <= maxPages && !encontrouUltimoConhecido) {
        // 🛑 Verificação extra de segurança
        if (currentPage > LIMIT_PAGINAS_INCREMENTAL) {
          console.warn(`[SyncBackground] 🛑 ALERTA: Atingiu limite de segurança (${LIMIT_PAGINAS_INCREMENTAL} páginas). Parando.`);
          break;
        }

        try {
          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              storeId: finalStoreId,
              endpoint: '/pedidos',
              method: 'GET',
              params: {
                // ✅ MODO OTIMIZADO: Não enviar filtro de data, buscar apenas por número de pedido
                // A API Tiny aceita buscar sem data quando usamos ordenação por número
                ordenar: 'numeroPedido|DESC',
                pagina: currentPage,
                limite: 20, // ✅ Limite fixo de 20 pedidos totais
                // ✅ NÃO ENVIAR dataInicial e dataFinal para evitar erro 400
              },
            }),
          });

          console.log(`[SyncBackground] 📡 [OTIMIZADO] Chamando API Tiny - Página ${currentPage}, Ordem: DESC, Limite: 20 (Sem filtro de data)`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SyncBackground] ❌ Erro na API Tiny: ${response.status} - ${errorText}`);
            throw new Error(`Erro na API Tiny: ${response.status}`);
          }

          const result = await response.json();
          let pedidos = result.itens || result.pedidos || [];

          // 🛑 FREIO MANUAL: Se a API ignorar o limite e retornar 100, cortamos aqui para 20
          if (pedidos.length > 20) {
            console.warn(`[SyncBackground] ⚠️ API retornou ${pedidos.length} pedidos (ignorou limite). Cortando para 20.`);
            pedidos = pedidos.slice(0, 20);
          }

          if (pedidos.length === 0) {
            console.log(`[SyncBackground] ✅ Fim dos dados: página ${currentPage} retornou 0 pedidos`);
            hasMore = false;
            break;
          }

          // ✅ FILTRAR: Pegar apenas pedidos com número MAIOR que o último conhecido E situação correta
          const pedidosNovos = pedidos.filter(p => {
            const pedido = p.pedido || p;
            const numeroPedido = parseInt(String(pedido.numeroPedido || pedido.numero_pedido || pedido.numero || 0));
            const situacao = Number(pedido.situacao || p.situacao || 0);
            // ✅ Apenas pedidos novos (número > último conhecido) E situação Aprovado (1) ou Faturado (3)
            return numeroPedido > ultimoNumeroConhecido && (situacao === 1 || situacao === 3);
          });

          console.log(`[SyncBackground] 📊 Página ${currentPage}: ${pedidos.length} pedidos retornados, ${pedidosNovos.length} são novos (número > ${ultimoNumeroConhecido})`);

          // ✅ PARAR IMEDIATAMENTE se encontrou um pedido com número <= último conhecido
          // Isso significa que já passamos de todos os pedidos novos
          const temPedidoAntigo = pedidos.some(p => {
            const pedido = p.pedido || p;
            const numeroPedido = parseInt(String(pedido.numeroPedido || pedido.numero_pedido || pedido.numero || 0));
            return numeroPedido <= ultimoNumeroConhecido;
          });

          if (temPedidoAntigo) {
            console.log(`[SyncBackground] ✅ Encontrou pedido antigo (número <= ${ultimoNumeroConhecido}). Todos os novos já foram coletados. PARANDO BUSCA.`);
            encontrouUltimoConhecido = true;
            hasMore = false;
            // ✅ Adicionar apenas os novos antes de parar
            if (pedidosNovos.length > 0) {
              allPedidos = allPedidos.concat(pedidosNovos);
            }
            break;
          }

          // Se encontrou pedidos novos, adicionar à lista
          if (pedidosNovos.length > 0) {
            allPedidos = allPedidos.concat(pedidosNovos);
          }

          // ✅ OTIMIZAÇÃO: Se não encontrou nenhum pedido novo nesta página, pode parar
          // (significa que todos os pedidos nesta página são antigos ou já processados)
          if (pedidosNovos.length === 0 && pedidos.length > 0) {
            console.log(`[SyncBackground] ⚠️ Página ${currentPage} não tem pedidos novos. Todos os pedidos são antigos (número <= ${ultimoNumeroConhecido}). PARANDO BUSCA.`);
            encontrouUltimoConhecido = true;
            hasMore = false;
            break;
          }

          // Se retornou menos que o limite, acabou
          if (pedidos.length < (limit || 100)) {
            hasMore = false;
            break;
          }

          currentPage++;

          // Rate limiting
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`[SyncBackground] ❌ Erro ao buscar página ${currentPage}:`, error);
          hasMore = false;
        }
      }

      console.log(`[SyncBackground] ✅ Busca incremental otimizada concluída: ${allPedidos.length} pedidos novos encontrados`);
    } else {
      // ✅ MODO NORMAL: Buscar por data (comportamento original)
      while (hasMore && currentPage <= maxPages) {
        try {
          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              storeId: finalStoreId,
              endpoint: '/pedidos',
              method: 'GET',
              params: {
                dataInicio: dataInicioSync,
                pagina: currentPage,
                limite: limit || 500,
              },
            }),
          });

          console.log(`[SyncBackground] 📡 Chamando API Tiny - Página ${currentPage}, Data: ${dataInicioSync}, Limite: ${limit || 500}`);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao buscar pedidos: ${errorText}`);
          }

          const result = await response.json();

          // Tiny ERP v3 retorna dados em { itens: [...], paginacao: {...} }
          const pedidos = result.itens || result.pedidos || [];

          // ✅ PARAR se página retornou 0 pedidos
          if (pedidos.length === 0) {
            console.log(`[SyncBackground] ✅ Fim dos dados: página ${currentPage} retornou 0 pedidos`);
            hasMore = false;
            break;
          }

          allPedidos = allPedidos.concat(pedidos);

          // Verificar se há mais páginas
          const paginacao = result.paginacao || {};
          const totalPaginas = paginacao.totalPaginas || paginacao.total_paginas || 0;
          const paginaAtual = paginacao.paginaAtual || paginacao.pagina || currentPage;

          // ✅ Usar totalPaginas da API se disponível
          if (totalPaginas > 0) {
            hasMore = paginaAtual < totalPaginas && currentPage < maxPages;
            console.log(`[SyncBackground] 📊 Paginação API: ${paginaAtual}/${totalPaginas}, continuar=${hasMore}`);
          } else {
            // Se API não retornar totalPaginas, continuar até página vazia
            hasMore = currentPage < maxPages;
          }

          currentPage++;

          console.log(`[SyncBackground] 📄 Página ${currentPage - 1}: ${pedidos.length} pedidos encontrados, total acumulado: ${allPedidos.length}`);

        } catch (error) {
          console.error(`[SyncBackground] ❌ Erro ao buscar página ${currentPage}:`, error);
          hasMore = false;
        }
      }
    }

    console.log(`[SyncBackground] 📊 Total de ${allPedidos.length} pedidos encontrados`);

    // Filtrar apenas pedidos faturados (situacao = 1 ou 3)
    // ✅ REQUISITO: Apenas Aprovado (1) e Faturado (3). Sem exceção.
    // ✅ REQUISITO: Apenas Aprovado (1) e Faturado (3). Sem exceção.
    const pedidosFaturados = [];
    const pedidosIgnorados = [];

    allPedidos.forEach(p => {
      const situacao = Number(p.situacao || p.pedido?.situacao);
      const id = p.id || p.pedido?.id;

      if (situacao === 1 || situacao === 3) {
        pedidosFaturados.push(p);
      } else {
        pedidosIgnorados.push({ id, situacao });
      }
    });

    console.log(`[SyncBackground] ✅ ${pedidosFaturados.length} pedidos válidos (Aprovado/Faturado) para processar`);
    if (pedidosIgnorados.length > 0) {
      console.log(`[SyncBackground] ℹ️ ${pedidosIgnorados.length} pedidos ignorados (Status incorreto):`,
        pedidosIgnorados.slice(0, 5).map(p => `${p.id} (Status: ${p.situacao})`)
      );
    }

    // Limpar cache no início da sincronização
    clearCache();

    // Processar e salvar pedidos
    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const pedidoData of pedidosFaturados) {
      try {
        const pedido = pedidoData.pedido || pedidoData;

        // ✅ CORREÇÃO CRÍTICA: Usar numeroPedido como identificador principal (mais estável)
        // O numeroPedido é o que o usuário vê e é mais confiável que o ID interno do Tiny
        const numeroPedido = pedido.numeroPedido || pedido.numero_pedido || pedido.numero;
        const tinyIdInterno = String(pedido.id || numeroPedido || `temp_${Date.now()}`);

        // ✅ Usar numeroPedido como tiny_id principal (compatibilidade com dados antigos)
        const tinyId = numeroPedido ? String(numeroPedido) : tinyIdInterno;

        console.log(`[SyncBackground] 📦 Processando pedido - ID Tiny: ${pedido.id}, Número: ${numeroPedido}, tiny_id: ${tinyId}...`);

        // ✅ OTIMIZAÇÃO CRÍTICA: Verificar se pedido já existe por numero_pedido (PRIMEIRO) ou tiny_id (FALLBACK)
        // REQUISITO DO USUÁRIO: "só quero que traga as vendas novas nessa background"
        // Se já existe, PULAR IMEDIATAMENTE. Não atualizar, não buscar detalhes.
        try {
          // ✅ PRIMEIRO: Verificar por numero_pedido (mais confiável)
          let existingOrderCheck = null;

          if (numeroPedido) {
            const { data: checkByNumero } = await supabase
              .schema('sistemaretiradas')
              .from('tiny_orders')
              .select('id, tiny_id, numero_pedido')
              .eq('store_id', storeId)
              .eq('numero_pedido', String(numeroPedido))
              .maybeSingle();

            if (checkByNumero) {
              existingOrderCheck = checkByNumero;
              console.log(`[SyncBackground] 🔍 Pedido encontrado por numero_pedido: ${numeroPedido} (tiny_id no banco: ${checkByNumero.tiny_id})`);
            }
          }

          // ✅ FALLBACK: Se não encontrou por numero_pedido, verificar por tiny_id (compatibilidade)
          if (!existingOrderCheck) {
            const { data: checkByTinyId } = await supabase
              .schema('sistemaretiradas')
              .from('tiny_orders')
              .select('id, tiny_id, numero_pedido')
              .eq('store_id', storeId)
              .eq('tiny_id', tinyId)
              .maybeSingle();

            if (checkByTinyId) {
              existingOrderCheck = checkByTinyId;
              console.log(`[SyncBackground] 🔍 Pedido encontrado por tiny_id: ${tinyId} (numero_pedido no banco: ${checkByTinyId.numero_pedido})`);
            }
          }

          // ✅ FALLBACK FINAL: Verificar por ID interno do Tiny (para dados muito antigos)
          if (!existingOrderCheck && pedido.id) {
            const { data: checkByTinyIdInterno } = await supabase
              .schema('sistemaretiradas')
              .from('tiny_orders')
              .select('id, tiny_id, numero_pedido')
              .eq('store_id', storeId)
              .eq('tiny_id', String(pedido.id))
              .maybeSingle();

            if (checkByTinyIdInterno) {
              existingOrderCheck = checkByTinyIdInterno;
              console.log(`[SyncBackground] 🔍 Pedido encontrado por ID interno Tiny: ${pedido.id} (numero_pedido no banco: ${checkByTinyIdInterno.numero_pedido})`);
            }
          }

          if (existingOrderCheck) {
            console.log(`[SyncBackground] ⏩ Pedido já existe (ID: ${existingOrderCheck.id}, tiny_id: ${existingOrderCheck.tiny_id}, numero_pedido: ${existingOrderCheck.numero_pedido}). Pulando (foco em novas vendas)...`);
            continue;
          }
        } catch (checkError) {
          console.warn(`[SyncBackground] ⚠️ Erro ao verificar existência do pedido:`, checkError);
        }

        // ✅ TAREFA 1: Buscar detalhes completos do pedido
        console.log(`[SyncBackground] 🔍 Buscando detalhes completos do pedido ${pedido.id}...`);
        let pedidoCompleto = null;

        try {
          pedidoCompleto = await fetchPedidoCompletoFromTiny(storeId, pedido.id);

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

          clienteId = await syncTinyContact(supabase, storeId, pedido.cliente, tinyId);

          if (clienteId) {
            console.log(`[SyncBackground] ✅ Cliente sincronizado com ID: ${clienteId.substring(0, 8)}...`);
          } else {
            console.warn(`[SyncBackground] ⚠️ Cliente não foi sincronizado`);
          }
        }

        // ✅ TAREFA 4: Processar itens completos com extração de dados
        const itensProcessados = await Promise.all(
          (itensParaProcessar || []).map(async (item) => {
            return await processarItemCompleto(storeId, item, pedidoCompleto?.id || pedido.id);
          })
        );

        console.log(`[SyncBackground] ✅ Pedido ${pedido.id} processado: ${itensProcessados.length} itens com categorias`);

        // ✅ TAREFA 5: Buscar colaboradora pelo vendedor
        let colaboradoraId = null;
        if (pedido.vendedor && pedido.vendedor.id) {
          colaboradoraId = await findCollaboratorByVendedor(supabase, storeId, pedido.vendedor);
          if (colaboradoraId) {
            console.log(`[SyncBackground] ✅ Colaboradora encontrada: ${colaboradoraId.substring(0, 8)}...`);
          }
        }

        // ✅ TAREFA 7: Verificar se precisa atualizar (usar mesma lógica de verificação)
        let existingOrder = null;

        // Verificar por numero_pedido primeiro
        if (numeroPedido) {
          const { data: checkByNumero } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .select('id, tiny_id, numero_pedido, data_pedido, valor_total')
            .eq('store_id', storeId)
            .eq('numero_pedido', String(numeroPedido))
            .maybeSingle();

          if (checkByNumero) {
            existingOrder = checkByNumero;
          }
        }

        // Fallback: verificar por tiny_id
        if (!existingOrder) {
          const { data: checkByTinyId } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .select('id, tiny_id, numero_pedido, data_pedido, valor_total')
            .eq('store_id', storeId)
            .eq('tiny_id', tinyId)
            .maybeSingle();

          if (checkByTinyId) {
            existingOrder = checkByTinyId;
          }
        }

        // Fallback final: verificar por ID interno
        if (!existingOrder && pedido.id) {
          const { data: checkByTinyIdInterno } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_orders')
            .select('id, tiny_id, numero_pedido, data_pedido, valor_total')
            .eq('store_id', storeId)
            .eq('tiny_id', String(pedido.id))
            .maybeSingle();

          if (checkByTinyIdInterno) {
            existingOrder = checkByTinyIdInterno;
          }
        }

        // ✅ TAREFA 6 (MOVIDA): Preparar dados do pedido completo (agora com existingOrder)
        const orderData = prepararDadosPedidoCompleto(storeId, pedido, pedidoCompleto, clienteId, colaboradoraId, itensProcessados, tinyId, existingOrder);

        // ✅ Pular pedidos com valor zero ou negativo (vale troca cobriu 100% ou mais)
        if (!orderData || orderData.valor_total <= 0) {
          console.log(`[SyncBackground] ⏭️ Pedido ${tinyId} ignorado (valor zero ou negativo após desconto de vale troca)`);
          continue;
        }

        const precisaAtualizar = !existingOrder || shouldUpdateOrder(existingOrder, orderData);

        if (!precisaAtualizar && existingOrder) {
          console.log(`[SyncBackground] ℹ️ Pedido ${tinyId} não precisa ser atualizado`);
          continue;
        }

        // ✅ DEBUG RADICAL: Verificar colisão
        if (existingOrder) {
          console.log(`[SyncBackground] 🔍 Pedido ${tinyId} encontrou existente com ID interno: ${existingOrder.id} (TinyID no banco: ${existingOrder.tiny_id})`);
          if (existingOrder.tiny_id !== tinyId) {
            console.error(`[SyncBackground] 🚨 COLISÃO DETECTADA! Busquei ${tinyId} mas retornou ${existingOrder.tiny_id}`);
          }
        }

        // ✅ TAREFA 8: Salvar pedido completo
        let orderSavedId = null;

        // ✅ Garantir que numero_pedido não seja NULL para upsert funcionar
        if (!orderData.numero_pedido) {
          console.warn(`[SyncBackground] ⚠️ Pedido ${pedido.id} não tem numero_pedido. Usando ID interno como fallback.`);
          orderData.numero_pedido = String(pedido.id);
          orderData.tiny_id = String(pedido.id);
        }

        const { error: upsertError, data: savedOrder } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .upsert(orderData, {
            onConflict: 'numero_pedido,store_id', // ✅ Usar numero_pedido como chave de conflito (mais confiável)
          })
          .select('id')
          .single();

        if (upsertError) {
          console.error(`[SyncBackground] ❌ Erro ao salvar pedido ${tinyId}:`, upsertError);
          errors++;
        } else {
          orderSavedId = savedOrder?.id || existingOrder?.id;

          if (existingOrder) {
            updated++;
            console.log(`[SyncBackground] ✅ Pedido ${tinyId} atualizado`);
          } else {
            synced++;
            console.log(`[SyncBackground] ✅ Pedido ${tinyId} criado`);

            // ✅ NOVA FUNCIONALIDADE: Enviar WhatsApp quando detectar nova venda do ERP
            // Executar em background (não bloquear sincronização)
            (async () => {
              try {
                await enviarWhatsAppNovaVendaTiny(supabase, orderData, storeId, itensProcessados, pedidoCompleto);
              } catch (error) {
                console.error(`[SyncBackground] ❌ Erro ao enviar WhatsApp (não bloqueia sincronização):`, error);
              }
            })();
          }

          // ✅ TAREFA 9: Gerar cashback com FALLBACK manual (trigger + manual)
          // O trigger do banco gera automaticamente, mas fazemos uma tentativa manual como fallback
          // para garantir que funcione mesmo se o trigger falhar
          if (orderSavedId && clienteId && orderData.valor_total > 0) {
            try {
              // Aguardar um pouco para o trigger executar primeiro
              await new Promise(resolve => setTimeout(resolve, 500));

              // Verificar se o cashback já foi gerado pelo trigger
              const { data: existingCashback } = await supabase
                .schema('sistemaretiradas')
                .from('cashback_transactions')
                .select('id')
                .eq('tiny_order_id', orderSavedId)
                .eq('transaction_type', 'EARNED')
                .maybeSingle();

              if (existingCashback) {
                console.log(`[SyncBackground] ✅ Cashback já gerado automaticamente pelo trigger para pedido ${tinyId}`);
              } else {
                // ✅ FALLBACK: Tentar gerar manualmente se o trigger não gerou
                // O trigger já valida cancelados, então aqui tentamos gerar para qualquer situação
                console.log(`[SyncBackground] ⚠️ Cashback não foi gerado pelo trigger, tentando FALLBACK manual para pedido ${tinyId}`);

                const { data: cashbackResult, error: cashbackError } = await supabase
                  .schema('sistemaretiradas')
                  .rpc('gerar_cashback', {
                    p_tiny_order_id: orderSavedId,
                    p_cliente_id: clienteId,
                    p_store_id: storeId,
                    p_colaboradora_id: colaboradoraId, // ✅ NOVO: Passar colaboradora
                    p_valor_total: orderData.valor_total
                  });

                if (cashbackError) {
                  console.error(`[SyncBackground] ❌ Erro no FALLBACK manual para pedido ${tinyId}:`, cashbackError);
                } else if (cashbackResult && cashbackResult.success) {
                  console.log(`[SyncBackground] ✅ Cashback gerado via FALLBACK manual: R$ ${cashbackResult.amount}`);

                  // ✅ NOVO: Processar fila de WhatsApp após gerar cashback
                  if (cashbackResult.whatsapp_queue_id) {
                    console.log(`[SyncBackground] 📱 Processando fila de WhatsApp para cashback gerado (Queue ID: ${cashbackResult.whatsapp_queue_id})`);
                    // Processar fila em background (não bloqueia sincronização)
                    (async () => {
                      try {
                        const queueUrl = `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/process-cashback-whatsapp-queue`;
                        await fetch(queueUrl, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                        });
                        console.log(`[SyncBackground] ✅ Fila de WhatsApp processada para pedido ${tinyId}`);
                      } catch (queueError) {
                        console.warn(`[SyncBackground] ⚠️ Erro ao processar fila de WhatsApp (não bloqueia):`, queueError.message);
                      }
                    })();
                  }
                } else {
                  console.log(`[SyncBackground] ℹ️ FALLBACK não gerou cashback: ${cashbackResult?.message || 'Motivo desconhecido'}`);
                }
              }
            } catch (cashbackException) {
              console.error(`[SyncBackground] ❌ Exceção no FALLBACK de cashback para pedido ${tinyId}:`, cashbackException);
              // Não falhar a sincronização do pedido por causa do cashback
            }
          }
        }

      } catch (error) {
        console.error(`[SyncBackground] ❌ Erro ao processar pedido:`, error);
        errors++;
      }
    }

    console.log(`[SyncBackground] ✅ Sincronização concluída: ${synced} novos, ${updated} atualizados, ${errors} erros`);

    // ✅ NOVA FUNCIONALIDADE: Criar vendas automaticamente a partir dos pedidos sincronizados
    // ⚠️ IMPORTANTE: Sempre executar, mesmo se não houver novos pedidos (pode haver pedidos antigos sem venda)
    // ⚠️ IMPORTANTE: Aguardar um pouco para garantir que todas as transações foram commitadas
    console.log(`[SyncBackground] ⏳ Aguardando 2 segundos para garantir que todas as transações foram commitadas...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`[SyncBackground] 🔄 Criando vendas automaticamente a partir dos pedidos do Tiny...`);
    console.log(`[SyncBackground] 📋 Parâmetros: store_id=${storeId || 'NULL'}, data_inicio=NULL`);
    console.log(`[SyncBackground] 📋 Nota: Processando TODOS os pedidos sem venda (não apenas os novos sincronizados)`);
    
    try {
      // ✅ IMPORTANTE: Processar TODOS os pedidos sem venda, não apenas os da sincronização atual
      // Isso garante que pedidos que não foram processados anteriormente sejam criados
      // ✅ CRÍTICO: Sempre chamar, mesmo se synced = 0 (pode haver pedidos antigos sem venda)
      const { data: vendasResult, error: vendasError } = await supabase
        .schema('sistemaretiradas')
        .rpc('criar_vendas_de_tiny_orders', {
          p_store_id: storeId || null, // Se fornecido, processa apenas esta loja
          p_data_inicio: null // Processar TODOS os pedidos (garante que nada seja perdido)
        });

      if (vendasError) {
        console.error(`[SyncBackground] ❌ Erro ao criar vendas:`, vendasError);
        console.error(`[SyncBackground] ❌ Detalhes do erro:`, JSON.stringify(vendasError, null, 2));
      } else {
        console.log(`[SyncBackground] 📊 Resultado da função criar_vendas_de_tiny_orders:`, JSON.stringify(vendasResult, null, 2));
        
        if (vendasResult && vendasResult.length > 0) {
          const result = vendasResult[0];
          console.log(`[SyncBackground] ✅ Vendas criadas: ${result.vendas_criadas || 0} novas, ${result.vendas_atualizadas || 0} atualizadas, ${result.erros || 0} erros`);

          if (result.erros > 0) {
            console.warn(`[SyncBackground] ⚠️ Alguns pedidos tiveram erro ao criar venda. Verifique os detalhes.`);
            if (result.detalhes) {
              const erros = result.detalhes.filter((d) => d.tipo === 'erro');
              console.warn(`[SyncBackground] ⚠️ Erros detalhados:`, JSON.stringify(erros, null, 2));
            }
          }
          
          // ✅ LOG DETALHADO: Mostrar todas as vendas criadas/atualizadas
          if (result.detalhes && Array.isArray(result.detalhes)) {
            const criadas = result.detalhes.filter((d) => d.tipo === 'criada');
            const atualizadas = result.detalhes.filter((d) => d.tipo === 'atualizada');
            
            if (criadas.length > 0) {
              console.log(`[SyncBackground] 📝 Vendas criadas (${criadas.length}):`, criadas.map((d) => `Pedido #${d.numero_pedido} -> Sale ID: ${d.sale_id}`).join(', '));
            }
            if (atualizadas.length > 0) {
              console.log(`[SyncBackground] 🔄 Vendas atualizadas (${atualizadas.length}):`, atualizadas.map((d) => `Pedido #${d.numero_pedido} -> Sale ID: ${d.sale_id}`).join(', '));
            }
          }
        } else {
          console.warn(`[SyncBackground] ⚠️ Função retornou resultado vazio ou nulo.`);
          console.warn(`[SyncBackground] ⚠️ Isso pode significar que não há pedidos sem venda OU que a função não está retornando dados corretamente.`);
          console.warn(`[SyncBackground] ⚠️ Verifique os logs do banco de dados para mais detalhes.`);
        }
      }
    } catch (vendasException) {
      console.error(`[SyncBackground] ❌ Exceção ao criar vendas (não bloqueia sincronização):`, vendasException);
      console.error(`[SyncBackground] ❌ Stack trace:`, vendasException.stack);
      console.error(`[SyncBackground] ❌ Tipo do erro:`, typeof vendasException);
      console.error(`[SyncBackground] ❌ Mensagem:`, vendasException.message);
      // Não falhar a sincronização se a criação de vendas falhar
    }

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
  // ✅ Para hard sync, sempre usar 100 por página (máximo da API Tiny v3)
  const limite = hardSync ? 100 : (limit || 100);

  console.log(`[SyncBackground] 🔄 Iniciando processamento completo em background... (hardSync: ${hardSync}, limite: ${limite} por página)`);

  // Buscar pedidos do Tiny ERP
  let allPedidos = [];
  let currentPage = 1;
  let hasMore = true;

  // Variáveis para detecção de loop infinito (páginas duplicadas)
  let lastPageFirstId = null;
  let lastPageLastId = null;

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
                  dataInicial: dataInicioSync,
                  limit: limite, // ✅ CORREÇÃO: Nome correto é 'limit'
                  offset: (currentPage - 1) * limite, // ✅ CORREÇÃO: API v3 usa 'offset', não 'pagina'
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

      console.log(`[SyncBackground] 📡 Chamando API Tiny - Página ${currentPage} (Offset ${(currentPage - 1) * limite}), Data: ${dataInicioSync}, Limite: ${limite}`);

      const response = await fetchWithRetry();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar pedidos (status ${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // Tiny ERP v3 retorna dados em { itens: [...], paginacao: {...} }
      const pedidos = result.itens || result.pedidos || [];
      allPedidos = allPedidos.concat(pedidos);

      // ✅ Verificar se há mais páginas - lógica ajustada para v3 (limit/offset/total)
      const paginacao = result.paginacao || {};
      const totalRegistros = paginacao.total || paginacao.totalRegistros || paginacao.total_registros || 0;

      // Calcular total de páginas baseado no total de registros
      let totalPaginas = 0;
      if (totalRegistros > 0) {
        totalPaginas = Math.ceil(totalRegistros / limite);
      } else {
        // Fallback: se não tem total, tentar estimar ou usar o que temos
        totalPaginas = paginacao.totalPaginas || paginacao.pages || 0;
      }

      // ✅ CORREÇÃO CRÍTICA: SEMPRE recalcular totalPaginas usando pedidos.length REAL se necessário
      if (totalRegistros > 0 && pedidos.length > 0) {
        // Se a API retornou menos itens que o limite e diz que tem mais, algo está estranho, mas vamos confiar no total
        // O cálculo acima (total / limite) é o mais correto para offset-based pagination
      }

      console.log(`[SyncBackground] 📄 Página ${currentPage}: ${pedidos.length} pedidos encontrados`);

      // ✅ DEBUG: Logar IDs do primeiro e último pedido para verificar se páginas são iguais
      let primeiroId = null;
      let ultimoId = null;

      if (pedidos.length > 0) {
        primeiroId = pedidos[0].id || pedidos[0].numeroPedido;
        ultimoId = pedidos[pedidos.length - 1].id || pedidos[pedidos.length - 1].numeroPedido;
        console.log(`[SyncBackground] 🔍 IDs da Página ${currentPage}: Primeiro=${primeiroId}, Último=${ultimoId}`);

        // ✅ DETECÇÃO DE PÁGINA DUPLICADA
        // Se a página atual tem os mesmos IDs da página anterior, a API está ignorando a paginação
        if (lastPageFirstId && lastPageLastId &&
          String(primeiroId) === String(lastPageFirstId) &&
          String(ultimoId) === String(lastPageLastId)) {

          console.error(`[SyncBackground] 🚨 ERRO CRÍTICO: PÁGINA DUPLICADA DETECTADA!`);
          console.error(`[SyncBackground] 🚨 A API retornou exatamente os mesmos dados da página anterior.`);
          console.error(`[SyncBackground] 🚨 Abortando para evitar loop infinito de updates.`);
          hasMore = false;
          break;
        }

        // Atualizar IDs da última página para próxima verificação
        lastPageFirstId = primeiroId;
        lastPageLastId = ultimoId;
      }

      console.log(`[SyncBackground] 📊 Paginação: página atual=${currentPage}, total páginas=${totalPaginas}, total registros=${totalRegistros}, já processados=${allPedidos.length}`);

      // ✅ Verificar se devemos continuar
      if (pedidos.length < limite) {
        // Se retornou menos que o limite, acabou
        hasMore = false;
        console.log(`[SyncBackground] 🏁 Fim da paginação: retornou ${pedidos.length} itens (menor que limite ${limite})`);
      } else if (totalPaginas > 0) {
        // Se temos total de páginas, verificar se chegamos ao fim
        hasMore = currentPage < totalPaginas;
        console.log(`[SyncBackground] 📊 Usando paginação: ${currentPage}/${totalPaginas}, hasMore=${hasMore}`);
      } else {
        // Fallback: continua enquanto vierem itens cheios
        hasMore = true;
      }

      // Incrementa página para próxima iteração
      currentPage++;

      // Safety check para maxPages
      if (currentPage > maxPages) {
        hasMore = false;
        console.log(`[SyncBackground] 🛑 Atingiu limite máximo de páginas (${maxPages})`);
      }

      // ✅ Rate Limiting: Aguardar 1 segundo entre páginas para evitar 429 Too Many Requests
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

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

  // Filtrar pedidos aprovados E faturados (situacao = 1 ou 3)
  const pedidosFaturados = allPedidos.filter(p => {
    const situacao = p.situacao || p.pedido?.situacao;
    // 1 = Aprovado, 3 = Faturado
    return situacao === 1 || situacao === 3 ||
      situacao === 'aprovado' || situacao === 'Aprovado' ||
      situacao === 'faturado' || situacao === 'Faturado';
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

      // ✅ Verificar se pedido já existe ANTES de preparar dados
      // Isso permite preservar data_pedido e valor_total originais
      const { data: existingOrder } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('tiny_id', tinyId)
        .maybeSingle();

      // Preparar dados do pedido completo
      const orderData = prepararDadosPedidoCompleto(storeId, pedido, pedidoCompleto, clienteId, colaboradoraId, itensProcessados, tinyId, existingOrder);

      const precisaAtualizar = !existingOrder || shouldUpdateOrder(existingOrder, orderData);

      if (!precisaAtualizar && existingOrder) {
        console.log(`[SyncBackground] ℹ️ Pedido ${tinyId} não precisa ser atualizado`);
        continue;
      }

      // ✅ CRÍTICO: Se pedido já existe, fazer UPDATE sem data_pedido (nunca atualizar)
      // Se é novo pedido, fazer INSERT com data_pedido completa
      if (existingOrder && existingOrder.data_pedido) {
        // ✅ PEDIDO EXISTE: Fazer UPDATE excluindo data_pedido (NUNCA atualizar)
        const { data_pedido, ...orderDataSemData } = orderData;

        // Preservar valor se já existe e não é zero
        const valorFinal = (existingOrder.valor_total > 0 && orderData.valor_total === 0)
          ? existingOrder.valor_total
          : (orderData.valor_total > 0 ? orderData.valor_total : existingOrder.valor_total);

        const updateData = {
          ...orderDataSemData,
          valor_total: valorFinal,
          // data_pedido NÃO está incluída - nunca será atualizada!
        };

        console.log(`[SyncBackground] 🔒 Pedido ${tinyId} (EXISTENTE): Fazendo UPDATE sem data_pedido (travada: ${existingOrder.data_pedido})`);

        const { error: updateError } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .update(updateData)
          .eq('tiny_id', tinyId)
          .eq('store_id', storeId);

        if (updateError) {
          console.error(`[SyncBackground] ❌ Erro ao atualizar pedido ${tinyId}:`, updateError);
          errors++;
        } else {
          updated++;
          console.log(`[SyncBackground] ✅ Pedido ${tinyId} atualizado (data_pedido preservada: ${existingOrder.data_pedido})`);
        }
      } else {
        // ✅ NOVO PEDIDO: Fazer INSERT com data_pedido completa
        console.log(`[SyncBackground] 📝 Pedido ${tinyId} (NOVO): Fazendo INSERT com data_pedido: ${orderData.data_pedido}`);

        const { error: insertError } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_orders')
          .insert(orderData);

        if (insertError) {
          console.error(`[SyncBackground] ❌ Erro ao inserir pedido ${tinyId}:`, insertError);
          errors++;
        } else {
          synced++;
          console.log(`[SyncBackground] ✅ Pedido ${tinyId} inserido com data_pedido: ${orderData.data_pedido}`);

          // ✅ NOVA FUNCIONALIDADE: Enviar WhatsApp quando detectar nova venda do ERP
          // Executar em background (não bloquear sincronização)
          (async () => {
            try {
              await enviarWhatsAppNovaVendaTiny(supabase, orderData, storeId, itensProcessados, pedidoCompleto);
            } catch (error) {
              console.error(`[SyncBackground] ❌ Erro ao enviar WhatsApp (não bloqueia sincronização):`, error);
            }
          })();
        }
      }

      // ✅ Contadores já são atualizados acima no if/else separado

    } catch (error) {
      console.error(`[SyncBackground] ❌ Erro ao processar pedido:`, error);
      errors++;
    }
  }

  console.log(`[SyncBackground] ✅ Sincronização concluída: ${synced} novos, ${updated} atualizados, ${errors} erros`);

  return {
    synced,
    updated,
    errors,
  };
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

    // Upsert - usar abordagem mais segura
    let savedContact = null;
    let upsertError = null;

    if (existingContact && existingContact.id) {
      // Se já existe, fazer UPDATE
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .update(contatoData)
        .eq('id', existingContact.id)
        .select()
        .single();
      savedContact = data;
      upsertError = error;
    } else {
      // Se não existe, tentar INSERT
      // Primeiro verificar se já existe por tiny_id ou cpf_cnpj
      let existingByTiny = null;
      if (clienteId) {
        const { data } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .select('id')
          .eq('store_id', storeId)
          .eq('tiny_id', clienteId.toString())
          .maybeSingle();
        existingByTiny = data;
      }

      let existingByCpf = null;
      if (cpfCnpj) {
        const { data } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .select('id')
          .eq('store_id', storeId)
          .eq('cpf_cnpj', cpfCnpj)
          .maybeSingle();
        existingByCpf = data;
      }

      if (existingByTiny || existingByCpf) {
        // Já existe, fazer UPDATE
        const idToUpdate = existingByTiny?.id || existingByCpf?.id;
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .update(contatoData)
          .eq('id', idToUpdate)
          .select()
          .single();
        savedContact = data;
        upsertError = error;
      } else {
        // Não existe, fazer INSERT
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .insert(contatoData)
          .select()
          .single();
        savedContact = data;
        upsertError = error;
      }
    }

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

    // Buscar colaboradoras da loja (incluindo tiny_vendedor_id)
    const { data: colaboradoras } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, name, email, cpf, tiny_vendedor_id')
      .eq('role', 'COLABORADORA')
      .eq('is_active', true)
      .eq('store_id', storeId);

    if (!colaboradoras || colaboradoras.length === 0) {
      return null;
    }

    const normalizeCPF = (cpf) => cpf ? String(cpf).replace(/\D/g, '') : null;
    const normalizedVendedorCPF = normalizeCPF(vendedorCompleto.cpf);

    // Função auxiliar para CASAR PERMANENTEMENTE tiny_vendedor_id quando encontrar match
    // IMUTÁVEL: Uma vez casados, os IDs ficam vinculados para sempre
    const saveVendedorIdMapping = async (colaboradoraId, tinyVendedorId, colaboradoraNome, matchType) => {
      if (!tinyVendedorId) return;
      try {
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .update({ 
            tiny_vendedor_id: String(tinyVendedorId),
            tiny_vendedor_mapeado_em: new Date().toISOString(),
            tiny_vendedor_match_tipo: matchType // CPF, NOME_EXATO, NOME_PARCIAL, EMAIL
          })
          .eq('id', colaboradoraId)
          .is('tiny_vendedor_id', null) // Só atualiza se ainda não tiver (IMUTÁVEL)
          .select();
        
        if (data && data.length > 0) {
          console.log(`[SyncBackground] 🔒 CASAMENTO PERMANENTE: tiny_vendedor_id ${tinyVendedorId} -> colaboradora ${colaboradoraNome} (${colaboradoraId}) [Match: ${matchType}]`);
        } else if (!error) {
          console.log(`[SyncBackground] ℹ️ Colaboradora ${colaboradoraNome} já tem tiny_vendedor_id mapeado (imutável)`);
        }
      } catch (err) {
        console.warn(`[SyncBackground] ⚠️ Erro ao salvar mapeamento:`, err);
      }
    };

    // ✅ 1. Tentar matching por CPF primeiro (mais confiável)
    if (normalizedVendedorCPF && normalizedVendedorCPF.length >= 11) {
      const matchByCPF = colaboradoras.find((colab) => {
        const colabCPF = normalizeCPF(colab.cpf);
        return colabCPF && colabCPF === normalizedVendedorCPF;
      });
      if (matchByCPF) {
        console.log(`[SyncBackground] ✅ Match por CPF: ${vendedorCompleto.nome} -> ${matchByCPF.name}`);
        // CASAR PERMANENTEMENTE para futuras sincronizações
        if (vendedorCompleto.id && !matchByCPF.tiny_vendedor_id) {
          await saveVendedorIdMapping(matchByCPF.id, vendedorCompleto.id, matchByCPF.name, 'CPF');
        }
        return matchByCPF.id;
      }
    }

    // ✅ 2. Tentar matching por tiny_vendedor_id JÁ CASADO (imutável, mais rápido)
    if (vendedorCompleto.id) {
      const vendedorTinyId = String(vendedorCompleto.id);
      const matchByTinyId = colaboradoras.find((colab) => {
        return colab.tiny_vendedor_id && String(colab.tiny_vendedor_id) === vendedorTinyId;
      });
      if (matchByTinyId) {
        console.log(`[SyncBackground] ✅ Match por Tiny ID (CASADO): ${vendedorCompleto.nome} (ID: ${vendedorTinyId}) -> ${matchByTinyId.name}`);
        return matchByTinyId.id;
      }
    }

    // ✅ 3. Tentar matching por email
    if (vendedorCompleto.email) {
      const matchByEmail = colaboradoras.find(
        (colab) => colab.email && colab.email.toLowerCase() === vendedorCompleto.email?.toLowerCase()
      );
      if (matchByEmail) {
        console.log(`[SyncBackground] ✅ Match por Email: ${vendedorCompleto.nome} -> ${matchByEmail.name}`);
        // CASAR PERMANENTEMENTE
        if (vendedorCompleto.id && !matchByEmail.tiny_vendedor_id) {
          await saveVendedorIdMapping(matchByEmail.id, vendedorCompleto.id, matchByEmail.name, 'EMAIL');
        }
        return matchByEmail.id;
      }
    }

    // ✅ 4. Tentar matching por nome EXATO (normalizado)
    if (vendedorCompleto.nome) {
      const normalizeName = (name) => {
        if (!name) return '';
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const normalizedVendedorNome = normalizeName(vendedorCompleto.nome);
      
      // Primeiro tentar match exato
      const matchByExactName = colaboradoras.find((colab) => {
        const normalizedColabNome = normalizeName(colab.name || '');
        return normalizedColabNome === normalizedVendedorNome;
      });

      if (matchByExactName) {
        console.log(`[SyncBackground] ✅ Match por Nome Exato: ${vendedorCompleto.nome} -> ${matchByExactName.name}`);
        // CASAR PERMANENTEMENTE
        if (vendedorCompleto.id && !matchByExactName.tiny_vendedor_id) {
          await saveVendedorIdMapping(matchByExactName.id, vendedorCompleto.id, matchByExactName.name, 'NOME_EXATO');
        }
        return matchByExactName.id;
      }
      
      // Tentar match parcial (nome do vendedor contém nome da colaboradora ou vice-versa)
      const matchByPartialName = colaboradoras.find((colab) => {
        const normalizedColabNome = normalizeName(colab.name || '');
        if (!normalizedColabNome || !normalizedVendedorNome) return false;
        return normalizedColabNome.includes(normalizedVendedorNome) || 
               normalizedVendedorNome.includes(normalizedColabNome);
      });

      if (matchByPartialName) {
        console.log(`[SyncBackground] ✅ Match por Nome Parcial: ${vendedorCompleto.nome} -> ${matchByPartialName.name}`);
        // CASAR PERMANENTEMENTE
        if (vendedorCompleto.id && !matchByPartialName.tiny_vendedor_id) {
          await saveVendedorIdMapping(matchByPartialName.id, vendedorCompleto.id, matchByPartialName.name, 'NOME_PARCIAL');
        }
        return matchByPartialName.id;
      }
      
      console.log(`[SyncBackground] ⚠️ Nenhum match encontrado para vendedor: ${vendedorCompleto.nome} (ID: ${vendedorCompleto.id})`);
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
function prepararDadosPedidoCompleto(storeId, pedido, pedidoCompleto, clienteId, colaboradoraId, itensComCategorias, tinyId, existingOrder = null) {
  // ✅ NOVA LÓGICA SIMPLES: 
  // - Se já existe pedido: SEMPRE usar data_pedido que já está gravada (TRAVADA)
  // - Se é novo pedido: Pegar DATA do Tiny + HORÁRIO ATUAL de Macapá = TRAVAR para sempre
  // - NÃO tentar extrair hora do Tiny, evitar conflitos

  let dataPedido = null;

  if (existingOrder && existingOrder.data_pedido) {
    // ✅ PEDIDO JÁ EXISTE: Usar data_pedido gravada e TRAVADA (nunca alterar)
    dataPedido = existingOrder.data_pedido;
    console.log(`[SyncBackground] 🔒 Pedido ${tinyId}: Data_pedido TRAVADA (não será alterada): ${dataPedido}`);
  } else {
    // ✅ NOVO PEDIDO: Pegar DATA do Tiny + HORÁRIO ATUAL de Macapá

    // 1. Extrair apenas a DATA (sem hora) do Tiny - tentar múltiplas fontes
    let dataDoTiny = null;

    // Tentar do pedido completo primeiro
    if (pedidoCompleto?.dataCriacao) {
      const dataComHora = pedidoCompleto.dataCriacao;
      dataDoTiny = dataComHora.split('T')[0] || dataComHora.split(' ')[0];
    } else if (pedidoCompleto?.data) {
      dataDoTiny = pedidoCompleto.data.split('T')[0] || pedidoCompleto.data.split(' ')[0];
    } else if (pedidoCompleto?.dataFaturamento) {
      dataDoTiny = pedidoCompleto.dataFaturamento.split('T')[0] || pedidoCompleto.dataFaturamento.split(' ')[0];
    }
    // Tentar do pedido original
    else if (pedido.dataCriacao) {
      dataDoTiny = pedido.dataCriacao.split('T')[0] || pedido.dataCriacao.split(' ')[0];
    } else if (pedido.data) {
      dataDoTiny = pedido.data.split('T')[0] || pedido.data.split(' ')[0];
    } else if (pedido.data_criacao) {
      dataDoTiny = pedido.data_criacao.split('T')[0] || pedido.data_criacao.split(' ')[0];
    }

    // Se não encontrou data do Tiny, usar data atual
    if (!dataDoTiny) {
      const agora = new Date();
      dataDoTiny = agora.toISOString().split('T')[0];
      console.warn(`[SyncBackground] ⚠️ Pedido ${tinyId}: Nenhuma data encontrada no Tiny, usando data atual: ${dataDoTiny}`);
    }

    // 2. Pegar HORÁRIO ATUAL de Macapá (UTC-3)
    const agora = new Date();
    // Ajustar para UTC-3 (Macapá)
    const macapaTime = new Date(agora.getTime() - (3 * 60 * 60 * 1000));
    const horaAtual = macapaTime.toISOString().split('T')[1].split('.')[0]; // HH:mm:ss

    // 3. Combinar: DATA do Tiny + HORÁRIO ATUAL de Macapá
    dataPedido = `${dataDoTiny}T${horaAtual}-03:00`;

    console.log(`[SyncBackground] ⏰ Pedido ${tinyId} (NOVO): Data do Tiny (${dataDoTiny}) + Hora atual Macapá (${horaAtual}) = ${dataPedido}`);
    console.log(`[SyncBackground] 🔒 Esta data_pedido será TRAVADA para sempre após primeira sincronização`);
  }

  // ✅ Calcular valor total - Priorizar campos principais e simplificar
  // Se já existe pedido no banco e tem valor > 0, preservar
  let valorTotal = 0;

  if (existingOrder && existingOrder.valor_total > 0) {
    // Preservar valor original se já existe e não é zero
    valorTotal = parseFloat(existingOrder.valor_total);
    console.log(`[SyncBackground] 🔒 Pedido ${tinyId}: Mantendo valor_total original: ${valorTotal}`);
  } else {
    // Prioridade 1: valorTotalPedido do pedido completo (mais confiável)
    if (pedidoCompleto?.valorTotalPedido) {
      valorTotal = parseFloat(pedidoCompleto.valorTotalPedido);
      console.log(`[SyncBackground] ✅ Valor total extraído de pedidoCompleto.valorTotalPedido: ${valorTotal}`);
    }
    // Prioridade 2: valorTotalPedido do pedido original
    else if (pedido.valorTotalPedido) {
      valorTotal = parseFloat(pedido.valorTotalPedido);
      console.log(`[SyncBackground] ✅ Valor total extraído de pedido.valorTotalPedido: ${valorTotal}`);
    }
    // Prioridade 3: valor do pedido completo (campo direto)
    else if (pedidoCompleto?.valor) {
      valorTotal = parseFloat(pedidoCompleto.valor);
      console.log(`[SyncBackground] ✅ Valor total extraído de pedidoCompleto.valor: ${valorTotal}`);
    }
    // Prioridade 4: valor do pedido original (campo direto)
    else if (pedido.valor) {
      valorTotal = parseFloat(pedido.valor);
      console.log(`[SyncBackground] ✅ Valor total extraído de pedido.valor: ${valorTotal}`);
    }
    // Prioridade 5: Calcular a partir dos itens (fallback confiável)
    else if (itensComCategorias && itensComCategorias.length > 0) {
      valorTotal = itensComCategorias.reduce((sum, item) => {
        return sum + (parseFloat(item.valorUnitario || 0) * parseFloat(item.quantidade || 0));
      }, 0);
      console.log(`[SyncBackground] ✅ Valor total calculado a partir dos itens: ${valorTotal}`);
    }
    // Prioridade 6: valor_pedido do pedido completo (fallback para pedidos aprovados)
    else if (pedidoCompleto?.valor_pedido) {
      valorTotal = parseFloat(pedidoCompleto.valor_pedido);
      console.log(`[SyncBackground] ✅ Valor total extraído de pedidoCompleto.valor_pedido (fallback): ${valorTotal}`);
    }
    // Prioridade 7: valor_pedido do pedido original
    else if (pedido.valor_pedido) {
      valorTotal = parseFloat(pedido.valor_pedido);
      console.log(`[SyncBackground] ✅ Valor total extraído de pedido.valor_pedido (fallback): ${valorTotal}`);
    }
    // Prioridade 8: Calcular a partir das parcelas (para pedidos aprovados)
    else if (pedidoCompleto?.parcelas && Array.isArray(pedidoCompleto.parcelas) && pedidoCompleto.parcelas.length > 0) {
      valorTotal = pedidoCompleto.parcelas.reduce((sum, parcela) => {
        return sum + (parseFloat(parcela.valor || parcela.valorParcela || 0));
      }, 0);
      console.log(`[SyncBackground] ✅ Valor total calculado a partir das parcelas: ${valorTotal}`);
    }

    // ✅ Log se valor for zero para debug
    if (valorTotal === 0) {
      console.warn(`[SyncBackground] ⚠️ Valor total zerado para pedido ${pedidoId}. Campos disponíveis:`, {
        pedidoCompleto_valorTotalPedido: pedidoCompleto?.valorTotalPedido,
        pedido_valorTotalPedido: pedido.valorTotalPedido,
        pedidoCompleto_valor: pedidoCompleto?.valor,
        pedido_valor: pedido.valor,
        pedidoCompleto_valor_pedido: pedidoCompleto?.valor_pedido,
        pedido_valor_pedido: pedido.valor_pedido,
        pedido_total_pedido: pedido.total_pedido,
        pedidoCompleto_total: pedidoCompleto?.total,
        pedidoCompleto_totalPedido: pedidoCompleto?.totalPedido,
        pedidoCompleto_valorTotal: pedidoCompleto?.valorTotal,
        parcelas: pedidoCompleto?.parcelas ? `${pedidoCompleto.parcelas.length} parcelas` : null,
        parcelas_valor_total: pedidoCompleto?.parcelas ? pedidoCompleto.parcelas.reduce((sum, p) => sum + (parseFloat(p.valor || p.valorParcela || 0)), 0) : null,
        itens_length: itensComCategorias?.length || 0,
        itens_valor_calculado: itensComCategorias ? itensComCategorias.reduce((sum, item) => sum + (parseFloat(item.valorUnitario || 0) * parseFloat(item.quantidade || 0)), 0) : null,
      });

      // Tentar encontrar qualquer campo que contenha valor
      const todosCampos = {
        ...pedidoCompleto,
        ...pedido,
      };
      const camposComValor = Object.entries(todosCampos).filter(([key, value]) => {
        if (typeof value === 'number' && value > 0) return true;
        if (typeof value === 'string' && /^\d+\.?\d*$/.test(value) && parseFloat(value) > 0) return true;
        return false;
      }).slice(0, 10); // Limitar a 10 campos para não poluir o log
      if (camposComValor.length > 0) {
        console.warn(`[SyncBackground] 📋 Campos numéricos encontrados no pedido ${pedidoId}:`, camposComValor);
      }
    }
  }

  // ✅ CALCULAR VALE TROCA: Detectar e calcular o valor do vale troca para desconto
  let valorValeTroca = 0;

  // Verificar parcelas do pedido completo (mais confiável)
  if (pedidoCompleto?.pagamento?.parcelas && Array.isArray(pedidoCompleto.pagamento.parcelas)) {
    pedidoCompleto.pagamento.parcelas.forEach((parcela) => {
      const formaPagamento = parcela.formaPagamento?.nome || parcela.formaPagamento || '';
      const meioPagamento = parcela.meioPagamento?.nome || parcela.meioPagamento || '';

      // Verificar se é vale troca (usando função auxiliar)
      if (isValeTroca(formaPagamento) || isValeTroca(meioPagamento)) {
        const valorParcela = parseFloat(parcela.valor || parcela.valorParcela || 0);
        valorValeTroca += valorParcela;
        console.log(`[SyncBackground] 🔄 Vale Troca encontrado: R$ ${valorParcela.toFixed(2)} (${formaPagamento || meioPagamento || 'Desconhecido'})`);
      }
    });
  }

  // Se não encontrou nas parcelas, verificar na forma de pagamento principal
  if (valorValeTroca === 0 && pedido?.pagamento?.formaPagamento?.nome) {
    const formaPagamentoNome = pedido.pagamento.formaPagamento.nome;
    if (isValeTroca(formaPagamentoNome)) {
      // Se a forma de pagamento é vale troca, verificar se todas as parcelas são vale troca
      if (pedidoCompleto?.pagamento?.parcelas && Array.isArray(pedidoCompleto.pagamento.parcelas)) {
        valorValeTroca = pedidoCompleto.pagamento.parcelas.reduce((sum, parcela) => {
          return sum + (parseFloat(parcela.valor || parcela.valorParcela || 0));
        }, 0);
        console.log(`[SyncBackground] 🔄 Vale Troca detectado via formaPagamento principal: R$ ${valorValeTroca.toFixed(2)}`);
      }
    }
  }

  // ✅ DESCONTAR VALE TROCA diretamente no tiny_orders
  // O valor_total no tiny_orders deve ser o valor CORRETO (já descontado o vale troca)
  // Isso garante que o ERP Dashboard mostre o valor correto
  if (valorValeTroca > 0) {
    const valorTotalAntes = valorTotal;

    // Se o vale troca for menor que o valor total, descontar normalmente
    if (valorTotal > valorValeTroca) {
      valorTotal = valorTotal - valorValeTroca; // Descontar vale troca
      console.log(`[SyncBackground] 💰 Valor antes: R$ ${valorTotalAntes.toFixed(2)} | Vale Troca: R$ ${valorValeTroca.toFixed(2)} | Valor final: R$ ${valorTotal.toFixed(2)}`);
    } else {
      // Se vale troca cobre 100% ou mais, definir valor como zero
      // O pedido será salvo mas a venda não será criada (valor_total > 0 é necessário)
      valorTotal = 0;
      console.log(`[SyncBackground] ⚠️ Vale Troca (R$ ${valorValeTroca.toFixed(2)}) cobre todo o valor (R$ ${valorTotalAntes.toFixed(2)}). Valor definido como R$ 0,00.`);
    }
  }

  // Preparar objeto do pedido
  // ✅ CRÍTICO: Se já existe pedido, usar SEMPRE a data_pedido original (NUNCA recalcular)
  const finalDataPedido = (existingOrder && existingOrder.data_pedido)
    ? existingOrder.data_pedido
    : dataPedido;

  // ✅ GARANTIR que numero_pedido sempre tenha valor (necessário para upsert)
  const numeroPedidoFinal = (pedido.numeroPedido || pedido.numero)?.toString() ||
    (pedidoCompleto?.numeroPedido || pedidoCompleto?.numero)?.toString() ||
    String(pedido.id) || // Fallback: usar ID interno se não tiver numeroPedido
    null;

  const orderData = {
    store_id: storeId,
    tiny_id: numeroPedidoFinal || tinyId, // ✅ Usar numeroPedido como tiny_id principal
    numero_pedido: numeroPedidoFinal, // ✅ Garantir que sempre tenha valor
    numero_ecommerce: (pedido.ecommerce?.numeroPedidoEcommerce || pedido.numero_ecommerce)?.toString() || null,
    situacao: pedido.situacao?.toString() || null,
    data_pedido: finalDataPedido,
    cliente_id: clienteId,
    cliente_nome: pedido.cliente?.nome || null,
    cliente_cpf_cnpj: normalizeCPFCNPJ(pedido.cliente?.cpfCnpj || pedido.cliente?.cpf || pedido.cliente?.cnpj || null),
    cliente_telefone: normalizeTelefone(pedido.cliente?.telefone || pedido.cliente?.celular || null),
    valor_total: valorTotal || 0,
    valor_desconto: parseFloat(pedido.valorDesconto || pedido.valor_desconto || 0),
    valor_frete: parseFloat(pedido.valorFrete || pedido.valor_frete || 0),
    // ✅ ADICIONAR VALE TROCA na forma de pagamento (apenas para informação, sem somar ao valor)
    forma_pagamento: (() => {
      const formasPagamento = [];

      // ✅ RECALCULAR valor do vale troca para garantir que temos o valor correto
      let valorValeTrocaParaFormaPagamento = 0;

      // Coletar todas as formas de pagamento das parcelas (exceto vale troca)
      if (pedidoCompleto?.pagamento?.parcelas && Array.isArray(pedidoCompleto.pagamento.parcelas)) {
        pedidoCompleto.pagamento.parcelas.forEach((parcela) => {
          const formaPagamento = parcela.formaPagamento?.nome || parcela.formaPagamento || '';
          const meioPagamento = parcela.meioPagamento?.nome || parcela.meioPagamento || '';

          // Calcular valor do vale troca
          if (isValeTroca(formaPagamento) || isValeTroca(meioPagamento)) {
            const valorParcela = parseFloat(parcela.valor || parcela.valorParcela || 0);
            valorValeTrocaParaFormaPagamento += valorParcela;
          }

          // Adicionar forma de pagamento se não for vale troca
          if (formaPagamento && !isValeTroca(formaPagamento)) {
            if (!formasPagamento.includes(formaPagamento)) {
              formasPagamento.push(formaPagamento);
            }
          }

          if (meioPagamento && !isValeTroca(meioPagamento) && formaPagamento !== meioPagamento) {
            if (!formasPagamento.includes(meioPagamento)) {
              formasPagamento.push(meioPagamento);
            }
          }
        });
      }

      // Se não encontrou nas parcelas, usar forma de pagamento principal
      if (formasPagamento.length === 0 && !valorValeTrocaParaFormaPagamento) {
        const formaPagamentoPrincipal = pedido.pagamento?.formaPagamento?.nome || null;
        if (formaPagamentoPrincipal && !isValeTroca(formaPagamentoPrincipal)) {
          formasPagamento.push(formaPagamentoPrincipal);
        }
      }

      // Adicionar "Vale Troca" como informação (se houver)
      // Usar valorValeTroca se disponível, senão usar o recalculado
      const valorFinalValeTroca = valorValeTroca > 0 ? valorValeTroca : valorValeTrocaParaFormaPagamento;

      if (valorFinalValeTroca > 0) {
        console.log(`[SyncBackground] 💳 Valor do Vale Troca para formato: ${valorFinalValeTroca}`);
        // Formatar valor em reais (R$ X.XXX,XX)
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(valorFinalValeTroca);
        formasPagamento.push(`Vale Troca (R$ ${valorFormatado})`);
        console.log(`[SyncBackground] 💳 Forma de pagamento com Vale Troca: ${formasPagamento.join(' + ')}`);
      }

      const formaPagamentoFinal = formasPagamento.length > 0 ? formasPagamento.join(' + ') : null;
      if (formaPagamentoFinal) {
        console.log(`[SyncBackground] 💳 Forma de pagamento final salva: ${formaPagamentoFinal}`);
      }
      return formaPagamentoFinal;
    })(),
    forma_envio: pedido.transportador?.formaEnvio?.nome || null,
    endereco_entrega: pedido.enderecoEntrega || null,
    itens: (itensComCategorias && itensComCategorias.length > 0) ? itensComCategorias : null,
    qtd_itens: (() => {
      if (itensComCategorias && itensComCategorias.length > 0) {
        const totalPecas = itensComCategorias.reduce((sum, item) => {
          return sum + (parseInt(item.quantidade) || 1);
        }, 0);
        console.log(`[SyncBackground] 📦 qtd_itens calculado: ${totalPecas} peças de ${itensComCategorias.length} itens`);
        return totalPecas;
      }
      return 1;
    })(),
    observacoes: pedido.observacoes || null,
    vendedor_nome: pedido.vendedor?.nome || pedido.vendedor_nome || null,
    vendedor_tiny_id: pedido.vendedor?.id?.toString() || null,
    colaboradora_id: colaboradoraId,
    dados_extras: pedido.dados_extras || null,
    // ✅ CRÍTICO: Preservar timestamps originais quando pedido já existe
    sync_at: (existingOrder && existingOrder.sync_at) ? existingOrder.sync_at : new Date().toISOString(),
    updated_at: new Date().toISOString(), // Sempre atualizar updated_at para rastrear última modificação
  };

  return orderData;
}

/**
 * Formata produtos dos itens para colocar nas observações do WhatsApp
 */
function formatarProdutosParaObservacoes(itens) {
  console.log(`[SyncBackground] 📝 [FORMATAR] ========== FORMATANDO PRODUTOS ==========`);
  console.log(`[SyncBackground] 📝 [FORMATAR] Total de itens: ${itens?.length || 0}`);

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    console.log(`[SyncBackground] 📝 [FORMATAR] ⚠️ Nenhum item para formatar`);
    return null;
  }

  // ✅ FORMATAR PRODUTOS: Um item por linha (igual mensagem manual)
  // ✅ CRÍTICO: Usar APENAS a descrição base do produto, SEM variações (tamanho, cor, etc)
  // Usar \n para quebra de linha (será escapado corretamente pela Netlify Function)
  const produtosFormatados = itens.map((item, index) => {
    console.log(`[SyncBackground] 📝 [FORMATAR] Item ${index + 1}:`, {
      produto: item.produto,
      infoAdicional: item.infoAdicional,
      descricao: item.descricao,
      nome: item.nome,
      quantidade: item.quantidade
    });
    // ✅ PRIORIDADE 1: Descrição do produto base (sem variações)
    // Se o item vem do pedido completo original, usar produto.descricao diretamente
    let descricaoBase = null;

    // ✅ ESTRATÉGIA: Pegar descrição do produto base, não do item processado
    if (item.produto) {
      // Item original do Tiny tem produto.descricao (descrição base sem variações)
      descricaoBase = item.produto.descricao || item.produto.nome || null;
    }

    // ✅ PRIORIDADE 2: Se não tem produto.descricao, usar infoAdicional (descrição original)
    if (!descricaoBase && item.infoAdicional) {
      descricaoBase = item.infoAdicional;
      // Remover variações conhecidas do final
      descricaoBase = descricaoBase.replace(/\s*-\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i, '').trim();
      descricaoBase = descricaoBase.replace(/\s*-\s*([A-Z\s]+)\s*-\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i, '').trim();
    }

    // ✅ PRIORIDADE 3: Se ainda não tem, usar descricao do item (mas limpar variações)
    if (!descricaoBase && item.descricao) {
      descricaoBase = item.descricao;
      // Remover tamanho e cor se estiverem no final da descrição
      descricaoBase = descricaoBase.replace(/\s*-\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i, '').trim();
      descricaoBase = descricaoBase.replace(/\s*-\s*([A-Z\s]+)\s*-\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i, '').trim();
    }

    // ✅ PRIORIDADE 4: Fallback para nome
    if (!descricaoBase && item.nome) {
      descricaoBase = item.nome;
      // Remover variações
      descricaoBase = descricaoBase.replace(/\s*-\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i, '').trim();
      descricaoBase = descricaoBase.replace(/\s*-\s*([A-Z\s]+)\s*-\s*([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO|UN)\s*$/i, '').trim();
    }

    // Fallback final
    if (!descricaoBase) {
      descricaoBase = 'Produto sem nome';
    }

    const quantidade = item.quantidade || 1;

    const resultado = `${quantidade}x ${descricaoBase.trim()}`;
    console.log(`[SyncBackground] 📝 [FORMATAR] Item ${index + 1} formatado: "${resultado}"`);

    // ✅ SOMENTE descrição base e quantidade, SEM tamanho, cor ou outras variações
    // ✅ Cada item em uma linha separada
    return resultado;
  });

  // ✅ JUNTAR COM QUEBRA DE LINHA (\n) - igual mensagem manual
  const resultadoFinal = produtosFormatados.join('\n');
  console.log(`[SyncBackground] 📝 [FORMATAR] Resultado final (primeiros 300 chars): ${resultadoFinal.substring(0, 300)}`);
  return resultadoFinal;
}

/**
 * Envia WhatsApp quando uma nova venda do Tiny chega
 * Usa a mesma estrutura de mensagem do LojaDashboard
 */
async function enviarWhatsAppNovaVendaTiny(supabase, orderData, storeId, itensComCategorias, pedidoCompleto = null) {
  try {
    console.log(`[SyncBackground] 📱 ========== INICIANDO ENVIO WHATSAPP ==========`);
    console.log(`[SyncBackground] 📱 Pedido: ${orderData.numero_pedido}`);
    console.log(`[SyncBackground] 📱 storeId: ${storeId}`);
    console.log(`[SyncBackground] 📱 itensComCategorias: ${itensComCategorias?.length || 0} itens`);
    console.log(`[SyncBackground] 📱 pedidoCompleto: ${pedidoCompleto ? 'SIM' : 'NÃO'}`);
    if (pedidoCompleto) {
      console.log(`[SyncBackground] 📱 pedidoCompleto.itens: ${pedidoCompleto.itens?.length || 0} itens`);
      console.log(`[SyncBackground] 📱 pedidoCompleto.parcelas: ${pedidoCompleto.parcelas?.length || 0} parcelas`);
      if (pedidoCompleto.parcelas && pedidoCompleto.parcelas.length > 0) {
        console.log(`[SyncBackground] 📱 Primeira parcela:`, JSON.stringify(pedidoCompleto.parcelas[0], null, 2));
      }
    }
    console.log(`[SyncBackground] 📱 orderData.colaboradora_id: ${orderData.colaboradora_id}`);
    console.log(`[SyncBackground] 📱 orderData.vendedor_nome: ${orderData.vendedor_nome}`);
    console.log(`[SyncBackground] 📱 orderData.data_pedido: ${orderData.data_pedido}`);
    console.log(`[SyncBackground] 📱 orderData.forma_pagamento: ${orderData.forma_pagamento}`);

    // 1. Buscar dados da loja e admin
    const { data: storeData, error: storeError } = await supabase
      .schema('sistemaretiradas')
      .from('stores')
      .select('admin_id, name')
      .eq('id', storeId)
      .single();

    if (storeError || !storeData?.admin_id) {
      console.warn(`[SyncBackground] ⚠️ Loja não encontrada ou sem admin. WhatsApp não será enviado.`);
      return;
    }

    // 2. Buscar nome da colaboradora (se houver)
    // ✅ BUSCA ROBUSTA: Verificar no banco se colaboradora_id foi salvo corretamente
    let colaboradoraName = null;

    console.log(`[SyncBackground] 🔍 [WHATSAPP] Buscando colaboradora para pedido ${orderData.numero_pedido}`);
    console.log(`[SyncBackground]   [WHATSAPP] colaboradora_id do orderData: ${orderData.colaboradora_id}`);
    console.log(`[SyncBackground]   [WHATSAPP] vendedor_nome: ${orderData.vendedor_nome}`);
    console.log(`[SyncBackground]   [WHATSAPP] vendedor_tiny_id: ${orderData.vendedor_tiny_id}`);

    // ✅ PRIORIDADE 1: Buscar pelo colaboradora_id (se foi vinculado corretamente)
    if (orderData.colaboradora_id) {
      const { data: colaboradoraData, error: colaboradoraError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, email, cpf')
        .eq('id', orderData.colaboradora_id)
        .single();

      if (colaboradoraError) {
        console.warn(`[SyncBackground] ⚠️ [WHATSAPP] Erro ao buscar colaboradora por ID ${orderData.colaboradora_id}:`, colaboradoraError);
      } else if (colaboradoraData?.name) {
        colaboradoraName = colaboradoraData.name;
        console.log(`[SyncBackground] ✅ [WHATSAPP] Colaboradora encontrada por ID: ${colaboradoraName} (ID: ${colaboradoraData.id})`);
      }
    }

    // ✅ PRIORIDADE 2: Se não encontrou por ID, buscar diretamente no banco pelo pedido
    if (!colaboradoraName) {
      console.log(`[SyncBackground] 🔍 [WHATSAPP] Colaboradora não encontrada por ID, buscando no banco pelo pedido...`);

      const { data: pedidoNoBanco } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('colaboradora_id, vendedor_nome, vendedor_tiny_id')
        .eq('store_id', storeId)
        .eq('numero_pedido', orderData.numero_pedido)
        .maybeSingle();

      if (pedidoNoBanco?.colaboradora_id) {
        console.log(`[SyncBackground] 🔍 [WHATSAPP] Pedido encontrado no banco com colaboradora_id: ${pedidoNoBanco.colaboradora_id}`);

        const { data: colaboradoraDoBanco } = await supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .select('id, name')
          .eq('id', pedidoNoBanco.colaboradora_id)
          .single();

        if (colaboradoraDoBanco?.name) {
          colaboradoraName = colaboradoraDoBanco.name;
          console.log(`[SyncBackground] ✅ [WHATSAPP] Colaboradora encontrada no banco: ${colaboradoraName}`);
        }
      }
    }

    // ✅ PRIORIDADE 3: Buscar pelo vendedor_nome (busca flexível)
    if (!colaboradoraName && orderData.vendedor_nome) {
      console.log(`[SyncBackground] 🔍 [WHATSAPP] Tentando buscar colaboradora pelo vendedor_nome: "${orderData.vendedor_nome}"`);

      const normalizeName = (name) => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[|,]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const { data: todasColaboradoras } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, email, cpf')
        .eq('role', 'COLABORADORA')
        .eq('is_active', true)
        .eq('store_id', storeId);

      if (todasColaboradoras && todasColaboradoras.length > 0) {
        const vendedorNomeNormalizado = normalizeName(orderData.vendedor_nome);

        // Tentar match exato primeiro
        let match = todasColaboradoras.find(c =>
          normalizeName(c.name) === vendedorNomeNormalizado
        );

        // Se não encontrou, tentar match parcial
        if (!match) {
          match = todasColaboradoras.find(c =>
            normalizeName(c.name).includes(vendedorNomeNormalizado) ||
            vendedorNomeNormalizado.includes(normalizeName(c.name))
          );
        }

        if (match) {
          colaboradoraName = match.name;
          console.log(`[SyncBackground] ✅ [WHATSAPP] Colaboradora encontrada por nome: ${colaboradoraName}`);
        }
      }
    }

    // ✅ PRIORIDADE 4: Se não encontrou, usar vendedor_nome do pedido
    if (!colaboradoraName && orderData.vendedor_nome) {
      colaboradoraName = orderData.vendedor_nome;
      console.log(`[SyncBackground] ⚠️ [WHATSAPP] Usando vendedor_nome do pedido (não encontrado no sistema): ${colaboradoraName}`);
    }

    // ✅ PRIORIDADE 5: Se ainda não tem, usar fallback
    if (!colaboradoraName) {
      colaboradoraName = 'Sistema ERP';
      console.warn(`[SyncBackground] ⚠️ [WHATSAPP] Nenhuma colaboradora encontrada, usando fallback: ${colaboradoraName}`);
    }

    console.log(`[SyncBackground] 📝 [WHATSAPP] Colaboradora final para WhatsApp: ${colaboradoraName}`);

    // 3. Buscar destinatários WhatsApp do admin (tipo VENDA)
    const { data: recipientsAllStores } = await supabase
      .schema('sistemaretiradas')
      .from('whatsapp_notification_config')
      .select('phone')
      .eq('admin_id', storeData.admin_id)
      .eq('notification_type', 'VENDA')
      .eq('active', true)
      .is('store_id', null);

    const { data: recipientsThisStore } = await supabase
      .schema('sistemaretiradas')
      .from('whatsapp_notification_config')
      .select('phone')
      .eq('admin_id', storeData.admin_id)
      .eq('notification_type', 'VENDA')
      .eq('active', true)
      .eq('store_id', storeId);

    const adminPhones = [
      ...(recipientsAllStores || []),
      ...(recipientsThisStore || [])
    ].map(r => r.phone).filter(Boolean);

    if (adminPhones.length === 0) {
      console.warn(`[SyncBackground] ⚠️ Nenhum destinatário WhatsApp encontrado para admin ${storeData.admin_id}`);
      return;
    }

    // 4. Calcular totais (dia e mês) - ✅ BUSCAR DE SALES (não tiny_orders)
    const hojeStr = new Date().toISOString().split('T')[0];
    const { data: vendasHoje } = await supabase
      .schema('sistemaretiradas')
      .from('sales')
      .select('valor')
      .eq('store_id', storeId)
      .gte('data_venda', `${hojeStr}T00:00:00`)
      .lte('data_venda', `${hojeStr}T23:59:59`);

    const totalDia = vendasHoje?.reduce((sum, v) => sum + (parseFloat(v.valor) || 0), 0) || 0;

    const valorVendaAtual = parseFloat(orderData.valor_total) || 0;
    const dataPedido = orderData.data_pedido ? new Date(orderData.data_pedido).toISOString().split('T')[0] : null;
    
    // Se a venda é de hoje, verificar se já está incluída no total
    let totalDiaComVendaAtual = totalDia;
    if (dataPedido === hojeStr) {
      // Verificar se a venda atual já está em sales (para evitar duplicação)
      // Buscar vendas com mesmo valor (aproximado) e mesmo dia para esta loja
      const valorMinimo = valorVendaAtual * 0.99; // 1% de tolerância
      const valorMaximo = valorVendaAtual * 1.01;
      
      const vendaJaExiste = vendasHoje?.some(v => {
        const valorVenda = parseFloat(v.valor) || 0;
        return valorVenda >= valorMinimo && valorVenda <= valorMaximo;
      });

      if (!vendaJaExiste) {
        // Venda ainda não está em sales, precisamos adicioná-la
        totalDiaComVendaAtual = totalDia + valorVendaAtual;
        console.log(`[SyncBackground] 📊 Total do dia: ${totalDia.toFixed(2)} + venda atual ${valorVendaAtual.toFixed(2)} = ${totalDiaComVendaAtual.toFixed(2)} (venda ainda não estava em sales)`);
      } else {
        // Venda já está em sales, usar apenas o totalDia
        totalDiaComVendaAtual = totalDia;
        console.log(`[SyncBackground] 📊 Total do dia: ${totalDia.toFixed(2)} (venda atual já estava incluída em sales)`);
      }
    } else {
      console.log(`[SyncBackground] 📊 Total do dia (venda não é de hoje): ${totalDia.toFixed(2)} (dataPedido: ${dataPedido}, hojeStr: ${hojeStr})`);
      // Se não é de hoje, não devemos mostrar total do dia
      totalDiaComVendaAtual = null;
    }

    // ✅ BUSCAR TOTAL DO MÊS DE SALES (não tiny_orders)
    const mesAtual = new Date().toISOString().slice(0, 7); // Formato: YYYY-MM
    const primeiroDiaMes = `${mesAtual}-01`;
    const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: vendasMes } = await supabase
      .schema('sistemaretiradas')
      .from('sales')
      .select('valor, data_venda')
      .eq('store_id', storeId)
      .gte('data_venda', `${primeiroDiaMes}T00:00:00`)
      .lte('data_venda', `${ultimoDiaMes}T23:59:59`);

    const totalMes = vendasMes?.reduce((sum, v) => sum + (parseFloat(v.valor) || 0), 0) || 0;

    // ✅ CORRIGIDO: A venda atual JÁ está em sales quando esta função é chamada
    // Não precisamos adicionar novamente, senão duplica o valor
    let totalMesComVendaAtual = totalMes; // Usar o total que já inclui a venda atual
    console.log(`[SyncBackground] 📊 Total do mês (já inclui venda atual): ${totalMes.toFixed(2)}`);

    // 5. Formatar produtos para observações
    // ✅ CRÍTICO: Usar itens ORIGINAIS do pedido completo (não processados) para pegar descrição limpa
    console.log(`[SyncBackground] 📝 [WHATSAPP] ========== FORMATANDO PRODUTOS ==========`);
    console.log(`[SyncBackground] 📝 [WHATSAPP] itensComCategorias: ${JSON.stringify(itensComCategorias?.slice(0, 2), null, 2)}`);
    console.log(`[SyncBackground] 📝 [WHATSAPP] pedidoCompleto?.itens: ${JSON.stringify(pedidoCompleto?.itens?.slice(0, 2), null, 2)}`);

    let itensParaFormatar = itensComCategorias;
    if (pedidoCompleto && pedidoCompleto.itens && Array.isArray(pedidoCompleto.itens) && pedidoCompleto.itens.length > 0) {
      // Usar itens originais do Tiny (antes do processamento)
      itensParaFormatar = pedidoCompleto.itens;
      console.log(`[SyncBackground] 📝 [WHATSAPP] ✅ Usando ${itensParaFormatar.length} itens ORIGINAIS do pedido completo`);
    } else {
      console.log(`[SyncBackground] 📝 [WHATSAPP] ⚠️ Usando ${itensComCategorias?.length || 0} itens processados (pedido completo não disponível ou sem itens)`);
    }

    console.log(`[SyncBackground] 📝 [WHATSAPP] Itens que serão formatados: ${itensParaFormatar?.length || 0}`);
    const produtosTexto = formatarProdutosParaObservacoes(itensParaFormatar);
    console.log(`[SyncBackground] 📝 [WHATSAPP] Produtos formatados: ${produtosTexto?.substring(0, 200)}...`);
    const observacoes = produtosTexto || orderData.observacoes || null;

    // 6. Calcular quantidade de peças (soma das quantidades dos itens)
    const qtdPecas = itensComCategorias?.reduce((sum, item) => sum + (parseInt(item.quantidade) || 0), 0) || 0;

    // 7. Formatar mensagem (usando mesma estrutura do LojaDashboard)
    // ✅ FUSO HORÁRIO: Macapá-AP (UTC-3) - CORREÇÃO ROBUSTA
    let dataFormatada = 'hoje';
    if (orderData.data_pedido) {
      // ✅ INVESTIGAÇÃO PROFUNDA DO FUSO HORÁRIO
      // A data vem do Tiny ERP em formato ISO (provavelmente UTC ou horário local do servidor)
      // Macapá-AP usa UTC-3 (mesmo fuso de Manaus)
      // Precisamos converter corretamente para UTC-3

      const dataPedido = new Date(orderData.data_pedido);

      console.log(`[SyncBackground] 🕐 [WHATSAPP] Formatação de data:`);
      console.log(`[SyncBackground]   [WHATSAPP] data_pedido original: ${orderData.data_pedido}`);
      console.log(`[SyncBackground]   [WHATSAPP] dataPedido (Date object UTC): ${dataPedido.toISOString()}`);
      console.log(`[SyncBackground]   [WHATSAPP] dataPedido (Date object local): ${dataPedido.toString()}`);

      // ✅ CORREÇÃO: Macapá usa fuso de Brasília (America/Sao_Paulo - UTC-3)
      // NÃO fazer cálculo manual, apenas usar o timezone diretamente
      // O toLocaleString já faz a conversão correta automaticamente
      try {
        dataFormatada = dataPedido.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo', // Macapá-AP usa fuso de Brasília (UTC-3)
        });
        console.log(`[SyncBackground]   [WHATSAPP] dataFormatada (Macapá via timezone Brasília): ${dataFormatada}`);
      } catch (error) {
        console.warn(`[SyncBackground] ⚠️ [WHATSAPP] Erro ao formatar com timezone, usando fallback:`, error);
        // Fallback: usar formato local
        dataFormatada = dataPedido.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        console.log(`[SyncBackground]   [WHATSAPP] dataFormatada (fallback local): ${dataFormatada}`);
      }
    }

    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(orderData.valor_total || 0);

    let message = `🛒 *Nova Venda Lançada*\n\n`;
    message += `*Colaboradora:* ${colaboradoraName}\n`;
    message += `*Loja:* ${storeData.name}\n`;

    // ✅ Adicionar nome do cliente (se não for Consumidor Final)
    if (orderData.cliente_nome && 
        orderData.cliente_nome !== 'Consumidor Final' && 
        orderData.cliente_nome !== 'CONSUMIDOR_FINAL') {
      message += `*Cliente:* ${orderData.cliente_nome}\n`;
    }

    message += `*Valor:* ${valorFormatado}\n`;
    message += `*Quantidade de Peças:* ${qtdPecas}\n`;

    // ✅ Formatar formas de pagamento (listar todas com valores)
    console.log(`[SyncBackground] 📝 [WHATSAPP] ========== FORMATANDO FORMAS DE PAGAMENTO ==========`);
    console.log(`[SyncBackground] 📝 [WHATSAPP] pedidoCompleto existe: ${!!pedidoCompleto}`);
    console.log(`[SyncBackground] 📝 [WHATSAPP] pedidoCompleto.parcelas existe: ${!!pedidoCompleto?.parcelas}`);
    console.log(`[SyncBackground] 📝 [WHATSAPP] pedidoCompleto.parcelas é array: ${Array.isArray(pedidoCompleto?.parcelas)}`);
    console.log(`[SyncBackground] 📝 [WHATSAPP] pedidoCompleto.parcelas.length: ${pedidoCompleto?.parcelas?.length || 0}`);
    console.log(`[SyncBackground] 📝 [WHATSAPP] orderData.forma_pagamento: ${orderData.forma_pagamento}`);

    // ✅ Tentar buscar parcelas do pedido completo OU do pedido original
    let parcelasParaProcessar = null;

    if (pedidoCompleto?.parcelas && Array.isArray(pedidoCompleto.parcelas) && pedidoCompleto.parcelas.length > 0) {
      parcelasParaProcessar = pedidoCompleto.parcelas;
      console.log(`[SyncBackground] 📝 [WHATSAPP] ✅ Usando parcelas do pedidoCompleto: ${parcelasParaProcessar.length}`);
    } else if (pedidoCompleto?.pagamento?.parcelas && Array.isArray(pedidoCompleto.pagamento.parcelas) && pedidoCompleto.pagamento.parcelas.length > 0) {
      parcelasParaProcessar = pedidoCompleto.pagamento.parcelas;
      console.log(`[SyncBackground] 📝 [WHATSAPP] ✅ Usando parcelas do pedidoCompleto.pagamento: ${parcelasParaProcessar.length}`);
    }

    if (parcelasParaProcessar && parcelasParaProcessar.length > 0) {
      console.log(`[SyncBackground] 📝 [WHATSAPP] ✅ Processando ${parcelasParaProcessar.length} parcelas para formatar formas de pagamento`);
      console.log(`[SyncBackground] 📝 [WHATSAPP] Estrutura da primeira parcela:`, JSON.stringify(parcelasParaProcessar[0], null, 2));

      // ✅ Agrupar parcelas por forma de pagamento
      const formasPagamentoMap = new Map();

      parcelasParaProcessar.forEach((parcela, index) => {
        // Tentar pegar forma de pagamento da parcela (pode estar em diferentes campos)
        const formaPagamento = parcela.formaPagamento?.nome ||
          parcela.formaPagamento ||
          parcela.meioPagamento?.nome ||
          parcela.meioPagamento ||
          orderData.forma_pagamento ||
          'Não informado';
        const valorParcela = parseFloat(parcela.valor || parcela.valorParcela || 0);

        // ✅ IGNORAR VALE TROCA: Não incluir nas formas de pagamento exibidas (usar função auxiliar global)
        if (isValeTroca(formaPagamento)) {
          console.log(`[SyncBackground] 📝 [WHATSAPP] ⏭️  Parcela ${index + 1}: Vale Troca ignorado (R$ ${valorParcela.toFixed(2)})`);
          return; // Pular esta parcela (não incluir na lista de formas de pagamento)
        }

        console.log(`[SyncBackground] 📝 [WHATSAPP] Parcela ${index + 1}: ${formaPagamento} - R$ ${valorParcela.toFixed(2)}`);

        if (!formasPagamentoMap.has(formaPagamento)) {
          formasPagamentoMap.set(formaPagamento, {
            nome: formaPagamento,
            valorTotal: 0,
            numParcelas: 0
          });
        }

        const forma = formasPagamentoMap.get(formaPagamento);
        forma.valorTotal += valorParcela;
        forma.numParcelas += 1;
      });

      // ✅ Formatar todas as formas de pagamento
      const formasFormatadas = Array.from(formasPagamentoMap.values()).map((forma) => {
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(forma.valorTotal);

        // Se tiver mais de uma parcela, mostrar quantidade
        if (forma.numParcelas > 1) {
          return `${forma.nome}: ${valorFormatado} (${forma.numParcelas}x)`;
        } else {
          return `${forma.nome}: ${valorFormatado}`;
        }
      });

      console.log(`[SyncBackground] 📝 [WHATSAPP] Formas de pagamento formatadas: ${formasFormatadas.length} forma(s)`);

      if (formasFormatadas.length > 0) {
        // Se tiver apenas uma forma, mostrar em linha única
        if (formasFormatadas.length === 1) {
          message += `*Formas de Pagamento:* ${formasFormatadas[0]}\n`;
        } else {
          // Se tiver múltiplas formas, mostrar uma por linha
          message += `*Formas de Pagamento:*\n${formasFormatadas.map(f => `  • ${f}`).join('\n')}\n`;
        }
      } else {
        console.warn(`[SyncBackground] 📝 [WHATSAPP] ⚠️ Nenhuma forma de pagamento formatada, usando fallback`);
        // Se não conseguiu formatar, usar forma_pagamento simples
        if (orderData.forma_pagamento) {
          message += `*Formas de Pagamento:* ${orderData.forma_pagamento}\n`;
        }
      }
    } else {
      console.log(`[SyncBackground] 📝 [WHATSAPP] ⚠️ Não tem parcelas no pedido completo, usando forma_pagamento do orderData`);
      // Fallback: se não tiver parcelas, usar forma_pagamento simples
      if (orderData.forma_pagamento) {
        // ✅ Se for "Múltipla" ou "MULTIPLA", tentar buscar das parcelas mesmo assim
        if (orderData.forma_pagamento.toLowerCase().includes('múltipl') ||
          orderData.forma_pagamento.toLowerCase().includes('multipl')) {
          console.log(`[SyncBackground] 📝 [WHATSAPP] ⚠️ Forma de pagamento é "Múltipla", tentando buscar das parcelas mesmo sem pedidoCompleto`);

          // Tentar buscar parcelas de outra fonte se disponível
          // Por enquanto, vamos mostrar "Múltipla" mas com log para investigar
          message += `*Formas de Pagamento:* ${orderData.forma_pagamento}\n`;
          console.warn(`[SyncBackground] 📝 [WHATSAPP] ⚠️ Não foi possível detalhar formas de pagamento - pedidoCompleto não disponível ou sem parcelas`);
        } else {
          message += `*Formas de Pagamento:* ${orderData.forma_pagamento}\n`;
        }
      }
    }

    message += `*Data:* ${dataFormatada}\n`;

    // ✅ Sempre mostrar total do dia se a venda é de hoje e temos um valor
    // Usar hojeStr (definida anteriormente) para comparar com dataPedido
    if (dataPedido === hojeStr && totalDiaComVendaAtual !== undefined && totalDiaComVendaAtual !== null) {
      const totalDiaFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(totalDiaComVendaAtual);
      message += `*Total Vendido (Hoje):* ${totalDiaFormatado}\n`;
      console.log(`[SyncBackground] 📊 Total do dia incluído na mensagem: ${totalDiaFormatado} (dataPedido: ${dataPedido}, hojeStr: ${hojeStr})`);
    } else {
      console.log(`[SyncBackground] 📊 Total do dia NÃO incluído (dataPedido: ${dataPedido}, hojeStr: ${hojeStr}, totalDiaComVendaAtual: ${totalDiaComVendaAtual})`);
    }

    // ✅ Usar total do mês COM a venda atual incluída
    if (totalMesComVendaAtual > 0) {
      const totalMesFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(totalMesComVendaAtual);
      message += `*Total Mês:* ${totalMesFormatado}\n`;
    }

    if (observacoes && observacoes.trim()) {
      message += `\n*Peças Vendidas:*\n${observacoes.trim()}\n`;
    }

    message += `\nSistema EleveaOne 📊`;

    // ✅ LOG FINAL DA MENSAGEM COMPLETA
    console.log(`[SyncBackground] 📱 [WHATSAPP] ========== MENSAGEM FINAL ==========`);
    console.log(`[SyncBackground] 📱 [WHATSAPP] Mensagem completa (primeiros 500 chars):`);
    console.log(message.substring(0, 500));
    console.log(`[SyncBackground] 📱 [WHATSAPP] Mensagem completa (últimos 200 chars):`);
    console.log(message.substring(Math.max(0, message.length - 200)));
    console.log(`[SyncBackground] 📱 [WHATSAPP] Total de caracteres: ${message.length}`);
    console.log(`[SyncBackground] 📱 [WHATSAPP] Colaboradora na mensagem: ${colaboradoraName}`);
    console.log(`[SyncBackground] 📱 [WHATSAPP] Data formatada: ${dataFormatada}`);
    console.log(`[SyncBackground] 📱 [WHATSAPP] Observações (primeiros 200 chars): ${observacoes?.substring(0, 200) || 'NENHUMA'}`);

    // 8. Enviar WhatsApp para todos os destinatários
    // ✅ USAR EXATAMENTE O MESMO MECANISMO DO ENVIO MANUAL
    // Mesma URL, mesmo formato de payload, mesmo tratamento de resposta
    const baseUrl = process.env.URL || 'https://eleveaone.com.br';
    const whatsappFunctionUrl = `${baseUrl}/.netlify/functions/send-whatsapp-message`;

    console.log(`[SyncBackground] 📱 Enviando WhatsApp para ${adminPhones.length} destinatário(s)...`);
    console.log(`[SyncBackground] 📱 URL da função: ${whatsappFunctionUrl}`);

    // ✅ MESMO FORMATO DO ENVIO MANUAL: Promise.all com tratamento de sucesso/erro
    await Promise.all(
      adminPhones.map(async (phone) => {
        try {
          const response = await fetch(whatsappFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone,
              message,
              store_id: storeId, // ✅ Passar store_id para usar WhatsApp da loja se disponível, Global como fallback
            }),
          });

          // ✅ MESMO TRATAMENTO DE RESPOSTA DO ENVIO MANUAL
          const data = await response.json();

          if (response.ok && data.success) {
            console.log(`[SyncBackground] ✅ WhatsApp enviado com sucesso para ${phone}`);
          } else {
            console.warn(`[SyncBackground] ⚠️ Falha ao enviar WhatsApp para ${phone}:`, data.error || 'Erro desconhecido');
          }
        } catch (err) {
          console.error(`[SyncBackground] ❌ Erro ao enviar WhatsApp para ${phone}:`, err);
          // Não bloquear processo se um telefone falhar
        }
      })
    );

    console.log(`[SyncBackground] 📱 Processo de envio de WhatsApp concluído`);
  } catch (error) {
    console.error(`[SyncBackground] ❌ Erro ao enviar WhatsApp para nova venda:`, error);
    // Não bloquear o processo de sincronização se o WhatsApp falhar
  }
}
