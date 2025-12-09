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
    const { email, new_password } = await req.json();

    if (!email || !new_password) {
      return new Response(
        JSON.stringify({ 
          error: "Email e nova senha são obrigatórios",
          success: false 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Sending password reset email to:", email);

    // Send password reset email via Resend
    const emailResponse = await resend.emails.send({
      from: "Dashboard de Compras <senhas@eleveaone.com.br>",
      to: [email],
      subject: "Sua senha foi alterada - Dashboard de Compras",
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
    console.error("Error in send-password-reset-email function:", error);
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
