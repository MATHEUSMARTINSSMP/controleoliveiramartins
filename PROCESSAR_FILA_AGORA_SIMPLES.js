/**
 * Script simples para processar fila de WhatsApp de cashback
 * Chama a Edge Function diretamente
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kktsbnrnlnzyofupegjc.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-cashback-queue`;

// Obter service_role_key da variável de ambiente ou do argumento
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Erro: SUPABASE_SERVICE_ROLE_KEY não encontrado!');
  console.error('\nUso:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"');
  console.error('  node PROCESSAR_FILA_AGORA_SIMPLES.js');
  console.error('\nOu:');
  console.error('  node PROCESSAR_FILA_AGORA_SIMPLES.js "sua-chave-aqui"');
  process.exit(1);
}

async function processarFila() {
  console.log('🔄 Processando fila de WhatsApp de cashback...');
  console.log(`📍 URL: ${EDGE_FUNCTION_URL}\n`);

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Erro ao processar fila:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ Resultado do processamento:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n📊 Resumo:');
    console.log(`  - Processados: ${result.processed || 0}`);
    console.log(`  - Enviados: ${result.sent || 0}`);
    console.log(`  - Pulados: ${result.skipped || 0}`);
    console.log(`  - Falhados: ${result.failed || 0}`);

    if (result.processed === 0) {
      console.log('\n💡 Não havia mensagens pendentes na fila.');
    } else if (result.sent > 0) {
      console.log(`\n🎉 ${result.sent} mensagem(ns) enviada(s) com sucesso!`);
    }
  } catch (error) {
    console.error('❌ Erro ao processar fila:', error.message);
    console.error(error);
    process.exit(1);
  }
}

processarFila();

