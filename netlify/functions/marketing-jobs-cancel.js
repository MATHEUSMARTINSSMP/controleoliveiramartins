/**
 * Netlify Function: Cancelar Job
 * 
 * POST /api/marketing/jobs/:id/cancel
 * 
 * Cancela um job em processamento
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Não autorizado', code: 'AUTH_ERROR' }),
      };
    }

    // Extrair job ID do path ou do body
    let jobId;
    try {
      const body = JSON.parse(event.body || '{}');
      jobId = body.jobId;
    } catch (e) {
      // Ignorar erro de parse
    }

    // Se não veio no body, tentar do path
    if (!jobId) {
      const pathParts = event.path.split('/');
      jobId = pathParts[pathParts.length - 2]; // .../jobs/:id/cancel
    }

    if (!jobId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Job ID não fornecido',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Buscar job
    const { data: job, error: fetchError } = await supabase
      .from('marketing_jobs')
      .select('id, status')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Job não encontrado',
          code: 'JOB_NOT_FOUND',
        }),
      };
    }

    // Verificar se pode cancelar
    if (job.status === 'done' || job.status === 'failed' || job.status === 'canceled') {
      return {
        statusCode: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Job já está ${job.status}`,
          code: 'JOB_CANCELED',
        }),
      };
    }

    // Atualizar status para canceled
    const { error: updateError } = await supabase
      .from('marketing_jobs')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[marketing-jobs-cancel] Erro ao cancelar:', updateError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Erro ao cancelar job',
          code: 'UNKNOWN_ERROR',
        }),
      };
    }

    console.log('[MARKETING_JOB_CANCELED]', { jobId, previousStatus: job.status });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        status: 'canceled',
        message: 'Job cancelado com sucesso',
      }),
    };
  } catch (error) {
    console.error('[marketing-jobs-cancel] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'Erro interno',
        code: 'UNKNOWN_ERROR',
      }),
    };
  }
};

