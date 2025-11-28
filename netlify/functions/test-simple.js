/**
 * FUNÇÃO DE TESTE SIMPLES
 * Use para verificar se Netlify Functions está funcionando
 */

exports.handler = async (event, context) => {
    console.log('[test-simple] ✅ Função de teste executada com sucesso!');

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            success: true,
            message: 'Netlify Functions está funcionando!',
            timestamp: new Date().toISOString(),
            env: {
                hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
                hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                hasUrl: !!process.env.URL,
            }
        }),
    };
};
