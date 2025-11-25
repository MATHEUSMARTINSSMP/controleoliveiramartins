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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        db: {
          schema: 'sistemaretiradas',
        },
      }
    )

    const email = 'dev@dev.com'
    const password = '123456'
    const name = 'Desenvolvedor'

    // Verificar se usuário já existe
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUser?.users?.find(u => u.email === email)

    let userId: string

    if (userExists) {
      userId = userExists.id
      console.log(`[create-dev-user] Usuário ${email} já existe: ${userId}`)
    } else {
      // Criar usuário no auth
      const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: 'ADMIN',
        },
      })

      if (authError) {
        throw new Error(`Erro ao criar usuário no auth: ${authError.message}`)
      }

      if (!userData?.user?.id) {
        throw new Error('Usuário criado mas ID não retornado')
      }

      userId = userData.user.id
      console.log(`[create-dev-user] Usuário ${email} criado: ${userId}`)
    }

    // Aguardar um pouco para garantir que o usuário está persistido
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verificar se profile já existe
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existingProfile) {
      // Atualizar para garantir que é ADMIN
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          name,
          email,
          role: 'ADMIN',
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateError) {
        throw new Error(`Erro ao atualizar profile: ${updateError.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Profile atualizado para ${email}`,
          user_id: userId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Criar profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          name,
          email,
          role: 'ADMIN',
          active: true,
          limite_total: 999999.00,
          limite_mensal: 999999.00,
        })

      if (profileError) {
        throw new Error(`Erro ao criar profile: ${profileError.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Usuário ${email} e profile criados com sucesso!`,
          user_id: userId,
          credentials: {
            email: 'dev@dev.com',
            password: '123456',
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error: any) {
    console.error('[create-dev-user] Erro:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

