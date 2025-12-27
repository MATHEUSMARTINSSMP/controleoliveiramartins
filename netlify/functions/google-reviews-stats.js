/**
 * Netlify Function: Estatísticas de Reviews do Google My Business
 * 
 * GET /api/google/reviews/stats
 * 
 * Retorna estatísticas agregadas dos reviews
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Validar método
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    // Validar variáveis de ambiente
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Configuração do servidor incompleta',
        }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Extrair parâmetros da query string
    const queryParams = event.queryStringParameters || {};
    const siteSlug = (queryParams.siteSlug || queryParams.site_slug || '').trim().toLowerCase();
    const customerId = (queryParams.customerId || queryParams.customer_id || '').trim().toLowerCase();
    const period = (queryParams.period || '30d').trim();

    if (!siteSlug) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'siteSlug é obrigatório',
        }),
      };
    }

    // Calcular data inicial baseado no período
    const now = new Date();
    let fromDate = '1900-01-01';
    
    if (period === '7d') {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (period === '30d') {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (period === '90d') {
      fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (period === '1y') {
      fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    // Buscar reviews do banco
    let query = supabase
      .schema('sistemaretiradas')
      .from('google_reviews')
      .select('rating, reply')
      .eq('site_slug', siteSlug)
      .gte('review_date', fromDate)
      .order('review_date', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: reviews, error: reviewsError } = await query;

    if (reviewsError) {
      console.error('[Google Reviews Stats] Erro ao buscar reviews:', reviewsError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Erro ao buscar reviews',
        }),
      };
    }

    const reviewsList = reviews || [];
    const count = reviewsList.length;

    // Calcular estatísticas
    if (count === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          ok: true,
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          responseRate: 0,
          repliedReviews: 0,
          period: period,
        }),
      };
    }

    // Calcular média
    const sum = reviewsList.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;

    // Distribuição de ratings
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewsList.forEach(r => {
      const v = Math.round(Number(r.rating || 0));
      if (v >= 1 && v <= 5) dist[v]++;
    });

    // Reviews com resposta
    const replied = reviewsList.filter(r => (r.reply || '').trim().length > 0).length;
    const responseRate = count > 0 ? Number(((replied / count) * 100).toFixed(2)) : 0;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ok: true,
        totalReviews: count,
        averageRating: avg,
        ratingDistribution: dist,
        responseRate: responseRate,
        repliedReviews: replied,
        period: period,
      }),
    };
  } catch (error) {
    console.error('[Google Reviews Stats] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao calcular estatísticas',
      }),
    };
  }
};


