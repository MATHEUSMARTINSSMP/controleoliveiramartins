/**
 * Netlify Function: Buscar Reviews do Google My Business
 * 
 * POST /api/google/reviews
 * 
 * Busca reviews reais de todas as locations do Google My Business
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Buscar reviews de uma location
 */
async function fetchLocationReviews(accessToken, locationId, pageToken = null) {
  try {
    let url = `https://mybusiness.googleapis.com/v4/${locationId}/reviews?pageSize=50&orderBy=updateTime desc`;
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
      throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      reviews: data.reviews || [],
      nextPageToken: data.nextPageToken || null,
    };
  } catch (error) {
    console.error(`[Google Reviews] Erro ao buscar reviews da location ${locationId}:`, error);
    return { reviews: [], nextPageToken: null };
  }
}

/**
 * Converter star rating do Google para número
 */
function convertStarRating(rating) {
  const ratingMap = {
    'ONE': 1,
    'TWO': 2,
    'THREE': 3,
    'FOUR': 4,
    'FIVE': 5,
  };
  return ratingMap[rating] || 0;
}

/**
 * Processar review do Google para formato do banco
 */
function processReview(review, accountId, locationId) {
  return {
    review_id_external: review.reviewId || review.name || '',
    rating: convertStarRating(review.starRating),
    comment: review.comment || '',
    author_name: review.reviewer?.displayName || 'Anônimo',
    review_date: review.createTime || review.updateTime || new Date().toISOString(),
    reply: review.reply?.comment || '',
    account_id: accountId,
    location_id: locationId,
  };
}

/**
 * Salvar reviews no banco
 */
