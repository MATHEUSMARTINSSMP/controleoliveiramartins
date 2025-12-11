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
      .select('id, name, email, role, store_id, store_default, is_active')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error('[verify-colaboradora-ponto] ❌ Erro ao buscar perfil:', profileError);
      console.error('[verify-colaboradora-ponto] ❌ User ID:', authData.user.id);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Perfil não encontrado',
        }),
      };
    }

    console.log('[verify-colaboradora-ponto] ✅ Perfil encontrado:', {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      store_id: profile.store_id,
      store_default: profile.store_default,
      is_active: profile.is_active
    });

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
    if (!profile.is_active) {
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
    
    // Primeiro, tentar buscar na tabela stores
    // Usar RPC ou query direta sem RLS para garantir acesso
    const { data: storesList, error: listError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('stores')
      .select('id, name, ponto_ativo, active')
      .eq('id', storeId)
      .maybeSingle(); // Usar maybeSingle para evitar erro se não encontrar

    console.log('[verify-colaboradora-ponto] Resultado da busca em stores:', {
      encontrou: storesList ? 1 : 0,
      dados: storesList,
      erro: listError
    });

    // Se não encontrou na tabela stores, tentar buscar no perfil LOJA
    let finalStore = storesList || null;
    if (!finalStore) {
      console.log('[verify-colaboradora-ponto] ⚠️ Loja não encontrada em stores, tentando buscar no perfil LOJA...');
      
      // Buscar perfil LOJA que tenha store_default igual ao storeId
      const { data: lojaProfile, error: lojaProfileError } = await supabaseAdmin
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, store_default, store_id')
        .eq('role', 'LOJA')
        .or(`store_default.eq.${storeId},store_id.eq.${storeId}`)
        .eq('is_active', true)
        .limit(1);

      console.log('[verify-colaboradora-ponto] Resultado da busca em profiles (LOJA):', {
        encontrou: lojaProfile?.length || 0,
        dados: lojaProfile,
        erro: lojaProfileError
      });

        // Se encontrou o perfil LOJA, criar objeto de loja a partir do perfil
        // já que a loja pode não estar na tabela stores mas existe no perfil
        if (lojaProfile && lojaProfile.length > 0) {
          const loja = lojaProfile[0];
          const storeIdToSearch = loja.store_default || loja.store_id || storeId;
          
          console.log('[verify-colaboradora-ponto] Tentando buscar loja na tabela stores com ID do perfil:', storeIdToSearch);
          
          // Tentar buscar na tabela stores novamente
          const { data: storeFromProfile, error: storeFromProfileError } = await supabaseAdmin
            .schema('sistemaretiradas')
            .from('stores')
            .select('id, name, ponto_ativo, active')
            .eq('id', storeIdToSearch)
            .maybeSingle();

          if (storeFromProfile) {
            finalStore = storeFromProfile;
            console.log('[verify-colaboradora-ponto] ✅ Loja encontrada via perfil LOJA na tabela stores:', finalStore);
          } else {
            // Se não encontrou na tabela stores, criar objeto a partir do perfil
            // Isso permite que o sistema funcione mesmo se a loja não estiver na tabela stores
            console.log('[verify-colaboradora-ponto] ⚠️ Loja não encontrada em stores, usando dados do perfil LOJA');
            finalStore = {
              id: storeIdToSearch,
              name: loja.name || 'Loja',
              ponto_ativo: true, // Assumir ativo se não estiver na tabela
              active: true,
            };
            console.log('[verify-colaboradora-ponto] ✅ Loja criada a partir do perfil:', finalStore);
          }
        }

      // Se ainda não encontrou, listar todas as lojas para debug e tentar encontrar
      if (!finalStore) {
        console.log('[verify-colaboradora-ponto] ⚠️ Loja não encontrada, buscando todas as lojas para debug...');
        const { data: allStores, error: allStoresError } = await supabaseAdmin
          .schema('sistemaretiradas')
          .from('stores')
          .select('id, name, active, ponto_ativo')
          .limit(10);
        
        console.log('[verify-colaboradora-ponto] Lojas disponíveis no banco:', {
          total: allStores?.length || 0,
          lojas: allStores?.map(s => ({ id: s.id, name: s.name, active: s.active, ponto_ativo: s.ponto_ativo })),
          erro: allStoresError
        });

        // Tentar encontrar a loja na lista retornada
        const foundInList = allStores?.find(s => s.id === storeId);
        if (foundInList) {
          finalStore = foundInList;
          console.log('[verify-colaboradora-ponto] ✅ Loja encontrada na lista completa:', finalStore);
        } else if (lojaProfile && lojaProfile.length > 0) {
          // Se ainda não encontrou mas tem perfil LOJA, usar o perfil como fallback
          const loja = lojaProfile[0];
          console.log('[verify-colaboradora-ponto] ⚠️ Usando perfil LOJA como fallback (loja pode não estar em stores)');
          finalStore = {
            id: storeId,
            name: loja.name || 'Loja',
            ponto_ativo: true, // Assumir ativo
            active: true,
          };
          console.log('[verify-colaboradora-ponto] ✅ Loja criada a partir do perfil LOJA:', finalStore);
        }
      }
    }

    // Se ainda não encontrou, tentar com .single() na busca original
    if (!finalStore) {
      const { data: store, error: storeError } = await supabaseAdmin
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, ponto_ativo, active')
        .eq('id', storeId)
        .maybeSingle();

      if (storeError && storeError.code !== 'PGRST116') {
        console.error('[verify-colaboradora-ponto] ❌ Erro ao buscar loja:', {
          message: storeError.message,
          code: storeError.code,
          details: storeError.details,
          hint: storeError.hint,
          storeId: storeId
        });
      }

      if (store) {
        finalStore = store;
      } else if (storesList && storesList.length > 0) {
        finalStore = storesList[0];
      }
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
    // 2. Se não, verificar se store_default corresponde ao nome da loja (com normalização)
    const normalizeName = (name) => {
      if (!name) return '';
      return name
        .toLowerCase()
        .replace(/[|,]/g, '') // Remover pipes e vírgulas
        .replace(/\s+/g, ' ') // Normalizar espaços
        .trim();
    };

    const storeIdMatch = profile.store_id === storeId;
    const storeDefaultNormalized = profile.store_default ? normalizeName(profile.store_default) : null;
    const lojaNameNormalized = normalizeName(finalStore.name);
    const storeDefaultMatch = storeDefaultNormalized && storeDefaultNormalized === lojaNameNormalized;
    
    const belongsToStore = storeIdMatch || storeDefaultMatch;

    console.log('[verify-colaboradora-ponto] Validação de pertencimento:', {
      colaboradora_id: profile.id,
      colaboradora_email: profile.email,
      colaboradora_store_id: profile.store_id,
      colaboradora_store_default: profile.store_default,
      loja_id: storeId,
      loja_name: finalStore.name,
      store_id_match: storeIdMatch,
      store_default_normalized: storeDefaultNormalized,
      loja_name_normalized: lojaNameNormalized,
      store_default_match: storeDefaultMatch,
      belongs_to_store: belongsToStore,
    });

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

