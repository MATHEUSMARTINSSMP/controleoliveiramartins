import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createProfile() {
  const userId = '47e05718-7d48-41b5-8cc3-6ec1d8930de2';
  const email = 'gabrieleferreirabobato@gmail.com';
  
  console.log('🔄 Criando profile para usuário:', userId);
  
  // Criar profile
  const { data, error } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .insert({
      id: userId,
      name: 'Gabriele Ferreira Bobato',
      email: email,
      role: 'COLABORADORA',
      is_active: true,
      limite_total: 1000,
      limite_mensal: 800
    })
    .select();
  
  if (error) {
    console.error('❌ Erro ao criar profile:', error);
    return;
  }
  
  console.log('✅ Profile criado com sucesso!');
  console.log('   Dados:', data);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ TUDO PRONTO!');
  console.log('📧 Email:', email);
  console.log('🔑 Senha:', '123456');
  console.log('🌐 Login em:', 'https://eleveaone.com.br');
  console.log('='.repeat(60));
}

createProfile().catch(console.error);
