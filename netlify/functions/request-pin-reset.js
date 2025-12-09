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
    // Validate environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Configuracao do servidor incompleta',
        }),
      };
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    );

    const { colaboradora_id, email } = JSON.parse(event.body || '{}');

    if (!colaboradora_id) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'ID da colaboradora e obrigatorio' }),
      };
    }

    console.log('Requesting PIN reset for colaboradora:', colaboradora_id);

    // Get colaboradora info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, store_id')
      .eq('id', colaboradora_id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Colaboradora nao encontrada' }),
      };
    }

    const targetEmail = email || profile.email;
    
    if (!targetEmail) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Email nao encontrado para esta colaboradora' }),
      };
    }

    // Generate reset token using RPC
    const { data: resetToken, error: tokenError } = await supabaseAdmin.rpc('generate_pin_reset_token', {
      p_colaboradora_id: colaboradora_id
    });

    if (tokenError) {
      console.error('Error generating token:', tokenError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Erro ao gerar token de reset' }),
      };
    }

    console.log('Token generated, sending email to:', targetEmail);

    // Send email with token
    const netlifyUrl = process.env.NETLIFY_URL || process.env.DEPLOY_PRIME_URL || 'https://eleveaone.com.br';
    
    const emailResponse = await fetch(`${netlifyUrl}/.netlify/functions/send-pin-reset-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: targetEmail,
        name: profile.name,
        resetToken: resetToken,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok || !emailData.success) {
      console.error('Email sending failed:', emailData);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          message: 'Erro ao enviar email. Tente novamente.',
          details: emailData.error 
        }),
      };
    }

    console.log('PIN reset email sent successfully');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Codigo de reset enviado para ${targetEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`,
      }),
    };
  } catch (error) {
    console.error('Error in request-pin-reset function:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        error: error.message || String(error),
        success: false,
      }),
    };
  }
};
