/**
 * NETLIFY SCHEDULED FUNCTION: Sincronização Automática de Pedidos
 * 
 * Roda automaticamente a cada 1 minuto
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
    try {
        const startTime = new Date();
        console.log(`[sync-orders-cron] 🔄 Iniciando sincronização automática de pedidos... [${startTime.toISOString()}]`);

        // Validar variáveis de ambiente
        console.log('[sync-orders-cron] 📋 Verificando variáveis de ambiente...');
        console.log('- VITE_SUPABASE_URL:', supabaseUrl ? '✅ OK' : '❌ FALTANDO');
        console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ OK' : '❌ FALTANDO');
        console.log('- URL:', process.env.URL ? '✅ OK' : '⚠️ FALTANDO (usando fallback)');

        try {
            // Buscar todas as lojas ativas
            const { data: stores, error: storesError } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name')
                .eq('active', true);

            if (storesError) {
                console.error('[sync-orders-cron] ❌ Erro ao buscar lojas:', storesError);
                throw storesError;
            }

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
            const baseUrl = process.env.URL || 'https://eleveaone.com.br';

            for (const store of stores) {
                try {
                    console.log(`[sync-orders-cron] 🔄 Sincronizando loja: ${store.name} (${store.id})`);

                    // Chamar a função de sincronização em background
                    const syncResponse = await fetch(`${baseUrl}/.netlify/functions/sync-tiny-orders-background`, {
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
                    console.log(`[sync-orders-cron] 📊 Detalhes:`, JSON.stringify(syncResult, null, 2));
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
            const endTime = new Date();
            const duration = endTime - startTime;

            console.log(`[sync-orders-cron] 🎉 Sincronização concluída: ${successCount}/${stores.length} lojas OK`);
            console.log(`[sync-orders-cron] ⏱️ Duração: ${duration}ms`);
            console.log(`[sync-orders-cron] 📅 Fim: ${endTime.toISOString()}`);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: `Sincronização automática concluída`,
                    stores: stores.length,
                    success: successCount,
                    duration: `${duration}ms`,
                    timestamp: endTime.toISOString(),
                    results: results,
                }),
            };
        } catch (error) {
            console.error('[sync-orders-cron] ❌ Erro crítico:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: error.message,
                    timestamp: new Date().toISOString(),
                }),
            };
        }
    } catch (fatalError) {
        console.error('[sync-orders-cron] 💀 ERRO FATAL:', fatalError);
        console.error('Stack trace:', fatalError.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Fatal error in cron job',
                message: fatalError.message,
                stack: fatalError.stack,
                timestamp: new Date().toISOString(),
            }),
        };
    }
};
