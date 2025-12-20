const { createClient } = require('@supabase/supabase-js');

const N8N_CONNECT_ENDPOINT = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect';

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
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

        // Buscar número reserva (incluindo flags de backup para gerar nome único)
        const { data: backupAccount, error: backupError } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_accounts')
          .select('id, phone, store_id, uazapi_status, is_connected, is_backup1, is_backup2, is_backup3')
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

            // Para números reserva, modificar siteSlug para diferenciar do principal
            // Isso garante que o N8N gere um nome de instância único
            let backupSuffix = '';
            if (backupAccount.is_backup1) backupSuffix = '_backup1';
            else if (backupAccount.is_backup2) backupSuffix = '_backup2';
            else if (backupAccount.is_backup3) backupSuffix = '_backup3';
            
            finalSiteSlug = storeSlug + backupSuffix;
            finalCustomerId = customerIdValue;
            isBackupAccount = true;
            backupAccountId = backupAccount.id;

            console.log('[whatsapp-connect] Usando número reserva:', backupAccount.phone, '| siteSlug:', finalSiteSlug, '| backupSuffix:', backupSuffix);
          }
        }
      } catch (err) {
        console.warn('[whatsapp-connect] Erro ao buscar número reserva:', err.message);
        // Continuar com siteSlug/customerId originais se fornecidos
      }
    }

    if (!finalSiteSlug || !finalCustomerId) {
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

    console.log('Calling N8N connect endpoint:', N8N_CONNECT_ENDPOINT);
    console.log('[whatsapp-connect] Parâmetros:', { siteSlug: finalSiteSlug, customerId: finalCustomerId, isBackupAccount });

    const response = await fetch(N8N_CONNECT_ENDPOINT, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json' 
      },
      body: JSON.stringify({ siteSlug: finalSiteSlug, customerId: finalCustomerId }),
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

    const qrCode = data.qrCode || data.qr_code || data.qr || null;
    const instanceId = data.instanceId || data.instance_id || null;
    const status = qrCode ? 'qr_required' : 'connecting';

    // Se for número reserva, atualizar whatsapp_accounts ao invés de whatsapp_credentials
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
            uazapi_qr_code: qrCode,
            uazapi_status: status,
            uazapi_instance_id: instanceId,
            updated_at: new Date().toISOString()
          })
          .eq('id', backupAccountId);

        console.log('[whatsapp-connect] ✅ Atualizado whatsapp_accounts:', backupAccountId);
      } catch (updateError) {
        console.warn('[whatsapp-connect] Erro ao atualizar whatsapp_accounts:', updateError.message);
        // Não falhar se atualização der erro, retornar QR code mesmo assim
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: data.success ?? true,
        qrCode: qrCode,
        instanceId: instanceId,
        status: status,
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
