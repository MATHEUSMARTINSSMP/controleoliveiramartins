
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking tiny_orders table (itens column)...');

    const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('id, tiny_id, data_pedido, itens')
        .order('data_pedido', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log(`Found ${data.length} recent orders.`);

    data.forEach(order => {
        console.log(`Order ${order.tiny_id} (${order.data_pedido}):`);

        if (order.itens && Array.isArray(order.itens)) {
            console.log(`  - Itens (${order.itens.length}):`);
            order.itens.forEach((item, idx) => {
                console.log(`    [${idx}] SKU: ${item.codigo || item.sku}`);
                console.log(`         Tamanho: ${item.tamanho}`);
                console.log(`         Cor: ${item.cor}`);
                console.log(`         Categoria: ${item.categoria}`);
                console.log(`         Subcategoria: ${item.subcategoria}`);
                console.log(`         Raw Item Keys: ${Object.keys(item).join(', ')}`);
            });
        } else {
            console.log('  - No itens or invalid format:', order.itens);
        }
        console.log('---');
    });
}

checkData();
