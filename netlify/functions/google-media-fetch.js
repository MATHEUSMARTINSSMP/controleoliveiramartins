/**
 * Netlify Function: Buscar Mídias do Google My Business
 * 
 * POST /.netlify/functions/google-media-fetch
 * 
 * Busca fotos e vídeos de uma location específica do Google My Business
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Buscar mídias de uma location
 */
async function fetchLocationMedia(accessToken, locationId, pageToken = null) {
  try {
    // Google My Business API v4 - Buscar mídias
    // Documentação: https://developers.google.com/my-business/content/basic-setup
    let url = `https://mybusiness.googleapis.com/v4/${locationId}/media?pageSize=100`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      console.warn(`[Google Media] Erro ao buscar mídias da location ${locationId}:`, error);
      return { mediaItems: [], nextPageToken: null };
    }

    const data = await response.json();
    return {
      mediaItems: data.mediaItems || [],
      nextPageToken: data.nextPageToken || null,
    };
  } catch (error) {
    console.error(`[Google Media] Erro ao buscar mídias da location ${locationId}:`, error);
    return { mediaItems: [], nextPageToken: null };
  }
}

/**
 * Renovar access token se necessário
 */
async function refreshAccessTokenIfNeeded(supabase, userEmail, siteSlug) {
  try {
    const { data: credentials, error: credError } = await supabase
      .schema('sistemaretiradas')
      .from('google_credentials')
      .select('*')
      .eq('customer_id', userEmail)
      .eq('site_slug', siteSlug)
      .maybeSingle();

    if (credError || !credentials) {
      throw new Error('Credenciais Google não encontradas');
    }

    if (!credentials.access_token) {
      throw new Error('Access token não encontrado');
    }

    // Verificar se token está expirado
    const now = new Date();
    const expiresAt = credentials.expires_at ? new Date(credentials.expires_at) : null;

    if (expiresAt && expiresAt <= now && credentials.refresh_token) {
      console.log('[Google Media] Token expirado, renovando...');
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: credentials.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Erro ao renovar token');
      }

      const tokenData = await tokenResponse.json();
      const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

      await supabase
        .schema('sistemaretiradas')
        .from('google_credentials')
        .update({
          access_token: tokenData.access_token,
          expires_at: newExpiresAt,
        })
        .eq('customer_id', userEmail)
        .eq('site_slug', siteSlug);

      return tokenData.access_token;
    }

    return credentials.access_token;
  } catch (error) {
    console.error('[Google Media] Erro ao obter/renovar token:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    const body = JSON.parse(event.body || '{}');
    const siteSlug = (body.siteSlug || body.site_slug || '').trim().toLowerCase();
    const userEmail = (body.userEmail || body.user_email || body.customerId || '').trim().toLowerCase();
    const locationId = (body.locationId || '').trim();

    if (!siteSlug || !userEmail) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'siteSlug e userEmail são obrigatórios',
        }),
      };
    }

    // Obter/renovar access token
    const accessToken = await refreshAccessTokenIfNeeded(supabase, userEmail, siteSlug);

    // Buscar location_id se não fornecido
    let finalLocationId = locationId;
    if (!finalLocationId) {
      const { data: locations, error: locError } = await supabase
        .from('google_business_accounts')
        .select('location_id')
        .eq('customer_id', userEmail)
        .eq('site_slug', siteSlug)
        .not('location_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (locError || !locations) {
        return {
          statusCode: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Location não encontrada',
          }),
        };
      }

      finalLocationId = locations.location_id;
    }

    // Buscar mídias
    const allMediaItems = [];
    let pageToken = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10; // Limite de segurança

    while (hasMore && pageCount < maxPages) {
      const result = await fetchLocationMedia(accessToken, finalLocationId, pageToken);
      allMediaItems.push(...result.mediaItems);
      pageToken = result.nextPageToken;
      hasMore = !!result.nextPageToken;
      pageCount++;
    }

    // Normalizar mídias para formato padrão
    const normalizedMedia = allMediaItems.map((item, index) => ({
      id: item.mediaFormat?.sourceUrl?.split('/').pop() || `media_${index}`,
      url: item.mediaFormat?.sourceUrl || item.googleUrl || '',
      thumbnailUrl: item.thumbnailUrl || item.mediaFormat?.sourceUrl || '',
      type: item.mediaFormat?.sourceUrl?.includes('video') ? 'VIDEO' : 'PHOTO',
      category: item.category || 'OTHER',
      views: item.insights?.viewCount || 0,
      uploadDate: item.createTime || new Date().toISOString(),
      author: item.attribution?.displayName || 'Owner',
      description: item.description || '',
    }));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        mediaItems: normalizedMedia,
        total: normalizedMedia.length,
      }),
    };
  } catch (error) {
    console.error('[Google Media Fetch] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao buscar mídias',
      }),
    };
  }
};

