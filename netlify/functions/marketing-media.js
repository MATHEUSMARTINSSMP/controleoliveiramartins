/**
 * Netlify Function: Criar Job de Geração de Mídia
 * 
 * POST /api/marketing/media
 * 
 * Cria job assíncrono para geração de imagem ou vídeo com IA
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

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
    if (event.httpMethod !== 'POST') {
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

    // Parse body
    const body = JSON.parse(event.body || '{}');
    const {
      type,
      provider,
      model,
      prompt,
      promptOriginal, // Prompt original (antes de expansão)
      promptFinal, // Prompt final usado
      output,
      brand,
      inputImages = [],
      mask,
      promptSpec, // PromptSpec completo (opcional, se veio do builder)
    } = body;

    // Validar campos obrigatórios
    if (!type || !provider || !model || !prompt) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Campos obrigatórios faltando: type, provider, model, prompt',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    if (!['image', 'video'].includes(type)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'type deve ser "image" ou "video"',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    if (!['gemini', 'openai'].includes(provider)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'provider deve ser "gemini" ou "openai"',
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

    // Obter userId e storeId do token (simplificado, ajustar conforme auth real)
    // TODO: Validar JWT e extrair user_id e store_id
    const userId = body.userId || 'temp-user-id';
    const storeId = body.storeId || 'temp-store-id';

    // Verificar rate limit
    const rateLimitCheck = await checkRateLimit(supabase, storeId);
    if (!rateLimitCheck.allowed) {
      return {
        statusCode: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Rate limit excedido',
          code: 'RATE_LIMIT',
          resetAt: rateLimitCheck.resetAt,
        }),
      };
    }

    // Verificar quotas
    const quotaCheck = await checkQuota(supabase, storeId, type);
    if (!quotaCheck.canProceed) {
      return {
        statusCode: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Quota excedida',
          code: 'QUOTA_EXCEEDED',
          daily: quotaCheck.daily,
          monthly: quotaCheck.monthly,
        }),
      };
    }

    // Validar prompt (básico)
    if (prompt.length < 10 || prompt.length > 2000) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Prompt deve ter entre 10 e 2000 caracteres',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    // Criar job ID
    const jobId = uuidv4();

    // Preparar input JSONB
    const input = {
      type,
      provider,
      model,
      prompt,
      output: output || {},
      brand: brand || {},
      inputImages,
      mask: mask || null,
      promptSpec: promptSpec || null,
    };

    // Inserir job
    const { data: job, error: insertError } = await supabase
      .from('marketing_jobs')
      .insert({
        id: jobId,
        store_id: storeId,
        user_id: userId,
        type,
        provider,
        provider_model: model,
        status: 'queued',
        progress: 0,
        input,
        prompt_original: promptOriginal || prompt,
        prompt_final: promptFinal || prompt,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[marketing-media] Erro ao criar job:', insertError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Erro ao criar job',
          code: 'UNKNOWN_ERROR',
        }),
      };
    }

    // Incrementar uso (não bloquear se falhar)
    try {
      await incrementUsage(supabase, storeId, type);
    } catch (error) {
      console.warn('[marketing-media] Erro ao incrementar uso:', error);
    }

    // Log de criação
    console.log('[MARKETING_JOB_CREATED]', {
      jobId,
      storeId,
      userId,
      type,
      provider,
      model,
    });

    return {
      statusCode: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        status: 'queued',
      }),
    };
  } catch (error) {
    console.error('[marketing-media] Erro:', error);
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

/**
 * Verificar rate limit
 */
async function checkRateLimit(supabase, storeId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { count } = await supabase
    .from('marketing_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('created_at', oneHourAgo.toISOString());

  const limit = 100; // Requisições por hora
  const currentCount = count || 0;

  return {
    allowed: currentCount < limit,
    remaining: Math.max(0, limit - currentCount),
    resetAt: new Date(Date.now() + 60 * 60 * 1000),
  };
}

/**
 * Verificar quota
 */
async function checkQuota(supabase, storeId, type) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Buscar uso diário e mensal
  const [dailyData, monthlyData] = await Promise.all([
    supabase
      .from('marketing_usage')
      .select('count')
      .eq('store_id', storeId)
      .eq('period_start', todayStart.toISOString())
      .eq('period_type', 'daily')
      .eq('type', type)
      .single(),
    supabase
      .from('marketing_usage')
      .select('count')
      .eq('store_id', storeId)
      .eq('period_start', monthStart.toISOString())
      .eq('period_type', 'monthly')
      .eq('type', type)
      .single(),
  ]);

  const dailyLimit = 100;
  const monthlyLimit = 2000;

  const daily = {
    currentCount: dailyData.data?.count || 0,
    limitCount: dailyLimit,
    withinLimit: (dailyData.data?.count || 0) < dailyLimit,
  };

  const monthly = {
    currentCount: monthlyData.data?.count || 0,
    limitCount: monthlyLimit,
    withinLimit: (monthlyData.data?.count || 0) < monthlyLimit,
  };

  return {
    daily,
    monthly,
    canProceed: daily.withinLimit && monthly.withinLimit,
  };
}

/**
 * Incrementar uso
 */
async function incrementUsage(supabase, storeId, type) {
  const { error } = await supabase.rpc('increment_marketing_usage', {
    p_store_id: storeId,
    p_type: type,
    p_cost_estimate: 0, // Será calculado depois
  });

  if (error) {
    throw error;
  }
}

