/**
 * Proxy para Hub Fidelidade Linx Microvix
 * Evita problemas de CORS chamando a API do servidor
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LINX_URLS = {
  homologacao: 'https://hubagnostico-homologacao.linx.com.br/v1',
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  try {
    const { storeId, endpoint, method = 'GET', body } = JSON.parse(event.body || '{}');

    if (!storeId || !endpoint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'storeId e endpoint são obrigatórios' }),
      };
    }

    // Buscar configuração da loja
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'sistemaretiradas' },
    });

    const { data: config, error: configError } = await supabase
      .from('linx_microvix_config')
      .select('*')
      .eq('store_id', storeId)
      .eq('active', true)
      .eq('hub_active', true)
      .maybeSingle();

    if (configError || !config) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Configuração Hub Fidelidade não encontrada ou inativa',
        }),
      };
    }

    // Montar URL
    const baseUrl = config.hub_ambiente === 'producao' && config.hub_url_producao
      ? config.hub_url_producao
      : LINX_URLS.homologacao;

    const url = `${baseUrl}${endpoint}`;

    // Validar credenciais obrigatórias antes de chamar API
    if (!config.hub_token_produto || !config.hub_token_parceiro) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Credenciais Hub incompletas. Configure Token Produto e Token Parceiro.',
        }),
      };
    }

    if (!config.cnpj || !config.nome_loja) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'CNPJ e Nome da Loja são obrigatórios.',
        }),
      };
    }

    // Headers de autenticação Linx
    const linxHeaders = {
      'Content-Type': 'application/json',
      'Linx-Cnpj': config.cnpj.replace(/\D/g, ''),
      'Linx-TokenProduto': config.hub_token_produto,
      'Linx-TokenParceiro': config.hub_token_parceiro,
      'Linx-IdParceiro': String(config.hub_id_parceiro || ''),
      'Linx-NomeLoja': config.nome_loja,
    };

    console.log(`[LinxHub] Chamando ${method} ${url}`);

    // Fazer requisição para Linx
    const response = await fetch(url, {
      method,
      headers: linxHeaders,
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Atualizar status no banco
    await supabase
      .from('linx_microvix_config')
      .update({
        hub_sync_status: response.ok ? 'CONNECTED' : 'ERROR',
        hub_last_sync_at: new Date().toISOString(),
        hub_error_message: response.ok ? null : responseText.substring(0, 500),
      })
      .eq('store_id', storeId);

    // Registrar transação apenas quando há IdentificadorTransacao válido (transação real de venda)
    if (body?.Documento && body?.IdentificadorTransacao) {
      await supabase.from('linx_microvix_transacoes').insert({
        store_id: storeId,
        identificador_transacao: body.IdentificadorTransacao,
        tipo_operacao: endpoint.replace('/', ''),
        cpf_cliente: body.Documento,
        request_payload: body,
        response_payload: responseData,
        status: response.ok ? 'SUCCESS' : 'ERROR',
        error_message: response.ok ? null : responseText.substring(0, 500),
      });
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: responseData.Mensagem || responseData.message || 'Erro na API Linx',
          details: responseData,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    console.error('[LinxHub] Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
