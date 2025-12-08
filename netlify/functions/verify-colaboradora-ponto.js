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

    const body = JSON.parse(event.body || '{}');
    const { email, password, storeId } = body;

    console.log('[verify-colaboradora-ponto] Request body:', { email, storeId: storeId ? `${storeId.substring(0, 8)}...` : 'null/undefined' });

    if (!email || !password || !storeId) {
      console.error('[verify-colaboradora-ponto] ❌ Campos obrigatórios faltando:', { email: !!email, password: !!password, storeId: !!storeId });
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
    console.log('[verify-colaboradora-ponto] Buscando loja com ID completo:', storeId);
    console.log('[verify-colaboradora-ponto] Tipo do storeId:', typeof storeId);
    console.log('[verify-colaboradora-ponto] Tamanho do storeId:', storeId?.length);
    
    // Primeiro, tentar buscar sem .single() para ver se encontra algo
    const { data: storesList, error: listError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('stores')
      .select('id, name, ponto_ativo, active')
      .eq('id', storeId);

    console.log('[verify-colaboradora-ponto] Resultado da busca (sem .single()):', {
      encontrou: storesList?.length || 0,
      dados: storesList,
      erro: listError
    });

    // Se não encontrou, tentar buscar todas as lojas para debug
    if (!storesList || storesList.length === 0) {
      console.log('[verify-colaboradora-ponto] ⚠️ Loja não encontrada, buscando todas as lojas para debug...');
      const { data: allStores, error: allStoresError } = await supabaseAdmin
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, active')
        .limit(10);
      
      console.log('[verify-colaboradora-ponto] Lojas disponíveis no banco:', {
        total: allStores?.length || 0,
        lojas: allStores?.map(s => ({ id: s.id, name: s.name, active: s.active })),
        erro: allStoresError
      });
    }

    // Agora tentar com .single()
    const { data: store, error: storeError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('stores')
      .select('id, name, ponto_ativo, active')
      .eq('id', storeId)
      .single();

    // Determinar qual loja usar (da query .single() ou da lista)
    let finalStore = null;
    
    if (storeError) {
      console.error('[verify-colaboradora-ponto] ❌ Erro ao buscar loja:', {
        message: storeError.message,
        code: storeError.code,
        details: storeError.details,
        hint: storeError.hint,
        storeId: storeId
      });
      
      // Se a loja foi encontrada na lista mas deu erro no .single(), usar a primeira
      if (storesList && storesList.length > 0) {
        console.log('[verify-colaboradora-ponto] ⚠️ Erro no .single() mas loja encontrada na lista, usando primeira:', storesList[0]);
        finalStore = storesList[0];
      } else {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Loja não encontrada',
            details: storeError.message || `Nenhuma loja encontrada com ID: ${storeId}`,
            code: storeError.code,
          }),
        };
      }
    } else if (store) {
      finalStore = store;
    } else if (storesList && storesList.length > 0) {
      finalStore = storesList[0];
    }

    if (!finalStore) {
      console.error('[verify-colaboradora-ponto] ❌ Loja não encontrada no banco para ID:', storeId);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Loja não encontrada',
          details: `Nenhuma loja encontrada com ID: ${storeId}`,
        }),
      };
    }

    console.log('[verify-colaboradora-ponto] ✅ Loja encontrada:', { 
      id: finalStore.id, 
      name: finalStore.name, 
      ponto_ativo: finalStore.ponto_ativo,
      active: finalStore.active
    });

    // Validação flexível: verificar se pertence à loja
    // 1. Verificar se store_id corresponde
    // 2. Se não, verificar se store_default corresponde ao nome da loja
    const belongsToStore = 
      profile.store_id === storeId || 
      (profile.store_default && 
       profile.store_default.toLowerCase().trim() === finalStore.name.toLowerCase().trim());

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
            loja_name: finalStore.name,
          },
        }),
      };
    }

    if (!finalStore.ponto_ativo) {
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

