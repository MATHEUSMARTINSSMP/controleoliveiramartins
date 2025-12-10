const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const { 
      admin_email, 
      admin_name, 
      notification_type, 
      payment_amount, 
      payment_date, 
      error_message,
      subscription_status 
    } = JSON.parse(event.body || '{}');

    if (!admin_email || !notification_type) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'admin_email e notification_type são obrigatórios',
          success: false,
        }),
      };
    }

    console.log('Sending payment notification email to:', admin_email, 'Type:', notification_type);

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    );

    // Buscar dados do admin
    const { data: profile } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('profiles')
      .select('name, email')
      .eq('email', admin_email)
      .single();

    const adminName = admin_name || profile?.name || 'Administrador';

    let subject = '';
    let emailContent = '';

    switch (notification_type) {
      case 'PAYMENT_SUCCESS':
        subject = '✅ Pagamento Confirmado - Sistema EleveaOne';
        emailContent = getPaymentSuccessTemplate(adminName, payment_amount, payment_date);
        break;
      case 'PAYMENT_FAILED':
        subject = '⚠️ Falha no Pagamento - Sistema EleveaOne';
        emailContent = getPaymentFailedTemplate(adminName, payment_amount, payment_date, error_message);
        break;
      case 'SUBSCRIPTION_CANCELED':
        subject = '❌ Assinatura Cancelada - Sistema EleveaOne';
        emailContent = getSubscriptionCanceledTemplate(adminName);
        break;
      case 'PAYMENT_OVERDUE':
        subject = '🔴 Pagamento em Atraso - Sistema EleveaOne';
        emailContent = getPaymentOverdueTemplate(adminName, payment_amount, payment_date);
        break;
      default:
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({
            error: 'Tipo de notificação inválido',
            success: false,
          }),
        };
    }

    const emailResponse = await resend.emails.send({
      from: 'Sistema EleveaOne <senhas@eleveaone.com.br>',
      to: [admin_email],
      subject: subject,
      html: emailContent,
    });

    console.log('Payment notification email sent:', emailResponse);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        message: 'Email de notificação enviado com sucesso',
        email_id: emailResponse.id,
      }),
    };
  } catch (error) {
    console.error('Error sending payment notification email:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao enviar email de notificação',
      }),
    };
  }
};

