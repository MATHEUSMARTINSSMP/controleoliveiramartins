// ============================================
// TESTE RÁPIDO PARA CONSOLE DO NAVEGADOR
// Cole este código no console (F12 > Console)
// ============================================

(async () => {
  console.log('🧪 INICIANDO TESTES...\n');
  
  const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp';
  const SCHEMA = 'sacadaohboy-mrkitsch-loungerie';
  
  // TESTE 1: Com Supabase client (como está sendo usado no código)
  console.log('1️⃣ Testando com Supabase client...');
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from("profiles")
      .select("id, name")
      .limit(1);
    
    if (error) {
      console.error('❌ ERRO:', error.message);
      console.error('   Código:', error.code);
      console.error('   Detalhes:', error);
    } else {
      console.log('✅ SUCESSO:', data);
    }
  } catch (e) {
    console.error('❌ EXCEÇÃO:', e);
  }
  
  // TESTE 2: Com fetch direto (bypass Supabase client)
  console.log('\n2️⃣ Testando com fetch direto (bypass cliente)...');
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Accept-Profile': SCHEMA,
          'Content-Profile': SCHEMA,
        },
      }
    );
    
    const data = await response.json();
    const contentProfile = response.headers.get('content-profile');
    
    console.log('Status:', response.status);
    console.log('Content-Profile header:', contentProfile);
    
    if (response.status === 200) {
      console.log('✅ SUCESSO:', data);
    } else {
      console.error('❌ ERRO HTTP:', data);
    }
  } catch (e) {
    console.error('❌ EXCEÇÃO:', e);
  }
  
  // TESTE 3: Verificar headers enviados
  console.log('\n3️⃣ Verifique a aba Network do DevTools:');
  console.log('   - Procure por requisições para /rest/v1/profiles');
  console.log('   - Clique na requisição e vá em "Headers"');
  console.log('   - Verifique se "Accept-Profile" está presente nos Request Headers');
  console.log('   - Verifique o valor de "content-profile" nos Response Headers');
  
  console.log('\n✅ TESTES CONCLUÍDOS!');
})();

