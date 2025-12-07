const N8N_CONNECT_ENDPOINT = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { siteSlug, customerId } = event.queryStringParameters || {};

    if (!siteSlug || !customerId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing siteSlug or customerId',
          qrCode: null 
        }),
      };
    }

    const url = new URL(N8N_CONNECT_ENDPOINT);
    url.searchParams.append('siteSlug', siteSlug);
    url.searchParams.append('customerId', customerId);

    console.log('Calling N8N connect endpoint:', url.toString());

    const response = await fetch(url.toString(), { 
      method: 'GET', 
      headers: { 'Accept': 'application/json' } 
    });
    
    const responseText = await response.text();
    console.log('N8N response status:', response.status);
    console.log('N8N response:', responseText);

    if (!response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `N8N returned ${response.status}`,
          qrCode: null 
        }),
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON from N8N',
          raw: responseText,
          qrCode: null 
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: data.success ?? true,
        qrCode: data.qrCode || data.qr_code || data.qr || null,
        instanceId: data.instanceId || data.instance_id || null,
        status: data.qrCode ? 'qr_required' : 'connecting',
        message: data.message || null,
      }),
    };
  } catch (error) {
    console.error('Error calling N8N:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        qrCode: null 
      }),
    };
  }
};
