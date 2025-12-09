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
        <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 20px 10px;">
            <tr>
              <td align="center" style="padding: 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
                  <tr>
                    <td style="background: rgba(15, 23, 42, 0.95); border-radius: 24px; border: 1px solid rgba(139, 92, 246, 0.3); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); overflow: hidden;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(217, 70, 239, 0.2) 100%); padding: 35px 30px 25px 30px; text-align: center;">
                            <img src="https://eleveaone.com.br/elevea.png" alt="EleveaOne" style="max-width: 160px; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);">
                              Recuperação de Senha
                            </h1>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="padding: 30px; color: #e2e8f0;">
                            <p style="font-size: 17px; line-height: 1.7; margin: 0 0 20px 0; color: #f1f5f9;">
                              Olá, <strong style="color: #a78bfa;">${profile.name}</strong>!
                            </p>
                            <p style="font-size: 15px; line-height: 1.7; margin: 0 0 20px 0; color: #cbd5e1;">
                              Sua senha foi resetada conforme solicitado.
                            </p>
                            <p style="font-size: 15px; line-height: 1.7; margin: 0 0 15px 0; color: #cbd5e1;">
                              Sua nova senha temporária é:
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(217, 70, 239, 0.15) 100%); border-radius: 16px; padding: 28px; text-align: center; border: 2px solid rgba(139, 92, 246, 0.4);">
                                  <span style="font-family: 'Courier New', monospace; font-size: 26px; font-weight: 700; color: #a78bfa; letter-spacing: 4px;">
                                    ${tempPassword}
                                  </span>
                                </td>
                              </tr>
                            </table>
                            <p style="font-size: 15px; line-height: 1.7; margin: 20px 0; color: #cbd5e1;">
                              Faça login em: <a href="https://eleveaone.com.br/auth" style="color: #a78bfa; text-decoration: none; font-weight: 600; border-bottom: 2px solid rgba(167, 139, 250, 0.5);">Sistema EleveaOne</a>
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="background: rgba(245, 158, 11, 0.15); border-left: 4px solid rgba(245, 158, 11, 0.7); border-radius: 12px; padding: 18px; margin: 20px 0;">
                                  <p style="color: #fbbf24; font-size: 14px; line-height: 1.6; margin: 0;">
                                    <strong>⚠️ Importante:</strong> Por favor, altere sua senha após fazer login.
                                  </p>
                                </td>
                              </tr>
                            </table>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="background: rgba(239, 68, 68, 0.15); border-left: 4px solid rgba(239, 68, 68, 0.7); border-radius: 12px; padding: 18px; margin: 20px 0;">
                                  <p style="color: #f87171; font-size: 14px; line-height: 1.6; margin: 0;">
                                    <strong>🔒 Atenção:</strong> Se você não solicitou esta alteração, entre em contato com o administrador imediatamente.
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="padding: 25px 30px; text-align: center; border-top: 1px solid rgba(139, 92, 246, 0.3); background: rgba(15, 23, 42, 0.6);">
                            <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
                              Sistema EleveaOne - Sistema de Gestão<br>
                              Este é um email automático, não responda.
                            </p>
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
