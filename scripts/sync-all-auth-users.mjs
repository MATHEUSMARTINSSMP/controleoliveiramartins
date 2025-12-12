import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function syncAllAuthUsers() {
  console.log('🔍 Buscando todos os profiles de COLABORADORAS...\n');
  
  // 1. Buscar todos os profiles de colaboradoras
  const { data: profiles, error: profilesError } = await supabase
    .schema('sistemaretiradas')
    .from('profiles')
    .select('*')
    .eq('role', 'COLABORADORA')
    .eq('is_active', true);
  
  if (profilesError) {
    console.error('❌ Erro ao buscar profiles:', profilesError);
    return;
  }
  
  console.log(`✅ Encontrados ${profiles.length} profiles de colaboradoras\n`);
  
  // 2. Buscar todos os usuários do Auth
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Erro ao listar usuários do Auth:', authError);
    return;
  }
  
  const authUsers = authData.users;
  console.log(`✅ Encontrados ${authUsers.length} usuários no Auth\n`);
  
  // 3. Identificar profiles sem usuário Auth
  const profilesWithoutAuth = [];
  
  for (const profile of profiles) {
    const authUser = authUsers.find(u => u.email?.toLowerCase() === profile.email?.toLowerCase());
    
    if (!authUser) {
      profilesWithoutAuth.push(profile);
    }
  }
  
  console.log('='.repeat(60));
  console.log(`📊 RESUMO:`);
  console.log(`   Total de profiles: ${profiles.length}`);
  console.log(`   Profiles SEM Auth: ${profilesWithoutAuth.length}`);
  console.log(`   Profiles COM Auth: ${profiles.length - profilesWithoutAuth.length}`);
  console.log('='.repeat(60));
  
  if (profilesWithoutAuth.length === 0) {
    console.log('\n✅ Todos os profiles já têm usuários Auth correspondentes!');
    return;
  }
  
  console.log(`\n🔄 Criando usuários Auth para ${profilesWithoutAuth.length} profiles...\n`);
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const profile of profilesWithoutAuth) {
    console.log(`\n📝 Processando: ${profile.name} (${profile.email})`);
    
    try {
      // Criar usuário no Auth
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: profile.email.toLowerCase(),
        password: '123456', // Senha padrão temporária
        email_confirm: true,
        user_metadata: {
          name: profile.name,
          role: profile.role
        }
      });
      
      if (createError) {
        console.error(`   ❌ Erro ao criar usuário:`, createError.message);
        results.failed.push({ profile, error: createError.message });
        continue;
      }
      
      console.log(`   ✅ Usuário Auth criado! ID: ${newUser.user.id}`);
      
      // Deletar profile antigo
      const { error: deleteError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .delete()
        .eq('id', profile.id);
      
      if (deleteError) {
        console.error(`   ⚠️ Erro ao deletar profile antigo:`, deleteError.message);
      } else {
        console.log(`   ✅ Profile antigo deletado`);
      }
      
      // Criar novo profile com ID correto
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
          recebe_notificacoes_gincana: profile.recebe_notificacoes_gincana || true,
          tiny_vendedor_id: profile.tiny_vendedor_id
        });
      
      if (insertError) {
        console.error(`   ❌ Erro ao criar novo profile:`, insertError.message);
        results.failed.push({ profile, error: insertError.message });
      } else {
        console.log(`   ✅ Novo profile criado com ID correto!`);
        results.success.push({
          name: profile.name,
          email: profile.email,
          oldId: profile.id,
          newId: newUser.user.id
        });
      }
      
      // Aguardar 500ms entre criações para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Erro inesperado:`, error.message);
      results.failed.push({ profile, error: error.message });
    }
  }
  
  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADO FINAL:');
  console.log('='.repeat(60));
  console.log(`✅ Sucesso: ${results.success.length}`);
  console.log(`❌ Falhas: ${results.failed.length}`);
  console.log('='.repeat(60));
  
  if (results.success.length > 0) {
    console.log('\n✅ USUÁRIOS CRIADOS COM SUCESSO:');
    results.success.forEach(r => {
      console.log(`   - ${r.name} (${r.email})`);
      console.log(`     Senha temporária: 123456`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ FALHAS:');
    results.failed.forEach(r => {
      console.log(`   - ${r.profile.name} (${r.profile.email})`);
      console.log(`     Erro: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔑 IMPORTANTE: Todas as senhas temporárias são: 123456');
  console.log('📧 Recomende que as colaboradoras alterem a senha no primeiro login');
  console.log('='.repeat(60));
}

syncAllAuthUsers().catch(console.error);
