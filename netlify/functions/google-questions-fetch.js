/**
 * Netlify Function: Buscar Perguntas do Google My Business
 * 
 * POST /.netlify/functions/google-questions-fetch
 * 
 * Busca perguntas e respostas de uma location específica do Google My Business
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Buscar perguntas de uma location
 */
async function fetchLocationQuestions(accessToken, locationId, pageToken = null) {
  try {
    // Google My Business API v4 - Buscar questions
    // Documentação: https://developers.google.com/my-business/content/questions
    let url = `https://mybusiness.googleapis.com/v4/${locationId}/questions?pageSize=50&orderBy=updateTime desc`;
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
      console.warn(`[Google Questions] Erro ao buscar questions da location ${locationId}:`, error);
      return { questions: [], nextPageToken: null };
    }

    const data = await response.json();
    return {
      questions: data.questions || [],
      nextPageToken: data.nextPageToken || null,
    };
  } catch (error) {
    console.error(`[Google Questions] Erro ao buscar questions da location ${locationId}:`, error);
    return { questions: [], nextPageToken: null };
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
      console.log('[Google Questions] Token expirado, renovando...');
      
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
    console.error('[Google Questions] Erro ao obter/renovar token:', error);
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

    // Buscar questions
    const allQuestions = [];
    let pageToken = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10;

    while (hasMore && pageCount < maxPages) {
      const result = await fetchLocationQuestions(accessToken, locationIdForV4, pageToken);
      allQuestions.push(...result.questions);
      pageToken = result.nextPageToken;
      hasMore = !!result.nextPageToken;
      pageCount++;
    }

    // Normalizar questions
    const normalizedQuestions = allQuestions.map((q) => ({
      id: q.name?.split('/').pop() || '',
      name: q.name || '',
      text: q.text || '',
      authorName: q.author?.displayName || 'Anônimo',
      authorPhoto: q.author?.profilePhotoUrl || null,
      createTime: q.createTime || new Date().toISOString(),
      updateTime: q.updateTime || q.createTime || new Date().toISOString(),
      upvoteCount: q.upvoteCount || 0,
      answerCount: q.answerCount || 0,
      topAnswer: q.topAnswer ? {
        text: q.topAnswer.text || '',
        createTime: q.topAnswer.createTime || new Date().toISOString(),
        authorType: q.topAnswer.author?.type || 'USER',
        authorName: q.topAnswer.author?.displayName || '',
      } : null,
      answers: q.answers ? q.answers.map(a => ({
        text: a.text || '',
        createTime: a.createTime || new Date().toISOString(),
        authorType: a.author?.type || 'USER',
        authorName: a.author?.displayName || '',
      })) : [],
    }));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        questions: normalizedQuestions,
        total: normalizedQuestions.length,
      }),
    };
  } catch (error) {
    console.error('[Google Questions Fetch] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao buscar perguntas',
      }),
    };
  }
};

