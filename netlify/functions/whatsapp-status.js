const { createClient } = require('@supabase/supabase-js');

const N8N_STATUS_ENDPOINT = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status';

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
    .replace(/_+/g, '_');
};

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
    const { siteSlug, customerId, whatsapp_account_id } = event.queryStringParameters || {};

    let finalSiteSlug = siteSlug;
    let finalCustomerId = customerId;
    let isBackupAccount = false;
    let backupAccountId = null;

    // Se whatsapp_account_id fornecido, buscar dados do número reserva
    if (whatsapp_account_id && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { db: { schema: 'sistemaretiradas' } }
        );

        // Buscar número reserva
        const { data: backupAccount, error: backupError } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_accounts')
          .select('id, phone, store_id, uazapi_status, is_connected')
          .eq('id', whatsapp_account_id)
          .single();

        if (!backupError && backupAccount) {
          // Buscar loja para obter site_slug
          const { data: store } = await supabase
            .schema('sistemaretiradas')
            .from('stores')
            .select('site_slug, name')
            .eq('id', backupAccount.store_id)
            .single();

          if (store) {
            const storeSlug = store.site_slug || generateSlug(store.name);

            // Buscar credencial principal da loja para obter customer_id
            const { data: primaryCredential } = await supabase
              .schema('sistemaretiradas')
              .from('whatsapp_credentials')
              .select('customer_id, admin_id')
              .eq('site_slug', storeSlug)
              .eq('status', 'active')
              .eq('is_global', false)
              .maybeSingle();

            let customerIdValue = primaryCredential?.customer_id || storeSlug;

            // Se temos admin_id, buscar email do profile
            if (primaryCredential?.admin_id && !primaryCredential?.customer_id) {
              const { data: adminProfile } = await supabase
                .schema('sistemaretiradas')
                .from('profiles')
                .select('email')
                .eq('id', primaryCredential.admin_id)
                .single();

              if (adminProfile?.email) {
                customerIdValue = adminProfile.email;
              }
            }

            finalSiteSlug = storeSlug;
            finalCustomerId = customerIdValue;
            isBackupAccount = true;
            backupAccountId = backupAccount.id;

            console.log('[whatsapp-status] Usando número reserva:', backupAccount.phone, '| siteSlug:', finalSiteSlug);
          }
        }
      } catch (err) {
        console.warn('[whatsapp-status] Erro ao buscar número reserva:', err.message);
        // Continuar com siteSlug/customerId originais se fornecidos
      }
    }

    console.log('[whatsapp-status] Request params:', { siteSlug: finalSiteSlug, customerId: finalCustomerId, isBackupAccount });

    if (!finalSiteSlug || !finalCustomerId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, connected: false, status: 'error', qrCode: null, instanceId: null, phoneNumber: null }),
      };
    }

    const url = new URL(N8N_STATUS_ENDPOINT);
    url.searchParams.append('siteSlug', finalSiteSlug);
    url.searchParams.append('customerId', finalCustomerId);

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

    const instanceId = data.instanceId || data.uazapi_instance_id || null;
    const phoneNumber = data.phoneNumber || data.uazapi_phone_number || null;
    const token = data.token || data.uazapi_token || null;

    // Se for número reserva, atualizar whatsapp_accounts com o status
    if (isBackupAccount && backupAccountId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { db: { schema: 'sistemaretiradas' } }
        );

        await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_accounts')
          .update({
            uazapi_status: normalizedStatus,
            uazapi_qr_code: qrCode,
            uazapi_instance_id: instanceId,
            uazapi_token: token,
            is_connected: isConnected,
            updated_at: new Date().toISOString()
          })
          .eq('id', backupAccountId);

        console.log('[whatsapp-status] ✅ Atualizado whatsapp_accounts:', backupAccountId, '| status:', normalizedStatus);
      } catch (updateError) {
        console.warn('[whatsapp-status] Erro ao atualizar whatsapp_accounts:', updateError.message);
        // Não falhar se atualização der erro, retornar status mesmo assim
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: data.success ?? true,
        ok: data.ok ?? true,
        connected: isConnected,
        status: normalizedStatus,
        qrCode: qrCode,
        instanceId: instanceId,
        phoneNumber: phoneNumber,
        token: token,
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
