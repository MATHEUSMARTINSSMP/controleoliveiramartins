const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestOrders() {
    console.log('🔍 Verificando últimos pedidos sincronizados...\n');

    const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('id, tiny_id, numero_pedido, sync_at, itens')
        .order('sync_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Erro:', error);
        return;
    }

    console.log(`✅ Encontrados ${data.length} pedidos\n`);

    data.forEach((order, idx) => {
        console.log(`\n📦 Pedido #${idx + 1}: ${order.numero_pedido || order.tiny_id}`);
        console.log(`   Sincronizado em: ${order.sync_at}`);

        if (order.itens && Array.isArray(order.itens)) {
            console.log(`   Total de itens: ${order.itens.length}`);

            order.itens.forEach((item, itemIdx) => {
                console.log(`\n   Item ${itemIdx + 1}:`);
                console.log(`     Descrição: ${item.descricao || 'N/A'}`);
                console.log(`     Tamanho: ${item.tamanho || 'NULL'}`);
                console.log(`     Cor: ${item.cor || 'NULL'}`);
                console.log(`     Categoria: ${item.categoria || 'NULL'}`);
                console.log(`     Subcategoria: ${item.subcategoria || 'NULL'}`);
            });
        } else {
            console.log('   ⚠️ Sem itens');
        }
        console.log('   ' + '='.repeat(60));
    });
}

checkLatestOrders();
