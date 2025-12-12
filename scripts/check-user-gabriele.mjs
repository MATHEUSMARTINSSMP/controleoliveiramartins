import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUser() {
  const email = 'gabrieleferreirabobato@gmail.com';
  
  console.log('🔍 Verificando usuário:', email);
  console.log('='.repeat(60));
  
  const { data: users, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Erro ao listar usuários:', authError);
    return;
  }
  
  const user = users.users.find(u => u.email === email);
  
  if (!user) {
    console.error('❌ Usuário não encontrado no Auth!');
    return;
  }
  
  console.log('\n✅ Usuário encontrado no Auth:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Email Confirmado:', user.email_confirmed_at ? '✅ SIM' : '❌ NÃO');
  console.log('   Criado em:', user.created_at);
  console.log('   Último login:', user.last_sign_in_at || 'Nunca');
  console.log('   Banido até:', user.banned_until || 'Não banido');
  
  const { data: profile, error: profileError } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  if (profileError) {
    console.error('\n❌ Erro ao buscar profile:', profileError);
  } else if (!profile) {
    console.error('\n❌ Profile não encontrado!');
  } else {
    console.log('\n✅ Profile encontrado:');
    console.log('   ID:', profile.id);
    console.log('   Nome:', profile.name);
    console.log('   Role:', profile.role);
    console.log('   Ativo (active):', profile.active ? '✅ SIM' : '❌ NÃO');
    console.log('   Ativo (is_active):', profile.is_active ? '✅ SIM' : '❌ NÃO');
    console.log('   Loja:', profile.store_default || profile.store_id || 'Não definida');
  }
  
  console.log('\n🔄 Resetando senha para: 123456');
  const { error: resetError } = await supabase.auth.admin.updateUserById(user.id, {
    password: '123456'
  });
  
  if (resetError) {
    console.error('❌ Erro ao resetar senha:', resetError);
  } else {
    console.log('✅ Senha resetada com sucesso!');
  }
  
  if (!user.email_confirmed_at) {
    console.log('\n🔄 Confirmando email...');
    const { error: confirmError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });
    
    if (confirmError) {
      console.error('❌ Erro ao confirmar email:', confirmError);
    } else {
      console.log('✅ Email confirmado!');
    }
  }
  
  if (!profile?.active || !profile?.is_active) {
    console.log('\n🔄 Ativando profile...');
    const { error: activateError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .update({ active: true, is_active: true })
      .eq('id', user.id);
    
    if (activateError) {
      console.error('❌ Erro ao ativar profile:', activateError);
    } else {
      console.log('✅ Profile ativado!');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ VERIFICAÇÃO CONCLUÍDA!');
  console.log('📧 Email:', email);
  console.log('🔑 Senha:', '123456');
  console.log('🌐 Login em:', 'https://eleveaone.com.br');
  console.log('='.repeat(60));
}

checkUser().catch(console.error);
