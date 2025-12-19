/**
 * Cakto API Client Helper
 * 
 * Helper para autenticar e fazer requisições à API do Cakto
 * Usa OAuth2 com Client Credentials flow
 */

const CAKTO_API_BASE_URL = 'https://api.cakto.com.br'; // Ajustar conforme documentação real
const CAKTO_AUTH_URL = 'https://api.cakto.com.br/oauth/token'; // Ajustar conforme documentação real

/**
 * Obtém access token usando Client Credentials
 */
async function getCaktoAccessToken(clientId, clientSecret) {
  try {
    const response = await fetch(CAKTO_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'read write', // Ajustar conforme necessário
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cakto API] Auth error:', errorText);
      throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('[Cakto API] Error getting access token:', error);
    throw error;
  }
}

/**
 * Busca informações de uma compra/pedido pelo ID
 */
async function getCaktoPurchase(purchaseId, accessToken) {
  try {
    const response = await fetch(`${CAKTO_API_BASE_URL}/purchases/${purchaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cakto API] Get purchase error:', errorText);
      throw new Error(`Failed to get purchase: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Cakto API] Error getting purchase:', error);
    throw error;
  }
}

/**
 * Busca informações do cliente pelo ID
 */
async function getCaktoCustomer(customerId, accessToken) {
  try {
    const response = await fetch(`${CAKTO_API_BASE_URL}/customers/${customerId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cakto API] Get customer error:', errorText);
      throw new Error(`Failed to get customer: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Cakto API] Error getting customer:', error);
    throw error;
  }
}

/**
 * Wrapper principal para fazer requisições autenticadas
 */
async function makeCaktoRequest(endpoint, method = 'GET', body = null) {
  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('CAKTO_CLIENT_ID and CAKTO_CLIENT_SECRET must be set');
  }

  const accessToken = await getCaktoAccessToken(clientId, clientSecret);

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${CAKTO_API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Cakto API] ${method} ${endpoint} error:`, errorText);
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

module.exports = {
  getCaktoAccessToken,
  getCaktoPurchase,
  getCaktoCustomer,
  makeCaktoRequest,
};

