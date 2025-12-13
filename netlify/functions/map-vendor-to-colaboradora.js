/**
 * Netlify Function: Mapear Vendedor Tiny para Colaboradora
 * 
 * Vincula manualmente um vendedor do Tiny ERP a uma colaboradora
 * 
 * Endpoint: /.netlify/functions/map-vendor-to-colaboradora
 * Método: POST
 * Body: { "store_id": "uuid", "tiny_vendedor_id": "123", "colaboradora_id": "uuid" }
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
    const { store_id, storeId: inputStoreId, tiny_vendedor_id, colaboradora_id } = body;
    const finalStoreId = store_id || inputStoreId;

    if (!finalStoreId || !tiny_vendedor_id || !colaboradora_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'store_id, tiny_vendedor_id e colaboradora_id são obrigatórios',
        }),
      };
    }

    console.log(`[MapVendor] 🔗 Mapeando vendedor ${tiny_vendedor_id} para colaboradora ${colaboradora_id}...`);

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

    // Verificar se a colaboradora existe e pertence à loja
    const { data: colaboradora, error: colabError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, nome, store_id, tiny_vendedor_id')
      .eq('id', colaboradora_id)
      .single();

    if (colabError || !colaboradora) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Colaboradora não encontrada' }),
      };
    }

    if (colaboradora.store_id !== finalStoreId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Colaboradora não pertence a esta loja' }),
      };
    }

    // Verificar se o vendedor já está mapeado para outra colaboradora
    const { data: jaMapesado } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, nome')
      .eq('store_id', finalStoreId)
      .eq('tiny_vendedor_id', String(tiny_vendedor_id))
      .neq('id', colaboradora_id)
      .maybeSingle();

    if (jaMapesado) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Este vendedor já está mapeado para ${jaMapesado.nome}`,
        }),
      };
    }

    // Atualizar a colaboradora com o tiny_vendedor_id
    const { error: updateError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .update({
        tiny_vendedor_id: String(tiny_vendedor_id),
        tiny_match_type: 'MANUAL',
        updated_at: new Date().toISOString(),
      })
      .eq('id', colaboradora_id);

    if (updateError) {
      console.error('[MapVendor] ❌ Erro ao atualizar colaboradora:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Erro ao salvar mapeamento' }),
      };
    }

    console.log(`[MapVendor] ✅ Mapeamento salvo: vendedor ${tiny_vendedor_id} → ${colaboradora.nome}`);

    // Atualizar pedidos existentes com este vendedor que não têm colaboradora
    const { data: pedidosAtualizados, error: pedidosError } = await supabase
      .schema('sistemaretiradas')
      .from('tiny_orders')
      .update({ colaboradora_id: colaboradora_id })
      .eq('store_id', finalStoreId)
      .eq('vendedor_tiny_id', String(tiny_vendedor_id))
      .is('colaboradora_id', null)
      .select('id');

    const pedidosCount = pedidosAtualizados?.length || 0;
    console.log(`[MapVendor] 📦 ${pedidosCount} pedidos atualizados com a nova colaboradora`);

    // Reprocessar criação de vendas para os pedidos atualizados
    if (pedidosCount > 0) {
      console.log(`[MapVendor] 🔄 Reprocessando criação de vendas para ${pedidosCount} pedidos...`);
      
      try {
        const { data: vendasResult, error: vendasError } = await supabase.rpc(
          'criar_vendas_de_tiny_orders',
          { p_store_id: finalStoreId, p_mes_referencia: null }
        );

        if (vendasError) {
          console.warn('[MapVendor] ⚠️ Aviso ao reprocessar vendas:', vendasError);
        } else {
          console.log('[MapVendor] ✅ Vendas reprocessadas:', vendasResult);
        }
      } catch (rpcError) {
        console.warn('[MapVendor] ⚠️ Erro ao chamar RPC:', rpcError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Vendedor mapeado para ${colaboradora.nome}`,
        pedidos_atualizados: pedidosCount,
      }),
    };

  } catch (error) {
    console.error('[MapVendor] ❌ Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
