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

    if (!process.env.VITE_TINY_API_CLIENT_ID || !process.env.VITE_TINY_API_CLIENT_SECRET) {
      console.error('Missing Tiny API credentials');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Credenciais Tiny não configuradas.',
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

    // Extrair código da query string
    const queryParams = new URLSearchParams(event.queryStringParameters || {});
    const code = queryParams.get('code');
    const error = queryParams.get('error');
    const errorDescription = queryParams.get('error_description');

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

    // Trocar código por token
    const tokenResponse = await fetch('https://api.tiny.com.br/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.VITE_TINY_API_CLIENT_ID,
        client_secret: process.env.VITE_TINY_API_CLIENT_SECRET,
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

    // Buscar ou criar registro de credenciais
    const { data: existingCredentials } = await supabaseAdmin
      .from('tiny_api_credentials')
      .select('*')
      .eq('active', true)
      .maybeSingle();

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
      // Criar novo
      const { data, error: insertError } = await supabaseAdmin
        .from('tiny_api_credentials')
        .insert({
          client_id: process.env.VITE_TINY_API_CLIENT_ID,
          client_secret: process.env.VITE_TINY_API_CLIENT_SECRET,
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
      console.log('[TinyOAuth] Credentials created:', credentialsId);
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

