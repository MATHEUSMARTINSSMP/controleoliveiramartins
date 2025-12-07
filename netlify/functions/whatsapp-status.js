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
    console.log('[whatsapp-status] Request params:', { siteSlug, customerId });

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

    console.log('[whatsapp-status] Calling N8N:', url.toString());
    const response = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
    const responseText = await response.text();
    console.log('[whatsapp-status] N8N response status:', response.status);
    console.log('[whatsapp-status] N8N response body:', responseText);

    if (!response.ok) {
      console.error('[whatsapp-status] N8N returned error:', response.status);
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
      console.error('[whatsapp-status] Failed to parse JSON:', e);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, connected: false, status: 'disconnected', qrCode: null, instanceId: null, phoneNumber: null }),
      };
    }

    console.log('[whatsapp-status] Parsed data:', JSON.stringify(data));

    // Normalizar status de multiplas fontes possiveis
    // N8N pode retornar: { uazapi_status: "connected" } ou { status: "connected" } ou { connected: true }
    const rawStatus = data.uazapi_status || data.status || '';
    const isConnected = data.connected === true || rawStatus.toLowerCase() === 'connected';
    const hasQrCode = !!(data.qrCode || data.uazapi_qr_code || data.qr_code);
    const qrCode = data.qrCode || data.uazapi_qr_code || data.qr_code || null;
    
    let normalizedStatus = 'disconnected';
    if (hasQrCode && !isConnected) {
      normalizedStatus = 'qr_required';
    } else if (isConnected) {
      normalizedStatus = 'connected';
    } else if (rawStatus.toLowerCase() === 'connecting' || rawStatus.toLowerCase() === 'loading') {
      normalizedStatus = 'connecting';
    } else if (rawStatus.toLowerCase() === 'error' || rawStatus.toLowerCase() === 'failed') {
      normalizedStatus = 'error';
    }

    console.log('[whatsapp-status] Normalized:', { rawStatus, isConnected, hasQrCode, normalizedStatus });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: data.success ?? true,
        ok: data.ok ?? true,
        connected: isConnected,
        status: normalizedStatus,
        qrCode: qrCode,
        instanceId: data.instanceId || data.uazapi_instance_id || null,
        phoneNumber: data.phoneNumber || data.uazapi_phone_number || null,
      }),
    };
  } catch (error) {
    console.error('[whatsapp-status] Exception:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, connected: false, status: 'error', qrCode: null, instanceId: null, phoneNumber: null }),
    };
  }
};
