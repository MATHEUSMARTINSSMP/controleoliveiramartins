// ============================================
// TESTE SIMPLES PARA CONSOLE DO NAVEGADOR
// Cole este código no console (F12 > Console)
// NÃO usa import.meta (que não funciona no console)
// ============================================

(async () => {
  console.log('🧪 TESTE DE CONFIGURAÇÃO DO SUPABASE\n');
  
  // Teste 1: Verificar se o supabase client está disponível
  try {
    // Tentar acessar o supabase através do window (se estiver exposto)
    const supabaseClient = window.supabase || (await import('/src/integrations/supabase/client.ts')).supabase;
    console.log('✅ Cliente Supabase encontrado');
  } catch (e) {
    console.log('⚠️ Cliente Supabase não acessível diretamente (normal)');
  }
  
  // Teste 2: Testar requisição direta com fetch
  console.log('\n📡 Testando requisição direta ao Supabase...');
  
  const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp';
  const SCHEMA = 'sistemaretiradas';
  
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
    console.log('Content-Profile na resposta:', contentProfile);
    console.log('Dados:', data);
    
    if (response.status === 200) {
      if (contentProfile === SCHEMA) {
        console.log('✅ PostgREST reconheceu o schema sistemaretiradas!');
      } else if (contentProfile === null) {
        console.log('⚠️ PostgREST não retornou content-profile - schema pode não estar configurado');
      } else {
        console.log('⚠️ PostgREST retornou schema diferente:', contentProfile);
      }
      
      if (data.length === 0) {
        console.log('⚠️ Array vazio - pode ser que não há dados ou problema de RLS');
      } else {
        console.log('✅ Dados retornados com sucesso!');
      }
    } else if (response.status === 404) {
      console.log('❌ 404 - Tabela não encontrada no schema sistemaretiradas');
      console.log('   Verifique se o script RENOMEAR_SCHEMA.sql foi executado no Supabase');
    } else {
      console.log('❌ Erro HTTP:', response.status, data);
    }
  } catch (e) {
    console.error('❌ Erro na requisição:', e);
  }
  
  // Teste 3: Verificar se há erros na aba Network
  console.log('\n📋 INSTRUÇÕES:');
  console.log('1. Vá na aba Network do DevTools');
  console.log('2. Recarregue a página (F5)');
  console.log('3. Encontre requisições para /rest/v1/profiles');
  console.log('4. Clique em uma requisição e vá em "Headers"');
  console.log('5. Verifique se os headers estão presentes:');
  console.log('   - apikey: [deve estar presente]');
  console.log('   - Accept-Profile: sistemaretiradas');
  console.log('   - Content-Profile: sistemaretiradas');
  console.log('6. Verifique o status code da resposta');
  console.log('7. Se for 404, verifique se o schema foi renomeado no Supabase');
  
  console.log('\n✅ TESTE CONCLUÍDO!');
})();

