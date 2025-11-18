import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { identifier } = JSON.parse(event.body || '{}');

    if (!identifier || typeof identifier !== 'string') {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Identificador inválido' }),
      };
    }

    const searchIdentifier = identifier.trim();
    console.log('Searching for user with identifier:', searchIdentifier);

    // Search for user by email (case insensitive), CPF, or name (case insensitive)
    let profiles = null;
    let searchError = null;

    // First try: exact email match (case insensitive)
    const { data: emailMatch, error: emailError } = await supabaseAdmin
      .schema('sacadaohboy-mrkitsch-loungerie')
      .from('profiles')
      .select('id, name, email, cpf')
      .ilike('email', searchIdentifier)
      .eq('active', true)
      .limit(1);

    if (emailMatch && emailMatch.length > 0) {
      profiles = emailMatch;
    } else {
      // Second try: CPF match
      const { data: cpfMatch, error: cpfError } = await supabaseAdmin
        .schema('sacadaohboy-mrkitsch-loungerie')
        .from('profiles')
        .select('id, name, email, cpf')
        .eq('cpf', searchIdentifier)
        .eq('active', true)
        .limit(1);

      if (cpfMatch && cpfMatch.length > 0) {
        profiles = cpfMatch;
      } else {
        // Third try: name match (case insensitive, partial)
        const { data: nameMatch, error: nameError } = await supabaseAdmin
          .schema('sacadaohboy-mrkitsch-loungerie')
          .from('profiles')
          .select('id, name, email, cpf')
          .ilike('name', `%${searchIdentifier}%`)
          .eq('active', true)
          .limit(1);

        if (nameMatch && nameMatch.length > 0) {
          profiles = nameMatch;
        } else {
          searchError = nameError || cpfError || emailError;
        }
      }
    }

    if (searchError) {
      console.error('Error searching for user:', searchError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Erro ao buscar usuário',
          error: String(searchError),
        }),
      };
    }

    if (!profiles || profiles.length === 0) {
      console.log('User not found with identifier:', searchIdentifier);
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: `Usuário não encontrado. Verifique se o email, CPF ou nome estão corretos.`,
        }),
      };
    }

    const profile = profiles[0];
    console.log('User found:', profile.email);

    // Generate a temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8).toUpperCase();

    console.log('Updating password for user:', profile.id);

    // Update password with admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    console.log('Password updated successfully, invalidating sessions');

    // Sign out all sessions for this user
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(profile.id);

    if (signOutError) {
      console.error('Error signing out user:', signOutError);
      // Continue anyway - password was updated
    }

    console.log('Sessions invalidated, sending email');

    // Send password reset email via Resend
    const emailResponse = await resend.emails.send({
      from: 'Dashboard de Compras <senhas@eleveaagencia.com.br>',
      to: [profile.email],
      subject: 'Recuperação de Senha - Dashboard de Compras',
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

    console.log('Email sent successfully:', emailResponse);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Email enviado com sucesso' }),
    };
  } catch (error) {
    console.error('Error in request-password-reset:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Erro ao processar solicitação de recuperação de senha',
        error: String(error),
      }),
    };
  }
};

