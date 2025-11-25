/**
 * Integração Genérica com Sistemas ERP
 * 
 * Suporta múltiplos sistemas: Tiny, Bling, Microvix, Conta Azul, etc.
 * Cada LOJA pode ter integração com diferentes sistemas ERP
 * 
 * Documentação Tiny: https://ajuda.olist.com/kb/articles/erp/integracoes
 */

// URLs base das APIs (fixas, não mudam por loja)
export const ERP_CONFIGS = {
  TINY: {
    baseUrl: 'https://api.tiny.com.br',
    erpUrl: 'https://erp.tiny.com.br',
    oauthEndpoint: '/oauth/authorize',
    tokenEndpoint: '/oauth/access_token',
  },
  BLING: {
    baseUrl: 'https://www.bling.com.br',
    erpUrl: 'https://www.bling.com.br',
    oauthEndpoint: '/Api/v3/oauth/authorize',
    tokenEndpoint: '/Api/v3/oauth/token',
  },
  // Adicionar outros sistemas conforme necessário
  // MICROVIX: { ... },
  // CONTA_AZUL: { ... },
};

export type SistemaERP = 'TINY' | 'BLING' | 'MICROVIX' | 'CONTA_AZUL';

interface ERPIntegration {
  id: string;
  store_id: string;
  sistema_erp: SistemaERP;
  client_id: string;
  client_secret: string;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  sync_status: string;
  config_adicional?: any;
}

/**
 * Gera URL de autorização OAuth para sistema ERP
 * Busca credenciais da LOJA no banco de dados
 * Cada loja tem apenas UMA integração ERP
 * 
 * @param storeId - ID da loja
 * @returns URL completa para redirecionar o usuário
 */
