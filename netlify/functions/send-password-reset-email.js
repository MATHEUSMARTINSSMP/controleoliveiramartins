const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { email, new_password } = JSON.parse(event.body || '{}');

    if (!email || !new_password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Email e nova senha são obrigatórios',
          success: false,
        }),
      };
    }

    console.log('Sending password reset email to:', email);

    // Send password reset email via Resend
    const emailResponse = await resend.emails.send({
      from: 'Dashboard de Compras <senhas@eleveaagencia.com.br>',
      to: [email],
      subject: 'Sua senha foi alterada - Dashboard de Compras',
      html: `
        <h1>Senha Alterada</h1>
        <p>Sua senha do Dashboard de Compras foi alterada pelo administrador.</p>
        <p>Sua nova senha temporária é:</p>
        <p><strong>${new_password}</strong></p>
        <p>Por favor, faça login em: <a href="https://eleveaone.com.br/auth">Dashboard de Compras</a></p>
        <p>Recomendamos fortemente que você altere sua senha após fazer login.</p>
        <br>
        <p>Atenciosamente,<br>Equipe Dashboard de Compras</p>
      `,
    });

    console.log('Email sent successfully:', emailResponse);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify({
        success: true,
        message: 'Email enviado com sucesso',
        emailId: emailResponse.data?.id,
      }),
    };
  } catch (error) {
    console.error('Error in send-password-reset-email function:', error);
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

