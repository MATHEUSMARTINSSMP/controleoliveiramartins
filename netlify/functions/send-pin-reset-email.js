const { Resend } = require('resend');

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
    if (!process.env.RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Configuracao do servidor incompleta',
        }),
      };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { email, name, resetToken } = JSON.parse(event.body || '{}');

    if (!email || !name || !resetToken) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Email, nome e token sao obrigatorios',
          success: false,
        }),
      };
    }

    console.log('Sending PIN reset email to:', email);

    const emailResponse = await resend.emails.send({
      from: 'Sistema EleveaOne <senhas@eleveaone.com.br>',
      to: [email],
      subject: 'Código para Redefinir seu PIN de Assinatura Digital - Sistema EleveaOne',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redefinir PIN de Assinatura Digital</title>
        </head>
        <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; position: relative; z-index: 1;">
                  <tr>
                    <td>
                      <div style="background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.1); overflow: hidden;">
                        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(217, 70, 239, 0.15) 100%); padding: 50px 40px 30px 40px; text-align: center; position: relative; overflow: hidden;">
                          <img src="https://eleveaone.com.br/elevea.png" alt="EleveaOne" style="max-width: 180px; height: auto; margin-bottom: 20px; filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.5));">
                          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 0 20px rgba(139, 92, 246, 0.5); background: linear-gradient(135deg, #ffffff 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                            Redefinir PIN de Assinatura
                          </h1>
                        </div>
                        <div style="padding: 40px; color: #e2e8f0;">
                          <p style="font-size: 18px; line-height: 1.8; margin: 0 0 24px 0; color: #f1f5f9;">
                            Olá, <strong style="color: #a78bfa; text-shadow: 0 0 10px rgba(167, 139, 250, 0.5);">${name}</strong>!
                          </p>
                          <p style="font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; color: #cbd5e1;">
                            Você solicitou a redefinição do seu PIN de assinatura digital para registro de ponto.
                          </p>
                          <p style="font-size: 16px; line-height: 1.8; margin: 0 0 16px 0; color: #cbd5e1;">
                            Use o código abaixo para redefinir seu PIN:
                          </p>
                          <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(217, 70, 239, 0.1) 100%); border-radius: 16px; padding: 40px; text-align: center; margin: 24px 0; border: 2px solid rgba(139, 92, 246, 0.3); box-shadow: 0 0 30px rgba(139, 92, 246, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1);">
                            <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; color: #a78bfa; letter-spacing: 6px; text-shadow: 0 0 20px rgba(167, 139, 250, 0.8);">
                              ${resetToken}
                            </span>
                          </div>
                          <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid rgba(245, 158, 11, 0.6); border-radius: 12px; padding: 20px; margin: 24px 0; backdrop-filter: blur(10px);">
                            <p style="color: #fbbf24; font-size: 14px; line-height: 1.6; margin: 0;">
                              <strong>⏰ Importante:</strong> Este código expira em <strong>1 hora</strong>. Se você não solicitou esta redefinição, ignore este email.
                            </p>
                          </div>
                          <p style="font-size: 16px; line-height: 1.8; margin: 24px 0 0 0; color: #cbd5e1;">
                            Lembre-se: o PIN de assinatura digital é diferente da sua senha de acesso ao sistema.
                          </p>
                        </div>
                        <div style="padding: 30px 40px; text-align: center; border-top: 1px solid rgba(139, 92, 246, 0.2); background: rgba(15, 23, 42, 0.5);">
                          <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
                            Sistema EleveaOne - Sistema de Gestão<br>
                            Este é um email automático, não responda.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
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
    console.error('Error in send-pin-reset-email function:', error);
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
