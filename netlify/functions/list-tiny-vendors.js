/**
 * Netlify Function: Listar Vendedores do Tiny ERP
 * 
 * Lista todos os vendedores cadastrados no Tiny ERP da loja
 * para permitir mapeamento manual com colaboradoras
 * 
 * Endpoint: /.netlify/functions/list-tiny-vendors
 * Método: POST
 * Body: { "store_id": "uuid" }
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { store_id, storeId: inputStoreId } = body;
    const finalStoreId = store_id || inputStoreId;

    if (!finalStoreId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'store_id é obrigatório' }),
      };
    }

    console.log(`[ListVendors] 🔍 Buscando vendedores da loja ${finalStoreId}...`);

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
      .eq('store_id', finalStoreId)
      .eq('sistema_erp', 'TINY')
      .maybeSingle();

    if (integrationError || !integration) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Integração Tiny não encontrada para esta loja',
        }),
      };
    }

    if (!integration.access_token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Token de acesso não configurado' }),
      };
    }

    // Chamar API Tiny para buscar vendedores
    const proxyUrl = `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-api-proxy`;

    let allVendedores = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: finalStoreId,
            endpoint: '/vendedores',
            method: 'GET',
            params: {
              pagina: currentPage,
              limite: 100,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ListVendors] ❌ Erro na API Tiny: ${response.status} - ${errorText}`);
          break;
        }

        const result = await response.json();
        const vendedores = result.itens || result.vendedores || [];

        if (vendedores.length === 0) {
          hasMore = false;
          break;
        }

        allVendedores = allVendedores.concat(vendedores);

        // Verificar paginação
        const paginacao = result.paginacao || {};
        const totalPaginas = paginacao.totalPaginas || 0;
        hasMore = currentPage < totalPaginas;
        currentPage++;

      } catch (error) {
        console.error(`[ListVendors] ❌ Erro ao buscar página ${currentPage}:`, error);
        hasMore = false;
      }
    }

    console.log(`[ListVendors] ✅ ${allVendedores.length} vendedores encontrados no Tiny`);

    // Buscar colaboradoras da loja para verificar quais já estão mapeadas
    const { data: colaboradoras, error: colabError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, nome, email, tiny_vendedor_id, is_active')
      .eq('store_id', finalStoreId)
      .eq('role', 'COLABORADORA');

    if (colabError) {
      console.error('[ListVendors] ❌ Erro ao buscar colaboradoras:', colabError);
    }

    // Mapear vendedores com status de mapeamento
    const vendedoresComStatus = allVendedores.map(v => {
      const vendedor = v.vendedor || v;
      const tinyId = String(vendedor.id);
      
      // Verificar se este vendedor já está mapeado para alguma colaboradora
      const colaboradoraMapeada = colaboradoras?.find(c => 
        c.tiny_vendedor_id && String(c.tiny_vendedor_id) === tinyId
      );

      return {
        tiny_id: tinyId,
        nome: vendedor.nome || 'Sem nome',
        cpf: vendedor.cpf || null,
        email: vendedor.email || null,
        mapeado: !!colaboradoraMapeada,
        colaboradora_id: colaboradoraMapeada?.id || null,
        colaboradora_nome: colaboradoraMapeada?.nome || null,
      };
    });

    // Buscar vendedor_tiny_id dos pedidos que NÃO estão mapeados
    const { data: pedidosNaoMapeados } = await supabase
      .schema('sistemaretiradas')
      .from('tiny_orders')
      .select('vendedor_tiny_id')
      .eq('store_id', finalStoreId)
      .is('colaboradora_id', null)
      .not('vendedor_tiny_id', 'is', null);

    // Contar ocorrências de cada vendedor_tiny_id
    const vendedoresNaoMapeadosCount = {};
    (pedidosNaoMapeados || []).forEach(p => {
      const id = String(p.vendedor_tiny_id);
      vendedoresNaoMapeadosCount[id] = (vendedoresNaoMapeadosCount[id] || 0) + 1;
    });

    // Adicionar vendedores dos pedidos que não estão na lista do Tiny
    // (podem ter sido deletados do Tiny mas ainda existem nos pedidos)
    const tinyIdsExistentes = new Set(vendedoresComStatus.map(v => v.tiny_id));
    
    Object.entries(vendedoresNaoMapeadosCount).forEach(([tinyId, count]) => {
      if (!tinyIdsExistentes.has(tinyId)) {
        vendedoresComStatus.push({
          tiny_id: tinyId,
          nome: `[Vendedor deletado do Tiny]`,
          cpf: null,
          email: null,
          mapeado: false,
          colaboradora_id: null,
          colaboradora_nome: null,
          pedidos_pendentes: count,
          deletado_do_tiny: true,
        });
      } else {
        // Adicionar contagem de pedidos pendentes
        const idx = vendedoresComStatus.findIndex(v => v.tiny_id === tinyId);
        if (idx >= 0) {
          vendedoresComStatus[idx].pedidos_pendentes = count;
        }
      }
    });

    // Ordenar: não mapeados primeiro, depois por quantidade de pedidos pendentes
    vendedoresComStatus.sort((a, b) => {
      if (a.mapeado !== b.mapeado) return a.mapeado ? 1 : -1;
      return (b.pedidos_pendentes || 0) - (a.pedidos_pendentes || 0);
    });

    // Retornar também as colaboradoras não mapeadas
    const colaboradorasNaoMapeadas = (colaboradoras || [])
      .filter(c => c.is_active && !c.tiny_vendedor_id)
      .map(c => ({
        id: c.id,
        nome: c.nome,
        email: c.email,
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        vendedores: vendedoresComStatus,
        colaboradoras_nao_mapeadas: colaboradorasNaoMapeadas,
        resumo: {
          total_vendedores: vendedoresComStatus.length,
          mapeados: vendedoresComStatus.filter(v => v.mapeado).length,
          nao_mapeados: vendedoresComStatus.filter(v => !v.mapeado).length,
          colaboradoras_sem_tiny: colaboradorasNaoMapeadas.length,
          pedidos_sem_colaboradora: Object.values(vendedoresNaoMapeadosCount).reduce((a, b) => a + b, 0),
        },
      }),
    };

  } catch (error) {
    console.error('[ListVendors] ❌ Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
