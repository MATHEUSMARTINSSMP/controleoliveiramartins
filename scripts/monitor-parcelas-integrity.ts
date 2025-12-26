/**
 * Script de monitoramento de integridade de parcelas
 * Execute periodicamente para garantir que não há compras sem parcelas
 * 
 * Uso: npx tsx scripts/monitor-parcelas-integrity.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkIntegrity() {
    console.log('🔍 Verificando integridade de parcelas...\n');
    console.log('Data/Hora:', new Date().toISOString());
    console.log('═══════════════════════════════════════════════════\n');

    // Usar a view criada na migration
    const { data: problemPurchases, error } = await supabase
        .schema('sistemaretiradas')
        .from('v_purchases_missing_parcelas')
        .select('*');

    if (error) {
        console.error('❌ Erro ao verificar integridade:', error);
        return false;
    }

    if (!problemPurchases || problemPurchases.length === 0) {
        console.log('✅ INTEGRIDADE OK: Todas as compras têm parcelas corretas!');
        console.log('   Total verificado: Todas as compras de colaboradoras');
        return true;
    }

    // Problemas encontrados!
    console.log('⚠️  PROBLEMAS ENCONTRADOS!\n');
    console.log(`   Total de compras com problemas: ${problemPurchases.length}\n`);

    problemPurchases.forEach((p: any, idx: number) => {
        console.log(`${idx + 1}. Compra ${p.purchase_id.substring(0, 8)}...`);
        console.log(`   Item: ${p.item}`);
        console.log(`   Valor: R$ ${p.preco_final}`);
        console.log(`   Parcelas esperadas: ${p.parcelas_esperadas}`);
        console.log(`   Parcelas encontradas: ${p.parcelas_encontradas}`);
        console.log(`   Data da compra: ${p.data_compra}`);
        console.log(`   Criado em: ${p.created_at}\n`);
    });

    console.log('═══════════════════════════════════════════════════');
    console.log('🔧 AÇÃO REQUERIDA:');
    console.log('   Execute: npx tsx scripts/repair-missing-parcelas.ts');
    console.log('═══════════════════════════════════════════════════\n');

    return false;
}

async function runMonitoring() {
    const isHealthy = await checkIntegrity();

    if (!isHealthy) {
        console.error('\n❌ Sistema com problemas de integridade!');
        process.exit(1);
    }

    console.log('\n✅ Sistema saudável!');
    process.exit(0);
}

runMonitoring();
