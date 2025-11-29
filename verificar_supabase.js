/**
 * Script de Verificação do Supabase
 * Testa conexão, configurações e status do pg_cron
 */

import { createClient } from '@supabase/supabase-js';

// Configurações do Supabase
// ✅ Usar variáveis de ambiente (não expor chaves no código)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp';

async function verificarSupabase() {
  console.log('🔍 Iniciando verificação do Supabase...\n');

  // Criar cliente com Service Role Key (acesso total)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: {
      schema: 'sistemaretiradas',
    },
  });

  try {
    // 1. Testar conexão básica
    console.log('1️⃣ Testando conexão básica...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('stores')
      .select('id')
      .limit(1);

    if (healthError) {
      console.error('❌ Erro na conexão:', healthError.message);
      return;
    }
    console.log('✅ Conexão estabelecida com sucesso!\n');

    // 2. Verificar se a função chamar_sync_tiny_orders existe
    console.log('2️⃣ Verificando função chamar_sync_tiny_orders...');
    try {
      const { data: functionExists, error: functionError } = await supabase
        .rpc('exec_sql', {
          query: `
            SELECT proname 
            FROM pg_proc 
            WHERE proname = 'chamar_sync_tiny_orders' 
            AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
            LIMIT 1;
          `
        });

      if (functionError) {
        // Tentar verificar de outra forma usando query direta
        const { data: altCheck } = await supabase
          .from('information_schema.routines')
          .select('routine_name')
          .eq('routine_schema', 'sistemaretiradas')
          .eq('routine_name', 'chamar_sync_tiny_orders')
          .limit(1);

        if (altCheck && altCheck.length > 0) {
          console.log('✅ Função chamar_sync_tiny_orders encontrada!\n');
        } else {
          console.log('⚠️  Função chamar_sync_tiny_orders não encontrada (execute a migration primeiro)\n');
        }
      } else {
        console.log('✅ Função chamar_sync_tiny_orders encontrada!\n');
      }
    } catch (err) {
      console.log('⚠️  Não foi possível verificar a função (normal se migration não foi executada)\n');
    }

    // 3. Verificar se o job do pg_cron foi criado
    console.log('3️⃣ Verificando job do pg_cron...');
    try {
      // Usar RPC para acessar tabela cron.job (não acessível diretamente via Supabase client)
      const { data: cronJob, error: cronError } = await supabase
        .rpc('exec_sql', {
          query: `
            SELECT jobid, jobname, schedule, active, command
            FROM cron.job
            WHERE jobname = 'sync-tiny-orders-automatico'
            LIMIT 1;
          `
        });

      if (cronError) {
        // Tentar verificar via query SQL direta
        console.log('⚠️  Não foi possível verificar via RPC, tentando método alternativo...');
        console.log('💡 Dica: Execute a migration no Supabase SQL Editor para criar o job\n');
      } else if (cronJob && cronJob.length > 0) {
        const job = cronJob[0];
        console.log('✅ Job encontrado!');
        console.log('   - Nome:', job.jobname);
        console.log('   - Schedule:', job.schedule);
        console.log('   - Ativo:', job.active ? 'Sim' : 'Não');
        console.log('   - Job ID:', job.jobid, '\n');
      } else {
        console.log('⚠️  Job não encontrado. Execute a migration primeiro.\n');
      }
    } catch (err) {
      console.log('⚠️  Não foi possível verificar o job (normal se migration não foi executada)\n');
    }

    // 4. Verificar logs do job
    console.log('4️⃣ Verificando logs do job...');
    try {
      const { data: jobLogs, error: logsError } = await supabase
        .rpc('exec_sql', {
          query: `
            SELECT start_time, end_time, status, return_message
            FROM cron.job_run_details
            WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico' LIMIT 1)
            ORDER BY start_time DESC
            LIMIT 5;
          `
        });

      if (logsError) {
        console.log('ℹ️  Não foi possível acessar logs (normal se job não existe ainda)\n');
      } else if (jobLogs && jobLogs.length > 0) {
        console.log(`✅ ${jobLogs.length} execuções encontradas:`);
        jobLogs.forEach((log, index) => {
          console.log(`   ${index + 1}. ${log.start_time} - Status: ${log.status || 'N/A'}`);
        });
        console.log('');
      } else {
        console.log('ℹ️  Nenhuma execução registrada ainda (job pode não ter rodado ainda)\n');
      }
    } catch (err) {
      console.log('ℹ️  Não foi possível verificar logs (normal se job não existe)\n');
    }

    // 5. Verificar extensões habilitadas
    console.log('5️⃣ Verificando extensões...');
    try {
      const { data: extensions, error: extError } = await supabase
        .rpc('exec_sql', {
          query: `
            SELECT extname 
            FROM pg_extension 
            WHERE extname IN ('pg_cron', 'pg_net', 'http');
          `
        });

      if (extError) {
        console.log('⚠️  Não foi possível verificar extensões (normal se não tiver permissão)\n');
      } else if (extensions && extensions.length > 0) {
        console.log('✅ Extensões encontradas:');
        extensions.forEach(ext => {
          console.log(`   - ${ext.extname}`);
        });
        console.log('');
      } else {
        console.log('⚠️  Nenhuma extensão relevante encontrada\n');
      }
    } catch (err) {
      console.log('⚠️  Não foi possível verificar extensões\n');
    }

    // 6. Testar chamada da Edge Function
    console.log('6️⃣ Testando chamada da Edge Function sync-tiny-orders...');
    
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY não configurada. Configure via variável de ambiente.\n');
    } else {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-tiny-orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({}),
        });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      if (response.ok) {
        console.log('✅ Edge Function respondeu com sucesso!');
        console.log('   Status:', response.status);
        console.log('   Resposta:', JSON.stringify(responseData, null, 2), '\n');
      } else {
        console.log('⚠️  Edge Function retornou erro:');
        console.log('   Status:', response.status);
        console.log('   Resposta:', responseText.substring(0, 200), '\n');
      }
    } catch (fetchError) {
      console.error('❌ Erro ao chamar Edge Function:', fetchError.message, '\n');
    }

    // 7. Verificar integrações ERP ativas
    console.log('7️⃣ Verificando integrações ERP...');
    const { data: integrations, error: intError } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('id, store_id, sistema_erp, sync_status')
      .eq('sistema_erp', 'TINY')
      .eq('sync_status', 'CONNECTED');

    if (intError) {
      console.log('⚠️  Erro ao verificar integrações:', intError.message, '\n');
    } else if (integrations && integrations.length > 0) {
      console.log(`✅ ${integrations.length} integração(ões) TINY ativa(s):`);
      integrations.forEach(int => {
        console.log(`   - Store ID: ${int.store_id}, Status: ${int.sync_status}`);
      });
      console.log('');
    } else {
      console.log('ℹ️  Nenhuma integração TINY ativa encontrada\n');
    }

    console.log('✅ Verificação concluída!\n');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar verificação
verificarSupabase().catch(console.error);

