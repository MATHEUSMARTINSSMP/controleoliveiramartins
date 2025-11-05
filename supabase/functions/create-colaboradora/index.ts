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

    const { email, password, name, cpf, limite_total, limite_mensal } = await req.json()

    // Create user with admin client
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'COLABORADORA',
      }
    })

    if (authError) throw authError

    // Update profile with CPF and custom limits
    if (userData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          cpf: cpf,
          limite_total: parseFloat(limite_total),
          limite_mensal: parseFloat(limite_mensal),
        })
        .eq('id', userData.user.id)

      if (profileError) throw profileError

      // Send welcome email
      try {
        await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-welcome-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            },
            body: JSON.stringify({
              email,
              name,
              password,
            }),
          }
        )
      } catch (emailError) {
        console.error('Error sending email:', emailError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: userData.user }),
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
