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

    const usuarios = [
      { name: 'Admin', email: 'admin@local', role: 'ADMIN' },
      { name: 'Emilly', email: 'emilly@local', role: 'COLABORADORA' },
      { name: 'Naíma', email: 'naima@local', role: 'COLABORADORA' },
      { name: 'Karol', email: 'karol@local', role: 'COLABORADORA' },
      { name: 'Rosana', email: 'rosana@local', role: 'COLABORADORA' },
      { name: 'Bruna', email: 'bruna@local', role: 'COLABORADORA' },
      { name: 'Fernanda', email: 'fernanda@local', role: 'COLABORADORA' },
      { name: 'Ingred', email: 'ingred@local', role: 'COLABORADORA' },
      { name: 'Daniel', email: 'daniel@local', role: 'COLABORADORA' },
      { name: 'Michelle', email: 'michelle@local', role: 'COLABORADORA' },
      { name: 'Ramayane', email: 'ramayane@local', role: 'COLABORADORA' },
      { name: 'Ellen', email: 'ellen@local', role: 'COLABORADORA' },
      { name: 'Letícia', email: 'leticia@local', role: 'COLABORADORA' },
    ]

    const results = []
    for (const user of usuarios) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: '123456',
        email_confirm: true,
        user_metadata: { name: user.name, role: user.role }
      })
      
      if (error && !error.message.includes('already')) {
        console.error(`Erro ao criar ${user.email}:`, error)
      } else {
        results.push({ email: user.email, success: !error })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
