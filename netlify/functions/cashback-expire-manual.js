/**
 * Netlify Function: Trigger Manual de Expiração de Cashback
 * 
 * Endpoint: POST /.netlify/functions/cashback-expire-manual
 * 
 * Permite que admin force expiração de cashback via dashboard
 * (Não precisa esperar o cron diário)
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    console.log('[CashbackExpireManual] 🕐 Expiração manual iniciada...');

    // Inicializar Supabase com service role key
    const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // Chamar RPC para expirar cashback vencido
        const { data, error } = await supabase.rpc('expirar_cashback_vencido');

        if (error) {
            console.error('[CashbackExpireManual] ❌ Erro ao expirar cashback:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                }),
            };
        }

        const expiredCount = data || 0;
        console.log(`[CashbackExpireManual] ✅ ${expiredCount} transações expiradas`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `${expiredCount} transações de cashback expiradas`,
                expiredCount,
                timestamp: new Date().toISOString(),
            }),
        };
    } catch (error) {
        console.error('[CashbackExpireManual] ❌ Erro inesperado:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
            }),
        };
    }
};
