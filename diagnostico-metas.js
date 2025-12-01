import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticarMetas() {
    console.log('🔍 DIAGNÓSTICO DE METAS - INICIANDO...\n');

    // 1. Buscar todas as metas mensais recentes
    console.log('1️⃣ Buscando metas mensais (tipo MENSAL)...');
    const { data: metasMensais, error: erro1 } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('id, tipo, mes_referencia, store_id, colaboradora_id, meta_valor, stores(name)')
        .eq('tipo', 'MENSAL')
        .order('created_at', { ascending: false })
        .limit(10);

    if (erro1) {
        console.error('❌ Erro ao buscar metas mensais:', erro1);
    } else {
        console.log(`✅ Encontradas ${metasMensais?.length || 0} metas mensais`);
        metasMensais?.forEach((meta, i) => {
            console.log(`  ${i + 1}. Loja: ${meta.stores?.name || 'N/A'} | Mês: ${meta.mes_referencia} | Meta: R$ ${meta.meta_valor} | store_id: ${meta.store_id} | colaboradora_id: ${meta.colaboradora_id}`);
        });
    }

    console.log('\n2️⃣ Buscando metas individuais (tipo INDIVIDUAL)...');
    const { data: metasIndividuais, error: erro2 } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('id, tipo, mes_referencia, store_id, colaboradora_id, meta_valor, stores(name), profiles(name)')
        .eq('tipo', 'INDIVIDUAL')
        .order('created_at', { ascending: false })
        .limit(10);

    if (erro2) {
        console.error('❌ Erro ao buscar metas individuais:', erro2);
    } else {
        console.log(`✅ Encontradas ${metasIndividuais?.length || 0} metas individuais`);
        metasIndividuais?.forEach((meta, i) => {
            console.log(`  ${i + 1}. Loja: ${meta.stores?.name || 'N/A'} | Colab: ${meta.profiles?.name || 'N/A'} | Mês: ${meta.mes_referencia} | Meta: R$ ${meta.meta_valor}`);
        });
    }

    // 3. Verificar se há metas órfãs (sem store_id)
    console.log('\n3️⃣ Verificando metas órfãs (sem store_id)...');
    const { data: metasOrfas, error: erro3 } = await supabase
        .schema('sistemaretiradas')
        .from('goals')
        .select('id, tipo, mes_referencia, store_id, colaboradora_id')
        .is('store_id', null);

    if (erro3) {
        console.error('❌ Erro ao buscar metas órfãs:', erro3);
    } else {
        console.log(`${metasOrfas?.length === 0 ? '✅' : '⚠️'} Encontradas ${metasOrfas?.length || 0} metas órfãs`);
        if (metasOrfas && metasOrfas.length > 0) {
            metasOrfas.forEach((meta, i) => {
                console.log(`  ${i + 1}. ID: ${meta.id} | Tipo: ${meta.tipo} | Mês: ${meta.mes_referencia}`);
            });
        }
    }

    // 4. Verificar lojas disponíveis
    console.log('\n4️⃣ Verificando lojas cadastradas...');
    const { data: lojas, error: erro4 } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, active')
        .eq('active', true);

    if (erro4) {
        console.error('❌ Erro ao buscar lojas:', erro4);
    } else {
        console.log(`✅ Encontradas ${lojas?.length || 0} lojas ativas`);
        lojas?.forEach((loja, i) => {
            console.log(`  ${i + 1}. ${loja.name} (ID: ${loja.id})`);
        });
    }

    console.log('\n✅ DIAGNÓSTICO CONCLUÍDO');
}

diagnosticarMetas();
