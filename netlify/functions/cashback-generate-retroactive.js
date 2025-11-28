/**
 * Netlify Function: Gerar Cashback Retroativo
 * 
 * Endpoint: POST /.netlify/functions/cashback-generate-retroactive
 * 
 * Body esperado:
 * {
 *   "dias": 7  // Opcional, padrão 7 dias
 * }
 * 
 * Gera cashback para pedidos passados que não tiveram cashback gerado
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
        const body = event.body ? JSON.parse(event.body) : {};
        const dias = body.dias || 7;

        console.log(`[CashbackRetroactive] 🔄 Gerando cashback retroativo para últimos ${dias} dias...`);

        // Inicializar Supabase
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Buscar pedidos elegíveis dos últimos N dias
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - dias);

        const { data: pedidos, error: pedidosError } = await supabase
            .from('tiny_orders')
            .select(`
        id,
        cliente_id,
        store_id,
        valor_total,
        numero_pedido,
        situacao,
        tiny_contacts (
          cpf_cnpj
        )
      `)
            .gte('data_pedido', dataInicio.toISOString())
            .not('cliente_id', 'is', null)
            .gt('valor_total', 0);

        if (pedidosError) {
            console.error('[CashbackRetroactive] ❌ Erro ao buscar pedidos:', pedidosError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Erro ao buscar pedidos',
                }),
            };
        }

        let gerados = 0;
        let ignorados = 0;
        let erros = 0;

        for (const pedido of pedidos || []) {
            try {
                // 🔴 VALIDAÇÃO OBRIGATÓRIA: Cliente DEVE ter CPF
                const cpfCnpj = pedido.tiny_contacts?.cpf_cnpj;
                if (!cpfCnpj || cpfCnpj.trim() === '') {
                    console.log(`[CashbackRetroactive] 🚫 Pedido ${pedido.numero_pedido} ignorado - Cliente sem CPF`);
                    ignorados++;
                    continue;
                }

                // Validar se pedido não está cancelado
                if (pedido.situacao && ['cancelado', 'Cancelado'].includes(pedido.situacao)) {
                    ignorados++;
                    continue;
                }

                // Verificar se já existe cashback para este pedido
                const { data: existingCashback } = await supabase
                    .from('cashback_transactions')
                    .select('id')
                    .eq('tiny_order_id', pedido.id)
                    .eq('transaction_type', 'EARNED')
                    .maybeSingle();

                if (existingCashback) {
                    ignorados++;
                    continue;
                }

                // Gerar cashback
                const { data: result, error: gerarError } = await supabase.rpc('gerar_cashback', {
                    p_tiny_order_id: pedido.id,
                    p_cliente_id: pedido.cliente_id,
                    p_store_id: pedido.store_id,
                    p_valor_total: pedido.valor_total,
                });

                if (gerarError || !result?.success) {
                    console.error(`[CashbackRetroactive] ❌ Erro no pedido ${pedido.numero_pedido}:`, gerarError || result?.error);
                    erros++;
                } else {
                    console.log(`[CashbackRetroactive] ✅ Cashback gerado para pedido ${pedido.numero_pedido}`);
                    gerados++;
                }
            } catch (error) {
                console.error(`[CashbackRetroactive] ❌ Erro ao processar pedido ${pedido.numero_pedido}:`, error);
                erros++;
            }
        }

        console.log(`[CashbackRetroactive] ✅ Concluído: ${gerados} gerados, ${ignorados} ignorados, ${erros} erros`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Cashback retroativo processado',
                gerados,
                ignorados,
                erros,
                total_analisados: pedidos?.length || 0,
            }),
        };
    } catch (error) {
        console.error('[CashbackRetroactive] ❌ Erro inesperado:', error);
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
