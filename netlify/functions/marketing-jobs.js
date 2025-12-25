/**
 * Netlify Function: Consultar Status do Job
 * 
 * GET /api/marketing/jobs/:id
 * 
 * Retorna status e progresso de um job de geração
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Validar método
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    // Validar autenticação
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Não autorizado', code: 'AUTH_ERROR' }),
      };
    }

    // Extrair job ID do path
    const pathParts = event.path.split('/');
    const jobId = pathParts[pathParts.length - 1];

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

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Buscar job
    const { data: job, error } = await supabase
      .from('marketing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Job não encontrado',
          code: 'JOB_NOT_FOUND',
        }),
      };
    }

    // Construir resposta baseada no status
    const response = {
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
    };

    // Se concluído, incluir asset
    if (job.status === 'done' && job.result) {
      response.asset = {
        assetId: job.result.assetId,
        type: job.type,
        mediaUrl: job.result.mediaUrl,
        thumbnailUrl: job.result.thumbnailUrl || null,
        mime: job.type === 'image' ? 'image/png' : 'video/mp4',
        meta: job.result.meta || {},
      };
    }

    // Se falhou, incluir erro
    if (job.status === 'failed') {
      response.error = {
        message: job.error_message || 'Erro desconhecido',
        code: job.error_code || 'PROVIDER_ERROR',
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[marketing-jobs] Erro:', error);
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

