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

    console.log('Searching for user with identifier:', identifier)

    // Search for user by email, CPF, or name
    const { data: profiles, error: searchError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, cpf')
      .or(`email.eq.${identifier},cpf.eq.${identifier},name.ilike.${identifier}`)
      .eq('active', true)
      .limit(1)

    if (searchError) {
      console.error('Error searching for user:', searchError)
      throw searchError
    }

    if (!profiles || profiles.length === 0) {
      console.log('User not found')
      return new Response(
        JSON.stringify({ success: false, message: 'Usuário não encontrado' }),
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

    console.log('Password updated successfully, invalidating sessions')

    // Sign out all sessions for this user
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(profile.id)
    
    if (signOutError) {
      console.error('Error signing out user:', signOutError)
      // Continue anyway - password was updated
    }

    console.log('Sessions invalidated, sending email')

    // Send password reset email via Resend
    const emailResponse = await resend.emails.send({
      from: "Dashboard de Compras <teste@eleveaagencia.com.br>",
      to: [profile.email],
      subject: "Recuperação de Senha - Dashboard de Compras",
      html: `
        <h1>Recuperação de Senha</h1>
        <p>Olá, ${profile.name}!</p>
        <p>Sua senha foi resetada conforme solicitado.</p>
        <p>Sua nova senha temporária é:</p>
        <p><strong style="font-size: 18px; color: #2563eb;">${tempPassword}</strong></p>
        <p>Faça login em: <a href="${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovableproject.com') || 'https://51fd7933-ecd0-4561-8a16-223b4ee29b63.lovableproject.com'}/auth">Dashboard de Compras</a></p>
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
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
