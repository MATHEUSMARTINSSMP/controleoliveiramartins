/**
 * Netlify Function: Renovar URL Assinada
 * 
 * POST /api/marketing/assets/:id/refresh-url
 * 
 * Renova URL assinada de um asset quando expira
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
    if (event.httpMethod !== 'POST') {
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

    // Extrair asset ID do path
    const pathParts = event.path.split('/');
    const assetId = pathParts[pathParts.length - 2]; // .../assets/:id/refresh-url

    if (!assetId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Asset ID não fornecido',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Buscar asset
    const { data: asset, error } = await supabase
      .from('marketing_assets')
      .select('storage_path, signed_expires_at')
      .eq('id', assetId)
      .single();

    if (error || !asset) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Asset não encontrado',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    if (!asset.storage_path) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Asset não tem storage_path',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    // Gerar nova URL assinada (24h)
    const expiresIn = 24 * 60 * 60; // 24 horas
    const { data: signedData, error: signedError } = await supabase.storage
      .from('marketing')
      .createSignedUrl(asset.storage_path, expiresIn);

    if (signedError) {
      console.error('[marketing-assets-refresh] Erro ao gerar URL:', signedError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Erro ao gerar URL assinada',
          code: 'STORAGE_ERROR',
        }),
      };
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Atualizar asset
    await supabase
      .from('marketing_assets')
      .update({
        signed_url: signedData.signedUrl,
        signed_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaUrl: signedData.signedUrl,
        expiresAt: expiresAt.toISOString(),
      }),
    };
  } catch (error) {
    console.error('[marketing-assets-refresh] Erro:', error);
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

