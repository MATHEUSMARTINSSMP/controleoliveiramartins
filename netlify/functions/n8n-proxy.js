/**
 * Netlify Function: Proxy para N8N
 * 
 * Faz proxy das requisições para o N8N para evitar problemas de CORS
 * 
 * Endpoint: /.netlify/functions/n8n-proxy
 * Método: POST
 * Body: { "endpoint": "/api/dre/categorias", "method": "GET", "params": {}, "body": {} }
 */

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-APP-KEY',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { endpoint, method = 'GET', params = {}, body: requestBody } = body;

    if (!endpoint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'endpoint é obrigatório' }),
      };
    }

    // Configuração N8N
    const N8N_BASE_URL = process.env.VITE_N8N_BASE_URL || process.env.N8N_BASE_URL || '';
    const N8N_MODE = (process.env.VITE_N8N_MODE || process.env.N8N_MODE || 'prod').toLowerCase();
    const N8N_AUTH_HEADER = process.env.VITE_N8N_AUTH_HEADER || process.env.N8N_AUTH_HEADER || '';

    if (!N8N_BASE_URL) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'N8N_BASE_URL não configurado' }),
      };
    }

    // Construir URL
    const prefix = N8N_MODE === 'test' ? '/webhook-test' : '/webhook';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Adicionar query params se for GET
    let fullUrl = `${N8N_BASE_URL.replace(/\/$/, '')}${prefix}${cleanEndpoint}`;
    
    if (method === 'GET' && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      fullUrl += `?${queryString}`;
    }

    console.log(`[N8N-Proxy] ${method} ${fullUrl}`);

    // Preparar headers
    const fetchHeaders = {
      'Content-Type': 'application/json',
    };

    if (N8N_AUTH_HEADER) {
      fetchHeaders['X-APP-KEY'] = N8N_AUTH_HEADER;
    }

    // Fazer requisição
    const fetchOptions = {
      method,
      headers: fetchHeaders,
    };

    if (method !== 'GET' && requestBody) {
      fetchOptions.body = JSON.stringify(requestBody);
    }

    const response = await fetch(fullUrl, fetchOptions);
    
    let data;
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    console.log(`[N8N-Proxy] Response status: ${response.status}, length: ${text.length}`);
    
    if (!text || text.trim() === '') {
      // Resposta vazia - retornar estrutura padrão
      data = { success: true, data: [] };
    } else if (contentType && contentType.includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('[N8N-Proxy] Erro ao parsear JSON:', parseErr.message, 'Text:', text.substring(0, 200));
        data = { success: false, error: 'Resposta inválida do N8N', raw: text.substring(0, 500) };
      }
    } else {
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: 'Resposta não é JSON válido', raw: text.substring(0, 500) };
      }
    }

    // Garantir que data nunca seja undefined
    if (data === undefined || data === null) {
      data = { success: true, data: [] };
    }

    return {
      statusCode: response.ok ? 200 : response.status,
      headers,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('[N8N-Proxy] Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao conectar com N8N' 
      }),
    };
  }
};
