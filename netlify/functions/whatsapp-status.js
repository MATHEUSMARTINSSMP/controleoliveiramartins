const N8N_STATUS_ENDPOINT = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { siteSlug, customerId } = event.queryStringParameters || {};

    if (!siteSlug || !customerId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, connected: false, status: 'error', qrCode: null, instanceId: null, phoneNumber: null }),
      };
    }

    const url = new URL(N8N_STATUS_ENDPOINT);
    url.searchParams.append('siteSlug', siteSlug);
    url.searchParams.append('customerId', customerId);

    const response = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
    const responseText = await response.text();

    if (!response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, connected: false, status: 'error', qrCode: null, instanceId: null, phoneNumber: null }),
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, connected: false, status: 'disconnected', qrCode: null, instanceId: null, phoneNumber: null }),
      };
    }

    const status = data.qrCode && !data.connected ? 'qr_required' : data.connected ? 'connected' : 'disconnected';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: data.success ?? true,
        ok: data.ok ?? true,
        connected: data.connected ?? false,
        status,
        qrCode: data.qrCode || null,
        instanceId: data.instanceId || null,
        phoneNumber: data.phoneNumber || null,
      }),
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, connected: false, status: 'error', qrCode: null, instanceId: null, phoneNumber: null }),
    };
  }
};
