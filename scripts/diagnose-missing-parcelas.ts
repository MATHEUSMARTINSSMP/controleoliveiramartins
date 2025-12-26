/**
 * Script para diagnosticar compras sem parcelas
 * Execute com: npx tsx scripts/diagnose-missing-parcelas.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function investigateGabrieleCompra() {
    console.log('🔍 Investigando compras da Gabriele Lobato...\n');

    // 1. Buscar perfil da Gabriele
    console.log('📋 PASSO 1: Buscando perfil da Gabriele Lobato');
    const { data: profiles, error: profileError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, role')
        .ilike('name', '%gabriele%lobato%');

    if (profileError) {
        console.error('❌ Erro ao buscar perfil:', profileError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('⚠️  Nenhum perfil encontrado com nome "Gabriele Lobato"');
        return;
    }

    console.log('✅ Perfil encontrado:');
    console.log(JSON.stringify(profiles[0], null, 2));
    const gabrieleId = profiles[0].id;

    // 2. Buscar compras da Gabriele
    console.log('\n📋 PASSO 2: Buscando compras da Gabriele');
    const { data: purchases, error: purchaseError } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select('*')
        .eq('colaboradora_id', gabrieleId)
        .order('created_at', { ascending: false });

    if (purchaseError) {
        console.error('❌ Erro ao buscar compras:', purchaseError);
        return;
    }

    if (!purchases || purchases.length === 0) {
        console.log('⚠️  Nenhuma compra encontrada para Gabriele Lobato');
        return;
    }

    console.log(`✅ ${purchases.length} compra(s) encontrada(s):\n`);
    purchases.forEach((p: any, idx: number) => {
        console.log(`Compra ${idx + 1}:`);
        console.log(`  ID: ${p.id}`);
        console.log(`  Data: ${p.data_compra}`);
        console.log(`  Item: ${p.item}`);
        console.log(`  Valor: R$ ${p.preco_final}`);
        console.log(`  Parcelas esperadas: ${p.num_parcelas}`);
        console.log(`  Status: ${p.status_compra}`);
        console.log(`  Criado em: ${p.created_at}\n`);
    });

    // 3. Verificar parcelas para cada compra
    console.log('📋 PASSO 3: Verificando parcelas de cada compra\n');

    for (const purchase of purchases) {
        const { data: parcelas, error: parcelasError } = await supabase
            .schema('sistemaretiradas')
            .from('parcelas')
            .select('*')
            .eq('compra_id', purchase.id)
            .order('n_parcela', { ascending: true });

        if (parcelasError) {
            console.error(`❌ Erro ao buscar parcelas da compra ${purchase.id}:`, parcelasError);
            continue;
        }

        console.log(`Compra ${purchase.id.substring(0, 8)}...`);
        console.log(`  Parcelas esperadas: ${purchase.num_parcelas}`);
        console.log(`  Parcelas encontradas: ${parcelas?.length || 0}`);

        if (!parcelas || parcelas.length === 0) {
            console.log('  ❌ PROBLEMA: Nenhuma parcela encontrada!');
            console.log(`  📝 Esta compra precisa de reparo\n`);
        } else {
            console.log('  ✅ Parcelas OK');
            parcelas.forEach((p: any) => {
                console.log(`    Parcela ${p.n_parcela}/${purchase.num_parcelas}: ${p.competencia} - R$ ${p.valor_parcela} - ${p.status_parcela}`);
            });
            console.log('');
        }
    }

    // 4. Resumo geral
    console.log('\n📊 RESUMO GERAL');
    console.log('═══════════════════════════════════════════════════');

    const comprasSemParcelas: any[] = [];
    for (const purchase of purchases) {
        const { data: parcelas } = await supabase
            .schema('sistemaretiradas')
            .from('parcelas')
            .select('id')
            .eq('compra_id', purchase.id);

        if (!parcelas || parcelas.length === 0) {
            comprasSemParcelas.push(purchase);
        }
    }

    console.log(`Total de compras: ${purchases.length}`);
    console.log(`Compras SEM parcelas: ${comprasSemParcelas.length}`);
    console.log(`Compras COM parcelas: ${purchases.length - comprasSemParcelas.length}`);

    if (comprasSemParcelas.length > 0) {
        console.log('\n⚠️  COMPRAS QUE PRECISAM DE REPARO:');
        comprasSemParcelas.forEach((p: any) => {
            console.log(`  - ${p.id} (${p.item}) - ${p.num_parcelas}x de R$ ${(p.preco_final / p.num_parcelas).toFixed(2)}`);
        });
    }

    return comprasSemParcelas;
}

// Executar
investigateGabrieleCompra()
    .then((comprasSemParcelas) => {
        console.log('\n✅ Investigação concluída!');
        if (comprasSemParcelas && comprasSemParcelas.length > 0) {
            console.log('\n💡 Próximos passos:');
            console.log('1. Execute o script de reparo SQL no Supabase');
            console.log('2. Ou use a função gerar_parcelas_faltantes() para cada compra');
        }
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Erro na investigação:', err);
        process.exit(1);
    });
