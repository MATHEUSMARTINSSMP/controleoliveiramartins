/**
 * Helper Functions para interagir com a API do Tiny ERP
 * 
 * Estas funções encapsulam a lógica de chamadas à API,
 * incluindo cache, tratamento de erros e logging detalhado
 */

const { createClient } = require('@supabase/supabase-js');

// Cache para evitar requisições duplicadas
const cache = {
  produtos: {},
  pedidos: {},
  contatos: {},
  vendedores: {},
};

/**
 * Limpar cache (chamar no início de cada sincronização)
 */
function clearCache() {
  cache.produtos = {};
  cache.pedidos = {};
  cache.contatos = {};
  cache.vendedores = {};
}

/**
 * Chamar API do Tiny ERP via proxy Netlify Function
 * 
 * @param {string} storeId - ID da loja
 * @param {string} endpoint - Endpoint da API (ex: '/pedidos', '/produtos/123')
 * @param {object} params - Parâmetros da requisição
 * @param {string} method - Método HTTP (GET, POST, etc.)
 * @returns {Promise<any>} - Resposta da API
 */
async function callERPAPI(storeId, endpoint, params = {}, method = 'GET') {
  const proxyUrl = `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-api-proxy`;

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      storeId: storeId, // ✅ CORREÇÃO: proxy espera storeId (camelCase)
      endpoint,
      method: method || 'GET',
      params: params || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao chamar API: ${response.status} - ${errorText}`);
  }

  // Verificar se a resposta está vazia antes de fazer parse
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    console.warn(`[ERPHelpers] ⚠️ Resposta vazia do endpoint ${endpoint}`);
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error(`[ERPHelpers] ❌ Erro ao fazer parse JSON da resposta:`, e.message);
    console.error(`[ERPHelpers] Resposta recebida:`, responseText.substring(0, 500));
    throw new Error(`Resposta inválida do servidor: ${e.message}`);
  }
}

/**
 * Buscar detalhes completos de um pedido do Tiny ERP
 * 
 * @param {string} storeId - ID da loja
 * @param {string|number} pedidoId - ID do pedido
 * @returns {Promise<any>} - Pedido completo com todos os dados
 */
async function fetchPedidoCompletoFromTiny(storeId, pedidoId) {
  // Cache check
  const cacheKey = `${storeId}_pedido_${pedidoId}`;
  if (cache.pedidos[cacheKey]) {
    console.log(`[ERPHelpers] ⚡ Cache hit para pedido ${pedidoId}`);
    return cache.pedidos[cacheKey];
  }

  console.log(`[ERPHelpers] 🔍 Buscando detalhes completos do pedido ${pedidoId} via GET /pedidos/${pedidoId}...`);

  try {
    const response = await callERPAPI(storeId, `/pedidos/${pedidoId}`, {}, 'GET');

    if (!response) {
      console.warn(`[ERPHelpers] ⚠️ Resposta vazia ao buscar pedido ${pedidoId}`);
      return null;
    }

    // Tiny ERP v3 retorna o pedido diretamente, não dentro de um objeto "pedido"
    const pedidoCompleto = response;

    if (!pedidoCompleto || !pedidoCompleto.id) {
      console.warn(`[ERPHelpers] ⚠️ Detalhes do pedido ${pedidoId} não encontrados`);
      return null;
    }

    console.log(`[ERPHelpers] ✅ Detalhes do pedido ${pedidoId} recebidos:`, {
      id: pedidoCompleto.id,
      numeroPedido: pedidoCompleto.numeroPedido,
      tem_itens: !!pedidoCompleto.itens,
      quantidade_itens: pedidoCompleto.itens?.length || 0,
      valorTotalPedido: pedidoCompleto.valorTotalPedido,
      dataCriacao: pedidoCompleto.dataCriacao || pedidoCompleto.data,
      tem_dataCriacao: !!pedidoCompleto.dataCriacao,
      tem_data: !!pedidoCompleto.data,
    });

    // Cache
    cache.pedidos[cacheKey] = pedidoCompleto;

    return pedidoCompleto;

  } catch (error) {
    console.error(`[ERPHelpers] ❌ Erro ao buscar pedido ${pedidoId}:`, error);
    throw error;
  }
}

/**
 * Buscar detalhes completos de um produto do Tiny ERP
 * 
 * @param {string} storeId - ID da loja
 * @param {string|number} produtoId - ID do produto
 * @returns {Promise<any>} - Produto completo com variações
 */
async function fetchProdutoCompletoFromTiny(storeId, produtoId) {
  // Cache check
  const cacheKey = `${storeId}_produto_${produtoId}`;
  if (cache.produtos[cacheKey]) {
    console.log(`[ERPHelpers] ⚡ Cache hit para produto ${produtoId}`);
    return cache.produtos[cacheKey];
  }

  console.log(`[ERPHelpers] 🔍 Buscando detalhes completos do produto ${produtoId} via GET /produtos/${produtoId}...`);

  try {
    const response = await callERPAPI(storeId, `/produtos/${produtoId}`, {}, 'GET');

    if (!response) {
      console.warn(`[ERPHelpers] ⚠️ Resposta vazia ao buscar produto ${produtoId}`);
      return null;
    }

    // Tiny ERP v3 retorna o produto diretamente
    const produtoCompleto = response;

    if (!produtoCompleto || !produtoCompleto.id) {
      console.warn(`[ERPHelpers] ⚠️ Detalhes do produto ${produtoId} não encontrados`);
      return null;
    }

    console.log(`[ERPHelpers] ✅ Detalhes do produto ${produtoId} recebidos:`, {
      id: produtoCompleto.id,
      sku: produtoCompleto.sku,
      descricao: produtoCompleto.descricao,
      tem_categoria: !!produtoCompleto.categoria,
      tem_marca: !!produtoCompleto.marca,
      tem_variacoes: !!produtoCompleto.variacoes,
      quantidade_variacoes: produtoCompleto.variacoes?.length || 0,
    });

    // Cache
    cache.produtos[cacheKey] = produtoCompleto;

    return produtoCompleto;

  } catch (error) {
    console.error(`[ERPHelpers] ❌ Erro ao buscar produto ${produtoId}:`, error);
    throw error;
  }
}

/**
 * Buscar detalhes completos de um contato do Tiny ERP
 * 
 * @param {string} storeId - ID da loja
 * @param {string|number} contatoId - ID do contato
 * @returns {Promise<any>} - Contato completo com todos os dados
 */
async function fetchContatoCompletoFromTiny(storeId, contatoId) {
  // Cache check
  const cacheKey = `${storeId}_contato_${contatoId}`;
  if (cache.contatos[cacheKey]) {
    console.log(`[ERPHelpers] ⚡ Cache hit para contato ${contatoId}`);
    return cache.contatos[cacheKey];
  }

  console.log(`[ERPHelpers] 🔍 Buscando detalhes completos do contato ${contatoId} via GET /contatos/${contatoId}...`);

  try {
    const response = await callERPAPI(storeId, `/contatos/${contatoId}`, {}, 'GET');

    if (!response) {
      console.warn(`[ERPHelpers] ⚠️ Resposta vazia ao buscar contato ${contatoId}`);
      return null;
    }

    // Tiny ERP v3 retorna o contato diretamente
    const contatoCompleto = response;

    if (!contatoCompleto || !contatoCompleto.id) {
      console.warn(`[ERPHelpers] ⚠️ Detalhes do contato ${contatoId} não encontrados`);
      return null;
    }

    console.log(`[ERPHelpers] ✅ Detalhes do contato ${contatoId} recebidos:`, {
      id: contatoCompleto.id,
      nome: contatoCompleto.nome,
      tem_telefone: !!contatoCompleto.telefone,
      tem_celular: !!contatoCompleto.celular,
      tem_email: !!contatoCompleto.email,
      tem_dataNascimento: !!contatoCompleto.dataNascimento,
    });

    // Cache
    cache.contatos[cacheKey] = contatoCompleto;

    return contatoCompleto;

  } catch (error) {
    console.error(`[ERPHelpers] ❌ Erro ao buscar contato ${contatoId}:`, error);
    throw error;
  }
}

/**
 * Buscar detalhes completos de um vendedor do Tiny ERP
 * 
 * @param {string} storeId - ID da loja
 * @param {string|number} vendedorId - ID do vendedor
 * @returns {Promise<any>} - Vendedor completo com todos os dados
 */
async function fetchVendedorCompletoFromTiny(storeId, vendedorId) {
  // Cache check
  const cacheKey = `${storeId}_vendedor_${vendedorId}`;
  if (cache.vendedores[cacheKey]) {
    console.log(`[ERPHelpers] ⚡ Cache hit para vendedor ${vendedorId}`);
    return cache.vendedores[cacheKey];
  }

  console.log(`[ERPHelpers] 🔍 Buscando detalhes completos do vendedor ${vendedorId} via GET /vendedores/${vendedorId}...`);

  try {
    // Tentar buscar via /vendedores/{id} ou /colaboradores/{id}
    let response = null;
    try {
      response = await callERPAPI(storeId, `/vendedores/${vendedorId}`, {}, 'GET');
    } catch (error) {
      // Se falhar, tentar /colaboradores/{id}
      try {
        response = await callERPAPI(storeId, `/colaboradores/${vendedorId}`, {}, 'GET');
      } catch (error2) {
        console.warn(`[ERPHelpers] ⚠️ Não foi possível buscar vendedor ${vendedorId}`);
        return null;
      }
    }

    if (!response) {
      console.warn(`[ERPHelpers] ⚠️ Resposta vazia ao buscar vendedor ${vendedorId}`);
      return null;
    }

    const vendedorCompleto = response;

    if (!vendedorCompleto || !vendedorCompleto.id) {
      console.warn(`[ERPHelpers] ⚠️ Detalhes do vendedor ${vendedorId} não encontrados`);
      return null;
    }

    console.log(`[ERPHelpers] ✅ Detalhes do vendedor ${vendedorId} recebidos:`, {
      id: vendedorCompleto.id,
      nome: vendedorCompleto.nome,
      tem_cpf: !!vendedorCompleto.cpf,
      tem_email: !!vendedorCompleto.email,
    });

    // Cache
    cache.vendedores[cacheKey] = vendedorCompleto;

    return vendedorCompleto;

  } catch (error) {
    console.error(`[ERPHelpers] ❌ Erro ao buscar vendedor ${vendedorId}:`, error);
    return null;
  }
}

module.exports = {
  callERPAPI,
  fetchPedidoCompletoFromTiny,
  fetchProdutoCompletoFromTiny,
  fetchContatoCompletoFromTiny,
  fetchVendedorCompletoFromTiny,
  clearCache,
};

