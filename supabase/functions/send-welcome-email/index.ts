import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  tempPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, tempPassword }: WelcomeEmailRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "Sistema de Compras <onboarding@resend.dev>",
      to: [email],
      subject: "Bem-vinda ao Sistema de Compras!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #D4AF37 0%, #F4E4C1 100%); border-radius: 10px;">
          <h1 style="color: #5D4E37; text-align: center;">Bem-vinda, ${name}!</h1>
          <div style="background: white; padding: 30px; border-radius: 8px; margin-top: 20px;">
            <p style="color: #5D4E37; font-size: 16px;">
              Sua conta foi criada com sucesso no Sistema de Compras!
            </p>
            <div style="background: #F8F5F0; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #D4AF37;">
              <p style="margin: 0; color: #5D4E37;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 10px 0 0 0; color: #5D4E37;"><strong>Senha Temporária:</strong> ${tempPassword}</p>
            </div>
            <p style="color: #5D4E37;">
              Por favor, faça login usando as credenciais acima e altere sua senha assim que possível.
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${Deno.env.get("VITE_SUPABASE_URL")}" 
                 style="background: linear-gradient(135deg, #D4AF37, #F4E4C1); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Acessar Sistema
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #5D4E37; margin-top: 20px; font-size: 14px;">
            Sistema de Compras - Gestão Inteligente
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
