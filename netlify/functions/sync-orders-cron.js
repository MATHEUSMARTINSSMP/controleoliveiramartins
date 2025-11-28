/**
 * NETLIFY SCHEDULED FUNCTION: Sincronização Automática de Pedidos
 * 
 * Roda automaticamente a cada 30 segundos
 * Busca novos pedidos do Tiny ERP e sincroniza com Supabase
 * Gera cashback automaticamente via trigger
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
    console.log('[sync-orders-cron] 🔄 Iniciando sincronização automática de pedidos...');

    try {
        // Buscar todas as lojas ativas
        const { data: stores, error: storesError } = await supabase
            .schema('sistemaretiradas')
            .from('stores')
            .select('id, name')
            .eq('active', true);

        if (storesError) throw storesError;

        if (!stores || stores.length === 0) {
            console.log('[sync-orders-cron] ⚠️ Nenhuma loja ativa encontrada');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'Nenhuma loja ativa' })
            };
        }

        console.log(`[sync-orders-cron] 🏪 ${stores.length} loja(s) ativa(s) encontrada(s)`);

        // Sincronizar cada loja
        const results = [];
        for (const store of stores) {
            try {
                console.log(`[sync-orders-cron] 🔄 Sincronizando loja: ${store.name} (${store.id})`);

                // Chamar a função de sincronização em background
                const syncResponse = await fetch(`${process.env.URL}/.netlify/functions/sync-tiny-orders-background`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        storeId: store.id,
                        mode: 'incremental', // Apenas novos pedidos
                        limit: 20, // Últimos 20 pedidos
                    }),
                });

                const syncResult = await syncResponse.json();

                results.push({
                    store: store.name,
                    success: syncResponse.ok,
                    result: syncResult,
                });

                console.log(`[sync-orders-cron] ✅ Loja ${store.name}: ${syncResult.message || 'OK'}`);
            } catch (storeError) {
                console.error(`[sync-orders-cron] ❌ Erro na loja ${store.name}:`, storeError);
                results.push({
                    store: store.name,
                    success: false,
                    error: storeError.message,
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`[sync-orders-cron] 🎉 Sincronização concluída: ${successCount}/${stores.length} lojas OK`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Sincronização automática concluída`,
                stores: stores.length,
                success: successCount,
                results: results,
            }),
        };
    } catch (error) {
        console.error('[sync-orders-cron] ❌ Erro crítico:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
            }),
        };
    }
};
