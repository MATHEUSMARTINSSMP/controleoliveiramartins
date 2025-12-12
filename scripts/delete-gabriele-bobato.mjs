import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteGabrieleBobato() {
  const email = 'gabrieleferreirabobato@gmail.com';
  const userId = '47e05718-7d48-41b5-8cc3-6ec1d8930de2';
  
  console.log('🗑️  Deletando Gabriele Ferreira Bobato...\n');
  console.log('Email:', email);
  console.log('User ID:', userId);
  console.log('');
  
  // 1. Deletar profile
  console.log('🔄 Deletando profile...');
  const { error: profileError } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .delete()
    .eq('id', userId);
  
  if (profileError) {
    console.error('❌ Erro ao deletar profile:', profileError);
  } else {
    console.log('✅ Profile deletado');
  }
  
  // 2. Deletar usuário Auth
  console.log('\n🔄 Deletando usuário Auth...');
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  
  if (authError) {
    console.error('❌ Erro ao deletar Auth user:', authError);
  } else {
    console.log('✅ Auth user deletado');
  }
  
  // 3. Verificar se foi deletado
  console.log('\n🔍 Verificando...');
  
  const { data: profileCheck } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authCheck = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 VERIFICAÇÃO FINAL');
  console.log('='.repeat(60));
  console.log('Profile existe?', profileCheck ? '❌ SIM (ERRO!)' : '✅ NÃO');
  console.log('Auth user existe?', authCheck ? '❌ SIM (ERRO!)' : '✅ NÃO');
  console.log('='.repeat(60));
  
  if (!profileCheck && !authCheck) {
    console.log('\n✅ SUCESSO! Gabriele Ferreira Bobato foi completamente removida.');
    console.log('✅ Apenas Gabriele Lobato de Freitas permanece no sistema.');
  } else {
    console.log('\n⚠️ ATENÇÃO! Ainda existem registros. Verifique manualmente.');
  }
}

deleteGabrieleBobato().catch(console.error);
