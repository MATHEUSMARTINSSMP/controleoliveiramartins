/**
 * Netlify Scheduled Function: Expiração Automática de Cashback
 * 
 * Roda automaticamente a cada 24h (configurado no netlify.toml)
 * Chama RPC do Supabase para expirar cashback vencido
 * 
 * Schedule: Diariamente às 00:00 (horário do servidor)
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    console.log('[CashbackExpireCron] 🕐 Iniciando expiração automática de cashback...');

    // Inicializar Supabase com service role key (permissões admin)
    const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // Chamar RPC para expirar cashback vencido
        const { data, error } = await supabase.rpc('expirar_cashback_vencido');

        if (error) {
            console.error('[CashbackExpireCron] ❌ Erro ao expirar cashback:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                }),
            };
        }

        const expiredCount = data || 0;
        console.log(`[CashbackExpireCron] ✅ ${expiredCount} transações de cashback expiradas`);

        // Se expirou algum cashback, buscar detalhes para notificação
        if (expiredCount > 0) {
            const { data: expiredTransactions } = await supabase
                .from('cashback_transactions')
                .select(`
          id,
          amount,
          cliente_id,
          tiny_contacts (
            nome,
            email,
            telefone
          )
        `)
                .eq('transaction_type', 'EXPIRED')
                .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Últimos 60 segundos
                .limit(100);

            console.log(`[CashbackExpireCron] 📧 ${expiredTransactions?.length || 0} clientes afetados`);

            // TODO: Enviar notificações por email/SMS
            // for (const transaction of expiredTransactions || []) {
            //   await sendExpirationNotification(transaction);
            // }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `${expiredCount} transações de cashback expiradas`,
                expiredCount,
                timestamp: new Date().toISOString(),
            }),
        };
    } catch (error) {
        console.error('[CashbackExpireCron] ❌ Erro inesperado:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
            }),
        };
    }
};
