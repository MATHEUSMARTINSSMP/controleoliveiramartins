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
      from: "Dashboard de Compras <senhas@eleveaagencia.com.br>",
      to: [profile.email],
      subject: "Recuperação de Senha - Dashboard de Compras",
      html: `
        <h1>Recuperação de Senha</h1>
        <p>Olá, ${profile.name}!</p>
        <p>Sua senha foi resetada conforme solicitado.</p>
        <p>Sua nova senha temporária é:</p>
        <p><strong style="font-size: 18px; color: #2563eb;">${tempPassword}</strong></p>
        <p>Faça login em: <a href="https://controleinterno.netlify.app/auth">Dashboard de Compras</a></p>
        <p><strong>Importante:</strong> Por favor, altere sua senha após fazer login.</p>
        <br>
        <p>Se você não solicitou esta alteração, entre em contato com o administrador imediatamente.</p>
        <br>
        <p>Atenciosamente,<br>Equipe Dashboard de Compras</p>
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
