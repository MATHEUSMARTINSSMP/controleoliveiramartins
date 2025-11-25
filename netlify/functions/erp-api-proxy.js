/**
 * Netlify Function: Proxy para API ERP
 * 
 * Resolve problema de CORS fazendo requisições ao Tiny ERP pelo servidor
 * O frontend chama esta função, que então chama a API do Tiny ERP
 * 
 * Documentação Tiny: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ERP_CONFIGS = {
  TINY: {
    apiV3Url: 'https://erp.tiny.com.br/public-api/v3',
    oauthTokenUrl: 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token',
  },
  BLING: {
    baseUrl: 'https://www.bling.com.br',
    oauthTokenUrl: 'https://www.bling.com.br/Api/v3/oauth/token',
  },
};

/**
 * Atualiza o access token se estiver expirado
 */
async function refreshTokenIfNeeded(supabaseAdmin, integration) {
  if (!integration.token_expires_at) return integration.access_token;

  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();

  // Se expira em menos de 5 minutos, renovar
  if (timeUntilExpiry < 5 * 60 * 1000 && integration.refresh_token) {
    console.log('[ERP-API-Proxy] Token expirando, renovando...');
    
    const config = ERP_CONFIGS[integration.sistema_erp || 'TINY'];
    if (!config) {
      throw new Error(`Sistema ERP ${integration.sistema_erp} não suportado`);
    }

    const tokenUrl = config.oauthTokenUrl;
    const redirectUri = `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-oauth-callback`;

    const tokenBody = new URLSearchParams();
    tokenBody.append('grant_type', 'refresh_token');
    tokenBody.append('refresh_token', integration.refresh_token);
    tokenBody.append('client_id', integration.client_id);
    tokenBody.append('client_secret', integration.client_secret);
    
    if (integration.sistema_erp === 'TINY') {
      tokenBody.append('redirect_uri', redirectUri);
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[ERP-API-Proxy] Erro ao renovar token:', error);
      throw new Error('Erro ao renovar token de acesso');
    }

    const tokenData = await tokenResponse.json();
    
    // Calcular data de expiração
    const expiresIn = tokenData.expires_in || 3600; // Padrão 1 hora
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Atualizar no banco
    await supabaseAdmin
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || integration.refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    return tokenData.access_token;
  }

  return integration.access_token;
}

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
      console.error('[ERP-API-Proxy] Missing Supabase environment variables');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Configuração do servidor incompleta',
        }),
      };
    }

    // Inicializar Supabase Admin
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: { schema: 'sistemaretiradas' },
      }
    );

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Body inválido',
        }),
      };
    }

    const { storeId, endpoint, params = {}, method = 'GET' } = body;

    if (!storeId || !endpoint) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'storeId e endpoint são obrigatórios',
        }),
      };
    }

    // Buscar integração da loja
    const { data: integration, error: credError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (credError || !integration) {
      console.error('[ERP-API-Proxy] Integração não encontrada:', credError);
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Integração ERP não encontrada para esta loja',
        }),
      };
    }

    if (!integration.access_token) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Token de acesso não encontrado. Reautorize a conexão.',
        }),
      };
    }

    // Verificar e renovar token se necessário
    const accessToken = await refreshTokenIfNeeded(supabaseAdmin, integration);

    // Obter configuração do sistema ERP
    const sistemaERP = integration.sistema_erp || 'TINY';
    const config = ERP_CONFIGS[sistemaERP];
    
    if (!config) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Sistema ERP ${sistemaERP} não suportado`,
        }),
      };
    }

    // Construir URL
    let url = `${config.apiV3Url}${endpoint}`;

    // Para GET, parâmetros na query string
    // Para POST, parâmetros no body
    let requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    };

    if (method === 'GET') {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    } else {
      requestOptions.body = JSON.stringify(params);
    }

    console.log(`[ERP-API-Proxy] Fazendo requisição ${method} para: ${url}`);
    console.log(`[ERP-API-Proxy] Headers:`, JSON.stringify(requestOptions.headers, null, 2));
    if (requestOptions.body) {
      console.log(`[ERP-API-Proxy] Body:`, requestOptions.body.substring(0, 200));
    }

    // Fazer requisição para API do Tiny ERP
    let apiResponse;
    try {
      apiResponse = await fetch(url, requestOptions);
    } catch (fetchError) {
      console.error('[ERP-API-Proxy] Erro ao fazer fetch:', fetchError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Erro de rede ao conectar com Tiny ERP: ${fetchError.message}`,
        }),
      };
    }

    // Ler resposta
    const responseText = await apiResponse.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // Se não for JSON, retornar texto
      console.warn('[ERP-API-Proxy] Resposta não é JSON:', responseText.substring(0, 500));
      responseData = { raw: responseText };
    }

    console.log(`[ERP-API-Proxy] Status: ${apiResponse.status}, Resposta:`, JSON.stringify(responseData).substring(0, 500));

    // Se erro 401, marcar como erro no banco
    if (apiResponse.status === 401) {
      await supabaseAdmin
        .schema('sistemaretiradas')
        .from('erp_integrations')
        .update({
          sync_status: 'ERROR',
          error_message: 'Token inválido ou expirado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);
    }

    // Retornar resposta
    return {
      statusCode: apiResponse.status,
      headers: { 
        ...corsHeaders, 
        'Content-Type': apiResponse.headers.get('content-type') || 'application/json',
      },
      body: JSON.stringify(responseData),
    };

  } catch (error) {
    console.error('[ERP-API-Proxy] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
    };
  }
};