async function saveReviews(supabase, customerId, siteSlug, reviews) {
  if (reviews.length === 0) return { saved: 0, errors: 0 };

  let saved = 0;
  let errors = 0;

  for (const review of reviews) {
    try {
      const { error } = await supabase
        .from('google_reviews')
        .upsert({
          customer_id: customerId,
          site_slug: siteSlug,
          review_id_external: review.review_id_external,
          rating: review.rating,
          comment: review.comment || null,
          author_name: review.author_name || null,
          review_date: review.review_date,
          reply: review.reply || null,
          account_id: review.account_id || null,
          location_id: review.location_id || null,
        }, {
          onConflict: 'customer_id,site_slug,review_id_external',
        });

      if (error) {
        console.error('[Google Reviews] Erro ao salvar review:', error);
        errors++;
      } else {
        saved++;
      }
    } catch (error) {
      console.error('[Google Reviews] Erro ao salvar review:', error);
      errors++;
    }
  }

  return { saved, errors };
}

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
    if (event.httpMethod !== 'POST') {
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

    // Parse body
    const body = JSON.parse(event.body || '{}');
    const siteSlug = (body.siteSlug || body.site_slug || '').trim().toLowerCase();
    const userEmail = (body.userEmail || body.user_email || body.customerId || '').trim().toLowerCase();

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

    // Buscar credenciais do banco (incluindo location_id opcional)
    const { data: credentials, error: credError } = await supabase
      .from('google_credentials')
      .select('access_token, refresh_token, expires_at, token_type, status, location_id')
      .eq('customer_id', userEmail)
      .eq('site_slug', siteSlug)
      .eq('status', 'active')
      .single();

    if (credError || !credentials) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Credenciais não encontradas. Conecte sua conta Google primeiro.',
          needsReauth: true,
        }),
      };
    }

    // Verificar se token está expirado
    const now = Date.now();
    const expiresAt = credentials.expires_at ? new Date(credentials.expires_at).getTime() : null;
    const isExpired = expiresAt ? now > (expiresAt - 300000) : false; // 5 min antes

    let accessToken = credentials.access_token;

    // Se expirado e tem refresh_token, fazer refresh
    if (isExpired && credentials.refresh_token) {
      try {
        const refreshParams = new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: credentials.refresh_token,
          grant_type: 'refresh_token',
        });

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: refreshParams.toString(),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;

          // Atualizar token no banco
          const newExpiresAt = refreshData.expires_in
            ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
            : null;

          await supabase
            .from('google_credentials')
            .update({
              access_token: accessToken,
              expires_at: newExpiresAt,
            })
            .eq('customer_id', userEmail)
            .eq('site_slug', siteSlug);
        }
      } catch (refreshError) {
        console.error('[Google Reviews] Erro ao fazer refresh do token:', refreshError);
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Token expirado. Reconecte sua conta Google.',
            needsReauth: true,
          }),
        };
      }
    }

    if (!accessToken) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Access token não disponível. Reconecte sua conta Google.',
          needsReauth: true,
        }),
      };
    }

    // Buscar locations do banco
    // Se credentials tem location_id, filtrar apenas essa location
    let locationsQuery = supabase
      .from('google_business_accounts')
      .select('account_id, location_id')
      .eq('customer_id', userEmail)
      .eq('site_slug', siteSlug);
    
    // Se tem location_id na credencial, filtrar apenas essa location
    if (credentials.location_id) {
      locationsQuery = locationsQuery.eq('location_id', credentials.location_id);
      console.log(`[Google Reviews] Filtrando por location_id: ${credentials.location_id}`);
    }
    
    const { data: locations, error: locError } = await locationsQuery;

    if (locError || !locations || locations.length === 0) {
      // Se não tem locations no banco, tentar buscar da API
      console.log('[Google Reviews] Nenhuma location no banco, tentando buscar da API...');
      
      // Buscar accounts
      const accountsResponse = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!accountsResponse.ok) {
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            ok: true,
            reviews: [],
            totalReviews: 0,
            message: 'Nenhuma location encontrada. Conecte sua conta Google primeiro.',
          }),
        };
      }

      const accountsData = await accountsResponse.json();
      const accounts = accountsData.accounts || [];

      // Buscar locations de cada account e salvar no banco
      const allLocations = [];
      for (const account of accounts) {
        const accountId = account.name || '';
        if (!accountId) continue;

        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (locationsResponse.ok) {
          const locationsData = await locationsResponse.json();
          const accountLocations = locationsData.locations || [];

          for (const location of accountLocations) {
            allLocations.push({
              account_id: accountId,
              location_id: location.name || '',
            });

            // Salvar no banco (apenas se não tiver location_id na credencial OU se for a location específica)
            const shouldSave = !credentials.location_id || location.name === credentials.location_id;
            
            if (shouldSave) {
              await supabase
                .from('google_business_accounts')
                .upsert({
                  customer_id: userEmail,
                  site_slug: siteSlug,
                  account_id: accountId,
                  account_name: account.accountName || '',
                  location_id: location.name || '',
                  location_name: location.title || location.storefront?.title || '',
                  is_primary: allLocations.length === 1 && (!credentials.location_id || location.name === credentials.location_id),
                }, {
                  onConflict: 'customer_id,site_slug,account_id,location_id',
                });
            }
          }
        }

        // Delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (allLocations.length === 0) {
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            ok: true,
            reviews: [],
            totalReviews: 0,
            message: 'Nenhuma location encontrada.',
          }),
        };
      }

      // Usar locations encontradas
      locations = allLocations;
    }

    // Buscar reviews de cada location
    const allReviews = [];
    for (const location of locations) {
      if (!location.location_id) continue;

      let pageToken = null;
      let hasMore = true;

      while (hasMore) {
        const result = await fetchLocationReviews(
          accessToken,
          location.location_id,
          pageToken
        );

        // Processar reviews
        for (const review of result.reviews) {
          const processedReview = processReview(
            review,
            location.account_id,
            location.location_id
          );
          allReviews.push(processedReview);
        }

        pageToken = result.nextPageToken;
        hasMore = !!pageToken;

        // Delay para evitar rate limit
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Delay entre locations
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Salvar reviews no banco
    const saveResult = await saveReviews(supabase, userEmail, siteSlug, allReviews);

    // Calcular estatísticas
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0
      ? allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
      : 0;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ok: true,
        reviews: allReviews,
        totalReviews: totalReviews,
        averageRating: Number(averageRating.toFixed(2)),
        saved: saveResult.saved,
        errors: saveResult.errors,
      }),
    };
  } catch (error) {
    console.error('[Google Reviews Fetch] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao buscar reviews',
      }),
    };
  }
};


