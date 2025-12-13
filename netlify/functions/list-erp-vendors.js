/**
 * Netlify Function: Listar Vendedores do ERP
 * 
 * Lista todos os vendedores únicos encontrados nos pedidos sincronizados
 * para permitir mapeamento manual com colaboradoras
 * 
 * NOTA: A API Tiny v3 NÃO tem endpoint /vendedores separado.
 * Os vendedores vêm dentro dos pedidos como { id, nome }.
 * Esta função extrai os vendedores únicos dos pedidos já sincronizados.
 * 
 * Endpoint: /.netlify/functions/list-erp-vendors
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

    console.log(`[ListVendors] Buscando vendedores da loja ${finalStoreId}...`);

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Configuração Supabase não encontrada' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar integração da loja para confirmar que tem Tiny configurado
    const { data: integration, error: integrationError } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('id, sistema_erp, sync_status')
      .eq('store_id', finalStoreId)
      .eq('sistema_erp', 'TINY')
      .maybeSingle();

    if (integrationError) {
      console.error('[ListVendors] Erro ao buscar integração:', integrationError);
    }

    if (!integration) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Integração Tiny não encontrada para esta loja',
        }),
      };
    }

    // Buscar colaboradoras da loja
    const { data: colaboradoras, error: colabError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, nome, email, tiny_vendedor_id, is_active')
      .eq('store_id', finalStoreId)
      .eq('role', 'COLABORADORA');

    if (colabError) {
      console.error('[ListVendors] Erro ao buscar colaboradoras:', colabError);
    }

    // Buscar vendedores únicos dos pedidos sincronizados
    // A tabela tiny_orders deve ter campos: vendedor_tiny_id, vendedor_nome
    const { data: pedidosComVendedor, error: pedidosError } = await supabase
      .schema('sistemaretiradas')
      .from('tiny_orders')
      .select('vendedor_tiny_id, vendedor_nome, colaboradora_id')
      .eq('store_id', finalStoreId)
      .not('vendedor_tiny_id', 'is', null);

    if (pedidosError) {
      console.error('[ListVendors] Erro ao buscar pedidos:', pedidosError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Erro ao buscar pedidos: ' + pedidosError.message }),
      };
    }

    console.log(`[ListVendors] ${(pedidosComVendedor || []).length} pedidos com vendedor encontrados`);

    // Agrupar vendedores únicos e contar pedidos
    const vendedoresMap = new Map();
    const pedidosSemColaboradora = {};

    (pedidosComVendedor || []).forEach(p => {
      const tinyId = String(p.vendedor_tiny_id);
      
      if (!vendedoresMap.has(tinyId)) {
        vendedoresMap.set(tinyId, {
          tiny_id: tinyId,
          nome: p.vendedor_nome || `Vendedor #${tinyId}`,
          total_pedidos: 0,
          pedidos_pendentes: 0,
        });
      }
      
      const vendedor = vendedoresMap.get(tinyId);
      vendedor.total_pedidos++;
      
      // Atualizar nome se estava vazio e agora tem
      if (p.vendedor_nome && (!vendedor.nome || vendedor.nome === `Vendedor #${tinyId}`)) {
        vendedor.nome = p.vendedor_nome;
      }
      
      // Contar pedidos sem colaboradora
      if (!p.colaboradora_id) {
        vendedor.pedidos_pendentes++;
        pedidosSemColaboradora[tinyId] = (pedidosSemColaboradora[tinyId] || 0) + 1;
      }
    });

    // Converter Map para Array e adicionar status de mapeamento
    const vendedoresComStatus = Array.from(vendedoresMap.values()).map(vendedor => {
      // Verificar se este vendedor já está mapeado para alguma colaboradora
      const colaboradoraMapeada = (colaboradoras || []).find(c => 
        c.tiny_vendedor_id && String(c.tiny_vendedor_id) === vendedor.tiny_id
      );

      return {
        ...vendedor,
        mapeado: !!colaboradoraMapeada,
        colaboradora_id: colaboradoraMapeada?.id || null,
        colaboradora_nome: colaboradoraMapeada?.nome || null,
      };
    });

    // Ordenar: não mapeados primeiro, depois por quantidade de pedidos pendentes
    vendedoresComStatus.sort((a, b) => {
      if (a.mapeado !== b.mapeado) return a.mapeado ? 1 : -1;
      return (b.pedidos_pendentes || 0) - (a.pedidos_pendentes || 0);
    });

    console.log(`[ListVendors] ${vendedoresComStatus.length} vendedores únicos encontrados`);

    // Retornar também as colaboradoras não mapeadas
    const colaboradorasNaoMapeadas = (colaboradoras || [])
      .filter(c => c.is_active && !c.tiny_vendedor_id)
      .map(c => ({
        id: c.id,
        nome: c.nome,
        email: c.email,
      }));

    const totalPedidosSemColaboradora = Object.values(pedidosSemColaboradora).reduce((a, b) => a + b, 0);

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
          pedidos_sem_colaboradora: totalPedidosSemColaboradora,
        },
      }),
    };

  } catch (error) {
    console.error('[ListVendors] Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
