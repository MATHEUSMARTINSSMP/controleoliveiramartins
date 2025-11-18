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
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
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

    console.log('Password updated successfully, invalidating sessions');

    // Sign out all sessions for this user to force re-login with new password
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(user_id);

    if (signOutError) {
      console.error('Error signing out user:', signOutError);
      // Continue anyway - password was updated
    } else {
      console.log('Sessions invalidated successfully');
    }

    console.log('Sending email notification');

    // Send notification email via Netlify Function
    try {
      // Use NETLIFY_URL if available (set automatically by Netlify), otherwise use the site URL
      const netlifyUrl =
        process.env.NETLIFY_URL ||
        process.env.DEPLOY_PRIME_URL ||
        'https://controleinterno.netlify.app';
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

