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

    const { email, password, name, cpf, limite_total, limite_mensal } = JSON.parse(event.body || '{}');

    console.log('[create-colaboradora] Starting for:', email);

    // STEP 1: Check if user already exists BEFORE trying to create
    console.log('[create-colaboradora] Checking existing users...');
    const { data: allUsersData } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = allUsersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      console.log('[create-colaboradora] User exists:', existingUser.id);

      // Check if profile exists
      const { data: profile } = await supabaseAdmin
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id')
        .eq('id', existingUser.id)
        .maybeSingle();

      if (profile) {
        console.log('[create-colaboradora] Profile exists - duplicate!');
        throw new Error('Já existe uma colaboradora com este email');
      }

      // ORPHANED USER - Delete it
      console.log('[create-colaboradora] ORPHANED user detected! Deleting...');
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id);

      // Wait longer for deletion to propagate
      console.log('[create-colaboradora] Waiting for deletion to propagate...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // STEP 2: Create auth.user
    console.log('[create-colaboradora] Creating auth.user...');
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'COLABORADORA' },
    });

    if (authError) {
      console.error('[create-colaboradora] Auth error:', authError);
      throw new Error(authError.message || 'Erro ao criar usuário');
    }

    if (!userData?.user) {
      throw new Error('Falha ao criar usuário - sem dados retornados');
    }

    console.log('[create-colaboradora] User created:', userData.user.id);

    // STEP 3: Wait for auth propagation
    await new Promise(resolve => setTimeout(resolve, 500));

    // STEP 4: Create profile
    console.log('[create-colaboradora] Creating profile...');
    const { error: profileError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('profiles')
      .upsert({
        id: userData.user.id,
        name,
        email,
        cpf,
        role: 'COLABORADORA',
        limite_total: parseFloat(limite_total),
        limite_mensal: parseFloat(limite_mensal),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('[create-colaboradora] Profile error:', profileError);
      throw new Error('Erro ao criar profile: ' + profileError.message);
    }

    console.log('[create-colaboradora] SUCCESS!');

    // STEP 5: Send welcome email (non-blocking)
    try {
      const netlifyUrl = process.env.NETLIFY_URL || process.env.DEPLOY_PRIME_URL || 'https://controleinterno.netlify.app';
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
