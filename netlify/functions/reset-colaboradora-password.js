const { createClient } = require('@supabase/supabase-js');

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
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    );

    const { user_id, new_password, email } = JSON.parse(event.body || '{}');

    console.log('Resetting password for user:', user_id);

    // Update password with admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    console.log('Password updated successfully');

    // Note: When password is updated, Supabase automatically invalidates all existing sessions
    // No need to manually sign out - the old sessions will be invalid on next use
    // Attempting to signOut with userId can cause JWT errors, so we skip it
    
    console.log('Sessions will be automatically invalidated on next login attempt, sending email notification');

    // Send notification email via Netlify Function
    try {
      // Use NETLIFY_URL if available (set automatically by Netlify), otherwise use the site URL
      const netlifyUrl =
        process.env.NETLIFY_URL ||
        process.env.DEPLOY_PRIME_URL ||
        'https://eleveaone.com.br';
      const emailResponse = await fetch(`${netlifyUrl}/.netlify/functions/send-password-reset-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          new_password,
        }),
      });

      const emailData = await emailResponse.json();
      console.log('Email sent response:', emailData);

      if (!emailResponse.ok) {
        console.error('Email sending failed:', emailData);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request if email fails
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Senha resetada com sucesso' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(error) }),
    };
  }
};

