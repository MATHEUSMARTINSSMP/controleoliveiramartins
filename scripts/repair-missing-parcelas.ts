/**
 * Script para reparar compras sem parcelas
 * Execute com: npx tsx scripts/repair-missing-parcelas.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Purchase {
    id: string;
    data_compra: string;
    preco_final: number;
    num_parcelas: number;
    item: string;
}

function gerarParcelas(purchase: Purchase) {
    const { id, data_compra, preco_final, num_parcelas } = purchase;

    // Calcular valor base da parcela com arredondamento bancário
    const valorBase = Math.round((preco_final / num_parcelas) * 100) / 100;
    const totalParcelas = valorBase * num_parcelas;
    const diferenca = preco_final - totalParcelas;

    // Extrair ano e mês da data da compra
    const dataCompra = new Date(data_compra);
    const ano = dataCompra.getFullYear();
    const mes = dataCompra.getMonth() + 1; // getMonth() retorna 0-11

    const parcelas = [];

    for (let i = 0; i < num_parcelas; i++) {
        const mesAtual = mes + i;
        const anoAtual = ano + Math.floor((mesAtual - 1) / 12);
        const mesFormatado = ((mesAtual - 1) % 12) + 1;
        const competencia = `${anoAtual}${mesFormatado.toString().padStart(2, '0')}`;

        // Ajustar diferença na última parcela
        const valorParcela = i === num_parcelas - 1 ? valorBase + diferenca : valorBase;

        parcelas.push({
            compra_id: id,
            n_parcela: i + 1,
            competencia,
            valor_parcela: valorParcela,
            status_parcela: 'PENDENTE',
        });
    }

    return parcelas;
}

async function repairPurchase(purchaseId: string) {
    console.log(`\n🔧 Reparando compra: ${purchaseId}`);

    // 1. Buscar dados da compra
    const { data: purchase, error: purchaseError } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();

    if (purchaseError || !purchase) {
        console.error('❌ Erro ao buscar compra:', purchaseError);
        return false;
    }

    console.log(`📦 Compra encontrada: ${purchase.item}`);
    console.log(`   Valor: R$ ${purchase.preco_final}`);
    console.log(`   Parcelas: ${purchase.num_parcelas}x`);

    // 2. Verificar se já tem parcelas
    const { data: existingParcelas } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .select('id')
        .eq('compra_id', purchaseId);

    if (existingParcelas && existingParcelas.length > 0) {
        console.log(`⚠️  Esta compra já tem ${existingParcelas.length} parcela(s). Pulando...`);
        return false;
    }

    // 3. Gerar parcelas
    const parcelas = gerarParcelas(purchase);
    console.log(`\n📝 Gerando ${parcelas.length} parcela(s):`);
    parcelas.forEach(p => {
        console.log(`   Parcela ${p.n_parcela}/${purchase.num_parcelas}: ${p.competencia} - R$ ${p.valor_parcela.toFixed(2)}`);
    });

    // 4. Inserir parcelas
    const { data: insertedParcelas, error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('parcelas')
        .insert(parcelas)
        .select();

    if (insertError) {
        console.error('❌ Erro ao inserir parcelas:', insertError);
        return false;
    }

    console.log(`✅ ${insertedParcelas?.length || 0} parcela(s) criada(s) com sucesso!`);
    return true;
}

async function repairAllMissingParcelas() {
    console.log('🔍 Buscando todas as compras sem parcelas...\n');

    // Buscar todas as compras
    const { data: allPurchases, error: purchasesError } = await supabase
        .schema('sistemaretiradas')
        .from('purchases')
        .select('id, data_compra, preco_final, num_parcelas, item, colaboradora_id')
        .not('colaboradora_id', 'is', null) // Apenas compras de colaboradoras
        .order('created_at', { ascending: false });

    if (purchasesError) {
        console.error('❌ Erro ao buscar compras:', purchasesError);
        return;
    }

    console.log(`📊 Total de compras encontradas: ${allPurchases?.length || 0}\n`);

    // Verificar quais não têm parcelas
    const purchasesWithoutParcelas: Purchase[] = [];

    for (const purchase of allPurchases || []) {
        const { data: parcelas } = await supabase
            .schema('sistemaretiradas')
            .from('parcelas')
            .select('id')
            .eq('compra_id', purchase.id);

        if (!parcelas || parcelas.length === 0) {
            purchasesWithoutParcelas.push(purchase as Purchase);
        }
    }

    console.log(`⚠️  Compras SEM parcelas: ${purchasesWithoutParcelas.length}\n`);

    if (purchasesWithoutParcelas.length === 0) {
        console.log('✅ Todas as compras têm parcelas! Nada a reparar.');
        return;
    }

    // Reparar cada compra
    console.log('🔧 Iniciando reparo...\n');
    console.log('═══════════════════════════════════════════════════\n');

    let successCount = 0;
    let failCount = 0;

    for (const purchase of purchasesWithoutParcelas) {
        const success = await repairPurchase(purchase.id);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('\n📊 RESULTADO FINAL:');
    console.log(`   ✅ Reparadas com sucesso: ${successCount}`);
    console.log(`   ❌ Falhas: ${failCount}`);
    console.log(`   📦 Total processadas: ${purchasesWithoutParcelas.length}`);
}

// Executar
repairAllMissingParcelas()
    .then(() => {
        console.log('\n✅ Processo de reparo concluído!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Erro no processo de reparo:', err);
        process.exit(1);
    });
