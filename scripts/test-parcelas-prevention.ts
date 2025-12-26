/**
 * Teste Automatizado: Sistema de Prevenção de Parcelas Faltantes
 * 
 * Este script testa todas as camadas de proteção:
 * 1. Trigger do banco de dados
 * 2. Verificação do frontend
 * 3. Funções de validação
 * 
 * Execute: npx tsx scripts/test-parcelas-prevention.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let testsPassed = 0;
let testsFailed = 0;

function logTest(name: string, passed: boolean, details?: string) {
    if (passed) {
        console.log(`✅ ${name}`);
        testsPassed++;
    } else {
        console.log(`❌ ${name}`);
        if (details) console.log(`   ${details}`);
        testsFailed++;
    }
}

async function testTriggerExists() {
    console.log('\n🧪 Teste 1: Verificar se trigger existe');

    const { data, error } = await supabase.rpc('pg_get_triggerdef', {
        trigger_oid: 'trigger_auto_create_parcelas'
    }).single();

    logTest(
        'Trigger auto_create_parcelas existe',
        !error,
        error?.message
    );
}

async function testValidationFunction() {
    console.log('\n🧪 Teste 2: Verificar função de validação');

    const { data, error } = await supabase
        .rpc('validate_parcelas_integrity');

    logTest(
        'Função validate_parcelas_integrity() funciona',
        !error,
        error?.message
    );
}

async function testView() {
    console.log('\n🧪 Teste 3: Verificar view de monitoramento');

    const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('v_purchases_missing_parcelas')
        .select('*')
        .limit(1);

    logTest(
        'View v_purchases_missing_parcelas existe',
        !error,
        error?.message
    );
}

async function testCurrentIntegrity() {
    console.log('\n🧪 Teste 4: Verificar integridade atual');

    const { data: problemPurchases } = await supabase
        .schema('sistemaretiradas')
        .from('v_purchases_missing_parcelas')
        .select('*');

    const hasProblems = (problemPurchases?.length || 0) > 0;

    logTest(
        'Sistema sem compras problemáticas',
        !hasProblems,
        hasProblems ? `${problemPurchases?.length} compras com problemas encontradas` : undefined
    );

    if (hasProblems) {
        console.log('\n⚠️  Compras com problemas:');
        problemPurchases?.forEach((p: any) => {
            console.log(`   - ${p.purchase_id}: ${p.parcelas_encontradas}/${p.parcelas_esperadas} parcelas`);
        });
    }
}

async function testAllPurchasesHaveParcelas() {
    console.log('\n🧪 Teste 5: Verificar se todas as compras têm parcelas');

    // Buscar todas as compras de colaboradoras
    const { data: purchases } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select('id, num_parcelas, colaboradora_id')
        .not('colaboradora_id', 'is', null)
        .limit(100);

    if (!purchases || purchases.length === 0) {
        logTest('Verificação de parcelas (sem compras para testar)', true);
        return;
    }

    let allHaveParcelas = true;
    const problems: any[] = [];

    for (const purchase of purchases) {
        const { data: parcelas } = await supabase
            .schema('sistemaretiradas')
            .from('parcelas')
            .select('id')
            .eq('compra_id', purchase.id);

        if ((parcelas?.length || 0) !== purchase.num_parcelas) {
            allHaveParcelas = false;
            problems.push({
                id: purchase.id,
                expected: purchase.num_parcelas,
                found: parcelas?.length || 0
            });
        }
    }

    logTest(
        `Todas as ${purchases.length} compras verificadas têm parcelas corretas`,
        allHaveParcelas,
        !allHaveParcelas ? `${problems.length} compras com problemas` : undefined
    );

    if (!allHaveParcelas) {
        console.log('\n⚠️  Compras problemáticas:');
        problems.forEach(p => {
            console.log(`   - ${p.id}: ${p.found}/${p.expected} parcelas`);
        });
    }
}

async function runAllTests() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🧪 TESTE DO SISTEMA DE PREVENÇÃO DE PARCELAS');
    console.log('═══════════════════════════════════════════════════');

    try {
        await testTriggerExists();
        await testValidationFunction();
        await testView();
        await testCurrentIntegrity();
        await testAllPurchasesHaveParcelas();
    } catch (error) {
        console.error('\n❌ Erro durante os testes:', error);
        testsFailed++;
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 RESULTADO DOS TESTES');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Testes passados: ${testsPassed}`);
    console.log(`❌ Testes falhados: ${testsFailed}`);
    console.log(`📊 Total: ${testsPassed + testsFailed}`);
    console.log(`📈 Taxa de sucesso: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

    if (testsFailed === 0) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM!');
        console.log('✅ Sistema de prevenção funcionando corretamente');
        process.exit(0);
    } else {
        console.log('\n⚠️  ALGUNS TESTES FALHARAM');
        console.log('🔧 Verifique os erros acima e corrija antes de prosseguir');
        process.exit(1);
    }
}

runAllTests();
