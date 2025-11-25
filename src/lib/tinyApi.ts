/**
 * Integração com API Tiny ERP
 * 
 * Documentação: https://ajuda.olist.com/kb/articles/erp/integracoes
 */

// Configuração da API Tiny
export const TINY_API_CONFIG = {
  baseUrl: import.meta.env.VITE_TINY_API_BASE_URL || 'https://api.tiny.com.br',
  erpUrl: import.meta.env.VITE_TINY_ERP_URL || 'https://erp.tiny.com.br',
  clientId: import.meta.env.VITE_TINY_API_CLIENT_ID,
  clientSecret: import.meta.env.VITE_TINY_API_CLIENT_SECRET,
};

/**
 * Gera URL de autorização OAuth para o Tiny ERP
 * @returns URL completa para redirecionar o usuário
 */
export function getTinyAuthorizationUrl(): string {
  if (!TINY_API_CONFIG.clientId) {
    throw new Error('VITE_TINY_API_CLIENT_ID não está configurado');
  }

  const redirectUri = `${window.location.origin}/api/tiny/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TINY_API_CONFIG.clientId,
    redirect_uri: redirectUri,
    scope: 'produtos pedidos estoque contatos', // Escopos necessários
  });
  
  return `${TINY_API_CONFIG.erpUrl}/oauth/authorize?${params.toString()}`;
}

/**
 * Troca código OAuth por access token
 * Esta função deve ser chamada no backend (Netlify Function)
 * @param code - Código recebido no callback
 * @returns Token de acesso e refresh token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  if (!TINY_API_CONFIG.clientId || !TINY_API_CONFIG.clientSecret) {
    throw new Error('Credenciais Tiny não configuradas');
  }

  const response = await fetch(`${TINY_API_CONFIG.baseUrl}/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: TINY_API_CONFIG.clientId,
      client_secret: TINY_API_CONFIG.clientSecret,
      redirect_uri: `${window.location.origin}/api/tiny/callback`,
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
 * @param refreshToken - Refresh token atual
 * @returns Novo token de acesso
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  if (!TINY_API_CONFIG.clientId || !TINY_API_CONFIG.clientSecret) {
    throw new Error('Credenciais Tiny não configuradas');
  }

  const response = await fetch(`${TINY_API_CONFIG.baseUrl}/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: TINY_API_CONFIG.clientId,
      client_secret: TINY_API_CONFIG.clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(`Erro ao renovar token: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Faz chamada à API Tiny com autenticação automática
 * Renova token se necessário
 * 
 * @param endpoint - Endpoint da API (ex: '/api/produtos.pesquisa.php')
 * @param params - Parâmetros da requisição
 * @param tenantId - ID do tenant (opcional, para multi-tenancy)
 * @returns Resposta da API
 */
export async function callTinyAPI(
  endpoint: string,
  params: Record<string, any> = {},
  tenantId?: string
): Promise<any> {
  // Buscar credenciais do tenant (ou padrão)
  const { supabase } = await import('@/integrations/supabase/client');
  
  let credentialsQuery = supabase
    .schema('sistemaretiradas')
    .from('tiny_api_credentials')
    .select('*')
    .eq('active', true)
    .maybeSingle();

  // Se tenantId fornecido, filtrar por tenant
  if (tenantId) {
    credentialsQuery = credentialsQuery.eq('tenant_id', tenantId);
  }

  const { data: credentials, error: credError } = await credentialsQuery;

  if (credError || !credentials) {
    throw new Error('Credenciais Tiny não encontradas. Configure a conexão primeiro.');
  }

  if (!credentials.access_token) {
    throw new Error('Token de acesso não encontrado. Reautorize a conexão.');
  }

  // Verificar se token está expirado
  const now = new Date();
  const expiresAt = credentials.token_expires_at ? new Date(credentials.token_expires_at) : null;
  
  let accessToken = credentials.access_token;
  let refreshToken = credentials.refresh_token;

  // Se token expirado, renovar
  if (expiresAt && expiresAt <= now) {
    console.log('[TinyAPI] Token expirado, renovando...');
    
    if (!refreshToken) {
      throw new Error('Token expirado e refresh token não disponível. Reautorize a conexão.');
    }

    try {
      const newTokens = await refreshAccessToken(refreshToken);
      accessToken = newTokens.access_token;
      refreshToken = newTokens.refresh_token;

      // Atualizar no banco
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + newTokens.expires_in);

      await supabase
        .schema('sistemaretiradas')
        .from('tiny_api_credentials')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', credentials.id);

      console.log('[TinyAPI] Token renovado com sucesso');
    } catch (error: any) {
      console.error('[TinyAPI] Erro ao renovar token:', error);
      // Atualizar status para erro
      await supabase
        .schema('sistemaretiradas')
        .from('tiny_api_credentials')
        .update({
          sync_status: 'ERROR',
          error_message: error.message,
        })
        .eq('id', credentials.id);
      
      throw new Error('Erro ao renovar token. Reautorize a conexão.');
    }
  }

  // Fazer chamada à API
  const url = `${TINY_API_CONFIG.baseUrl}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token: accessToken,
      formato: 'JSON',
      ...params,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    
    // Se 401, token pode estar inválido
    if (response.status === 401) {
      // Atualizar status
      await supabase
        .schema('sistemaretiradas')
        .from('tiny_api_credentials')
        .update({
          sync_status: 'ERROR',
          error_message: 'Token inválido ou expirado',
        })
        .eq('id', credentials.id);
      
      throw new Error('Token inválido. Reautorize a conexão.');
    }

    throw new Error(`Erro na API Tiny: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  
  // Atualizar última sincronização
  await supabase
    .schema('sistemaretiradas')
    .from('tiny_api_credentials')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_status: 'CONNECTED',
      error_message: null,
    })
    .eq('id', credentials.id);

  return data;
}

/**
 * Testa conexão com API Tiny
 * Faz uma chamada simples para validar credenciais
 * 
 * @param tenantId - ID do tenant (opcional)
 * @returns true se conexão está OK
 */
export async function testTinyConnection(tenantId?: string): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    // Chamada simples: listar produtos (vazio = retorna estrutura)
    const result = await callTinyAPI('/api/produtos.pesquisa.php', {
      pesquisa: '',
      pagina: 1,
    }, tenantId);

    return {
      success: true,
      message: 'Conexão com Tiny ERP estabelecida com sucesso!',
      data: result,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erro ao testar conexão',
    };
  }
}

