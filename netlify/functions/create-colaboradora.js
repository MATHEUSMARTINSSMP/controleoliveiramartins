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

    console.log('[create-colaboradora] Creating user:', email);

    // Step 1: Create auth.user
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'COLABORADORA',
      },
    });

    if (authError) {
      console.error('[create-colaboradora] Auth error:', authError);
      throw authError;
    }

    console.log('[create-colaboradora] User created with ID:', userData.user.id);

    // Step 2: Wait a moment for auth user to be fully persisted
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 3: Create or update profile with CORRECT ID
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
        onConflict: 'id', // If ID exists, update
        ignoreDuplicates: false
      });

    if (profileError) {
      console.error('[create-colaboradora] Profile error:', profileError);
      throw profileError;
    }

    console.log('[create-colaboradora] Profile created successfully');

    // Step 4: Send welcome email
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
        console.log('[create-colaboradora] Welcome email sent successfully');
      }
    } catch (emailError) {
      console.error('[create-colaboradora] Email error:', emailError);
      // Don't throw - email failure shouldn't fail the whole operation
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        user: userData.user,
        message: 'Colaboradora created successfully'
      }),
    };
  } catch (error) {
    console.error('[create-colaboradora] Error:', error);
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error) }),
    };
  }
};
