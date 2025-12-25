/**
 * Netlify Function: Listar Assets (Galeria)
 * 
 * GET /api/marketing/assets
 * 
 * Lista assets de marketing de uma loja
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Não autorizado', code: 'AUTH_ERROR' }),
      };
    }

    // Parse query params
    const queryParams = new URLSearchParams(event.queryStringParameters || {});
    const type = queryParams.get('type'); // 'image' | 'video'
    const limit = parseInt(queryParams.get('limit') || '50', 10);
    const cursor = queryParams.get('cursor'); // ID do último asset para paginação
    const storeId = queryParams.get('storeId'); // TODO: extrair do token

    if (!storeId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'storeId é obrigatório',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Construir query
    let query = supabase
      .from('marketing_assets')
      .select('id, type, provider, provider_model, prompt, storage_path, public_url, signed_url, signed_expires_at, meta, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100)); // Máximo 100

    if (type) {
      query = query.eq('type', type);
    }

    if (cursor) {
      // Paginação: buscar assets criados antes do cursor
      query = query.lt('created_at', cursor);
    }

    const { data: assets, error } = await query;

    if (error) {
      console.error('[marketing-assets-list] Erro:', error);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Erro ao buscar assets',
          code: 'UNKNOWN_ERROR',
        }),
      };
    }

    // Mapear assets para formato de resposta
    const mappedAssets = (assets || []).map((asset) => ({
      assetId: asset.id,
      type: asset.type,
      provider: asset.provider,
      providerModel: asset.provider_model,
      prompt: asset.prompt,
      mediaUrl: asset.public_url || asset.signed_url,
      signedExpiresAt: asset.signed_expires_at,
      meta: asset.meta || {},
      createdAt: asset.created_at,
    }));

    // Calcular próximo cursor
    const nextCursor =
      mappedAssets.length === limit && mappedAssets.length > 0
        ? mappedAssets[mappedAssets.length - 1].createdAt
        : null;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assets: mappedAssets,
        nextCursor,
        hasMore: nextCursor !== null,
      }),
    };
  } catch (error) {
    console.error('[marketing-assets-list] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'Erro interno',
        code: 'UNKNOWN_ERROR',
      }),
    };
  }
};

