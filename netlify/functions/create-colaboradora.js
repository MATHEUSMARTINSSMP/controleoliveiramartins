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
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { email, password, name, cpf, limite_total, limite_mensal } = JSON.parse(
      event.body || '{}'
    );

    // Create user with admin client
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'COLABORADORA',
      },
    });

    if (authError) throw authError;

    // Update profile with CPF and custom limits
    if (userData.user) {
      const { error: profileError } = await supabaseAdmin
        .schema('sacadaohboy-mrkitsch-loungerie')
        .from('profiles')
        .update({
          cpf: cpf,
          limite_total: parseFloat(limite_total),
          limite_mensal: parseFloat(limite_mensal),
        })
        .eq('id', userData.user.id);

      if (profileError) throw profileError;

      // Send welcome email via Netlify Function
      try {
        // Use NETLIFY_URL if available (set automatically by Netlify), otherwise use the site URL
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
          console.error('Email sending failed:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, user: userData.user }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error) }),
    };
  }
};

