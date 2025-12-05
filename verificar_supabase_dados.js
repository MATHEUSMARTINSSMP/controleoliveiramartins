// Script para verificar dados no Supabase
// Execute: node verificar_supabase_dados.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: {
    schema: 'sistemaretiradas',
  },
});

async function verificarDados() {
  console.log('🔍 Verificando dados no Supabase...\n');

  try {
    // 1. Verificar todas as lojas
    console.log('📦 1. Verificando lojas...');
    const { data: stores, error: storesError } = await supabase
      .schema('sistemaretiradas')
      .from('stores')
      .select('id, name, active, sistema_erp, created_at, updated_at')
      .order('name');

    if (storesError) {
      console.error('❌ Erro ao buscar lojas:', storesError);
    } else {
      console.log(`✅ Total de lojas encontradas: ${stores.length}`);
      console.log(`   - Ativas: ${stores.filter(s => s.active).length}`);
      console.log(`   - Inativas: ${stores.filter(s => !s.active).length}`);
      console.log('\n   Lojas:');
      stores.forEach(store => {
        console.log(`   - ${store.name} (${store.active ? 'Ativa' : 'Inativa'})${store.sistema_erp ? ` - ERP: ${store.sistema_erp}` : ''}`);
      });
    }

    console.log('\n');

    // 2. Verificar integrações ERP
    console.log('🔌 2. Verificando integrações ERP...');
    const { data: integrations, error: integrationsError } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select(`
        id,
        store_id,
        sistema_erp,
        sync_status,
        client_id,
        last_sync_at,
        error_message,
        active,
        created_at,
        updated_at,
        stores!inner(name)
      `)
      .order('created_at', { ascending: false });

    if (integrationsError) {
      console.error('❌ Erro ao buscar integrações:', integrationsError);
    } else {
      console.log(`✅ Total de integrações encontradas: ${integrations.length}`);
      console.log(`   - Conectadas: ${integrations.filter(i => i.sync_status === 'CONNECTED').length}`);
      console.log(`   - Desconectadas: ${integrations.filter(i => i.sync_status === 'DISCONNECTED').length}`);
      console.log(`   - Com erro: ${integrations.filter(i => i.sync_status === 'ERROR').length}`);
      console.log(`   - Ativas: ${integrations.filter(i => i.active).length}`);
      console.log('\n   Integrações:');
      integrations.forEach(int => {
        const storeName = int.stores?.name || 'Loja não encontrada';
        const clientIdPreview = int.client_id ? `${int.client_id.substring(0, 20)}...` : 'Não configurado';
        const lastSync = int.last_sync_at ? new Date(int.last_sync_at).toLocaleString('pt-BR') : 'Nunca';
        console.log(`   - ${storeName}:`);
        console.log(`     • Sistema: ${int.sistema_erp || 'N/A'}`);
        console.log(`     • Status: ${int.sync_status || 'N/A'}`);
        console.log(`     • Client ID: ${clientIdPreview}`);
        console.log(`     • Última sincronização: ${lastSync}`);
        if (int.error_message) {
          console.log(`     • Erro: ${int.error_message}`);
        }
      });
    }

    console.log('\n');

    // 3. Verificar lojas sem integração
    console.log('⚠️  3. Verificando lojas sem integração...');
    const { data: storesSemIntegracao } = await supabase
      .schema('sistemaretiradas')
      .from('stores')
      .select('id, name, active')
      .not('id', 'in', `(${integrations?.map(i => `'${i.store_id}'`).join(',') || ''})`);

    if (storesSemIntegracao && storesSemIntegracao.length > 0) {
      console.log(`⚠️  Lojas sem integração configurada: ${storesSemIntegracao.length}`);
      storesSemIntegracao.forEach(store => {
        console.log(`   - ${store.name} (${store.active ? 'Ativa' : 'Inativa'})`);
      });
    } else {
      console.log('✅ Todas as lojas têm integração configurada ou não há lojas.');
    }

    console.log('\n');

    // 4. Verificar estrutura da tabela erp_integrations
    console.log('📋 4. Verificando estrutura da tabela erp_integrations...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_schema: 'sistemaretiradas', table_name: 'erp_integrations' })
      .catch(() => ({ data: null, error: null }));

    if (columnsError || !columns) {
      console.log('ℹ️  Não foi possível verificar estrutura via RPC. Verifique manualmente no Supabase Dashboard.');
    }

    console.log('\n✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  }
}

// Executar verificação
verificarDados();

