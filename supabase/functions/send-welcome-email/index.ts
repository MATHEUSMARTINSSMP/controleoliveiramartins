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
      from: "Dashboard de Compras <senhas@eleveaone.com.br>",
      to: [email],
      subject: "Bem-vinda ao Dashboard de Compras!",
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
