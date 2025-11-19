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

    // Check if profile exists and update/create it with CPF and custom limits
    if (userData.user) {
      // First, check if profile exists
      const { data: existingProfile, error: checkError } = await supabaseAdmin
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id')
        .eq('id', userData.user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is OK if profile doesn't exist yet
        console.error('Error checking profile:', checkError);
        throw checkError;
      }

      if (existingProfile) {
        // Profile exists, update it
        const { error: updateError } = await supabaseAdmin
          .schema('sistemaretiradas')
          .from('profiles')
          .update({
            name: name,
            cpf: cpf,
            limite_total: parseFloat(limite_total),
            limite_mensal: parseFloat(limite_mensal),
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userData.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          throw updateError;
        }
      } else {
        // Profile doesn't exist, create it
        const { error: insertError } = await supabaseAdmin
          .schema('sistemaretiradas')
          .from('profiles')
          .insert({
            id: userData.user.id,
            name: name,
            email: email,
            cpf: cpf,
            role: 'COLABORADORA',
            limite_total: parseFloat(limite_total),
            limite_mensal: parseFloat(limite_mensal),
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }
      }

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

