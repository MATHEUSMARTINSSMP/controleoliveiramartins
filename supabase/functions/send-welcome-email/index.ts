import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, password } = await req.json();

    if (!email || !name || !password) {
      return new Response(
        JSON.stringify({ 
          error: "Email, nome e senha são obrigatórios",
          success: false 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Sending welcome email to:", email);

    // Send welcome email via Resend
    const emailResponse = await resend.emails.send({
      from: "Sistema EleveaOne <senhas@eleveaone.com.br>",
      to: [email],
      subject: "Bem-vinda ao Sistema EleveaOne!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); border-radius: 16px 16px 0 0;">
                      <img src="https://eleveaone.com.br/elevea.png" alt="EleveaOne" style="max-width: 200px; height: auto; margin-bottom: 20px;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Bem-vinda ao Sistema EleveaOne!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 40px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Olá, <strong>${name}</strong>!</p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Sua conta foi criada com sucesso no Sistema EleveaOne.</p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">Suas credenciais de acesso são:</p>
                      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; margin: 20px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${email}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Senha:</td>
                            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right; font-family: 'Courier New', monospace;">${password}</td>
                          </tr>
                        </table>
                      </div>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">Por favor, faça login em: <a href="https://eleveaone.com.br/auth" style="color: #2563eb; text-decoration: none; font-weight: 600;">Sistema EleveaOne</a></p>
                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;"><strong>Recomendação:</strong> Alteramos que você altere sua senha após o primeiro login.</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sistema EleveaOne - Sistema de Gestão<br>Este é um email automático, não responda.</p>
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email enviado com sucesso",
      emailId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || String(error),
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
