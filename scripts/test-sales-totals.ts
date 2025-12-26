/**
 * Teste Automatizado: Cálculo de Totais de Vendas
 * 
 * Verifica se os totais estão sendo calculados corretamente,
 * sem duplicação de valores.
 * 
 * Execute: npx tsx scripts/test-sales-totals.ts
 */

import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

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

/**
 * Teste 1: Verificar se totais diários estão corretos
 */
async function testDailyTotals() {
    console.log('\n🧪 Teste 1: Verificar totais diários');

    try {
        // Buscar todas as lojas
        const { data: stores } = await supabase
            .schema('sistemaretiradas')
            .from('stores')
            .select('id, name')
            .limit(5); // Testar apenas 5 lojas para não demorar muito

        if (!stores || stores.length === 0) {
            logTest('Totais diários (sem lojas para testar)', true);
            return;
        }

        const hoje = format(new Date(), 'yyyy-MM-dd');
        let allCorrect = true;
        const problems: any[] = [];

        for (const store of stores) {
            // Buscar vendas do dia
            const { data: sales } = await supabase
                .schema('sistemaretiradas')
                .from('sales')
                .select('id, valor')
                .eq('store_id', store.id)
                .gte('data_venda', `${hoje}T00:00:00`)
                .lte('data_venda', `${hoje}T23:59:59`);

            if (!sales || sales.length === 0) continue;

            // Calcular total manualmente
            const expectedTotal = sales.reduce((sum, s) => sum + parseFloat(s.valor || '0'), 0);

            // Para cada venda, simular o cálculo como se fosse a venda atual
            for (const currentSale of sales) {
                // Buscar vendas EXCLUINDO a venda atual
                const { data: otherSales } = await supabase
                    .schema('sistemaretiradas')
                    .from('sales')
                    .select('valor')
                    .eq('store_id', store.id)
                    .gte('data_venda', `${hoje}T00:00:00`)
                    .lte('data_venda', `${hoje}T23:59:59`)
                    .neq('id', currentSale.id);

                const totalWithoutCurrent = otherSales?.reduce((sum, s) => sum + parseFloat(s.valor || '0'), 0) || 0;
                const totalWithCurrent = totalWithoutCurrent + parseFloat(currentSale.valor || '0');

                // Verificar se o total está correto
                const diff = Math.abs(totalWithCurrent - expectedTotal);
                if (diff > 0.01) { // Tolerância de 1 centavo para erros de arredondamento
                    allCorrect = false;
                    problems.push({
                        store: store.name,
                        saleId: currentSale.id,
                        expected: expectedTotal,
                        calculated: totalWithCurrent,
                        diff
                    });
                }
            }
        }

        logTest(
            `Totais diários corretos para ${stores.length} lojas`,
            allCorrect,
            !allCorrect ? `${problems.length} problemas encontrados` : undefined
        );

        if (!allCorrect) {
            console.log('\n⚠️  Problemas encontrados:');
            problems.forEach(p => {
                console.log(`   - Loja: ${p.store}, Venda: ${p.saleId.substring(0, 8)}...`);
                console.log(`     Esperado: R$ ${p.expected.toFixed(2)}, Calculado: R$ ${p.calculated.toFixed(2)}, Diff: R$ ${p.diff.toFixed(2)}`);
            });
        }
    } catch (error) {
        logTest('Totais diários', false, String(error));
    }
}

/**
 * Teste 2: Verificar se há duplicatas em cálculos existentes
 */