function getPaymentSuccessTemplate(name, amount, date) {
  const formattedAmount = amount ? new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(amount / 100) : 'N/A';
  
  const formattedDate = date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 20px 10px;">
        <tr>
          <td align="center" style="padding: 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
              <tr>
                <td style="background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.3); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); overflow: hidden;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(16, 185, 129, 0.2) 100%); padding: 35px 30px 25px 30px; text-align: center;">
                        <img src="https://eleveaone.com.br/elevea.png" alt="EleveaOne" style="max-width: 160px; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
                          ✅ Pagamento Confirmado!
                        </h1>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="padding: 30px; color: #e2e8f0;">
                        <p style="font-size: 17px; line-height: 1.7; margin: 0 0 20px 0; color: #f1f5f9;">
                          Olá, <strong style="color: #22c55e;">${name}</strong>!
                        </p>
                        <p style="font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; color: #cbd5e1;">
                          Seu pagamento foi processado com sucesso!
                        </p>
                        <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 16px; padding: 24px; margin: 24px 0; border: 2px solid rgba(34, 197, 94, 0.3);">
                          <p style="margin: 0 0 12px 0; color: #cbd5e1;"><strong style="color: #22c55e;">Valor:</strong> ${formattedAmount}</p>
                          <p style="margin: 0; color: #cbd5e1;"><strong style="color: #22c55e;">Data:</strong> ${formattedDate}</p>
                        </div>
                        <p style="font-size: 16px; line-height: 1.8; margin: 24px 0 0 0; color: #cbd5e1;">
                          Sua assinatura está ativa e você tem acesso completo ao sistema.
                        </p>
                        <div style="text-align: center; margin-top: 32px;">
                          <a href="https://eleveaone.com.br/admin" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
                            Acessar Dashboard
                          </a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function getPaymentFailedTemplate(name, amount, date, errorMessage) {
  const formattedAmount = amount ? new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(amount / 100) : 'N/A';
  
  const formattedDate = date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 20px 10px;">
        <tr>
          <td align="center" style="padding: 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
              <tr>
                <td style="background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(239, 68, 68, 0.3); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); overflow: hidden;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.2) 100%); padding: 35px 30px 25px 30px; text-align: center;">
                        <img src="https://eleveaone.com.br/elevea.png" alt="EleveaOne" style="max-width: 160px; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
                          ⚠️ Falha no Pagamento
                        </h1>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="padding: 30px; color: #e2e8f0;">
                        <p style="font-size: 17px; line-height: 1.7; margin: 0 0 20px 0; color: #f1f5f9;">
                          Olá, <strong style="color: #ef4444;">${name}</strong>!
                        </p>
                        <p style="font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; color: #cbd5e1;">
                          Infelizmente, não foi possível processar seu pagamento.
                        </p>
                        <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%); border-radius: 16px; padding: 24px; margin: 24px 0; border: 2px solid rgba(239, 68, 68, 0.3);">
                          <p style="margin: 0 0 12px 0; color: #cbd5e1;"><strong style="color: #ef4444;">Valor:</strong> ${formattedAmount}</p>
                          <p style="margin: 0 0 12px 0; color: #cbd5e1;"><strong style="color: #ef4444;">Data:</strong> ${formattedDate}</p>
                          ${errorMessage ? `<p style="margin: 12px 0 0 0; color: #fca5a5; font-size: 14px;"><strong>Erro:</strong> ${errorMessage}</p>` : ''}
                        </div>
                        <p style="font-size: 16px; line-height: 1.8; margin: 24px 0 0 0; color: #cbd5e1;">
                          Por favor, verifique os dados do seu cartão ou método de pagamento e tente novamente.
                        </p>
                        <div style="text-align: center; margin-top: 32px;">
                          <a href="https://eleveaone.com.br/admin" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
                            Verificar Pagamento
                          </a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function getSubscriptionCanceledTemplate(name) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 20px 10px;">
        <tr>
          <td align="center" style="padding: 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
              <tr>
                <td style="background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(148, 163, 184, 0.3); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); overflow: hidden;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="background: linear-gradient(135deg, rgba(148, 163, 184, 0.25) 0%, rgba(100, 116, 139, 0.2) 100%); padding: 35px 30px 25px 30px; text-align: center;">
                        <img src="https://eleveaone.com.br/elevea.png" alt="EleveaOne" style="max-width: 160px; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
                          ❌ Assinatura Cancelada
                        </h1>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="padding: 30px; color: #e2e8f0;">
                        <p style="font-size: 17px; line-height: 1.7; margin: 0 0 20px 0; color: #f1f5f9;">
                          Olá, <strong style="color: #94a3b8;">${name}</strong>!
                        </p>
                        <p style="font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; color: #cbd5e1;">
                          Sua assinatura foi cancelada. Você ainda pode acessar o sistema para visualizar seus dados, mas funcionalidades de criação e edição estarão limitadas.
                        </p>
                        <p style="font-size: 16px; line-height: 1.8; margin: 24px 0 0 0; color: #cbd5e1;">
                          Se você deseja reativar sua assinatura, entre em contato conosco ou acesse a área de pagamentos.
                        </p>
                        <div style="text-align: center; margin-top: 32px;">
                          <a href="https://eleveaone.com.br/admin" style="display: inline-block; background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                            Acessar Dashboard
                          </a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function getPaymentOverdueTemplate(name, amount, date) {
  const formattedAmount = amount ? new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(amount / 100) : 'N/A';
  
  const formattedDate = date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 20px 10px;">
        <tr>
          <td align="center" style="padding: 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
              <tr>
                <td style="background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(234, 179, 8, 0.3); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); overflow: hidden;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="background: linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(202, 138, 4, 0.2) 100%); padding: 35px 30px 25px 30px; text-align: center;">
                        <img src="https://eleveaone.com.br/elevea.png" alt="EleveaOne" style="max-width: 160px; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
                          🔴 Pagamento em Atraso
                        </h1>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="padding: 30px; color: #e2e8f0;">
                        <p style="font-size: 17px; line-height: 1.7; margin: 0 0 20px 0; color: #f1f5f9;">
                          Olá, <strong style="color: #eab308;">${name}</strong>!
                        </p>
                        <p style="font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; color: #cbd5e1;">
                          Seu pagamento está em atraso. Por favor, regularize o quanto antes para evitar a suspensão do acesso.
                        </p>
                        <div style="background: linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(202, 138, 4, 0.1) 100%); border-radius: 16px; padding: 24px; margin: 24px 0; border: 2px solid rgba(234, 179, 8, 0.3);">
                          <p style="margin: 0 0 12px 0; color: #cbd5e1;"><strong style="color: #eab308;">Valor:</strong> ${formattedAmount}</p>
                          <p style="margin: 0; color: #cbd5e1;"><strong style="color: #eab308;">Vencimento:</strong> ${formattedDate}</p>
                        </div>
                        <p style="font-size: 16px; line-height: 1.8; margin: 24px 0 0 0; color: #cbd5e1;">
                          Após 7 dias de atraso, seu acesso será suspenso. Regularize agora para manter o acesso completo ao sistema.
                        </p>
                        <div style="text-align: center; margin-top: 32px;">
                          <a href="https://eleveaone.com.br/admin" style="display: inline-block; background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(234, 179, 8, 0.4);">
                            Regularizar Pagamento
                          </a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

