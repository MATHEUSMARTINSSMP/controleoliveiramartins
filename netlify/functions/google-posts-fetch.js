/**
 * Netlify Function: Buscar Postagens do Google My Business
 * 
 * POST /.netlify/functions/google-posts-fetch
 * 
 * Busca postagens (posts) de uma location específica do Google My Business
 */

const { createClient } = require('@supabase/supabase-js');
const { buildV4Parent } = require('./utils/googleBusinessProfileHelpers');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Buscar postagens de uma location
 */
async function fetchLocationPosts(accessToken, locationId, pageToken = null) {
  try {
    // Google My Business API v4 - Buscar posts
    let url = `https://mybusiness.googleapis.com/v4/${locationId}/localPosts?pageSize=50`;
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
      console.warn(`[Google Posts] Erro ao buscar posts da location ${locationId}:`, error);
      return { localPosts: [], nextPageToken: null };
    }

    const data = await response.json();
    return {
      localPosts: data.localPosts || [],
      nextPageToken: data.nextPageToken || null,
    };
  } catch (error) {
    console.error(`[Google Posts] Erro ao buscar posts da location ${locationId}:`, error);
    return { localPosts: [], nextPageToken: null };
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

    const now = new Date();
    const expiresAt = credentials.expires_at ? new Date(credentials.expires_at) : null;

    if (expiresAt && expiresAt <= now && credentials.refresh_token) {
      console.log('[Google Posts] Token expirado, renovando...');
      
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
    console.error('[Google Posts] Erro ao obter/renovar token:', error);
    throw error;
  }
}

exports.handler = async (event) => {
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

    const accessToken = await refreshAccessTokenIfNeeded(supabase, userEmail, siteSlug);

    // Buscar account_id e location_id se não fornecido
    let finalLocationId = locationId;
    let accountId = null;
    
    if (!finalLocationId) {
      const { data: locationData, error: locError } = await supabase
        .schema('sistemaretiradas')
        .from('google_business_accounts')
        .select('account_id, location_id')
        .eq('customer_id', userEmail)
        .eq('site_slug', siteSlug)
        .not('location_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (locError || !locationData) {
        return {
          statusCode: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Location não encontrada',
          }),
        };
      }

      accountId = locationData.account_id;
      finalLocationId = locationData.location_id;
    } else {
      // Se locationId foi fornecido, buscar account_id correspondente
      const { data: locationData, error: locError } = await supabase
        .schema('sistemaretiradas')
        .from('google_business_accounts')
        .select('account_id')
        .eq('customer_id', userEmail)
        .eq('site_slug', siteSlug)
        .eq('location_id', finalLocationId)
        .limit(1)
        .maybeSingle();

      if (!locError && locationData) {
        accountId = locationData.account_id;
      }
    }

    // Construir formato v4 se temos account_id e location_id
    let locationIdForV4 = finalLocationId;
    if (accountId && finalLocationId) {
      locationIdForV4 = buildV4Parent(accountId, finalLocationId);
    }

    // Buscar posts
    const allPosts = [];
    let pageToken = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10;

    while (hasMore && pageCount < maxPages) {
      const result = await fetchLocationPosts(accessToken, locationIdForV4, pageToken);
      allPosts.push(...result.localPosts);
      pageToken = result.nextPageToken;
      hasMore = !!result.nextPageToken;
      pageCount++;
    }

    // Normalizar posts
    const normalizedPosts = allPosts.map((post) => ({
      name: post.name || '',
      summary: post.summary || '',
      state: post.state || 'UNSPECIFIED',
      createTime: post.createTime || new Date().toISOString(),
      updateTime: post.updateTime || new Date().toISOString(),
      media: post.media || [],
      callToAction: post.callToAction || null,
      topics: post.topics || [],
      languageCode: post.languageCode || 'pt-BR',
    }));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        posts: normalizedPosts,
        total: normalizedPosts.length,
      }),
    };
  } catch (error) {
    console.error('[Google Posts Fetch] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao buscar postagens',
      }),
    };
  }
};

