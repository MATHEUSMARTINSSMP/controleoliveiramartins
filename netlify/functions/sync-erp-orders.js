/**
 * Netlify Function para sincronização automática de pedidos do Tiny ERP
 * Passo 15: Implementar sincronização automática
 * 
 * Esta função pode ser agendada via Netlify Scheduled Functions ou chamada manualmente
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 * 
 * Para agendar, adicione no netlify.toml:
 * [[plugins]]
 *   package = "@netlify/plugin-scheduled-functions"
 * 
 * E crie um arquivo sync-erp-orders.schedule.js com:
 * exports.handler = async (event, context) => {
 *   // Chama esta função
 * }
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Verificar autenticação (pode usar header Authorization ou secret)
    const authHeader = event.headers.authorization;
    const secretKey = event.headers['x-secret-key'] || event.queryStringParameters?.secret;

    // Se não tiver secret key configurada, usar variável de ambiente
    const expectedSecret = process.env.ERP_SYNC_SECRET || 'change-me-in-production';
    
    if (secretKey !== expectedSecret && !authHeader) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'sistemaretiradas' },
    });

    // Buscar todas as lojas com integração Tiny ERP ativa
    const { data: integrations, error: integrationsError } = await supabase
      .from('erp_integrations')
      .select('store_id, sistema_erp, sync_status')
      .eq('sistema_erp', 'TINY')
      .eq('sync_status', 'CONNECTED');

    if (integrationsError) {
      throw integrationsError;
    }

    if (!integrations || integrations.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'No active Tiny ERP integrations found',
          synced: 0,
        }),
      };
    }

    // Importar função de sincronização
    // Nota: Em produção, você pode precisar adaptar isso para usar uma biblioteca compartilhada
    // ou fazer as chamadas diretamente aqui
    const results = [];

    for (const integration of integrations) {
      try {
        // Aqui você chamaria a função syncTinyOrders
        // Por enquanto, vamos apenas registrar que deveria sincronizar
        // Em produção, você pode usar uma biblioteca compartilhada ou fazer as chamadas diretamente
        
        results.push({
          store_id: integration.store_id,
          status: 'pending',
          message: 'Sincronização deve ser feita via API ou biblioteca compartilhada',
        });

        // TODO: Implementar chamada real à função de sincronização
        // const syncResult = await syncTinyOrders(integration.store_id, { incremental: true });
        // results.push({ store_id: integration.store_id, ...syncResult });
      } catch (error) {
        results.push({
          store_id: integration.store_id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Sincronização automática executada',
        results,
        total: integrations.length,
      }),
    };
  } catch (error) {
    console.error('Erro na sincronização automática:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || 'Erro desconhecido na sincronização',
      }),
    };
  }
};

