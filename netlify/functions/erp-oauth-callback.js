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
const ERP_CONFIGS = {
  TINY: {
    baseUrl: 'https://api.tiny.com.br',
    tokenEndpoint: '/oauth/access_token',
  },
  BLING: {
    baseUrl: 'https://www.bling.com.br',
    tokenEndpoint: '/Api/v3/oauth/token',
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
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=${encodeURIComponent(errorDescription || error)}`,
        },
      };
    }

    // Validar código
    if (!code) {
      console.error('[ERPOAuth] No code received in callback');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=code_missing`,
        },
      };
    }

    // Validar state (deve conter store_id e sistema_erp)
    if (!state) {
      console.error('[ERPOAuth] No state received in callback');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=state_missing`,
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
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=invalid_state`,
        },
      };
    }

    const { store_id, sistema_erp } = stateData;

    if (!store_id || !sistema_erp) {
      console.error('[ERPOAuth] Missing store_id or sistema_erp in state');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=invalid_state_data`,
        },
      };
    }

    console.log('[ERPOAuth] Processing callback for store:', store_id, 'system:', sistema_erp);

    // Buscar credenciais da loja
    const { data: existingIntegration, error: credError } = await supabaseAdmin
      .from('erp_integrations')
      .select('id, client_id, client_secret')
      .eq('store_id', store_id)
      .eq('sistema_erp', sistema_erp)
      .eq('active', true)
      .maybeSingle();

    if (credError && credError.code !== 'PGRST116') {
      console.error('[ERPOAuth] Error fetching credentials:', credError);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=credentials_error`,
        },
      };
    }

    // Se não encontrou, tentar env var como fallback (apenas para desenvolvimento)
    let clientId, clientSecret;
    
    if (existingIntegration) {
      clientId = existingIntegration.client_id;
      clientSecret = existingIntegration.client_secret;
      console.log('[ERPOAuth] Using credentials from database');
    } else {
      // Fallback para env vars (apenas desenvolvimento/teste)
      clientId = process.env[`VITE_${sistema_erp}_API_CLIENT_ID`];
      clientSecret = process.env[`VITE_${sistema_erp}_API_CLIENT_SECRET`];
      console.log('[ERPOAuth] Using credentials from env vars (fallback)');
    }

    if (!clientId || !clientSecret) {
      console.error('[ERPOAuth] Credentials not found');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=credentials_not_found`,
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
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=sistema_nao_suportado`,
        },
      };
    }

    console.log('[ERPOAuth] Exchanging code for token...');

    // Trocar código por token
    const tokenResponse = await fetch(`${config.baseUrl}${config.tokenEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.URL || 'https://eleveaone.com.br'}/api/erp/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
      console.error('[ERPOAuth] Error exchanging code:', errorData);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=${encodeURIComponent(errorData.message || 'Erro ao obter token')}`,
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
        Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?success=true&store_id=${store_id}&sistema=${sistema_erp}`,
      },
    };
  } catch (error) {
    console.error('[ERPOAuth] Unexpected error:', error);
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/erp-integrations?error=${encodeURIComponent(error.message || 'Erro inesperado')}`,
      },
    };
  }
};

