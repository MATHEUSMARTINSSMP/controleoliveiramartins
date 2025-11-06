import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { user_id, new_password, email } = await req.json()

    console.log('Resetting password for user:', user_id)

    // Update password with admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      throw updateError
    }

    console.log('Password updated successfully, invalidating sessions')

    // Sign out all sessions for this user to force re-login with new password
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(user_id)
    
    if (signOutError) {
      console.error('Error signing out user:', signOutError)
      // Continue anyway - password was updated
    }

    console.log('Sessions invalidated, sending email notification')

    // Send notification email
    try {
      await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-password-reset-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          },
          body: JSON.stringify({
            email,
            new_password,
          }),
        }
      )
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Senha resetada com sucesso' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
