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
 * ✅ RENOVAÇÃO AUTOMÁTICA DE TOKEN
 * Atualiza o access token se estiver expirado ou próximo de expirar
 * Esta função roda no servidor (Netlify Function), então não tem problemas de CORS
 */
async function refreshTokenIfNeeded(supabaseAdmin, integration) {
  // Se não tem data de expiração, usar token atual
  if (!integration.token_expires_at) {
    console.log('[ERP-API-Proxy] Token sem data de expiração, usando token atual');
    return integration.access_token;
  }

  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();
  const minutesUntilExpiry = timeUntilExpiry / (60 * 1000);

  console.log(`[ERP-API-Proxy] Token expira em ${minutesUntilExpiry.toFixed(1)} minutos`);

  // ✅ RENOVAR SE: expirado OU expira em menos de 10 minutos
  const shouldRefresh = timeUntilExpiry < 10 * 60 * 1000; // 10 minutos

  if (shouldRefresh && integration.refresh_token) {
    console.log('[ERP-API-Proxy] 🔄 Token expirando/expirado, renovando automaticamente...');

    const config = ERP_CONFIGS[integration.sistema_erp || 'TINY'];
    if (!config) {
      throw new Error(`Sistema ERP ${integration.sistema_erp} não suportado`);
    }

    if (!integration.client_id || !integration.client_secret) {
      console.error('[ERP-API-Proxy] ❌ Credenciais incompletas para renovação');
      throw new Error('Credenciais incompletas. Reautorize a conexão.');
    }

    const tokenUrl = config.oauthTokenUrl;
    const redirectUri = `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-oauth-callback`;

    const tokenBody = new URLSearchParams();
    tokenBody.append('grant_type', 'refresh_token');
    tokenBody.append('refresh_token', integration.refresh_token);
    tokenBody.append('client_id', integration.client_id);
    tokenBody.append('client_secret', integration.client_secret);

    // Tiny ERP requer redirect_uri no refresh token
    if (integration.sistema_erp === 'TINY') {
      tokenBody.append('redirect_uri', redirectUri);
    }

    console.log('[ERP-API-Proxy] Fazendo requisição de renovação para:', tokenUrl);

    let tokenResponse;
    try {
      tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenBody.toString(),
      });
    } catch (fetchError) {
      console.error('[ERP-API-Proxy] ❌ Erro de rede ao renovar token:', fetchError);
      throw new Error(`Erro de rede ao renovar token: ${fetchError.message}`);
    }

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[ERP-API-Proxy] ❌ Erro ao renovar token:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
      });

      // Atualizar status no banco
      await supabaseAdmin
        .schema('sistemaretiradas')
        .from('erp_integrations')
        .update({
          sync_status: 'ERROR',
          error_message: `Erro ao renovar token: ${tokenResponse.status} ${errorText.substring(0, 200)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);

      throw new Error(`Erro ao renovar token: ${tokenResponse.status} ${errorText.substring(0, 100)}`);
    }

    let tokenData;
    try {
      tokenData = await tokenResponse.json();
    } catch (parseError) {
      console.error('[ERP-API-Proxy] ❌ Erro ao parsear resposta de renovação:', parseError);
      throw new Error('Resposta de renovação inválida');
    }

    console.log('[ERP-API-Proxy] ✅ Token renovado com sucesso');

    // Calcular data de expiração
    const expiresIn = tokenData.expires_in || 3600; // Padrão 1 hora
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Atualizar no banco
    const { error: updateError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || integration.refresh_token, // Manter refresh_token antigo se não vier novo
        token_expires_at: tokenExpiresAt,
        sync_status: 'CONNECTED',
        error_message: null, // Limpar erro anterior
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (updateError) {
      console.error('[ERP-API-Proxy] ⚠️ Erro ao atualizar token no banco:', updateError);
      // Continuar mesmo assim - o token foi renovado
    }

    console.log(`[ERP-API-Proxy] ✅ Token renovado e salvo. Expira em ${expiresIn}s (${(expiresIn / 60).toFixed(1)} minutos)`);
    return tokenData.access_token;
  }

  // Token ainda válido
  console.log(`[ERP-API-Proxy] ✅ Token válido, usando token atual`);
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

    // Verificar se a resposta está vazia
    if (!responseText || responseText.trim() === '') {
      console.warn('[ERP-API-Proxy] ⚠️ Resposta vazia do Tiny ERP API');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Resposta vazia do servidor',
          httpStatus: apiResponse.status, // ✅ Adicionado para debug
          endpoint
        }),
      };
    }

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // Se não for JSON, retornar texto
      console.warn('[ERP-API-Proxy] Resposta não é JSON:', responseText.substring(0, 500));
      responseData = { raw: responseText };
    }

    // ✅ LOG DETALHADO: Verificar estrutura da resposta para endpoints de pedidos
    if (endpoint && endpoint.includes('/pedidos')) {
      const isListagem = !endpoint.match(/\/pedidos\/\d+$/);
      const isDetalhes = endpoint.match(/\/pedidos\/\d+$/);

      console.log(`[ERP-API-Proxy] 📦 Resposta detalhada para ${endpoint}:`, {
        status: apiResponse.status,
        tipo: isListagem ? 'LISTAGEM (deve ter itens e paginacao)' : 'DETALHES (pedido direto)',
        tem_pedido_wrapper: !!responseData.pedido,
        tem_id_direto: !!responseData.id,
        tem_itens: !!responseData.itens,
        quantidade_itens: responseData.itens?.length || 0,
        tem_paginacao: !!responseData.paginacao,
        chaves_principais: Object.keys(responseData).slice(0, 20),
        estrutura_completa: JSON.stringify(responseData).substring(0, 2000),
      });

      // Se for listagem, verificar se os pedidos têm itens
      if (isListagem && responseData.itens && Array.isArray(responseData.itens)) {
        const primeiroPedido = responseData.itens[0];
        if (primeiroPedido) {
          console.log(`[ERP-API-Proxy] 📋 Primeiro pedido da listagem:`, {
            id: primeiroPedido.id,
            numeroPedido: primeiroPedido.numeroPedido,
            tem_itens: !!primeiroPedido.itens,
            quantidade_itens: primeiroPedido.itens?.length || 0,
            itens_preview: primeiroPedido.itens ? JSON.stringify(primeiroPedido.itens.slice(0, 2)) : 'null/undefined',
            todas_chaves: Object.keys(primeiroPedido),
          });
        }
      }

      // Se for detalhes completos, verificar itens
      if (isDetalhes) {
        const pedido = responseData;
        console.log(`[ERP-API-Proxy] 📦 Detalhes completos do pedido:`, {
          id: pedido.id,
          numeroPedido: pedido.numeroPedido,
          tem_itens: !!pedido.itens,
          quantidade_itens: pedido.itens?.length || 0,
          itens_preview: pedido.itens ? JSON.stringify(pedido.itens.slice(0, 2)) : 'null/undefined',
          estrutura_item_exemplo: pedido.itens && pedido.itens[0] ? {
            keys: Object.keys(pedido.itens[0]),
            produto: pedido.itens[0].produto,
            quantidade: pedido.itens[0].quantidade,
            valorUnitario: pedido.itens[0].valorUnitario,
          } : null,
        });
      }
    }

    // ✅ LOG DETALHADO: Verificar estrutura da resposta para endpoints de contatos
    if (endpoint && endpoint.includes('/contatos')) {
      // ✅ CORREÇÃO: Verificar se é listagem ou detalhes
      const isListagem = !endpoint.match(/\/contatos\/\d+$/);
      const isDetalhes = endpoint.match(/\/contatos\/\d+$/);

      console.log(`[ERP-API-Proxy] 📋 Resposta detalhada para ${endpoint}:`, {
        status: apiResponse.status,
        tipo: isListagem ? 'LISTAGEM (deve ter itens e paginacao)' : 'DETALHES (contato direto)',
        tem_contato_wrapper: !!responseData.contato,
        tem_id_direto: !!responseData.id,
        tem_itens: !!responseData.itens,
        tem_paginacao: !!responseData.paginacao,
        chaves_principais: Object.keys(responseData).slice(0, 15),
        estrutura_completa: JSON.stringify(responseData).substring(0, 1000),
      });

      // Se for GET /contatos/{id} (detalhes completos), logar campos importantes
      // ✅ CORREÇÃO: A documentação oficial mostra que GET /contatos/{id} retorna o contato DIRETAMENTE
      // Não há wrapper "contato", a resposta é o objeto contato em si
      if (endpoint.match(/\/contatos\/\d+$/)) {
        // responseData JÁ É o contato diretamente (não responseData.contato)
        const contato = responseData;
        console.log(`[ERP-API-Proxy] 📞 Campos de telefone/data no contato (DIRETO):`, {
          tem_telefone: !!contato.telefone,
          valor_telefone: contato.telefone,
          tem_celular: !!contato.celular,
          valor_celular: contato.celular,
          tem_dataNascimento: !!contato.dataNascimento,
          valor_dataNascimento: contato.dataNascimento,
          tem_data_nascimento: !!contato.data_nascimento,
          valor_data_nascimento: contato.data_nascimento,
          todas_chaves: Object.keys(contato).filter(k =>
            k.toLowerCase().includes('tel') ||
            k.toLowerCase().includes('cel') ||
            k.toLowerCase().includes('mobile') ||
            k.toLowerCase().includes('nasc')
          ),
          estrutura_verificada: 'responseData é o contato diretamente (sem wrapper)',
        });
      }
    }

    console.log(`[ERP-API-Proxy] Status: ${apiResponse.status}, Resposta (primeiros 500 chars):`, JSON.stringify(responseData).substring(0, 500));

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

