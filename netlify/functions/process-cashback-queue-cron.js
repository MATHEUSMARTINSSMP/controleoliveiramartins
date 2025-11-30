/**
 * NETLIFY SCHEDULED FUNCTION: Processar Fila de WhatsApp de Cashback
 * 
 * Roda automaticamente a cada 1 minuto
 * Chama a Edge Function do Supabase para processar a fila
 * A Edge Function usa a mesma lógica de envio WhatsApp que já existe
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kktsbnrnlnzyofupegjc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/process-cashback-queue`;

exports.handler = async (event, context) => {
    try {
        const startTime = new Date();
        console.log(`[process-cashback-queue-cron] 🔄 Iniciando processamento da fila de WhatsApp... [${startTime.toISOString()}]`);

        // Chamar Edge Function do Supabase
        console.log(`[process-cashback-queue-cron] 📡 Chamando Edge Function: ${EDGE_FUNCTION_URL}`);

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({}),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[process-cashback-queue-cron] ❌ Erro na Edge Function:', result);
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: 'Erro ao processar fila',
                    details: result,
                    timestamp: new Date().toISOString(),
                }),
            };
        }

        const endTime = new Date();
        const duration = endTime - startTime;

        console.log(`[process-cashback-queue-cron] ✅ Processamento concluído:`);
        console.log(`  - Processados: ${result.processed || 0}`);
        console.log(`  - Enviados: ${result.sent || 0}`);
        console.log(`  - Pulados: ${result.skipped || 0}`);
        console.log(`  - Falhados: ${result.failed || 0}`);
        console.log(`[process-cashback-queue-cron] ⏱️ Duração: ${duration}ms`);
        console.log(`[process-cashback-queue-cron] 📅 Fim: ${endTime.toISOString()}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Fila processada com sucesso',
                ...result,
                duration: `${duration}ms`,
                timestamp: endTime.toISOString(),
            }),
        };
    } catch (error) {
        console.error('[process-cashback-queue-cron] ❌ Erro crítico:', error);
        console.error('Stack trace:', error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Erro crítico ao processar fila',
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            }),
        };
    }
};

