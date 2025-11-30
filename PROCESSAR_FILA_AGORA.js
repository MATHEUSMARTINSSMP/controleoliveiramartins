/**
 * Script: Processar Fila de WhatsApp de Cashback AGORA
 * 
 * Execute este script para processar manualmente a fila de WhatsApp
 * 
 * Uso:
 *   node PROCESSAR_FILA_AGORA.js
 */

const { createClient } = require('@supabase/supabase-js');

async function processarFila() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseKey) {
    console.error('❌ Erro: SUPABASE_SERVICE_ROLE_KEY não encontrado!');
    console.error('Defina a variável de ambiente:');
    console.error('export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'sistemaretiradas' }
  });

  console.log('🔄 Processando fila de WhatsApp de cashback...\n');

  // Buscar pendentes
  const { data: pendentes, error: errorPendentes } = await supabase
    .from('cashback_whatsapp_queue')
    .select('id, created_at, status')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });

  if (errorPendentes) {
    console.error('❌ Erro ao buscar pendentes:', errorPendentes);
    return;
  }

  if (!pendentes || pendentes.length === 0) {
    console.log('✅ Nenhuma mensagem pendente na fila!');
    return;
  }

  console.log(`📋 ${pendentes.length} mensagem(ns) pendente(s) encontrada(s)\n`);

  // Chamar Netlify Function
  const netlifyUrl = process.env.NETLIFY_URL || 'https://eleveaone.com.br';
  const functionUrl = `${netlifyUrl}/.netlify/functions/process-cashback-whatsapp-queue`;

  console.log(`📡 Chamando: ${functionUrl}\n`);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Fila processada com sucesso!');
      console.log(`   - Processadas: ${result.processed || 0}`);
      console.log(`   - Enviadas: ${result.sent || 0}`);
      console.log(`   - Falhadas: ${result.failed || 0}`);
      console.log(`   - Puladas: ${result.skipped || 0}\n`);

      // Verificar status atual
      console.log('🔍 Verificando status atual da fila...\n');
      
      const { data: atual, error: errorAtual } = await supabase
        .from('cashback_whatsapp_queue')
        .select('status')
        .eq('status', 'PENDING');

      if (!errorAtual && atual) {
        const pendentesAgora = atual.length;
        console.log(`📊 Mensagens ainda pendentes: ${pendentesAgora}`);
        
        if (pendentesAgora > 0) {
          console.log('⚠️  Ainda há mensagens pendentes. Execute novamente para processar mais.');
        } else {
          console.log('✅ Todas as mensagens foram processadas!');
        }
      }
    } else {
      console.error('❌ Erro ao processar fila:', result.error || result.message);
    }
  } catch (error) {
    console.error('❌ Erro ao chamar Netlify Function:', error.message);
    console.error('\nVerifique:');
    console.error('  1. A URL do Netlify está correta?');
    console.error('  2. A função está deployada?');
    console.error('  3. Você tem acesso à internet?');
  }
}

// Executar
processarFila()
  .then(() => {
    console.log('\n✨ Concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

