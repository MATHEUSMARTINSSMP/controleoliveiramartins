import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function diagnosticoCompleto() {
    console.log('🔍 DIAGNÓSTICO COMPLETO - SISTEMA DE METAS\n');
    console.log('='.repeat(80));

    // 1. Verificar estrutura da tabela goals
    console.log('\n1️⃣ ESTRUTURA DA TABELA GOALS');
    console.log('-'.repeat(80));

    const { data: colunas, error: erroColunas } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'sistemaretiradas')
        .eq('table_name', 'goals');

    if (erroColunas) {
        console.error('❌ Erro ao buscar estrutura:', erroColunas);
    } else {
        console.log('✅ Colunas da tabela goals:');
        colunas?.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
    }

    // 2. Verificar políticas RLS
    console.log('\n2️⃣ POLÍTICAS RLS DA TABELA GOALS');
    console.log('-'.repeat(80));

    const { data: policies, error: erroPolicies } = await supabase
        .rpc('exec_sql', {
            sql: `
        SELECT 
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'goals'
        ORDER BY policyname;
      `
        });

    if (erroPolicies) {
        console.log('⚠️ Não foi possível buscar políticas via RPC (função pode não existir)');
        console.log('Tentando query direta...');

        // Tentar via query SQL direta
        const { data: rawPolicies, error: rawError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('schemaname', 'sistemaretiradas')
            .eq('tablename', 'goals');

        if (rawError) {
            console.error('❌ Erro ao buscar políticas:', rawError);
        } else {
            console.log(`✅ Encontradas ${rawPolicies?.length || 0} políticas RLS`);
            rawPolicies?.forEach((pol, i) => {
                console.log(`\n  Política ${i + 1}: ${pol.policyname}`);
                console.log(`    Comando: ${pol.cmd}`);
                console.log(`    Roles: ${pol.roles}`);
            });
        }
    } else {
        console.log(`✅ Encontradas ${policies?.length || 0} políticas RLS`);
        policies?.forEach((pol, i) => {
            console.log(`\n  Política ${i + 1}: ${pol.policyname}`);
            console.log(`    Comando: ${pol.cmd}`);
            console.log(`    Roles: ${pol.roles}`);
            console.log(`    Condição: ${pol.qual || 'N/A'}`);
        });
    }

    // 3. Verificar metas MENSAL existentes
    console.log('\n3️⃣ METAS MENSAL EXISTENTES');
    console.log('-'.repeat(80));

    const { data: metasMensais, error: erroMensais } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('id, mes_referencia, store_id, meta_valor, stores(name)')
        .eq('tipo', 'MENSAL')
        .order('created_at', { ascending: false })
        .limit(5);

    if (erroMensais) {
        console.error('❌ Erro:', erroMensais);
    } else {
        console.log(`✅ Encontradas ${metasMensais?.length || 0} metas MENSAL`);
        metasMensais?.forEach((meta, i) => {
            console.log(`  ${i + 1}. ${meta.stores?.name || 'N/A'} - ${meta.mes_referencia} - R$ ${meta.meta_valor}`);
        });
    }

    // 4. Verificar metas INDIVIDUAL existentes
    console.log('\n4️⃣ METAS INDIVIDUAL EXISTENTES (últimas 5)');
    console.log('-'.repeat(80));

    const { data: metasIndiv, error: erroIndiv } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('id, mes_referencia, store_id, colaboradora_id, meta_valor, stores(name), profiles(name)')
        .eq('tipo', 'INDIVIDUAL')
        .order('created_at', { ascending: false })
        .limit(5);

    if (erroIndiv) {
        console.error('❌ Erro:', erroIndiv);
    } else {
        console.log(`✅ Encontradas ${metasIndiv?.length || 0} metas INDIVIDUAL`);
        metasIndiv?.forEach((meta, i) => {
            console.log(`  ${i + 1}. ${meta.stores?.name || 'N/A'} - ${meta.profiles?.name || 'N/A'} - ${meta.mes_referencia} - R$ ${meta.meta_valor}`);
        });
    }

    // 5. Verificar se RLS está habilitado
    console.log('\n5️⃣ STATUS DO RLS');
    console.log('-'.repeat(80));

    const { data: rlsStatus, error: erroRLS } = await supabase
        .from('pg_tables')
        .select('tablename, rowsecurity')
        .eq('schemaname', 'sistemaretiradas')
        .eq('tablename', 'goals')
        .single();

    if (erroRLS) {
        console.error('❌ Erro ao verificar RLS:', erroRLS);
    } else {
        console.log(`${rlsStatus?.rowsecurity ? '🔒' : '🔓'} RLS ${rlsStatus?.rowsecurity ? 'HABILITADO' : 'DESABILITADO'} na tabela goals`);
    }

    // 6. Testar criação de meta MENSAL
    console.log('\n6️⃣ TESTE DE CRIAÇÃO DE META MENSAL');
    console.log('-'.repeat(80));

    const storeId = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'; // Sacada | Oh, Boy
    const mesRef = '202512';

    // Primeiro, deletar se existir
    await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .delete()
        .eq('tipo', 'MENSAL')
        .eq('store_id', storeId)
        .eq('mes_referencia', mesRef);

    const payloadTeste = {
        tipo: 'MENSAL',
        mes_referencia: mesRef,
        store_id: storeId,
        colaboradora_id: null,
        meta_valor: 99999,
        super_meta_valor: 119999,
        ativo: true,
        daily_weights: { '2025-12-01': 3.5 }
    };

    const { data: metaCriada, error: erroCriacao } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .insert(payloadTeste)
        .select()
        .single();

    if (erroCriacao) {
        console.error('❌ FALHA ao criar meta de teste:', erroCriacao);
        console.error('Detalhes:', JSON.stringify(erroCriacao, null, 2));
    } else {
        console.log('✅ Meta de teste criada com sucesso!');
        console.log('ID:', metaCriada.id);

        // Limpar teste
        await supabase
            .schema('sistemaretiradas')
            .from('goals')
            .delete()
            .eq('id', metaCriada.id);
        console.log('🧹 Meta de teste removida');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ DIAGNÓSTICO CONCLUÍDO\n');
}

diagnosticoCompleto().catch(err => {
    console.error('💥 Erro fatal:', err);
});
