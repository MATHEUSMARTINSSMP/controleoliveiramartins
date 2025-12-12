import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function investigate() {
  console.log('🔍 Investigando criação das Gabrieles...\n');
  
  // Buscar ambos os profiles
  const { data: profiles, error } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .or('email.eq.gabrieleferreirabobato@gmail.com,email.eq.gabrielefreitaslobato@gmail.com')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log('📊 Profiles encontrados:\n');
  
  for (const profile of profiles) {
    console.log('='.repeat(60));
    console.log(`👤 ${profile.name}`);
    console.log('='.repeat(60));
    console.log(`Email: ${profile.email}`);
    console.log(`ID do Profile: ${profile.id}`);
    console.log(`Criado em: ${profile.created_at}`);
    console.log(`Atualizado em: ${profile.updated_at}`);
    console.log(`Loja: ${profile.store_default}`);
    console.log(`CPF: ${profile.cpf || 'Não informado'}`);
    console.log(`WhatsApp: ${profile.whatsapp || 'Não informado'}`);
    
    // Verificar se existe usuário Auth
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData.users.find(u => u.email?.toLowerCase() === profile.email?.toLowerCase());
    
    if (authUser) {
      console.log(`\n✅ TEM Auth User:`);
      console.log(`   ID do Auth: ${authUser.id}`);
      console.log(`   IDs correspondem? ${authUser.id === profile.id ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   Criado em: ${authUser.created_at}`);
      console.log(`   Email confirmado: ${authUser.email_confirmed_at ? '✅ SIM' : '❌ NÃO'}`);
    } else {
      console.log(`\n❌ NÃO TEM Auth User`);
    }
    
    console.log('');
  }
  
  // Análise temporal
  console.log('\n' + '='.repeat(60));
  console.log('📅 ANÁLISE TEMPORAL');
  console.log('='.repeat(60));
  
  const gabrieleFerreira = profiles.find(p => p.email === 'gabrieleferreirabobato@gmail.com');
  const gabrieleLobato = profiles.find(p => p.email === 'gabrielefreitaslobato@gmail.com');
  
  if (gabrieleFerreira && gabrieleLobato) {
    const dateF = new Date(gabrieleFerreira.created_at);
    const dateL = new Date(gabrieleLobato.created_at);
    
    console.log(`\nGabriele Ferreira Bobato: ${dateF.toLocaleString('pt-BR')}`);
    console.log(`Gabriele Lobato de Freitas: ${dateL.toLocaleString('pt-BR')}`);
    
    if (dateF < dateL) {
      const diffMs = dateL - dateF;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      console.log(`\n⏰ Gabriele Ferreira foi criada ${diffDays} dias e ${diffHours} horas ANTES`);
      console.log(`\n💡 CONCLUSÃO: Gabriele Ferreira foi criada quando a função`);
      console.log(`   create-colaboradora ainda tinha o bug que não criava Auth user.`);
      console.log(`   Gabriele Lobato foi criada depois, quando o bug já estava corrigido.`);
    } else {
      console.log(`\n⏰ Gabriele Lobato foi criada ANTES`);
    }
  }
}

investigate().catch(console.error);
