/**
 * Netlify Function: Callback OAuth Tiny ERP
 * 
 * Esta função processa o callback OAuth do Tiny ERP:
 * 1. Recebe o código de autorização
 * 2. Troca código por access token
 * 3. Salva token no Supabase
 * 4. Redireciona para página de sucesso
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // NOTA: Client ID e Secret agora vêm do banco de dados (por tenant)
    // Env vars são apenas fallback para compatibilidade
    // O callback receberá tenant_id via query param ou state

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    );

    // Extrair código e tenant_id da query string
    const queryParams = new URLSearchParams(event.queryStringParameters || {});
    const code = queryParams.get('code');
    const error = queryParams.get('error');
    const errorDescription = queryParams.get('error_description');
    const state = queryParams.get('state'); // Pode conter tenant_id
    const tenantId = state ? JSON.parse(decodeURIComponent(state)).tenant_id : null;

    // Se houver erro no callback
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/tiny-config?error=${encodeURIComponent(errorDescription || error)}`,
        },
      };
    }

    // Validar código
    if (!code) {
      console.error('No code received in callback');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/tiny-config?error=code_missing`,
        },
      };
    }

    console.log('[TinyOAuth] Exchanging code for token...');
    console.log('[TinyOAuth] Tenant ID:', tenantId);

    // Buscar credenciais do tenant (ou padrão se não houver tenant_id)
    let credentialsQuery = supabaseAdmin
      .from('tiny_api_credentials')
      .select('id, client_id, client_secret, tenant_id')
      .eq('active', true);

    if (tenantId) {
      credentialsQuery = credentialsQuery.eq('tenant_id', tenantId);
    } else {
      // Se não tem tenant_id, buscar registro sem tenant_id (padrão)
      credentialsQuery = credentialsQuery.is('tenant_id', null);
    }

    const { data: existingCredentials, error: credError } = await credentialsQuery.maybeSingle();

    // Se não encontrou, tentar criar novo ou usar env vars como fallback
    let clientId, clientSecret;
    
    if (existingCredentials) {
      clientId = existingCredentials.client_id;
      clientSecret = existingCredentials.client_secret;
      console.log('[TinyOAuth] Usando credenciais do banco de dados');
    } else {
      // Fallback para env vars (compatibilidade)
      clientId = process.env.VITE_TINY_API_CLIENT_ID;
      clientSecret = process.env.VITE_TINY_API_CLIENT_SECRET;
      console.log('[TinyOAuth] Usando credenciais de env vars (fallback)');
    }

    if (!clientId || !clientSecret) {
      console.error('[TinyOAuth] Credenciais não encontradas');
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/tiny-config?error=credentials_not_found`,
        },
      };
    }

    // Trocar código por token
    const tokenResponse = await fetch('https://api.tiny.com.br/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${process.env.URL || 'https://eleveaone.com.br'}/api/tiny/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
      console.error('[TinyOAuth] Error exchanging code:', errorData);
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/tiny-config?error=${encodeURIComponent(errorData.message || 'Erro ao obter token')}`,
        },
      };
    }

    const tokenData = await tokenResponse.json();
    console.log('[TinyOAuth] Token received successfully');

    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

    let credentialsId;

    if (existingCredentials) {
      // Atualizar existente
      const { data, error: updateError } = await supabaseAdmin
        .from('tiny_api_credentials')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          sync_status: 'CONNECTED',
          error_message: null,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCredentials.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('[TinyOAuth] Error updating credentials:', updateError);
        throw updateError;
      }

      credentialsId = data.id;
      console.log('[TinyOAuth] Credentials updated:', credentialsId);
    } else {
      // Criar novo registro
      // Se não tinha credenciais no banco, usar as que foram usadas para obter o token
      const { data, error: insertError } = await supabaseAdmin
        .from('tiny_api_credentials')
        .insert({
          client_id: clientId,
          client_secret: clientSecret,
          tenant_id: tenantId || null, // Salvar tenant_id se fornecido
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
        console.error('[TinyOAuth] Error creating credentials:', insertError);
        throw insertError;
      }

      credentialsId = data.id;
      console.log('[TinyOAuth] Credentials created:', credentialsId, 'for tenant:', tenantId);
    }

    // Redirecionar para página de sucesso
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/tiny-config?success=true`,
      },
    };
  } catch (error) {
    console.error('[TinyOAuth] Unexpected error:', error);
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL || 'https://eleveaone.com.br'}/admin/tiny-config?error=${encodeURIComponent(error.message || 'Erro inesperado')}`,
      },
    };
  }
};

