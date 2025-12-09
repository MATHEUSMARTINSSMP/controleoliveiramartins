const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { db: { schema: 'sistemaretiradas' } }
    );

    // Extract data from request body
    const { email, password, name, cpf, limite_total, limite_mensal, store_default, store_id, whatsapp } = JSON.parse(event.body);

    console.log('[create-colaboradora] Received request:', { email, name, cpf, store_default, store_id, whatsapp });

    // Validate required fields
    if (!email || !password || !name || !cpf || !limite_total || !limite_mensal || !store_default || !whatsapp) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: email, password, name, cpf, limite_total, limite_mensal, store_default, whatsapp'
        }),
      };
    }

    // Validar formato do WhatsApp (apenas números, 10-11 dígitos)
    const normalizedWhatsapp = whatsapp.replace(/\D/g, '');
    if (normalizedWhatsapp.length < 10 || normalizedWhatsapp.length > 11) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'WhatsApp inválido. Digite apenas números (10-11 dígitos)'
        }),
      };
    }

    // STEP 0: Check commercial limits (Plan Limits)
    console.log('[create-colaboradora] Step 0: Checking plan limits...');
    const { data: canCreate, error: limitError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .rpc('can_create_colaboradora');

    if (limitError) {
      console.error('[create-colaboradora] ❌ Error checking limits:', limitError);
      // Fail safe: if we can't check limits, we should probably block or log heavily.
      // For now, let's block to be safe commercially.
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Erro ao verificar limites do plano. Tente novamente.'
        }),
      };
    }

    if (canCreate === false) {
      console.warn('[create-colaboradora] 🚫 Limit reached for colaboradoras');
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Limite de colaboradoras atingido para o seu plano. Faça upgrade para adicionar mais.'
        }),
      };
    }
    console.log('[create-colaboradora] ✅ Plan limits OK');

    // STEP 1: Try to create auth.user first
    console.log('[create-colaboradora] Step 1: Creating auth.user...');

    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(), // Always lowercase for consistency
      password: password,
      email_confirm: true,  // Auto-confirm email
      user_metadata: {
        name: name,
        cpf: cpf,
      },
    });

    // CRITICAL: Strict validation - if createUser fails or returns incomplete data, stop immediately
    if (authError || !userData || !userData.user || !userData.user.id) {
      console.error('[create-colaboradora] ❌ FAILED to create auth.user:', authError);

      // If user already exists, check if it's an orphan
      if (authError && authError.message && authError.message.includes('already registered')) {
        console.log('[create-colaboradora] User already registered. Checking for orphaned auth.user...');

        // Check if this is an orphaned auth.user (no matching profile)
        const { data: existingProfile, error: checkError } = await supabaseAdmin
          .schema('sistemaretiradas')
          .from('profiles')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (checkError) {
          console.error('[create-colaboradora] Error checking for existing profile:', checkError);
          throw new Error('Error checking existing user: ' + checkError.message);
        }

        if (!existingProfile) {
          console.log('[create-colaboradora] Found orphaned auth.user (no profile). Attempting cleanup...');

          // Get the orphaned user ID
          const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) {
            throw new Error('Error listing users: ' + listError.message);
          }

          const orphanedUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

          if (orphanedUser) {
            console.log('[create-colaboradora] Deleting orphaned auth.user:', orphanedUser.id);
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphanedUser.id);

            if (deleteError) {
              throw new Error('Error deleting orphaned user: ' + deleteError.message);
            }

            console.log('[create-colaboradora] Orphaned user deleted. Waiting 1s for propagation...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Retry creating the user
            console.log('[create-colaboradora] Retrying auth.user creation after cleanup...');
            const { data: retryUserData, error: retryAuthError } = await supabaseAdmin.auth.admin.createUser({
              email: email.toLowerCase(),
              password: password,
              email_confirm: true,
              user_metadata: {
                name: name,
                cpf: cpf,
              },
            });

            if (retryAuthError || !retryUserData || !retryUserData.user || !retryUserData.user.id) {
              console.error('[create-colaboradora] ❌ Retry FAILED:', retryAuthError);
              throw new Error('Failed to create auth.user after cleanup: ' + (retryAuthError?.message || 'Unknown error'));
            }

            // Use retry data
            userData.user = retryUserData.user;
            console.log('[create-colaboradora] ✅ Retry SUCCESS! auth.user created:', userData.user.id);
          } else {
            throw new Error('User already registered but could not find orphaned auth.user');
          }
        } else {
          throw new Error('User already registered with a valid profile');
        }
      } else {
        throw new Error('Failed to create auth.user: ' + (authError?.message || 'Unknown error'));
      }
    } else {
      console.log('[create-colaboradora] ✅ Step 1 SUCCESS: auth.user created with ID:', userData.user.id);
    }

    // Wait 500ms to ensure auth.user is fully persisted in Supabase
    console.log('[create-colaboradora] Waiting 500ms for auth.user persistence...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // STEP 2: Create/update profile with EXACT same ID
    console.log('[create-colaboradora] Step 2: Creating profile with ID:', userData.user.id);

    // Buscar store_id automaticamente se não foi fornecido
    let finalStoreId = store_id;
    if (!finalStoreId && store_default) {
      console.log('[create-colaboradora] store_id não fornecido, buscando automaticamente pelo store_default:', store_default);

      // Normalizar nome para busca flexível
      const normalizeName = (name) => {
        return name
          .toLowerCase()
          .replace(/[|,]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const { data: storesData, error: storesError } = await supabaseAdmin
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name')
        .eq('active', true);

      if (!storesError && storesData && storesData.length > 0) {
        const normalizedStoreName = normalizeName(store_default);
        const matchingStore = storesData.find(s => {
          const normalizedStore = normalizeName(s.name);
          return normalizedStore === normalizedStoreName ||
            s.name === store_default ||
            normalizedStore.includes(normalizedStoreName) ||
            normalizedStoreName.includes(normalizedStore);
        });

        if (matchingStore) {
          finalStoreId = matchingStore.id;
          console.log('[create-colaboradora] ✅ store_id encontrado automaticamente:', finalStoreId, 'para loja:', matchingStore.name);
        } else {
          console.warn('[create-colaboradora] ⚠️ Nenhuma loja encontrada para store_default:', store_default);
        }
      } else if (storesError) {
        console.error('[create-colaboradora] ❌ Erro ao buscar lojas:', storesError);
      }
    }

    const profilePayload = {
      id: userData.user.id,  // CRITICAL: Must match auth.user.id
      email: email.toLowerCase(),
      name: name,
      cpf: cpf,
      limite_total: parseFloat(limite_total),
      limite_mensal: parseFloat(limite_mensal),
      store_default: store_default,
      whatsapp: normalizedWhatsapp, // WhatsApp normalizado (apenas números)
      role: 'COLABORADORA',
      active: true,
    };

    // Add store_id se encontrado (fornecido ou buscado automaticamente)
    if (finalStoreId) {
      profilePayload.store_id = finalStoreId;
      console.log('[create-colaboradora] ✅ Salvando profile com store_id:', finalStoreId);
    } else {
      console.warn('[create-colaboradora] ⚠️ Profile será criado SEM store_id (store_default:', store_default, ')');
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('profiles')
      .upsert(profilePayload, {
        onConflict: 'id',  // Use ID as conflict key
      })
      .select()
      .single();

    if (profileError) {
      console.error('[create-colaboradora] Profile error:', profileError);
      throw new Error('Erro ao criar profile: ' + profileError.message);
    }

    console.log('[create-colaboradora] SUCCESS!');

    // STEP 5: Send welcome email (non-blocking)
    try {
      const netlifyUrl = process.env.NETLIFY_URL || process.env.DEPLOY_PRIME_URL || 'https://eleveaone.com.br';
      await fetch(`${netlifyUrl}/.netlify/functions/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
    } catch (emailError) {
      console.error('[create-colaboradora] Email failed (non-critical):', emailError);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, user: userData.user }),
    };
  } catch (error) {
    console.error('[create-colaboradora] ERROR:', error);
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || String(error) }),
    };
  }
};
