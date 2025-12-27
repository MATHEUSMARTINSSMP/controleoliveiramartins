/**
 * Netlify Function: Callback OAuth Google My Business
 * 
 * GET /api/google/oauth/callback
 * 
 * Processa o callback OAuth do Google My Business:
 * 1. Recebe código de autorização
 * 2. Valida PKCE
 * 3. Troca código por tokens
 * 4. Salva credenciais no banco
 * 5. Busca e salva accounts/locations
 * 6. Redireciona para dashboard
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Configuração OAuth Google
const GOOGLE_OAUTH_CONFIG = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uri: process.env.GOOGLE_REDIRECT_URI || (process.env.URL ? `${process.env.URL}/.netlify/functions/google-oauth-callback` : 'https://eleveaone.com.br/.netlify/functions/google-oauth-callback'),
  token_url: 'https://oauth2.googleapis.com/token',
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://eleveaone.com.br';

/**
 * Buscar accounts do Google My Business
 */
async function fetchAccounts(accessToken) {
  try {
    // Usar API v4 (mybusiness.googleapis.com) conforme documentação oficial
    const response = await fetch('https://mybusiness.googleapis.com/v4/accounts', {
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
    return data.accounts || [];
  } catch (error) {
    console.error('[Google OAuth] Erro ao buscar accounts:', error);
    return [];
  }
}

/**
 * Buscar locations de uma account
 */
async function fetchLocations(accessToken, accountName) {
  try {
    // Usar API v4 (mybusiness.googleapis.com) conforme documentação oficial
    // accountName deve estar no formato: accounts/123456789
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${accountName}/locations`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      console.warn(`[Google OAuth] Erro ao buscar locations da account ${accountName}:`, error.error?.message);
      return [];
    }

    const data = await response.json();
    return data.locations || [];
  } catch (error) {
    console.error(`[Google OAuth] Erro ao buscar locations da account ${accountName}:`, error);
    return [];
  }
}

/**
 * Salvar account/location no banco
 */
async function saveAccountLocation(supabase, customerId, siteSlug, account, location, isPrimary = false) {
  try {
    const { error } = await supabase
      .from('google_business_accounts')
      .upsert({
        customer_id: customerId,
        site_slug: siteSlug,
        account_id: account.name || account.account_id,
        account_name: account.accountName || account.name || '',
        account_type: account.type || 'PERSONAL',
        location_id: location.name || location.location_id || '',
        location_name: location.title || location.storefront?.title || '',
        location_address: location.storefront?.address?.addressLines?.join(', ') || '',
        location_phone: location.storefront?.primaryPhone || location.storefront?.phoneNumbers?.[0] || '',
        location_website: location.storefront?.websiteUri || '',
        location_category: location.categories?.primaryCategory?.displayName || '',
        location_latitude: location.storefront?.address?.latlng?.latitude || null,
        location_longitude: location.storefront?.address?.latlng?.longitude || null,
        is_primary: isPrimary,
      }, {
        onConflict: 'customer_id,site_slug,account_id,location_id',
      });

    if (error) {
      console.error('[Google OAuth] Erro ao salvar account/location:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Google OAuth] Erro ao salvar account/location:', error);
    return false;
  }
}

/**
 * Salvar accounts e locations após obter tokens
 */
async function saveAccountsAndLocations(supabase, accessToken, customerId, siteSlug) {
  try {
    // Buscar accounts
    const accounts = await fetchAccounts(accessToken);
    
    if (accounts.length === 0) {
      console.log('[Google OAuth] Nenhuma account encontrada');
      return { success: true, accountsCount: 0, locationsCount: 0 };
    }

    let totalLocations = 0;
    let firstLocation = true;

    // Para cada account, buscar locations
    for (const account of accounts) {
      const accountName = account.name || '';
      if (!accountName) continue;

      // account.name já vem no formato correto: accounts/123456789
      const locations = await fetchLocations(accessToken, accountName);
      
      // Salvar cada location
      for (const location of locations) {
        const saved = await saveAccountLocation(
          supabase,
          customerId,
          siteSlug,
          account,
          location,
          firstLocation // Primeira location é primária
        );
        
        if (saved) {
          totalLocations++;
          firstLocation = false;
        }

        // Delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return {
      success: true,
      accountsCount: accounts.length,
      locationsCount: totalLocations,
    };
  } catch (error) {
    console.error('[Google OAuth] Erro ao salvar accounts/locations:', error);
    return {
      success: false,
      error: error.message,
      accountsCount: 0,
      locationsCount: 0,
    };
  }
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
    // Validar variáveis de ambiente
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent('Configuração do servidor incompleta')}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Extrair parâmetros da query string
    const queryParams = event.queryStringParameters || {};
    const code = queryParams.code;
    const state = queryParams.state;
    const error = queryParams.error;
    const errorDescription = queryParams.error_description;

    // Verificar se houve erro do Google
    if (error) {
      const errorMsg = errorDescription || error;
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent(errorMsg)}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    // Validar parâmetros obrigatórios
    if (!code || !state) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent('Código de autorização ou state não fornecidos')}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    // Decodificar state
    let stateData;
    try {
      const stateBuffer = Buffer.from(state, 'base64url');
      stateData = JSON.parse(stateBuffer.toString());
    } catch (e) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent('State inválido')}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    const { customerId, siteSlug, codeVerifier } = stateData;

    if (!customerId || !siteSlug || !codeVerifier) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent('Dados do state incompletos')}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    // Trocar código por tokens
    const tokenParams = new URLSearchParams({
      code: code,
      client_id: GOOGLE_OAUTH_CONFIG.client_id,
      client_secret: GOOGLE_OAUTH_CONFIG.client_secret,
      redirect_uri: GOOGLE_OAUTH_CONFIG.redirect_uri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch(GOOGLE_OAUTH_CONFIG.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ error: { message: tokenResponse.statusText } }));
      console.error('[Google OAuth] Erro ao trocar código por tokens:', errorData);
      
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent(errorData.error?.message || 'Erro ao obter tokens')}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      token_type,
      scope,
    } = tokenData;

    if (!access_token) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent('Access token não recebido')}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    // Calcular expires_at
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Salvar credenciais no banco
    const { error: saveError } = await supabase
      .from('google_credentials')
      .upsert({
        customer_id: customerId,
        site_slug: siteSlug,
        scopes: scope || GOOGLE_OAUTH_CONFIG.scope,
        status: 'active',
        access_token: access_token,
        token_type: token_type || 'Bearer',
        refresh_token: refresh_token || null,
        expires_at: expiresAt,
      }, {
        onConflict: 'customer_id,site_slug',
      });

    if (saveError) {
      console.error('[Google OAuth] Erro ao salvar credenciais:', saveError);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent('Erro ao salvar credenciais')}">
          </head>
          <body>
            <p>Redirecionando...</p>
          </body>
          </html>
        `,
      };
    }

    // Buscar e salvar accounts/locations (em background, não bloquear redirect)
    saveAccountsAndLocations(supabase, access_token, customerId, siteSlug)
      .then(result => {
        console.log('[Google OAuth] Accounts/locations salvos:', result);
      })
      .catch(err => {
        console.error('[Google OAuth] Erro ao salvar accounts/locations:', err);
      });

    // Redirecionar para página de marketing com sucesso
    const redirectUrl = `${FRONTEND_URL}/admin/marketing?gmb=ok&site=${encodeURIComponent(siteSlug)}`;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="refresh" content="0;url=${redirectUrl}">
        </head>
        <body>
          <script>
            window.location.href = "${redirectUrl}";
          </script>
          <p>Redirecionando... <a href="${redirectUrl}">Clique aqui se não redirecionar automaticamente</a></p>
        </body>
        </html>
      `,
    };
  } catch (error) {
    console.error('[Google OAuth Callback] Erro:', error);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="refresh" content="0;url=${FRONTEND_URL}/admin/marketing?gmb=error&msg=${encodeURIComponent(error.message || 'Erro desconhecido')}">
        </head>
        <body>
          <p>Redirecionando...</p>
        </body>
        </html>
      `,
    };
  }
};

