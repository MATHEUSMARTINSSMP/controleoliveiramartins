/**
 * Netlify Function: Callback OAuth ERP (Genérico)
 * 
 * Esta função processa o callback OAuth de qualquer sistema ERP:
 * 1. Recebe o código de autorização
 * 2. Identifica loja e sistema via state
 * 3. Troca código por access token
 * 4. Salva token no Supabase (por loja)
 * 5. Redireciona para página de sucesso
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações por sistema ERP
// Documentação Tiny: https://erp.tiny.com.br/public-api/v3/swagger/index.html
// OAuth: https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token
const ERP_CONFIGS = {
  TINY: {
    baseUrl: 'https://api.tiny.com.br', // API v2 (legado)
    apiV3Url: 'https://erp.tiny.com.br/public-api/v3', // API v3 (nova)
    oauthTokenUrl: 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token', // OAuth Token
  },
  BLING: {
    baseUrl: 'https://www.bling.com.br',
    oauthTokenUrl: 'https://www.bling.com.br/Api/v3/oauth/token',
  },
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
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
      console.error('Missing Supabase environment variables');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Configuração do servidor incompleta.',
        }),
      };
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    );

    // Extrair código e state da query string
    const queryParams = new URLSearchParams(event.queryStringParameters || {});
    const code = queryParams.get('code');
    const error = queryParams.get('error');
    const errorDescription = queryParams.get('error_description');
    const state = queryParams.get('state');

    // Se houver erro no callback
    if (error) {
      console.error('[ERPOAuth] OAuth error:', error, errorDescription);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=${encodeURIComponent(errorDescription || error)}`,
        },
      };
    }

    // Validar código
    if (!code) {
      console.error('[ERPOAuth] No code received in callback');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=code_missing`,
        },
      };
    }

    // Validar state (deve conter store_id e sistema_erp)
    if (!state) {
      console.error('[ERPOAuth] No state received in callback');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=state_missing`,
        },
      };
    }

    let stateData;
    try {
      stateData = JSON.parse(decodeURIComponent(state));
    } catch (e) {
      console.error('[ERPOAuth] Invalid state format:', e);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=invalid_state`,
        },
      };
    }

    const { store_id } = stateData;

    if (!store_id) {
      console.error('[ERPOAuth] Missing store_id in state');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=invalid_state_data`,
        },
      };
    }

    console.log('[ERPOAuth] Processing callback for store:', store_id);

    // Buscar integração da loja (cada loja tem apenas uma)
    const { data: existingIntegration, error: credError } = await supabaseAdmin
      .from('erp_integrations')
      .select('id, client_id, client_secret, sistema_erp')
      .eq('store_id', store_id)
      .eq('active', true)
      .maybeSingle();

    if (credError && credError.code !== 'PGRST116') {
      console.error('[ERPOAuth] Error fetching credentials:', credError);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=credentials_error`,
        },
      };
    }

    // Se não encontrou integração, erro
    if (!existingIntegration) {
      console.error('[ERPOAuth] Integration not found for store');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=integration_not_found`,
        },
      };
    }

    const sistema_erp = existingIntegration.sistema_erp || 'TINY';
    const clientId = existingIntegration.client_id;
    const clientSecret = existingIntegration.client_secret;

    if (!clientId || !clientSecret) {
      console.error('[ERPOAuth] Credentials not found');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=credentials_not_found`,
        },
      };
    }

    // Obter configuração do sistema
    const config = ERP_CONFIGS[sistema_erp];
    if (!config) {
      console.error('[ERPOAuth] Sistema ERP não suportado:', sistema_erp);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=sistema_nao_suportado`,
        },
      };
    }

    console.log('[ERPOAuth] Exchanging code for token...');

    // Trocar código por token
    // Tiny ERP usa OAuth 2.0 padrão (OpenID Connect) com application/x-www-form-urlencoded
    let tokenUrl: string;
    let tokenBody: string;
    let tokenHeaders: Record<string, string>;

    if (sistema_erp === 'TINY') {
      tokenUrl = config.oauthTokenUrl;
      tokenHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-oauth-callback`,
      }).toString();
    } else if (sistema_erp === 'BLING') {
      tokenUrl = config.oauthTokenUrl || `${config.baseUrl}/Api/v3/oauth/token`;
      tokenHeaders = {
        'Content-Type': 'application/json',
      };
      tokenBody = JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-oauth-callback`,
      });
    } else {
      // Fallback para outros sistemas
      tokenUrl = config.oauthTokenUrl || `${config.baseUrl}/oauth/token`;
      tokenHeaders = {
        'Content-Type': 'application/json',
      };
      tokenBody = JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-oauth-callback`,
      });
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: tokenHeaders,
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
      console.error('[ERPOAuth] Error exchanging code:', errorData);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=${encodeURIComponent(errorData.message || 'Erro ao obter token')}`,
        },
      };
    }

    const tokenData = await tokenResponse.json();
    console.log('[ERPOAuth] Token received successfully');

    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

    let integrationId;

    if (existingIntegration) {
      // Atualizar existente
      const { data, error: updateError } = await supabaseAdmin
        .from('erp_integrations')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          sync_status: 'CONNECTED',
          error_message: null,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingIntegration.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('[ERPOAuth] Error updating integration:', updateError);
        throw updateError;
      }

      integrationId = data.id;
      console.log('[ERPOAuth] Integration updated:', integrationId);
    } else {
      // Criar novo registro
      const { data, error: insertError } = await supabaseAdmin
        .from('erp_integrations')
        .insert({
          store_id: store_id,
          sistema_erp: sistema_erp,
          client_id: clientId,
          client_secret: clientSecret,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          sync_status: 'CONNECTED',
          last_sync_at: new Date().toISOString(),
          active: true,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[ERPOAuth] Error creating integration:', insertError);
        throw insertError;
      }

      integrationId = data.id;
      console.log('[ERPOAuth] Integration created:', integrationId, 'for store:', store_id);
    }

    // Redirecionar para página de sucesso
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?success=true&store_id=${store_id}`,
      },
    };
  } catch (error) {
    console.error('[ERPOAuth] Unexpected error:', error);
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL || 'https://eleveaone.com.br'}/dev/erp-config?error=${encodeURIComponent(error.message || 'Erro inesperado')}`,
      },
    };
  }
};

