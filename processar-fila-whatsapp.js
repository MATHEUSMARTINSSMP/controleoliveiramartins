/**
 * Script para processar fila de WhatsApp de cashback
 * Executar: node processar-fila-whatsapp.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'sistemaretiradas',
  },
});

async function processarFila() {
  try {
    console.log('🔄 Processando fila de WhatsApp de cashback...\n');

    // Buscar itens pendentes
    const { data: queueItems, error: queueError } = await supabase
      .from('cashback_whatsapp_queue')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('❌ Erro ao buscar fila:', queueError);
      return;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('✅ Nenhum item pendente na fila');
      return;
    }

    console.log(`📋 ${queueItems.length} item(ns) encontrado(s) na fila\n`);

    // Chamar função Netlify para processar
    const netlifyUrl = 'https://eleveaone.com.br';
    const functionUrl = `${netlifyUrl}/.netlify/functions/process-cashback-whatsapp-queue`;

    console.log(`📡 Chamando função Netlify: ${functionUrl}\n`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Fila processada com sucesso!');
      console.log(`   - Processados: ${result.processed || 0}`);
      console.log(`   - Enviados: ${result.sent || 0}`);
      console.log(`   - Pulados: ${result.skipped || 0}`);
      console.log(`   - Falhas: ${result.failed || 0}\n`);

      // Verificar status atualizado
      const { data: updatedItems } = await supabase
        .from('cashback_whatsapp_queue')
        .select('id, status, error_message')
        .in('id', queueItems.map(item => item.id));

      console.log('📊 Status atualizado dos itens:');
      updatedItems?.forEach(item => {
        const statusEmoji = {
          'SENT': '✅',
          'SKIPPED': '⏭️',
          'FAILED': '❌',
          'PENDING': '⏳',
          'PROCESSING': '🔄',
        };
        console.log(`   ${statusEmoji[item.status] || '❓'} ${item.id.slice(0, 8)}... - ${item.status}`);
        if (item.error_message) {
          console.log(`      Erro: ${item.error_message}`);
        }
      });
    } else {
      console.error('❌ Erro ao processar fila:', result.error || result);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Processar fila
processarFila();

