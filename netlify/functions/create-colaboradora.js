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

    const { email, password, name, cpf, limite_total, limite_mensal } = JSON.parse(
      event.body || '{}'
    );

    console.log('[create-colaboradora] Starting creation for:', email);

    // Step 1: Try to create user first
    let userData;
    let authError;

    const createResult = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'COLABORADORA',
      },
    });

    userData = createResult.data;
    authError = createResult.error;

    // Step 2: If user already exists, check if it's orphaned
    if (authError && authError.message && authError.message.includes('already been registered')) {
      console.log('[create-colaboradora] User exists, checking if orphaned...');

      // Get existing user by email using SQL query
      const { data: existingAuthUser, error: queryError } = await supabaseAdmin
        .from('auth.users')
        .select('id, email')
        .eq('email', email)
        .single();

      if (queryError) {
        console.error('[create-colaboradora] Error querying auth.users:', queryError);

        // Alternative: try to get all users and filter (less efficient but works)
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
        const foundUser = allUsers?.users?.find(u => u.email === email);

        if (foundUser) {
          console.log('[create-colaboradora] Found user via listUsers:', foundUser.id);

          // Check if has profile
          const { data: profile } = await supabaseAdmin
            .schema('sistemaretiradas')
            .from('profiles')
            .select('id')
            .eq('id', foundUser.id)
            .maybeSingle();

          if (!profile) {
            console.log('[create-colaboradora] Orphaned user detected! Deleting:', foundUser.id);
            await supabaseAdmin.auth.admin.deleteUser(foundUser.id);

            // Wait a bit for deletion to propagate
            await new Promise(resolve => setTimeout(resolve, 500));

            // Retry creation
            const retryResult = await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: {
                name,
                role: 'COLABORADORA',
              },
            });

            userData = retryResult.data;
            authError = retryResult.error;
          } else {
            throw new Error('Já existe uma colaboradora ativa com este email');
          }
        } else {
          throw new Error('Erro ao verificar usuário existente');
        }
      }
    }

    if (authError) {
      console.error('[create-colaboradora] Auth error:', authError);
      throw authError;
    }

    if (!userData || !userData.user) {
      throw new Error('Falha ao criar usuário');
    }

    console.log('[create-colaboradora] User created with ID:', userData.user.id);

    // Step 3: Wait for auth user to be fully persisted
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 4: Create profile with CORRECT ID
    const profileData = {
      id: userData.user.id, // CRITICAL: Must match auth.user.id
      name,
      email,
      cpf,
      role: 'COLABORADORA',
      limite_total: parseFloat(limite_total),
      limite_mensal: parseFloat(limite_mensal),
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[create-colaboradora] Creating profile with ID:', profileData.id);

    const { error: profileError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (profileError) {
      console.error('[create-colaboradora] Profile error:', profileError);
      throw profileError;
    }

    console.log('[create-colaboradora] Profile created successfully');

    // Step 5: Send welcome email
    try {
      const netlifyUrl =
        process.env.NETLIFY_URL ||
        process.env.DEPLOY_PRIME_URL ||
        'https://controleinterno.netlify.app';

      const emailResponse = await fetch(`${netlifyUrl}/.netlify/functions/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          password,
        }),
      });

      if (!emailResponse.ok) {
        console.error('[create-colaboradora] Email failed:', await emailResponse.text());
      } else {
        console.log('[create-colaboradora] Welcome email sent');
      }
    } catch (emailError) {
      console.error('[create-colaboradora] Email error:', emailError);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        user: userData.user,
        message: 'Colaboradora criada com sucesso'
      }),
    };
  } catch (error) {
    console.error('[create-colaboradora] Final error:', error);
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || String(error)
      }),
    };
  }
};
