/**
 * Integração com API Tiny ERP
 * 
 * Documentação: https://ajuda.olist.com/kb/articles/erp/integracoes
 * 
 * IMPORTANTE: Credenciais são armazenadas no Supabase por tenant
 * Cada tenant pode ter seu próprio Tiny ERP com credenciais diferentes
 */

// URLs base da API Tiny (fixas, não mudam por tenant)
export const TINY_API_CONFIG = {
  baseUrl: import.meta.env.VITE_TINY_API_BASE_URL || 'https://api.tiny.com.br',
  erpUrl: import.meta.env.VITE_TINY_ERP_URL || 'https://erp.tiny.com.br',
  // Client ID e Secret podem ser diferentes por tenant, então não usamos env vars aqui
  // Eles serão buscados do banco de dados (tiny_api_credentials)
};

/**
 * Gera URL de autorização OAuth para o Tiny ERP
 * Busca Client ID do banco de dados (por tenant)
 * 
 * @param tenantId - ID do tenant (opcional, busca do tenant atual se não fornecido)
 * @returns URL completa para redirecionar o usuário
 */
export async function getTinyAuthorizationUrl(tenantId?: string): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');
  
  // Buscar credenciais do tenant
  let credentialsQuery = supabase
    .schema('sistemaretiradas')
    .from('tiny_api_credentials')
    .select('client_id')
    .eq('active', true);

  // Se tenantId fornecido, filtrar por tenant
  if (tenantId) {
    credentialsQuery = credentialsQuery.eq('tenant_id', tenantId);
  } else {
    // Se não fornecido, buscar registro sem tenant_id (padrão)
    credentialsQuery = credentialsQuery.is('tenant_id', null);
  }

  const { data: credentials, error } = await credentialsQuery.maybeSingle();

  // Se não encontrou no banco, tentar env var como fallback (compatibilidade)
  let clientId = credentials?.client_id;
  
  if (!clientId) {
    clientId = import.meta.env.VITE_TINY_API_CLIENT_ID;
    if (!clientId) {
      throw new Error('Client ID não encontrado. Configure as credenciais Tiny primeiro.');
    }
  }

  const redirectUri = `${window.location.origin}/api/tiny/callback`;
  
  // Incluir tenant_id no state para o callback saber qual tenant é
  const state = tenantId ? encodeURIComponent(JSON.stringify({ tenant_id: tenantId })) : undefined;
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'produtos pedidos estoque contatos', // Escopos necessários
  });
  
  // Adicionar state se houver tenant_id
  if (state) {
    params.append('state', state);
  }
  
  return `${TINY_API_CONFIG.erpUrl}/oauth/authorize?${params.toString()}`;
}

/**
 * Troca código OAuth por access token
 * Esta função deve ser chamada no backend (Netlify Function)
 * 
 * NOTA: Esta função busca client_id e client_secret do banco de dados
 * A Netlify Function fará isso usando service role key
 * 
 * @param code - Código recebido no callback
 * @param clientId - Client ID do tenant
 * @param clientSecret - Client Secret do tenant
 * @returns Token de acesso e refresh token
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Tiny não fornecidas');
  }

  const response = await fetch(`${TINY_API_CONFIG.baseUrl}/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
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
 * @param clientId - Client ID do tenant
 * @param clientSecret - Client Secret do tenant
 * @returns Novo token de acesso
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Tiny não fornecidas');
  }

  const response = await fetch(`${TINY_API_CONFIG.baseUrl}/oauth/access_token`, {
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

        if (!credentials.client_id || !credentials.client_secret) {
          throw new Error('Client ID ou Secret não encontrados. Reconfigure a conexão.');
        }

        try {
          const newTokens = await refreshAccessToken(
            refreshToken,
            credentials.client_id,
            credentials.client_secret
          );
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

