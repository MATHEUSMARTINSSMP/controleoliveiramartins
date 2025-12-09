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
    const { email, name, password } = JSON.parse(event.body || '{}');

    if (!email || !name || !password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Email, nome e senha são obrigatórios',
          success: false,
        }),
      };
    }

    console.log('Sending welcome email to:', email);

    // Send welcome email via Resend
    const emailResponse = await resend.emails.send({
      from: 'Dashboard de Compras <senhas@eleveaagencia.com.br>',
      to: [email],
      subject: 'Bem-vinda ao Dashboard de Compras!',
      html: `
        <h1>Olá, ${name}!</h1>
        <p>Sua conta foi criada com sucesso no Dashboard de Compras.</p>
        <p>Suas credenciais de acesso são:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Senha:</strong> ${password}</li>
        </ul>
        <p>Por favor, faça login em: <a href="https://eleveaone.com.br/auth">Dashboard de Compras</a></p>
        <p>Recomendamos que você altere sua senha após o primeiro login.</p>
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
    console.error('Error in send-welcome-email function:', error);
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

