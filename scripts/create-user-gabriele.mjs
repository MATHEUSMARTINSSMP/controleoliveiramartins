import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  const email = 'gabrieleferreirabobato@gmail.com';
  const password = '123456';
  
  console.log('🔍 Verificando se profile existe...');
  
  // 1. Verificar se existe profile
  const { data: profile, error: profileError } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  if (profileError && profileError.code !== 'PGRST116') {
    console.error('❌ Erro ao buscar profile:', profileError);
    return;
  }
  
  if (profile) {
    console.log('✅ Profile encontrado:');
    console.log('   ID:', profile.id);
    console.log('   Nome:', profile.name);
    console.log('   Role:', profile.role);
    console.log('   Loja:', profile.store_default || 'Não definida');
    
    // 2. Criar usuário no Auth com o mesmo ID do profile
    console.log('\n🔄 Criando usuário no Auth...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: profile.name,
        role: profile.role
      }
    });
    
    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
      return;
    }
    
    console.log('✅ Usuário criado no Auth!');
    console.log('   ID:', newUser.user.id);
    
    // 3. Atualizar o ID do profile para corresponder ao ID do Auth
    console.log('\n🔄 Atualizando ID do profile...');
    
    // Primeiro, deletar o profile antigo
    const { error: deleteError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .delete()
      .eq('id', profile.id);
    
    if (deleteError) {
      console.error('❌ Erro ao deletar profile antigo:', deleteError);
    } else {
      console.log('✅ Profile antigo deletado');
    }
    
    // Criar novo profile com o ID correto
    const { error: insertError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .insert({
        id: newUser.user.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        cpf: profile.cpf,
        whatsapp: profile.whatsapp,
        limite_total: profile.limite_total,
        limite_mensal: profile.limite_mensal,
        store_id: profile.store_id,
        store_default: profile.store_default,
        active: true,
        is_active: true
      });
    
    if (insertError) {
      console.error('❌ Erro ao criar novo profile:', insertError);
    } else {
      console.log('✅ Novo profile criado com ID correto!');
    }
    
  } else {
    console.log('❌ Profile não encontrado. Criando do zero...');
    
    // Criar usuário e profile do zero
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: 'Gabriele Ferreira Bobato',
        role: 'COLABORADORA'
      }
    });
    
    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
      return;
    }
    
    console.log('✅ Usuário criado!');
    console.log('   ID:', newUser.user.id);
    
    // Criar profile
    const { error: insertError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .insert({
        id: newUser.user.id,
        name: 'Gabriele Ferreira Bobato',
        email: email,
        role: 'COLABORADORA',
        active: true,
        is_active: true,
        limite_total: 1000,
        limite_mensal: 800
      });
    
    if (insertError) {
      console.error('❌ Erro ao criar profile:', insertError);
    } else {
      console.log('✅ Profile criado!');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ USUÁRIO CRIADO COM SUCESSO!');
  console.log('📧 Email:', email);
  console.log('🔑 Senha:', password);
  console.log('🌐 Login em:', 'https://eleveaone.com.br');
  console.log('='.repeat(60));
}

createUser().catch(console.error);
