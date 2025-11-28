/**
 * Netlify Function: Resgate de Cashback
 * 
 * Endpoint: POST /.netlify/functions/cashback-redeem
 * 
 * Body esperado:
 * {
 *   "cliente_id": "uuid",
 *   "valor_pedido": 100.00,
 *   "valor_cashback_usado": 30.00
 * }
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

    try {
        const { cliente_id, valor_pedido, valor_cashback_usado } = JSON.parse(event.body);

        // Validações básicas
        if (!cliente_id || !valor_pedido || !valor_cashback_usado) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Parâmetros obrigatórios: cliente_id, valor_pedido, valor_cashback_usado',
                }),
            };
        }

        // Inicializar Supabase
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Buscar saldo disponível do cliente
        const { data: balance, error: balanceError } = await supabase
            .from('cashback_balance')
            .select('balance_disponivel')
            .eq('cliente_id', cliente_id)
            .single();

        if (balanceError || !balance) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Cliente não possui saldo de cashback',
                }),
            };
        }

        // Validar se tem saldo suficiente
        if (balance.balance_disponivel < valor_cashback_usado) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Saldo insuficiente. Disponível: R$ ${balance.balance_disponivel.toFixed(2)}`,
                    saldo_disponivel: balance.balance_disponivel,
                }),
            };
        }

        // Buscar configurações de cashback para validar limite de uso
        const { data: settings } = await supabase.rpc('get_cashback_settings', { p_store_id: null });

        const percentual_uso_maximo = settings?.percentual_uso_maximo || 30;
        const valor_maximo_permitido = (valor_pedido * percentual_uso_maximo) / 100;

        // Validar se não excede limite de uso (30% do pedido)
        if (valor_cashback_usado > valor_maximo_permitido) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Cashback excede limite de ${percentual_uso_maximo}% do pedido. Máximo permitido: R$ ${valor_maximo_permitido.toFixed(2)}`,
                    valor_maximo_permitido,
                }),
            };
        }

        // Criar transação de resgate
        const { data: transaction, error: transactionError } = await supabase
            .from('cashback_transactions')
            .insert({
                cliente_id,
                transaction_type: 'REDEEMED',
                amount: valor_cashback_usado,
                description: `Cashback resgatado em pedido de R$ ${valor_pedido.toFixed(2)}`,
            })
            .select()
            .single();

        if (transactionError) {
            console.error('[CashbackRedeem] ❌ Erro ao criar transação:', transactionError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Erro ao processar resgate de cashback',
                }),
            };
        }

        // Saldo é atualizado automaticamente pelo trigger

        console.log(`[CashbackRedeem] ✅ Cashback resgatado: R$ ${valor_cashback_usado.toFixed(2)} (Cliente: ${cliente_id})`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Cashback resgatado com sucesso',
                transaction_id: transaction.id,
                valor_resgatado: valor_cashback_usado,
                novo_saldo: balance.balance_disponivel - valor_cashback_usado,
            }),
        };
    } catch (error) {
        console.error('[CashbackRedeem] ❌ Erro inesperado:', error);
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
