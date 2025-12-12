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
  const profileId = '7ce67086-8683-4423-b486-179ea2ac1ce0';
  const email = 'gabrielefreitaslobato@gmail.com';
  const password = '123456';
  
  console.log('🔍 Verificando profile existente...');
  
  // 1. Buscar profile existente
  const { data: profile, error: profileError } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();
  
  if (profileError) {
    console.error('❌ Erro ao buscar profile:', profileError);
    return;
  }
  
  console.log('✅ Profile encontrado:');
  console.log('   ID:', profile.id);
  console.log('   Nome:', profile.name);
  console.log('   Email:', profile.email);
  console.log('   CPF:', profile.cpf);
  console.log('   WhatsApp:', profile.whatsapp);
  console.log('   Loja:', profile.store_default);
  
  // 2. Criar usuário no Auth
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
  
  // 3. Deletar profile antigo
  console.log('\n🔄 Deletando profile antigo...');
  const { error: deleteError } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .delete()
    .eq('id', profileId);
  
  if (deleteError) {
    console.error('❌ Erro ao deletar profile antigo:', deleteError);
  } else {
    console.log('✅ Profile antigo deletado');
  }
  
  // 4. Criar novo profile com ID correto
  console.log('\n🔄 Criando novo profile com ID correto...');
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
      is_active: true,
      recebe_notificacoes_gincana: profile.recebe_notificacoes_gincana
    });
  
  if (insertError) {
    console.error('❌ Erro ao criar novo profile:', insertError);
  } else {
    console.log('✅ Novo profile criado com ID correto!');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ USUÁRIO CRIADO COM SUCESSO!');
  console.log('📧 Email:', email);
  console.log('🔑 Senha:', password);
  console.log('🌐 Login em:', 'https://eleveaone.com.br');
  console.log('='.repeat(60));
}

createUser().catch(console.error);
