const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Validate environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RESEND_API_KEY) {
      console.error('Missing environment variables:', {
        hasUrl: !!process.env.SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasResendKey: !!process.env.RESEND_API_KEY,
      });
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Configuração do servidor incompleta. Verifique as variáveis de ambiente.',
        }),
      };
    }

    // Initialize Resend inside handler to ensure env vars are available
    const resend = new Resend(process.env.RESEND_API_KEY);

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    );

    const { identifier } = JSON.parse(event.body || '{}');

    if (!identifier || typeof identifier !== 'string') {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Identificador inválido' }),
      };
    }

    // Normalize identifier: trim, lowercase, remove extra spaces
    let searchIdentifier = identifier.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // If it looks like an email, normalize it further
    if (searchIdentifier.includes('@')) {
      // Normalize email: lowercase, remove spaces, trim
      const emailParts = searchIdentifier.split('@');
      if (emailParts.length === 2) {
        const localPart = emailParts[0].replace(/\s+/g, '').toLowerCase();
        const domainPart = emailParts[1].replace(/\s+/g, '').toLowerCase();
        searchIdentifier = `${localPart}@${domainPart}`;
      }
    }
    
    console.log('Original identifier:', identifier);
    console.log('Normalized identifier:', searchIdentifier);

    // Search for user by email (case insensitive), CPF, or name (case insensitive)
    let profiles = null;
    let searchError = null;

    // First try: exact email match (case insensitive)
    // Try exact match first, then ilike if needed
    console.log('Attempting email search for:', searchIdentifier);
    
    let emailMatch = null;
    let emailError = null;
    
    // Search only in sistemaretiradas schema
    const schemaName = 'sistemaretiradas';
    
    // Try exact match first (faster)
    if (searchIdentifier.includes('@')) {
      console.log(`Trying exact email match in schema: ${schemaName}`);
      const { data: exactMatch, error: exactError } = await supabaseAdmin
        .schema(schemaName)
        .from('profiles')
        .select('id, name, email, cpf, active')
        .eq('email', searchIdentifier)
        .limit(1);
      
      if (exactError) {
        console.error(`Exact email search error:`, exactError);
        emailError = exactError;
      } else if (exactMatch && exactMatch.length > 0) {
        emailMatch = exactMatch;
        console.log(`User found by exact email match:`, exactMatch[0].email);
      }
    }
    
    // If exact match didn't work, try case-insensitive
    if (!emailMatch && !emailError && searchIdentifier.includes('@')) {
      console.log(`Trying case-insensitive email search in schema: ${schemaName}`);
      const { data: ilikeMatch, error: ilikeError } = await supabaseAdmin
        .schema(schemaName)
        .from('profiles')
        .select('id, name, email, cpf, active')
        .ilike('email', searchIdentifier)
        .limit(1);
      
      if (ilikeError) {
        console.error(`Case-insensitive email search error:`, ilikeError);
        emailError = ilikeError;
      } else if (ilikeMatch && ilikeMatch.length > 0) {
        emailMatch = ilikeMatch;
        console.log(`User found by case-insensitive email match:`, ilikeMatch[0].email);
      }
    }

    if (emailError) {
      console.error('Email search error:', emailError);
      searchError = emailError;
    } else if (emailMatch && emailMatch.length > 0) {
      console.log('User found by email:', emailMatch[0].email);
      profiles = emailMatch;
    } else {
      console.log('No email match, trying CPF...');
      // Second try: CPF match
      console.log(`Trying CPF search in schema: ${schemaName}`);
      const { data: cpfMatch, error: cpfError } = await supabaseAdmin
        .schema(schemaName)
        .from('profiles')
        .select('id, name, email, cpf, active')
        .eq('cpf', searchIdentifier)
        .limit(1);

      if (cpfError) {
        console.error('CPF search error:', cpfError);
        searchError = cpfError;
      } else if (cpfMatch && cpfMatch.length > 0) {
        console.log('User found by CPF:', cpfMatch[0].email);
        profiles = cpfMatch;
      } else {
        console.log('No CPF match, trying name...');
        // Third try: name match (case insensitive, partial)
        console.log(`Trying name search in schema: ${schemaName}`);
        const { data: nameMatch, error: nameError } = await supabaseAdmin
          .schema(schemaName)
          .from('profiles')
          .select('id, name, email, cpf, active')
          .ilike('name', `%${searchIdentifier}%`)
          .limit(1);

        if (nameError) {
          console.error('Name search error:', nameError);
          searchError = nameError;
        } else if (nameMatch && nameMatch.length > 0) {
          console.log('User found by name:', nameMatch[0].email);
          profiles = nameMatch;
        } else {
          console.log('No user found with any search method');
        }
      }
    }

    if (searchError) {
      console.error('Error searching for user:', searchError);
      console.error('Search error details:', JSON.stringify(searchError, null, 2));
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Erro ao buscar usuário no banco de dados',
          error: searchError.message || String(searchError),
          details: searchError.details || searchError.hint || null,
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
    console.log('User found:', profile.email, 'ID:', profile.id, 'Active:', profile.active);

    // Check if user is active (if active field exists and is false, skip)
    if (profile.active === false) {
      console.log('User is inactive:', profile.email);
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Usuário inativo. Entre em contato com o administrador.',
        }),
      };
    }

    // Use id (which is the UUID from auth.users) - the id field in profiles table is the auth.users.id
    const userId = profile.id;
    if (!userId) {
      console.error('No user ID found in profile:', JSON.stringify(profile, null, 2));
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Erro: ID do usuário não encontrado no perfil',
          debug: 'Profile data: ' + JSON.stringify(profile),
        }),
      };
    }

    console.log('Profile data:', JSON.stringify(profile, null, 2));
    console.log('Using user ID for password update:', userId);

    // Generate a temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8).toUpperCase();

    // Update password with admin client using uuid
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: tempPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    console.log('Password updated successfully');

    // Note: When password is updated, Supabase automatically invalidates all existing sessions
    // No need to manually sign out - the old sessions will be invalid on next use
    // Attempting to signOut with userId can cause JWT errors, so we skip it
    
    console.log('Sessions will be automatically invalidated on next login attempt, sending email');

    // Send password reset email via Resend
    try {
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
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Password was already updated, so we return success but log the email error
      // The user can still login with the new password
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Senha atualizada com sucesso, mas houve um erro ao enviar o email. Entre em contato com o administrador.',
          warning: 'Email não enviado',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Email enviado com sucesso' }),
    };
  } catch (error) {
    console.error('Error in request-password-reset:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Erro ao processar solicitação de recuperação de senha',
        error: error.message || String(error),
      }),
    };
  }
};