export async function getERPAuthorizationUrl(
  storeId: string
): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');

  // Buscar integração da loja (cada loja tem apenas uma)
  const { data: integration, error } = await supabase
    .schema('sistemaretiradas')
    .from('erp_integrations')
    .select('client_id, sistema_erp')
    .eq('store_id', storeId)
    .eq('active', true)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Erro ao buscar credenciais: ${error.message}`);
  }

  // Se não encontrou integração, erro
  if (!integration) {
    throw new Error(`Integração ERP não configurada para esta loja. Configure as credenciais primeiro em /dev/erp-config.`);
  }

  const sistemaERP = (integration.sistema_erp || 'TINY') as SistemaERP;
  const config = ERP_CONFIGS[sistemaERP];
  
  if (!config) {
    throw new Error(`Sistema ERP ${sistemaERP} não suportado`);
  }

  const clientId = integration.client_id;
  
  if (!clientId) {
    throw new Error(`Client ID não encontrado para loja ${storeId}. Configure as credenciais primeiro em /dev/erp-config.`);
  }

  const redirectUri = `${window.location.origin}/api/erp/callback`;
  
  // Incluir store_id no state (sistema já está salvo na integração)
  const state = encodeURIComponent(JSON.stringify({ 
    store_id: storeId
  }));
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
  });

  // Escopos específicos por sistema
  if (sistemaERP === 'TINY') {
    params.append('scope', 'produtos pedidos estoque contatos');
  } else if (sistemaERP === 'BLING') {
    params.append('scope', 'produtos pedidos estoque');
  }
  
  return `${config.erpUrl}${config.oauthEndpoint}?${params.toString()}`;
}

/**
 * Troca código OAuth por access token
 * 
 * @param code - Código recebido no callback
 * @param storeId - ID da loja
 * @param sistemaERP - Sistema ERP
 * @param clientId - Client ID
 * @param clientSecret - Client Secret
 * @returns Token de acesso e refresh token
 */
export async function exchangeCodeForToken(
  code: string,
  storeId: string,
  sistemaERP: SistemaERP,
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const config = ERP_CONFIGS[sistemaERP];
  
  if (!config) {
    throw new Error(`Sistema ERP ${sistemaERP} não suportado`);
  }

  const response = await fetch(`${config.baseUrl}${config.tokenEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${window.location.origin}/api/erp/callback`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(`Erro ao trocar código por token: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Renova access token usando refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  storeId: string,
  sistemaERP: SistemaERP,
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const config = ERP_CONFIGS[sistemaERP];
  
  if (!config) {
    throw new Error(`Sistema ERP ${sistemaERP} não suportado`);
  }

  const response = await fetch(`${config.baseUrl}${config.tokenEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(`Erro ao renovar token: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Faz chamada à API ERP com autenticação automática
 * Busca credenciais da LOJA no banco de dados
 * Cada loja tem apenas UMA integração ERP
 * 
 * @param storeId - ID da loja
 * @param endpoint - Endpoint da API
 * @param params - Parâmetros da requisição
 * @returns Resposta da API
 */
export async function callERPAPI(
  storeId: string,
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any> {
  const { supabase } = await import('@/integrations/supabase/client');

  // Buscar integração da loja (cada loja tem apenas uma)
  const { data: integration, error: credError } = await supabase
    .schema('sistemaretiradas')
    .from('erp_integrations')
    .select('*')
    .eq('store_id', storeId)
    .eq('active', true)
    .maybeSingle();

  if (credError || !integration) {
    throw new Error(`Integração ERP não encontrada para esta loja. Configure primeiro.`);
  }

  const sistemaERP = (integration.sistema_erp || 'TINY') as SistemaERP;
  const config = ERP_CONFIGS[sistemaERP];
  
  if (!config) {
    throw new Error(`Sistema ERP ${sistemaERP} não suportado`);
  }

  if (!integration.access_token) {
    throw new Error('Token de acesso não encontrado. Reautorize a conexão.');
  }

  // Verificar se token está expirado
  const now = new Date();
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  
  let accessToken = integration.access_token;
  let refreshToken = integration.refresh_token;

  // Se token expirado, renovar
  if (expiresAt && expiresAt <= now) {
    console.log(`[ERPAPI] Token expirado, renovando para loja ${storeId}...`);
    
    if (!refreshToken || !integration.client_id || !integration.client_secret) {
      throw new Error('Token expirado e credenciais incompletas. Reautorize a conexão.');
    }

    try {
      const newTokens = await refreshAccessToken(
        refreshToken,
        storeId,
        sistemaERP,
        integration.client_id,
        integration.client_secret
      );
      accessToken = newTokens.access_token;
      refreshToken = newTokens.refresh_token;

      // Atualizar no banco
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokens.expires_in);

      await supabase
        .schema('sistemaretiradas')
        .from('erp_integrations')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);

      console.log(`[ERPAPI] Token renovado com sucesso para loja ${storeId}`);
    } catch (error: any) {
      console.error(`[ERPAPI] Erro ao renovar token:`, error);
      await supabase
        .schema('sistemaretiradas')
        .from('erp_integrations')
        .update({
          sync_status: 'ERROR',
          error_message: error.message,
        })
        .eq('id', integration.id);
      
      throw new Error('Erro ao renovar token. Reautorize a conexão.');
    }
  }

  // Fazer chamada à API (formato específico por sistema)
  const url = `${config.baseUrl}${endpoint}`;
  let requestBody: any;

  // Formato de requisição específico por sistema
  if (sistemaERP === 'TINY') {
    requestBody = {
      token: accessToken,
      formato: 'JSON',
      ...params,
    };
  } else if (sistemaERP === 'BLING') {
    requestBody = {
      ...params,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    
    if (response.status === 401) {
      await supabase
        .schema('sistemaretiradas')
        .from('erp_integrations')
        .update({
          sync_status: 'ERROR',
          error_message: 'Token inválido ou expirado',
        })
        .eq('id', integration.id);
      
      throw new Error('Token inválido. Reautorize a conexão.');
    }

    throw new Error(`Erro na API ${sistemaERP}: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  
  // Atualizar última sincronização
  await supabase
    .schema('sistemaretiradas')
    .from('erp_integrations')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_status: 'CONNECTED',
      error_message: null,
    })
    .eq('id', integration.id);

  return data;
}

/**
 * Testa conexão com API ERP de uma loja
 * Cada loja tem apenas UMA integração ERP
 */
export async function testERPConnection(
  storeId: string
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Buscar qual sistema a loja usa
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: integration } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('sistema_erp')
      .eq('store_id', storeId)
      .eq('active', true)
      .maybeSingle();

    const sistemaERP = (integration?.sistema_erp || 'TINY') as SistemaERP;

    // Chamada de teste específica por sistema
    let endpoint: string;
    let params: Record<string, any> = {};

    if (sistemaERP === 'TINY') {
      endpoint = '/api/produtos.pesquisa.php';
      params = { pesquisa: '', pagina: 1 };
    } else if (sistemaERP === 'BLING') {
      endpoint = '/Api/v3/produtos';
      params = { pagina: 1 };
    } else {
      throw new Error(`Sistema ${sistemaERP} não suportado para teste`);
    }

    const result = await callERPAPI(storeId, endpoint, params);

    return {
      success: true,
      message: `Conexão com ${sistemaERP} estabelecida com sucesso!`,
      data: result,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erro ao testar conexão',
    };
  }
}

// =============================================================================
// FUNÇÕES DE COMPATIBILIDADE (mantém tinyApi.ts funcionando)
// =============================================================================

/**
 * @deprecated Use getERPAuthorizationUrl() com storeId
 */
export async function getTinyAuthorizationUrl(storeId?: string): Promise<string> {
  if (!storeId) {
    throw new Error('storeId é obrigatório. Cada loja tem seu próprio sistema ERP.');
  }
  return getERPAuthorizationUrl(storeId);
}

/**
 * @deprecated Use callERPAPI() com storeId
 */
export async function callTinyAPI(
  endpoint: string,
  params: Record<string, any> = {},
  storeId?: string
): Promise<any> {
  if (!storeId) {
    throw new Error('storeId é obrigatório. Cada loja tem seu próprio sistema ERP.');
  }
  return callERPAPI(storeId, endpoint, params);
}

/**
 * @deprecated Use testERPConnection() com storeId
 */
export async function testTinyConnection(storeId?: string): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  if (!storeId) {
    throw new Error('storeId é obrigatório. Cada loja tem seu próprio sistema ERP.');
  }
  return testERPConnection(storeId);
}

