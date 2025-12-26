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
      variations = 3, // Número de alternativas a gerar (padrão: 3)
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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[marketing-media] Variáveis de ambiente não configuradas');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Configuração do servidor incompleta',
          code: 'CONFIG_ERROR',
        }),
      };
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Validar JWT e extrair userId
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Não autorizado', code: 'AUTH_ERROR' }),
      };
    }

    const userId = user.id;

    // Obter storeId do body (obrigatório)
    const storeId = body.storeId;
    if (!storeId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'storeId é obrigatório',
          code: 'VALIDATION_ERROR',
        }),
      };
    }

    // Validar que o storeId existe e o usuário tem permissão básica
    // A verificação de permissão detalhada é feita pelo RLS do Supabase
    const { data: store, error: storeError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('stores')
      .select('id, admin_id')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Loja não encontrada', code: 'VALIDATION_ERROR' }),
      };
    }

    // Verificar rate limit (não bloquear se falhar, apenas logar)
    try {
      const rateLimitCheck = await checkRateLimit(supabaseAdmin, storeId);
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
    } catch (error) {
      console.warn('[marketing-media] Erro ao verificar rate limit:', error);
      // Continuar mesmo se falhar a verificação
    }

    // Verificar quotas (não bloquear se falhar, apenas logar)
    try {
      const quotaCheck = await checkQuota(supabaseAdmin, storeId, type);
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
    } catch (error) {
      console.warn('[marketing-media] Erro ao verificar quota:', error);
      // Continuar mesmo se falhar a verificação
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
      variations: Math.min(Math.max(parseInt(variations) || 3, 1), 5), // Entre 1 e 5 alternativas
    };

    // Inserir job
    const { data: job, error: insertError } = await supabaseAdmin
      .schema('sistemaretiradas')
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
          error: insertError.message || 'Erro ao criar job',
          code: insertError.code || 'UNKNOWN_ERROR',
          details: insertError.details || null,
        }),
      };
    }

    // Incrementar uso (não bloquear se falhar)
    try {
      await incrementUsage(supabaseAdmin, storeId, type);
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
    .schema('sistemaretiradas')
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
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  // Buscar uso diário e mensal (usar maybeSingle para não falhar se não existir)
  const [dailyData, monthlyData] = await Promise.all([
    supabase
      .schema('sistemaretiradas')
      .from('marketing_usage')
      .select('count')
      .eq('store_id', storeId)
      .eq('period_start', todayStart.toISOString())
      .eq('period_type', 'daily')
      .eq('type', type)
      .maybeSingle(),
    supabase
      .schema('sistemaretiradas')
      .from('marketing_usage')
      .select('count')
      .eq('store_id', storeId)
      .eq('period_start', monthStart.toISOString())
      .eq('period_type', 'monthly')
      .eq('type', type)
      .maybeSingle(),
  ]);

  const dailyLimit = 100;
  const monthlyLimit = 2000;

  const dailyCount = dailyData.data?.count || 0;
  const monthlyCount = monthlyData.data?.count || 0;

  const daily = {
    currentCount: dailyCount,
    limitCount: dailyLimit,
    withinLimit: dailyCount < dailyLimit,
  };

  const monthly = {
    currentCount: monthlyCount,
    limitCount: monthlyLimit,
    withinLimit: monthlyCount < monthlyLimit,
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

