/**
 * Netlify Function: Atualizar Locations do Google My Business
 * 
 * POST /.netlify/functions/google-locations-refresh
 * 
 * Busca locations atualizadas da API do Google My Business e atualiza o banco de dados
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Buscar accounts do Google My Business
 */
async function fetchAccounts(accessToken) {
  try {
    const response = await fetch('https://mybusiness.googleapis.com/v4/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.accounts || [];
  } catch (error) {
    console.error('[Google Locations Refresh] Erro ao buscar accounts:', error);
    throw error;
  }
}

/**
 * Buscar locations de uma account
 */
async function fetchLocations(accessToken, accountName) {
  try {
    const url = `https://mybusiness.googleapis.com/v4/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,primaryCategory,openInfo`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.locations || [];
  } catch (error) {
    console.error(`[Google Locations Refresh] Erro ao buscar locations da account ${accountName}:`, error);
    throw error;
  }
}

/**
 * Salvar ou atualizar location no banco
 */
async function saveAccountLocation(supabase, customerId, siteSlug, account, location, isPrimary) {
  try {
    const locationId = location.name?.split('/locations/').pop() || '';
    const accountId = account.name || '';

    if (!locationId || !accountId) {
      console.warn('[Google Locations Refresh] Location ou Account sem ID válido');
      return false;
    }

    // Verificar se já existe
    const { data: existing } = await supabase
      .schema('sistemaretiradas')
      .from('google_business_accounts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('site_slug', siteSlug)
      .eq('location_id', locationId)
      .maybeSingle();

    const locationData = {
      customer_id: customerId,
      site_slug: siteSlug,
      account_id: accountId,
      account_name: account.accountName || account.name || '',
      location_id: locationId,
      location_name: location.title || location.name || '',
      location_address: location.storefrontAddress?.addressLines?.join(', ') || 
                        location.storefrontAddress?.postalCode || '',
      location_phone: location.phoneNumbers?.primaryPhone || 
                     location.phoneNumbers?.phoneNumber || '',
      location_website: location.websiteUri || '',
      location_category: location.primaryCategory?.displayName || 
                        location.primaryCategory?.categoryId || '',
      is_primary: isPrimary,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Atualizar
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('google_business_accounts')
        .update(locationData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Inserir
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('google_business_accounts')
        .insert(locationData);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('[Google Locations Refresh] Erro ao salvar location:', error);
    return false;
  }
}

/**
 * Renovar access token se necessário
 */
async function refreshAccessTokenIfNeeded(supabase, userEmail, siteSlug) {
  try {
    const { data: credentials, error: credError } = await supabase
      .schema('sistemaretiradas')
      .from('google_credentials')
      .select('*')
      .eq('customer_id', userEmail)
      .eq('site_slug', siteSlug)
      .maybeSingle();

    if (credError || !credentials) {
      throw new Error('Credenciais Google não encontradas');
    }

    if (!credentials.access_token) {
      throw new Error('Access token não encontrado');
    }

    const now = new Date();
    const expiresAt = credentials.expires_at ? new Date(credentials.expires_at) : null;

    if (expiresAt && expiresAt <= now && credentials.refresh_token) {
      console.log('[Google Locations Refresh] Token expirado, renovando...');
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: credentials.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Erro ao renovar token');
      }

      const tokenData = await tokenResponse.json();
      const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

      await supabase
        .schema('sistemaretiradas')
        .from('google_credentials')
        .update({
          access_token: tokenData.access_token,
          expires_at: newExpiresAt,
        })
        .eq('customer_id', userEmail)
        .eq('site_slug', siteSlug);

      return tokenData.access_token;
    }

    return credentials.access_token;
  } catch (error) {
    console.error('[Google Locations Refresh] Erro ao obter/renovar token:', error);
    throw error;
  }
}

/**
 * Buscar e atualizar locations
 */
async function refreshLocations(supabase, accessToken, customerId, siteSlug) {
  try {
    // Buscar accounts
    const accounts = await fetchAccounts(accessToken);
    
    if (accounts.length === 0) {
      console.log('[Google Locations Refresh] Nenhuma account encontrada');
      return { success: true, accountsCount: 0, locationsCount: 0 };
    }

    // Remover is_primary de todas as locations deste site
    await supabase
      .schema('sistemaretiradas')
      .from('google_business_accounts')
      .update({ is_primary: false })
      .eq('customer_id', customerId)
      .eq('site_slug', siteSlug);

    let totalLocations = 0;
    let firstLocation = true;

    // Para cada account, buscar locations
    for (const account of accounts) {
      const accountId = account.name || '';
      if (!accountId) continue;

      const locations = await fetchLocations(accessToken, accountId);
      
      // Salvar cada location
      for (const location of locations) {
        const saved = await saveAccountLocation(
          supabase,
          customerId,
          siteSlug,
          account,
          location,
          firstLocation // Primeira location é primária
        );
        
        if (saved) {
          totalLocations++;
          firstLocation = false;
        }

        // Delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return {
      success: true,
      accountsCount: accounts.length,
      locationsCount: totalLocations,
    };
  } catch (error) {
    console.error('[Google Locations Refresh] Erro ao atualizar locations:', error);
    return {
      success: false,
      error: error.message,
      accountsCount: 0,
      locationsCount: 0,
    };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    const body = JSON.parse(event.body || '{}');
    const siteSlug = (body.siteSlug || body.site_slug || '').trim().toLowerCase();
    const userEmail = (body.userEmail || body.user_email || body.customerId || '').trim().toLowerCase();

    if (!siteSlug || !userEmail) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'siteSlug e userEmail são obrigatórios',
        }),
      };
    }

    const accessToken = await refreshAccessTokenIfNeeded(supabase, userEmail, siteSlug);
    const result = await refreshLocations(supabase, accessToken, userEmail, siteSlug);

    if (!result.success) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: result.error || 'Erro ao atualizar locations',
        }),
      };
    }

    // Buscar locations atualizadas do banco
    const { data: locations, error: locError } = await supabase
      .schema('sistemaretiradas')
      .from('google_business_accounts')
      .select('*')
      .eq('customer_id', userEmail)
      .eq('site_slug', siteSlug)
      .order('is_primary', { ascending: false });

    if (locError) {
      console.warn('[Google Locations Refresh] Erro ao buscar locations atualizadas:', locError);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        accountsCount: result.accountsCount,
        locationsCount: result.locationsCount,
        locations: locations || [],
      }),
    };
  } catch (error) {
    console.error('[Google Locations Refresh] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao atualizar locations',
      }),
    };
  }
};

