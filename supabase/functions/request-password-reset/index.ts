import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { identifier } = await req.json()

    if (!identifier || typeof identifier !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'Identificador inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const searchIdentifier = identifier.trim()
    console.log('Searching for user with identifier:', searchIdentifier)

    // Search for user by email (case insensitive), CPF, or name (case insensitive)
    // Try multiple queries to find the user
    let profiles = null
    let searchError = null

    // First try: exact email match (case insensitive)
    const { data: emailMatch, error: emailError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, name, email, cpf')
      .ilike('email', searchIdentifier)
      .eq('active', true)
      .limit(1)

    if (emailMatch && emailMatch.length > 0) {
      profiles = emailMatch
    } else {
      // Second try: CPF match
      const { data: cpfMatch, error: cpfError } = await supabaseAdmin
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, email, cpf')
        .eq('cpf', searchIdentifier)
        .eq('active', true)
        .limit(1)

      if (cpfMatch && cpfMatch.length > 0) {
        profiles = cpfMatch
      } else {
        // Third try: name match (case insensitive, partial)
        const { data: nameMatch, error: nameError } = await supabaseAdmin
          .schema('sistemaretiradas')
          .from('profiles')
          .select('id, name, email, cpf')
          .ilike('name', `%${searchIdentifier}%`)
          .eq('active', true)
          .limit(1)

        if (nameMatch && nameMatch.length > 0) {
          profiles = nameMatch
        } else {
          searchError = nameError || cpfError || emailError
        }
      }
    }

    if (searchError) {
      console.error('Error searching for user:', searchError)
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Erro ao buscar usuário',
          error: String(searchError)
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!profiles || profiles.length === 0) {
      console.log('User not found with identifier:', searchIdentifier)
      return new Response(
        JSON.stringify({
          success: false,
          message: `Usuário não encontrado. Verifique se o email, CPF ou nome estão corretos.`
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const profile = profiles[0]
    console.log('User found:', profile.email)

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()

    console.log('Updating password for user:', profile.id)

    // Update password with admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: tempPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      throw updateError
    }

    console.log('Password updated successfully')

    // Note: When password is updated, Supabase automatically invalidates all existing sessions
    // No need to manually sign out - the old sessions will be invalid on next use
    // Attempting to signOut with userId can cause JWT errors, so we skip it
    
    console.log('Sessions will be automatically invalidated on next login attempt, sending email')

    // Send password reset email via Resend
    const emailResponse = await resend.emails.send({
      from: "Sistema EleveaOne <senhas@eleveaone.com.br>",
      to: [profile.email],
      subject: "Recuperação de Senha - Sistema EleveaOne",
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
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Recuperação de Senha</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 40px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Olá, <strong>${profile.name}</strong>!</p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Sua senha foi resetada conforme solicitado.</p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">Sua nova senha temporária é:</p>
                      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0; border: 2px solid #e5e7eb;">
                        <span style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; color: #2563eb; letter-spacing: 2px;">${tempPassword}</span>
                      </div>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">Faça login em: <a href="https://eleveaone.com.br/auth" style="color: #2563eb; text-decoration: none; font-weight: 600;">Sistema EleveaOne</a></p>
                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;"><strong>Importante:</strong> Por favor, altere sua senha após fazer login.</p>
                      </div>
                      <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 20px 0;">
                        <p style="color: #991b1b; font-size: 14px; line-height: 1.6; margin: 0;"><strong>Atenção:</strong> Se você não solicitou esta alteração, entre em contato com o administrador imediatamente.</p>
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

    return new Response(
      JSON.stringify({ success: true, message: 'Email enviado com sucesso' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in request-password-reset:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Erro ao processar solicitação de recuperação de senha',
        error: String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
