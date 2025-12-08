/**
 * Netlify Function para verificar credenciais de colaboradora no controle de ponto
 * Não altera a sessão principal do usuário
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    );

    const { email, password, storeId } = JSON.parse(event.body || '{}');

    if (!email || !password || !storeId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Email, senha e storeId são obrigatórios',
        }),
      };
    }

    // Verificar credenciais usando admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password,
    });

    if (authError || !authData?.user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Email ou senha incorretos',
        }),
      };
    }

    // Buscar perfil da colaboradora (incluindo store_default para validação flexível)
    const { data: profile, error: profileError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, name, email, role, store_id, store_default, active')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Perfil não encontrado',
        }),
      };
    }

    // Verificar se é colaboradora
    if (profile.role !== 'COLABORADORA') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Acesso negado. Apenas colaboradoras podem acessar o controle de ponto',
        }),
      };
    }

    // Verificar se está ativa
    if (!profile.active) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Colaboradora inativa',
        }),
      };
    }

    // Buscar dados da loja para validação flexível
    const { data: store, error: storeError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('stores')
      .select('id, name, ponto_ativo')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Loja não encontrada',
        }),
      };
    }

    // Validação flexível: verificar se pertence à loja
    // 1. Verificar se store_id corresponde
    // 2. Se não, verificar se store_default corresponde ao nome da loja
    const belongsToStore = 
      profile.store_id === storeId || 
      (profile.store_default && 
       profile.store_default.toLowerCase().trim() === store.name.toLowerCase().trim());

    if (!belongsToStore) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Colaboradora não pertence a esta loja',
          details: {
            colaboradora_store_id: profile.store_id,
            colaboradora_store_default: profile.store_default,
            loja_id: storeId,
            loja_name: store.name,
          },
        }),
      };
    }

    if (!store.ponto_ativo) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Módulo de controle de ponto não está ativo para esta loja',
        }),
      };
    }

    // Retornar dados da colaboradora (sem token de sessão)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        colaboradora: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          store_id: profile.store_id,
        },
      }),
    };
  } catch (error) {
    console.error('[verify-colaboradora-ponto] Erro:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message,
      }),
    };
  }
};

