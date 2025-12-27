/**
 * Netlify Function: Buscar Métricas de Performance do Google My Business
 * 
 * POST /.netlify/functions/google-performance-fetch
 * 
 * Busca insights e métricas de performance de uma location do Google My Business
 * Usa reportInsights (ainda disponível, mas pode estar deprecated em favor da nova Performance API)
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Buscar insights de performance de uma location
 * Usa reportInsights endpoint (v4)
 */
async function fetchLocationInsights(accessToken, locationIds, startDate, endDate) {
  try {
    // Google My Business API v4 - reportInsights
    // Documentação: https://developers.google.com/my-business/content/insights
    // NOTA: Este endpoint pode estar deprecated, mas ainda funciona
    const url = `https://mybusiness.googleapis.com/v4/${locationIds[0].split('/locations/')[0]}/locations:reportInsights`;

    const requestBody = {
      locationNames: locationIds,
      basicRequest: {
        metricRequests: [
          {
            metric: 'QUERIES_DIRECT',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'QUERIES_INDIRECT',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'VIEWS_MAPS',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'VIEWS_SEARCH',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'ACTIONS_WEBSITE',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'ACTIONS_PHONE',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'ACTIONS_DRIVING_DIRECTIONS',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'PHOTOS_VIEWS_MERCHANT',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'PHOTOS_VIEWS_CUSTOMERS',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'PHOTOS_COUNT_MERCHANT',
            options: ['AGGREGATED_DAILY'],
          },
          {
            metric: 'PHOTOS_COUNT_CUSTOMERS',
            options: ['AGGREGATED_DAILY'],
          },
        ],
        timeRange: {
          startTime: startDate,
          endTime: endDate,
        },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      console.warn(`[Google Performance] Erro ao buscar insights:`, error);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[Google Performance] Erro ao buscar insights:`, error);
    return null;
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
      console.log('[Google Performance] Token expirado, renovando...');
      
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
    console.error('[Google Performance] Erro ao obter/renovar token:', error);
    throw error;
  }
}

/**
 * Processar métricas do response
 */
function processMetrics(locationMetrics) {
  if (!locationMetrics || !locationMetrics.metricValues) {
    return {
      views: { total: 0, change: 0 },
      clicks: { total: 0, change: 0 },
      calls: { total: 0, change: 0 },
      directions: { total: 0, change: 0 },
      messages: { total: 0, change: 0 },
    };
  }

  const metrics = locationMetrics.metricValues;
  let views = 0;
  let clicks = 0;
  let calls = 0;
  let directions = 0;

  metrics.forEach(mv => {
    const value = mv.dailyMetricValues?.[0]?.values?.[0]?.value || 0;
    
    switch (mv.metric) {
      case 'QUERIES_DIRECT':
      case 'QUERIES_INDIRECT':
      case 'VIEWS_MAPS':
      case 'VIEWS_SEARCH':
        views += parseInt(value) || 0;
        break;
      case 'ACTIONS_WEBSITE':
        clicks += parseInt(value) || 0;
        break;
      case 'ACTIONS_PHONE':
        calls += parseInt(value) || 0;
        break;
      case 'ACTIONS_DRIVING_DIRECTIONS':
        directions += parseInt(value) || 0;
        break;
    }
  });

  return {
    views: { total: views, change: 0 }, // Change precisa de comparação com período anterior
    clicks: { total: clicks, change: 0 },
    calls: { total: calls, change: 0 },
    directions: { total: directions, change: 0 },
  };
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
    const period = body.period || '30d'; // 7d, 30d, 90d, 1y

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

    // Calcular datas baseado no período
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Buscar location_ids
    let locationIds = [];
    if (locationId) {
      locationIds = [locationId];
    } else {
      const { data: locations, error: locError } = await supabase
        .from('google_business_accounts')
        .select('account_id, location_id')
        .eq('customer_id', userEmail)
        .eq('site_slug', siteSlug)
        .not('location_id', 'is', null);

      if (locError || !locations || locations.length === 0) {
        return {
          statusCode: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Locations não encontradas',
          }),
        };
      }

      // Construir location names no formato correto: accounts/{accountId}/locations/{locationId}
      locationIds = locations.map(loc => {
        const accountId = loc.account_id.split('/').pop() || loc.account_id;
        return `accounts/${accountId}/locations/${loc.location_id}`;
      });
    }

    if (locationIds.length === 0) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Nenhuma location encontrada',
        }),
      };
    }

    // Buscar insights
    const insightsData = await fetchLocationInsights(
      accessToken,
      locationIds,
      startDate.toISOString(),
      endDate.toISOString()
    );

    if (!insightsData || !insightsData.locationMetrics || insightsData.locationMetrics.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          metrics: {
            views: { total: 0, change: 0 },
            clicks: { total: 0, change: 0 },
            calls: { total: 0, change: 0 },
            directions: { total: 0, change: 0 },
          },
          rawData: null,
        }),
      };
    }

    // Processar primeira location (ou agregar todas)
    const aggregatedMetrics = insightsData.locationMetrics.reduce((acc, lm) => {
      const processed = processMetrics(lm);
      acc.views.total += processed.views.total;
      acc.clicks.total += processed.clicks.total;
      acc.calls.total += processed.calls.total;
      acc.directions.total += processed.directions.total;
      return acc;
    }, {
      views: { total: 0, change: 0 },
      clicks: { total: 0, change: 0 },
      calls: { total: 0, change: 0 },
      directions: { total: 0, change: 0 },
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        metrics: aggregatedMetrics,
        rawData: insightsData,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }),
    };
  } catch (error) {
    console.error('[Google Performance Fetch] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao buscar métricas de performance',
      }),
    };
  }
};

