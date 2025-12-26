/**
 * Netlify Function: Responder Review do Google My Business
 * 
 * POST /api/google/reviews/respond
 * 
 * Responde a uma review do Google My Business
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      { db: { schema: 'elevea' } }
    );

    // Parse body
    const body = JSON.parse(event.body || '{}');
    const customerId = (body.customerId || body.customer_id || '').trim();
    const siteSlug = (body.siteSlug || body.site_slug || '').trim().toLowerCase();
    const accountId = (body.accountId || body.account_id || '').trim();
    const locationId = (body.locationId || body.location_id || '').trim();
    const reviewId = (body.reviewId || body.review_id || '').trim();
    const reply = (body.reply || '').trim();

    // Validar parâmetros obrigatórios
    if (!customerId || !siteSlug || !accountId || !locationId || !reviewId || !reply) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'customerId, siteSlug, accountId, locationId, reviewId e reply são obrigatórios',
        }),
      };
    }

    // Validar tamanho da resposta (limite do Google: 4096 caracteres)
    if (reply.length > 4096) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Resposta muito longa. Máximo 4096 caracteres.',
        }),
      };
    }

    // Buscar credenciais
    const { data: credentials, error: credError } = await supabase
      .from('google_credentials')
      .select('access_token, refresh_token, expires_at, token_type, status')
      .eq('customer_id', customerId)
      .eq('site_slug', siteSlug)
      .eq('status', 'active')
      .single();

    if (credError || !credentials || !credentials.access_token) {
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
    const isExpired = expiresAt ? now > (expiresAt - 300000) : false;

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
            .eq('customer_id', customerId)
            .eq('site_slug', siteSlug);
        }
      } catch (refreshError) {
        console.error('[Google Reviews Respond] Erro ao fazer refresh do token:', refreshError);
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

    // Enviar resposta para o Google
    // API v4: POST /v4/{name}/reviews/{reviewId}:reply
    const replyUrl = `https://mybusiness.googleapis.com/v4/${locationId}/reviews/${reviewId}:reply`;

    const replyResponse = await fetch(replyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: reply,
      }),
    });

    if (!replyResponse.ok) {
      const errorData = await replyResponse.json().catch(() => ({ error: { message: replyResponse.statusText } }));
      console.error('[Google Reviews Respond] Erro ao enviar resposta:', errorData);
      
      return {
        statusCode: replyResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: errorData.error?.message || `HTTP ${replyResponse.status}: ${replyResponse.statusText}`,
        }),
      };
    }

    const replyData = await replyResponse.json();

    // Atualizar review no banco com a resposta
    await supabase
      .from('google_reviews')
      .update({
        reply: reply,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId)
      .eq('site_slug', siteSlug)
      .eq('review_id_external', reviewId);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        ok: true,
        replied: true,
        message: 'Resposta enviada com sucesso',
      }),
    };
  } catch (error) {
    console.error('[Google Reviews Respond] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao responder review',
      }),
    };
  }
};