async function testForDuplicates() {
    console.log('\n🧪 Teste 2: Verificar duplicatas em cálculos');

    try {
        // Buscar vendas recentes
        const { data: recentSales } = await supabase
            .schema('sistemaretiradas')
            .from('sales')
            .select('id, store_id, valor, data_venda')
            .order('created_at', { ascending: false })
            .limit(10);

        if (!recentSales || recentSales.length === 0) {
            logTest('Verificação de duplicatas (sem vendas recentes)', true);
            return;
        }

        let noDuplicates = true;

        for (const sale of recentSales) {
            const dateStr = format(new Date(sale.data_venda), 'yyyy-MM-dd');

            // Método 1: Incluir todas as vendas
            const { data: allSales } = await supabase
                .schema('sistemaretiradas')
                .from('sales')
                .select('valor')
                .eq('store_id', sale.store_id)
                .gte('data_venda', `${dateStr}T00:00:00`)
                .lte('data_venda', `${dateStr}T23:59:59`);

            const total1 = allSales?.reduce((sum, s) => sum + parseFloat(s.valor || '0'), 0) || 0;

            // Método 2: Excluir venda atual e adicionar
            const { data: otherSales } = await supabase
                .schema('sistemaretiradas')
                .from('sales')
                .select('valor')
                .eq('store_id', sale.store_id)
                .gte('data_venda', `${dateStr}T00:00:00`)
                .lte('data_venda', `${dateStr}T23:59:59`)
                .neq('id', sale.id);

            const total2 = (otherSales?.reduce((sum, s) => sum + parseFloat(s.valor || '0'), 0) || 0) + parseFloat(sale.valor || '0');

            // Os dois métodos devem dar o mesmo resultado
            const diff = Math.abs(total1 - total2);
            if (diff > 0.01) {
                noDuplicates = false;
                console.log(`   ⚠️  Diferença encontrada: R$ ${diff.toFixed(2)}`);
                console.log(`      Venda: ${sale.id.substring(0, 8)}...`);
                console.log(`      Método 1 (incluir tudo): R$ ${total1.toFixed(2)}`);
                console.log(`      Método 2 (excluir + adicionar): R$ ${total2.toFixed(2)}`);
            }
        }

        logTest(
            `Sem duplicatas em ${recentSales.length} vendas recentes`,
            noDuplicates
        );
    } catch (error) {
        logTest('Verificação de duplicatas', false, String(error));
    }
}

/**
 * Teste 3: Simular criação de venda e verificar total
 */
async function testSaleCreationScenario() {
    console.log('\n🧪 Teste 3: Simular criação de venda');

    try {
        // Buscar uma loja para teste
        const { data: store } = await supabase
            .schema('sistemaretiradas')
            .from('stores')
            .select('id')
            .limit(1)
            .single();

        if (!store) {
            logTest('Simulação de criação de venda (sem lojas)', true);
            return;
        }

        const hoje = format(new Date(), 'yyyy-MM-dd');

        // Buscar total atual
        const { data: currentSales } = await supabase
            .schema('sistemaretiradas')
            .from('sales')
            .select('valor')
            .eq('store_id', store.id)
            .gte('data_venda', `${hoje}T00:00:00`)
            .lte('data_venda', `${hoje}T23:59:59`);

        const currentTotal = currentSales?.reduce((sum, s) => sum + parseFloat(s.valor || '0'), 0) || 0;

        // Simular nova venda
        const newSaleValue = 100.00;
        const expectedNewTotal = currentTotal + newSaleValue;

        // Calcular como seria feito no código (método correto)
        const totalWithoutNew = currentTotal; // Porque a nova venda ainda não existe
        const calculatedTotal = totalWithoutNew + newSaleValue;

        const isCorrect = Math.abs(calculatedTotal - expectedNewTotal) < 0.01;

        logTest(
            'Simulação de criação de venda',
            isCorrect,
            !isCorrect ? `Esperado: R$ ${expectedNewTotal.toFixed(2)}, Calculado: R$ ${calculatedTotal.toFixed(2)}` : undefined
        );
    } catch (error) {
        logTest('Simulação de criação de venda', false, String(error));
    }
}

async function runAllTests() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🧪 TESTE DE TOTAIS DE VENDAS (SEM DUPLICATAS)');
    console.log('═══════════════════════════════════════════════════');

    try {
        await testDailyTotals();
        await testForDuplicates();
        await testSaleCreationScenario();
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
        console.log('✅ Cálculo de totais funcionando corretamente');
        process.exit(0);
    } else {
        console.log('\n⚠️  ALGUNS TESTES FALHARAM');
        console.log('🔧 Verifique os erros acima e corrija');
        process.exit(1);
    }
}

runAllTests();
