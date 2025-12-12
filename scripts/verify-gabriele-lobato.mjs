import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verify() {
  const email = 'gabrielefreitaslobato@gmail.com';
  
  console.log('✅ Verificando Gabriele Lobato de Freitas...\n');
  
  // Buscar profile
  const { data: profile } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  // Buscar auth user
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUser = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  
  console.log('='.repeat(60));
  console.log('👤 GABRIELE LOBATO DE FREITAS');
  console.log('='.repeat(60));
  console.log('📧 Email:', profile.email);
  console.log('🆔 Profile ID:', profile.id);
  console.log('🔑 Auth ID:', authUser.id);
  console.log('✅ IDs correspondem?', profile.id === authUser.id ? 'SIM' : 'NÃO');
  console.log('');
  console.log('📋 DADOS COMPLETOS:');
  console.log('   Nome:', profile.name);
  console.log('   CPF:', profile.cpf);
  console.log('   WhatsApp:', profile.whatsapp);
  console.log('   Loja:', profile.store_default);
  console.log('   Loja ID:', profile.store_id);
  console.log('   Limite Total:', profile.limite_total);
  console.log('   Limite Mensal:', profile.limite_mensal);
  console.log('   Ativo:', profile.is_active ? 'SIM' : 'NÃO');
  console.log('');
  console.log('🔐 AUTH STATUS:');
  console.log('   Email confirmado:', authUser.email_confirmed_at ? 'SIM' : 'NÃO');
  console.log('   Último login:', authUser.last_sign_in_at || 'Nunca');
  console.log('');
  console.log('='.repeat(60));
  console.log('🔑 CREDENCIAIS DE LOGIN:');
  console.log('   Email: gabrielefreitaslobato@gmail.com');
  console.log('   Senha: 123456');
  console.log('   URL: https://eleveaone.com.br');
  console.log('='.repeat(60));
}

verify().catch(console.error);
