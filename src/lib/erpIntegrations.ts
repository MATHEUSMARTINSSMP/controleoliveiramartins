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
 * 
 * @param storeId - ID da loja
 * @param sistemaERP - Sistema ERP ('TINY', 'BLING', etc)
 * @returns URL completa para redirecionar o usuário
 */
export async function getERPAuthorizationUrl(
  storeId: string,
  sistemaERP: SistemaERP = 'TINY'
): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');
  const config = ERP_CONFIGS[sistemaERP];
  
  if (!config) {
    throw new Error(`Sistema ERP ${sistemaERP} não suportado`);
  }

  // Buscar credenciais da loja
  const { data: integration, error } = await supabase
    .schema('sistemaretiradas')
    .from('erp_integrations')
    .select('client_id')
    .eq('store_id', storeId)
    .eq('sistema_erp', sistemaERP)
    .eq('active', true)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Erro ao buscar credenciais: ${error.message}`);
  }

  // Se não encontrou no banco, tentar env var como fallback (compatibilidade)
  let clientId = integration?.client_id;
  
  if (!clientId) {
    // Fallback para env vars (apenas para desenvolvimento/teste)
    clientId = import.meta.env[`VITE_${sistemaERP}_API_CLIENT_ID`];
    if (!clientId) {
      throw new Error(`Client ID não encontrado para loja ${storeId}. Configure as credenciais primeiro.`);
    }
  }

  const redirectUri = `${window.location.origin}/api/erp/callback`;
  
  // Incluir store_id e sistema no state para o callback saber qual loja/sistema é
  const state = encodeURIComponent(JSON.stringify({ 
    store_id: storeId,
    sistema_erp: sistemaERP 
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
 * 
 * @param storeId - ID da loja
 * @param sistemaERP - Sistema ERP ('TINY', 'BLING', etc)
 * @param endpoint - Endpoint da API
 * @param params - Parâmetros da requisição
 * @returns Resposta da API
 */
export async function callERPAPI(
  storeId: string,
  sistemaERP: SistemaERP,
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any> {
  const { supabase } = await import('@/integrations/supabase/client');
  const config = ERP_CONFIGS[sistemaERP];
  
  if (!config) {
    throw new Error(`Sistema ERP ${sistemaERP} não suportado`);
  }

  // Buscar credenciais da loja
  const { data: integration, error: credError } = await supabase
    .schema('sistemaretiradas')
    .from('erp_integrations')
    .select('*')
    .eq('store_id', storeId)
    .eq('sistema_erp', sistemaERP)
    .eq('active', true)
    .maybeSingle();

  if (credError || !integration) {
    throw new Error(`Integração ${sistemaERP} não encontrada para esta loja. Configure primeiro.`);
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
 */
export async function testERPConnection(
  storeId: string,
  sistemaERP: SistemaERP = 'TINY'
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
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

    const result = await callERPAPI(storeId, sistemaERP, endpoint, params);

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
    throw new Error('storeId é obrigatório. Cada loja tem seu próprio Tiny ERP.');
  }
  return getERPAuthorizationUrl(storeId, 'TINY');
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
    throw new Error('storeId é obrigatório. Cada loja tem seu próprio Tiny ERP.');
  }
  return callERPAPI(storeId, 'TINY', endpoint, params);
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
    throw new Error('storeId é obrigatório. Cada loja tem seu próprio Tiny ERP.');
  }
  return testERPConnection(storeId, 'TINY');
}

