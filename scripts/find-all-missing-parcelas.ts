/**
 * Script para encontrar TODAS as compras sem parcelas
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function findAllPurchasesWithoutParcelas() {
    console.log('🔍 Buscando TODAS as compras sem parcelas...\n');

    // Buscar TODAS as compras
    const { data: allPurchases, error: purchasesError } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select('id, data_compra, preco_final, num_parcelas, item, colaboradora_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50); // Últimas 50 compras

    if (purchasesError) {
        console.error('❌ Erro ao buscar compras:', purchasesError);
        return;
    }

    console.log(`📊 Total de compras (últimas 50): ${allPurchases?.length || 0}\n`);

    // Buscar perfis para mostrar nomes
    const colaboradoraIds = [...new Set(allPurchases?.map(p => p.colaboradora_id).filter(Boolean) || [])];
    const { data: profiles } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name')
        .in('id', colaboradoraIds);

    const profilesMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

    // Verificar parcelas para cada compra
    const purchasesWithoutParcelas: any[] = [];

    console.log('🔎 Verificando parcelas...\n');

    for (const purchase of allPurchases || []) {
        const { data: parcelas } = await supabase
            .schema('sistemaretiradas')
            .from('parcelas')
            .select('id')
            .eq('compra_id', purchase.id);

        const colaboradoraName = profilesMap.get(purchase.colaboradora_id) || 'Cliente (sem colaboradora)';
        const hasColaboradora = !!purchase.colaboradora_id;

        if (!parcelas || parcelas.length === 0) {
            purchasesWithoutParcelas.push({
                ...purchase,
                colaboradora_name: colaboradoraName,
                has_colaboradora: hasColaboradora
            });

            console.log(`❌ SEM PARCELAS: ${purchase.id.substring(0, 8)}...`);
            console.log(`   Colaboradora: ${colaboradoraName}`);
            console.log(`   Item: ${purchase.item}`);
            console.log(`   Valor: R$ ${purchase.preco_final} (${purchase.num_parcelas}x)`);
            console.log(`   Data: ${purchase.data_compra}`);
            console.log(`   Criado em: ${purchase.created_at}\n`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 RESUMO:');
    console.log(`   Total verificadas: ${allPurchases?.length || 0}`);
    console.log(`   SEM parcelas: ${purchasesWithoutParcelas.length}`);
    console.log(`   COM parcelas: ${(allPurchases?.length || 0) - purchasesWithoutParcelas.length}`);

    // Separar por tipo
    const comprasColaboradoras = purchasesWithoutParcelas.filter(p => p.has_colaboradora);
    const comprasClientes = purchasesWithoutParcelas.filter(p => !p.has_colaboradora);

    console.log(`\n   Compras de COLABORADORAS sem parcelas: ${comprasColaboradoras.length}`);
    console.log(`   Compras de CLIENTES sem parcelas: ${comprasClientes.length}`);

    if (comprasColaboradoras.length > 0) {
        console.log('\n⚠️  COMPRAS DE COLABORADORAS QUE PRECISAM DE REPARO:');
        comprasColaboradoras.forEach(p => {
            console.log(`   - ${p.colaboradora_name}: ${p.item} (${p.num_parcelas}x R$ ${(p.preco_final / p.num_parcelas).toFixed(2)})`);
        });
    }

    return purchasesWithoutParcelas;
}

findAllPurchasesWithoutParcelas()
    .then(() => {
        console.log('\n✅ Análise concluída!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Erro:', err);
        process.exit(1);
    });
