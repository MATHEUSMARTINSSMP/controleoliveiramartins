/**
 * Netlify Function: Iniciar OAuth Google My Business
 * 
 * GET /api/google/oauth/start
 * 
 * Inicia o fluxo OAuth do Google My Business com PKCE
 */

const crypto = require('crypto');
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
  scope: 'openid email https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/business.manage',
  auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_url: 'https://oauth2.googleapis.com/token',
};

// Redis client (usando Supabase como alternativa temporária)
// TODO: Implementar Redis real se necessário

/**
 * Gerar code_verifier para PKCE (mínimo 43 caracteres)
 */
function generateCodeVerifier(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  for (let i = 0; i < length; i++) {
    verifier += chars[Math.floor(Math.random() * chars.length)];
  }
  return verifier;
}

/**
 * Gerar code_challenge a partir do code_verifier
 */
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Salvar code_verifier temporariamente (usando Supabase como cache)
 */
async function saveCodeVerifier(supabase, nonce, codeVerifier, ttlSeconds = 1800) {
  try {
    // Usar uma tabela temporária ou criar uma tabela de cache
    // Por enquanto, vamos usar uma abordagem simples com Supabase
    // Em produção, considere usar Redis
    
    // Criar tabela de cache se não existir (via migration)
    // Por enquanto, vamos armazenar em uma tabela simples
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    
    // Usar uma tabela de cache temporária
    // Por simplicidade, vamos usar uma abordagem diferente:
    // Incluir o code_verifier no state e validar no callback
    // OU criar uma tabela elevea.oauth_pkce_cache
    
    return { success: true, nonce, codeVerifier };
  } catch (error) {
    console.error('[Google OAuth] Erro ao salvar code_verifier:', error);
    return { success: false, error: error.message };
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
    // Validar método
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    // Extrair parâmetros da query string
    const queryParams = event.queryStringParameters || {};
    const customerId = (queryParams.customerId || '').trim();
    const siteSlug = (queryParams.siteSlug || '').trim().toLowerCase();

    // Validar parâmetros obrigatórios
    if (!customerId || !siteSlug) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'customerId e siteSlug são obrigatórios',
        }),
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

    // Gerar PKCE
    const nonce = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier(64);
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Salvar code_verifier (usando state para incluir no callback)
    // Por enquanto, vamos incluir o code_verifier no state de forma segura
    // OU criar uma tabela de cache no Supabase
    
    // Criar state: customerId|siteSlug|nonce|codeVerifier (base64)
    const stateData = {
      customerId,
      siteSlug,
      nonce,
      codeVerifier, // Incluir no state (será validado no callback)
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Construir URL de autorização
    const authParams = new URLSearchParams({
      client_id: GOOGLE_OAUTH_CONFIG.client_id,
      redirect_uri: GOOGLE_OAUTH_CONFIG.redirect_uri,
      response_type: 'code',
      scope: GOOGLE_OAUTH_CONFIG.scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `${GOOGLE_OAUTH_CONFIG.auth_url}?${authParams.toString()}`;

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        authUrl: authUrl,
        timestamp: new Date().toISOString(),
        customerId,
        siteSlug,
      }),
    };
  } catch (error) {
    console.error('[Google OAuth Start] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao iniciar autenticação',
      }),
    };
  }
};

