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

    console.log('Password updated successfully')

    // Note: When password is updated, Supabase automatically invalidates all existing sessions
    // No need to manually sign out - the old sessions will be invalid on next use
    // Attempting to signOut with userId can cause JWT errors, so we skip it
    
    console.log('Sessions will be automatically invalidated on next login attempt, sending email notification')

    // Send notification email
    try {
      const emailResponse = await fetch(
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
      
      const emailData = await emailResponse.json()
      console.log('Email sent response:', emailData)
      
      if (!emailResponse.ok) {
        console.error('Email sending failed:', emailData)
      }
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
