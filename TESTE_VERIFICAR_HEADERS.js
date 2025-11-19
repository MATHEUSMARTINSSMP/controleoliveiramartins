// ============================================
// TESTE PARA VERIFICAR SE AMBOS OS HEADERS ESTÃO SENDO ENVIADOS
// Execute no console após o build ser atualizado
// ============================================

(async () => {
  console.log('🔍 VERIFICANDO HEADERS...\n');
  
  const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp';
  const SCHEMA = 'sacadaohboy-mrkitsch-loungerie';
  
  // Teste com AMBOS os headers
  console.log('Testando com Accept-Profile E Content-Profile...');
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Accept-Profile': SCHEMA,      // ← IMPORTANTE para SELECT
          'Content-Profile': SCHEMA,     // ← Para INSERT/UPDATE/DELETE
        },
      }
    );
    
    const data = await response.json();
    const acceptProfile = response.headers.get('accept-profile');
    const contentProfile = response.headers.get('content-profile');
    
    console.log('Status:', response.status);
    console.log('Response Headers:');
    console.log('  - accept-profile:', acceptProfile);
    console.log('  - content-profile:', contentProfile);
    console.log('Dados:', data);
    
    if (response.status === 200 && contentProfile === SCHEMA) {
      console.log('✅ SUCESSO! PostgREST reconheceu o schema!');
      if (data.length === 0) {
        console.log('⚠️ Array vazio - pode ser que não há dados na tabela ou problema de RLS');
      }
    } else if (response.status === 200 && !contentProfile) {
      console.log('⚠️ Status 200 mas content-profile está null - PostgREST pode não estar reconhecendo o schema');
    } else {
      console.log('❌ Erro:', data);
    }
  } catch (e) {
    console.error('❌ EXCEÇÃO:', e);
  }
  
  console.log('\n📋 INSTRUÇÕES:');
  console.log('1. Vá na aba Network do DevTools');
  console.log('2. Encontre a requisição para /rest/v1/profiles');
  console.log('3. Clique e vá em "Headers"');
  console.log('4. Verifique se AMBOS os headers estão presentes:');
  console.log('   - Accept-Profile: sacadaohboy-mrkitsch-loungerie');
  console.log('   - Content-Profile: sacadaohboy-mrkitsch-loungerie');
})();

