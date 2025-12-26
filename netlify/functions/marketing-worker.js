/**
 * Netlify Scheduled Function: Worker de Processamento
 * 
 * Processa jobs assíncronos de geração de mídia
 * Executa a cada 1 minuto (configurar no netlify.toml)
 * 
 * netlify.toml:
 * [[plugins]]
 * package = "@netlify/plugin-scheduled-functions"
 * 
 * [functions.marketing-worker]
 * schedule = "cron(0/1 * * * *)"  // A cada minuto
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MAX_JOBS_PER_RUN = 5;
const MAX_RETRIES = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Permitir chamada manual via POST ou GET (para scheduled functions)
  const isManual = event.httpMethod === 'POST' || (event.httpMethod === 'GET' && event.queryStringParameters?.manual === 'true');
  
  console.log(`[marketing-worker] Iniciando processamento... (${isManual ? 'manual' : 'scheduled'})`);

  // Validar variáveis de ambiente
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[marketing-worker] Variáveis de ambiente não configuradas');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Configuração incompleta',
        details: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados'
      }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  try {
    // Buscar jobs queued (limitado)
    const { data: jobs, error: fetchError } = await supabase
      .from('marketing_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (fetchError) {
      console.error('[marketing-worker] Erro ao buscar jobs:', fetchError);
      return { 
        statusCode: 500, 
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Erro ao buscar jobs', details: fetchError.message }) 
      };
    }

    if (!jobs || jobs.length === 0) {
      console.log('[marketing-worker] Nenhum job pendente');
      return { 
        statusCode: 200, 
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Nenhum job para processar', processed: 0 }) 
      };
    }

    console.log(`[marketing-worker] Processando ${jobs.length} jobs`);

    // Processar cada job
    const results = await Promise.allSettled(
      jobs.map((job) => processJob(supabase, job))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`[marketing-worker] Concluído: ${successful} sucesso, ${failed} falhas`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        processed: jobs.length,
        successful,
        failed,
        jobs: jobs.map(j => ({ id: j.id, type: j.type, provider: j.provider })),
      }),
    };
  } catch (error) {
    console.error('[marketing-worker] Erro crítico:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Processar um job
 */
async function processJob(supabase, job) {
  const jobId = job.id;
  const startTime = Date.now();

  try {
    // Verificar idempotência (se já foi processado)
    if (job.status !== 'queued') {
      console.log(`[marketing-worker] Job ${jobId} já foi processado (status: ${job.status})`);
      return;
    }

    // Atualizar status para processing
    await supabase
      .from('marketing_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`[marketing-worker] Processando job ${jobId} (${job.type}, ${job.provider})`);

    // Processar baseado no tipo
    if (job.type === 'image') {
      await processImageJob(supabase, job);
    } else if (job.type === 'video') {
      await processVideoJob(supabase, job);
    } else {
      throw new Error(`Tipo de job não suportado: ${job.type}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[marketing-worker] Job ${jobId} concluído em ${duration}ms`);
  } catch (error) {
    console.error(`[marketing-worker] Erro ao processar job ${jobId}:`, error);

    // Marcar como failed
    await supabase
      .from('marketing_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        error_code: 'PROVIDER_ERROR',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw error;
  }
}

/**
 * Processar job de imagem
 */
async function processImageJob(supabase, job) {
  const jobId = job.id;
  const input = job.input;
  const variations = input.variations || 1; // Número de alternativas (padrão: 1)

  // Preparar input para adapter
  const adapterInput = {
    type: 'image',
    provider: job.provider,
    model: job.provider_model,
    prompt: input.prompt || job.prompt_final,
    output: input.output || {},
    inputImages: input.inputImages || [],
    mask: input.mask,
  };

  // Gerar múltiplas variações
  const assets = [];
  const assetIds = [];
  const mediaUrls = [];

  for (let variation = 0; variation < variations; variation++) {
    console.log(`[marketing-worker] Gerando variação ${variation + 1}/${variations} (job ${jobId})`);

    // Gerar imagem com retry
    let imageResult;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[marketing-worker] Tentativa ${attempt}/${MAX_RETRIES} para gerar imagem variação ${variation + 1} (job ${jobId})`);

        imageResult = await generateImageWithRetry(adapterInput);
        break; // Sucesso
      } catch (error) {
        lastError = error;
        console.warn(`[marketing-worker] Tentativa ${attempt} falhou para variação ${variation + 1}:`, error.message);

        if (attempt < MAX_RETRIES) {
          // Backoff exponencial
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (!imageResult) {
      throw lastError || new Error(`Falha ao gerar imagem variação ${variation + 1} após todas as tentativas`);
    }

    // Upload para storage
    const assetId = uuidv4();
    const uploadResult = await uploadMediaToSupabase(
      supabase,
      imageResult.imageData,
      imageResult.mimeType,
      job.store_id,
      job.user_id,
      assetId,
      'image'
    );

    // Garantir que temos uma URL (public_url ou signed_url)
    const assetUrl = uploadResult.publicUrl || uploadResult.signedUrl;
    if (!assetUrl) {
      throw new Error(`Erro: uploadResult não retornou URL válida (publicUrl: ${uploadResult.publicUrl}, signedUrl: ${uploadResult.signedUrl})`);
    }

    // Extrair filename do path (último componente)
    const filename = uploadResult.path.split('/').pop() || `${assetId}.${extension}`;

    // Criar registro de asset
    const { data: asset, error: assetError } = await supabase
      .from('marketing_assets')
      .insert({
        id: assetId,
        store_id: job.store_id,
        user_id: job.user_id,
        type: 'image',
        provider: job.provider,
        provider_model: job.provider_model,
        prompt: adapterInput.prompt,
        storage_path: uploadResult.path,
        url: assetUrl, // Coluna obrigatória (legacy)
        filename: filename, // Coluna obrigatória
        mime_type: imageResult.mimeType,
        public_url: uploadResult.publicUrl,
        signed_url: uploadResult.signedUrl,
        signed_expires_at: uploadResult.signedExpiresAt?.toISOString(),
        meta: {
          width: imageResult.width,
          height: imageResult.height,
          mimeType: imageResult.mimeType,
          variation: variation + 1,
          totalVariations: variations,
        },
        job_id: jobId,
      })
      .select()
      .single();

    if (assetError) {
      throw new Error(`Erro ao criar asset variação ${variation + 1}: ${assetError.message}`);
    }

    assets.push(asset);
    assetIds.push(asset.id);
    mediaUrls.push(uploadResult.publicUrl || uploadResult.signedUrl);

    console.log(`[marketing-worker] Variação ${variation + 1}/${variations} gerada e salva: ${assetId}`);
  }

  // Atualizar job como done com todas as variações
  const result = variations === 1
    ? {
        assetId: assetIds[0],
        mediaUrl: mediaUrls[0],
        meta: {
          width: assets[0].meta?.width,
          height: assets[0].meta?.height,
        },
      }
    : {
        assetIds,
        mediaUrls,
        meta: {
          width: assets[0]?.meta?.width,
          height: assets[0]?.meta?.height,
          variations: variations,
        },
      };

  await supabase
    .from('marketing_jobs')
    .update({
      status: 'done',
      progress: 100,
      result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  console.log(`[marketing-worker] Job ${jobId} concluído com ${variations} variação(ões)`);
}

/**
 * Processar job de vídeo
 */
async function processVideoJob(supabase, job) {
  const jobId = job.id;
  const input = job.input;

  // Se não tem provider_ref, iniciar geração
  if (!job.provider_ref) {
    // Iniciar geração de vídeo
    const adapterInput = {
      type: 'video',
      provider: job.provider,
      model: job.provider_model,
      prompt: input.prompt || job.prompt_final,
      output: input.output || {},
      inputImages: input.inputImages || [],
    };

    const operation = await startVideoGenerationWithRetry(adapterInput);

    // Salvar provider_ref e continuar polling depois
    await supabase
      .from('marketing_jobs')
      .update({
        provider_ref: operation.operationId,
        progress: 10,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`[marketing-worker] Iniciada geração de vídeo (operation: ${operation.operationId})`);
    return; // Volta no próximo ciclo para polling
  }

  // Fazer polling do status
  const status = await pollVideoStatusWithRetry(job.provider_ref, job.provider);

  if (!status.done) {
    // Calcular progresso estimado baseado no tempo decorrido
    const elapsedSeconds = Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000);
    const elapsedMinutes = elapsedSeconds / 60;
    
    // Progresso mais realista:
    // - Primeiros 2 minutos: 10-30%
    // - 2-5 minutos: 30-60%
    // - 5-10 minutos: 60-85%
    // - 10+ minutos: 85-95% (aguardando finalização)
    let progress;
    if (elapsedMinutes < 2) {
      progress = Math.min(30, 10 + Math.floor(elapsedSeconds / 4)); // 1% a cada 4 segundos nos primeiros 2 min
    } else if (elapsedMinutes < 5) {
      progress = Math.min(60, 30 + Math.floor((elapsedMinutes - 2) * 10)); // 10% por minuto entre 2-5 min
    } else if (elapsedMinutes < 10) {
      progress = Math.min(85, 60 + Math.floor((elapsedMinutes - 5) * 5)); // 5% por minuto entre 5-10 min
    } else {
      progress = Math.min(95, 85 + Math.floor((elapsedMinutes - 10) * 0.5)); // Muito lento após 10 min
    }
    
    console.log(`[marketing-worker] Atualizando progresso do vídeo: ${progress}% (${elapsedMinutes.toFixed(1)} min decorridos)`);
    
    await supabase
      .from('marketing_jobs')
      .update({
        progress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    return;
  }

  if (status.error) {
    throw new Error(status.error);
  }

  // Download do vídeo
  let videoBuffer;
  if (job.provider === 'gemini' && status.videoUri) {
    videoBuffer = await downloadVideoFromGemini(status.videoUri);
  } else if (job.provider === 'openai') {
    videoBuffer = await downloadVideoFromOpenAI(job.provider_ref);
  } else {
    throw new Error('Método de download não implementado para este provider');
  }

  // Upload para storage
  const assetId = uuidv4();
  const uploadResult = await uploadMediaToSupabase(
    supabase,
    videoBuffer,
    'video/mp4',
    job.store_id,
    job.user_id,
    assetId,
    'video'
  );

  // Garantir que temos uma URL (para vídeos, geralmente signed_url)
  const assetUrl = uploadResult.signedUrl || uploadResult.publicUrl;
  if (!assetUrl) {
    throw new Error(`Erro: uploadResult não retornou URL válida para vídeo (publicUrl: ${uploadResult.publicUrl}, signedUrl: ${uploadResult.signedUrl})`);
  }

  // Extrair filename do path (último componente)
  const filename = uploadResult.path.split('/').pop() || `${assetId}.mp4`;

  // Criar registro de asset
  const { data: asset, error: assetError } = await supabase
    .from('marketing_assets')
    .insert({
      id: assetId,
      store_id: job.store_id,
      user_id: job.user_id,
      type: 'video',
      provider: job.provider,
      provider_model: job.provider_model,
      prompt: input.prompt || job.prompt_final,
      storage_path: uploadResult.path,
      url: assetUrl, // Coluna obrigatória (legacy)
      filename: filename, // Coluna obrigatória
      mime_type: 'video/mp4',
      public_url: uploadResult.publicUrl,
      signed_url: uploadResult.signedUrl,
      signed_expires_at: uploadResult.signedExpiresAt?.toISOString(),
      meta: {
        mimeType: 'video/mp4',
      },
      job_id: jobId,
    })
    .select()
    .single();

  if (assetError) {
    throw new Error(`Erro ao criar asset: ${assetError.message}`);
  }

  // Atualizar job como done
  await supabase
    .from('marketing_jobs')
    .update({
      status: 'done',
      progress: 100,
      result: {
        assetId: asset.id,
        mediaUrl: uploadResult.signedUrl,
        meta: {},
      },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  console.log(`[marketing-worker] Vídeo gerado e salvo: ${assetId}`);
}

/**
 * Wrappers com retry (simplificados)
 * Nota: Como estamos em Node.js puro, vamos fazer as chamadas diretas às APIs
 */
async function generateImageWithRetry(input) {
  if (input.provider === 'gemini') {
    return await generateImageWithGeminiDirect(input);
  } else {
    return await generateImageWithOpenAIDirect(input);
  }
}

/**
 * Gerar imagem com Gemini (chamada direta)
 */
async function generateImageWithGeminiDirect(input) {
  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const MODEL = 'gemini-2.5-flash-image';

  // Enriquecer prompt com informações completas do formato
  let enrichedPrompt = input.prompt;
  if (input.output) {
    const formatInfo = [];
    
    // Informações básicas de tamanho
    if (input.output.size) {
      const [width, height] = input.output.size.split('x').map(Number);
      formatInfo.push(`Dimensões: ${width}x${height} pixels (${input.output.size})`);
    }
    
    // Aspect ratio
    if (input.output.aspectRatio) {
      formatInfo.push(`Proporção: ${input.output.aspectRatio}`);
    }
    
    // Nome e descrição do formato
    if (input.output.formatName) {
      formatInfo.push(`Formato: ${input.output.formatName}`);
      if (input.output.formatDescription) {
        formatInfo.push(`Descrição: ${input.output.formatDescription}`);
      }
    }
    
    // Construir prompt enriquecido
    if (formatInfo.length > 0) {
      const formatDetails = formatInfo.join('\n');
      enrichedPrompt = `${input.prompt}\n\n=== CONTEXTO COMERCIAL ===\nEsta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz, com composição que direciona atenção para pontos importantes e reforça branding.\n\n=== ESPECIFICAÇÕES DO FORMATO ===\n${formatDetails}\n\nIMPORTANTE: A imagem deve ser gerada exatamente nestas especificações. Garanta que a composição, elementos visuais e layout estejam completamente otimizados para este formato específico do Instagram como um POST COMERCIAL PROFISSIONAL que vende e engaja.`;
    } else {
      enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Esta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz e adequada para redes sociais de empresas.`;
    }
  } else {
    enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Esta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz e adequada para redes sociais de empresas.`;
  }

  // Construir parts
  const parts = [{ text: enrichedPrompt }];

  // Adicionar imagens se houver
  if (input.inputImages && input.inputImages.length > 0) {
    for (const imgBase64 of input.inputImages) {
      const normalized = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: normalized,
        },
      });
    }
  }

  const response = await fetch(
    `${BASE_URL}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const imagePart = data.candidates[0]?.content?.parts?.find((p) => p.inlineData);
  
  if (!imagePart?.inlineData) {
    throw new Error('Resposta do Gemini não contém imagem');
  }

  const imageBase64 = imagePart.inlineData.data;
  const imageBuffer = Buffer.from(imageBase64, 'base64');

  return {
    imageData: imageBuffer,
    width: 1024,
    height: 1024,
    mimeType: 'image/png',
  };
}

/**
 * Gerar imagem com OpenAI (chamada direta)
 * Suporta: texto apenas, inpainting com máscara
 */
/**
 * Normalizar tamanho de imagem para OpenAI
 * OpenAI aceita apenas: '1024x1024', '1024x1536', '1536x1024', 'auto'
 */
function normalizeOpenAISize(size) {
  if (!size) return '1024x1024';
  
  // Se já for um tamanho válido, retornar
  const validSizes = ['1024x1024', '1024x1536', '1536x1024', 'auto'];
  if (validSizes.includes(size)) {
    return size;
  }
  
  // Tentar mapear tamanhos comuns do Instagram para tamanhos válidos
  const [width, height] = size.split('x').map(Number);
  
  // Quadrado (1:1)
  if (width === height) {
    return '1024x1024';
  }
  
  // Vertical (9:16 ou similar)
  if (height > width) {
    return '1024x1536';
  }
  
  // Horizontal (16:9 ou similar)
  if (width > height) {
    return '1536x1024';
  }
  
  // Fallback
  return '1024x1024';
}

async function generateImageWithOpenAIDirect(input) {
  const BASE_URL = 'https://api.openai.com/v1';
  const MODEL = input.model || 'gpt-image-1-mini';

  // Se tem máscara e imagem de entrada, usar inpainting
  if (input.mask && input.inputImages && input.inputImages.length > 0) {
    // Para inpainting, usar multipart/form-data (Web API FormData)
    const formData = new FormData();
    
    // Converter base64 para Buffer
    const imageBase64 = input.inputImages[0].includes(',') 
      ? input.inputImages[0].split(',')[1] 
      : input.inputImages[0];
    const maskBase64 = input.mask.includes(',') 
      ? input.mask.split(',')[1] 
      : input.mask;

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const maskBuffer = Buffer.from(maskBase64, 'base64');

    // Criar Blob objects (Node.js 18+ tem FormData global)
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    const maskBlob = new Blob([maskBuffer], { type: 'image/png' });

    // Enriquecer prompt com informações completas do formato
    let enrichedPrompt = input.prompt;
    if (input.output) {
      const formatInfo = [];
      
      // Nome do formato primeiro
      if (input.output.formatName) {
        formatInfo.push(`Formato: ${input.output.formatName}`);
      }
      
      // Descrição do formato
      if (input.output.formatDescription) {
        formatInfo.push(`Descrição: ${input.output.formatDescription}`);
      }
      
      // Dimensões (priorizar formatDimensions se disponível, senão calcular do size)
      if (input.output.formatDimensions) {
        formatInfo.push(`Dimensões: ${input.output.formatDimensions}`);
      } else if (input.output.size) {
        const [width, height] = input.output.size.split('x').map(Number);
        formatInfo.push(`Dimensões: ${width}x${height} pixels (${input.output.size})`);
      }
      
      // Aspect ratio
      if (input.output.aspectRatio) {
        formatInfo.push(`Proporção: ${input.output.aspectRatio}`);
      }
      
      // Construir prompt enriquecido
      if (formatInfo.length > 0) {
        const formatDetails = formatInfo.join('\n');
        enrichedPrompt = `${input.prompt}\n\n=== CONTEXTO COMERCIAL ===\nEsta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz, com composição que direciona atenção para pontos importantes e reforça branding.\n\n=== ESPECIFICAÇÕES DO FORMATO ===\n${formatDetails}\n\nIMPORTANTE: A imagem deve ser gerada exatamente nestas especificações. Garanta que a composição, elementos visuais e layout estejam completamente otimizados para este formato específico do Instagram como um POST COMERCIAL PROFISSIONAL que vende e engaja.`;
      } else {
        enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Esta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz e adequada para redes sociais de empresas.`;
      }
    } else {
      enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Esta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz e adequada para redes sociais de empresas.`;
    }

    formData.append('image', imageBlob, 'image.png');
    formData.append('mask', maskBlob, 'mask.png');
    formData.append('prompt', enrichedPrompt);
    const normalizedSize = normalizeOpenAISize(input.output?.size || '1024x1024');
    formData.append('size', normalizedSize);
    formData.append('n', '1');

    const response = await fetch(`${BASE_URL}/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        // Não definir Content-Type, deixar fetch definir com boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Inpainting API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Validar resposta da API
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Resposta da API OpenAI não contém dados de imagem');
    }
    
    // OpenAI retorna URL, não base64 - fazer download
    const imageUrl = data.data[0].url;
    if (!imageUrl) {
      throw new Error('URL da imagem não encontrada na resposta da API');
    }
    
    console.log(`[marketing-worker] Baixando imagem da URL: ${imageUrl.substring(0, 50)}...`);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Erro ao baixar imagem da URL: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBufferResult = Buffer.from(await imageResponse.arrayBuffer());
    if (!imageBufferResult || imageBufferResult.length === 0) {
      throw new Error('Imagem baixada está vazia ou inválida');
    }
    
    console.log(`[marketing-worker] Imagem baixada com sucesso (${imageBufferResult.length} bytes)`);

    const [width, height] = (input.output?.size || '1024x1024').split('x').map(Number);

    return {
      imageData: imageBufferResult,
      width,
      height,
      mimeType: 'image/png',
    };
  }

  // Enriquecer prompt com informações completas do formato
  let enrichedPrompt = input.prompt;
  if (input.output) {
    const formatInfo = [];
    
    // Informações básicas de tamanho
    if (input.output.size) {
      const [width, height] = input.output.size.split('x').map(Number);
      formatInfo.push(`Dimensões: ${width}x${height} pixels (${input.output.size})`);
    }
    
    // Aspect ratio
    if (input.output.aspectRatio) {
      formatInfo.push(`Proporção: ${input.output.aspectRatio}`);
    }
    
    // Nome e descrição do formato
    if (input.output.formatName) {
      formatInfo.push(`Formato: ${input.output.formatName}`);
      if (input.output.formatDescription) {
        formatInfo.push(`Descrição: ${input.output.formatDescription}`);
      }
    }
    
    // Construir prompt enriquecido
    if (formatInfo.length > 0) {
      const formatDetails = formatInfo.join('\n');
      enrichedPrompt = `${input.prompt}\n\n=== CONTEXTO COMERCIAL ===\nEsta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz, com composição que direciona atenção para pontos importantes e reforça branding.\n\n=== ESPECIFICAÇÕES DO FORMATO ===\n${formatDetails}\n\nIMPORTANTE: A imagem deve ser gerada exatamente nestas especificações. Garanta que a composição, elementos visuais e layout estejam completamente otimizados para este formato específico do Instagram como um POST COMERCIAL PROFISSIONAL que vende e engaja.`;
    } else {
      // Adicionar contexto comercial mesmo sem formato específico
      enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Esta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz e adequada para redes sociais de empresas.`;
    }
  } else {
    // Adicionar contexto comercial mesmo sem output
    enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Esta é uma imagem para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. A imagem deve ser profissional, comercialmente eficaz e adequada para redes sociais de empresas.`;
  }

  // Geração normal (texto apenas)
  const normalizedSize = normalizeOpenAISize(input.output?.size || '1024x1024');
  const payload = {
    model: MODEL,
    prompt: enrichedPrompt,
    size: normalizedSize,
    n: 1,
  };

  const response = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Validar resposta da API
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error('Resposta da API OpenAI não contém dados de imagem');
  }
  
  // OpenAI retorna URL, não base64 - fazer download
  const imageUrl = data.data[0].url;
  if (!imageUrl) {
    throw new Error('URL da imagem não encontrada na resposta da API');
  }
  
  console.log(`[marketing-worker] Baixando imagem da URL: ${imageUrl.substring(0, 50)}...`);
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Erro ao baixar imagem da URL: ${imageResponse.status} ${imageResponse.statusText}`);
  }
  
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Imagem baixada está vazia ou inválida');
  }
  
  console.log(`[marketing-worker] Imagem baixada com sucesso (${imageBuffer.length} bytes)`);

  const [width, height] = (payload.size || '1024x1024').split('x').map(Number);

  return {
    imageData: imageBuffer,
    width,
    height,
    mimeType: 'image/png',
  };
}

async function startVideoGenerationWithRetry(input) {
  if (input.provider === 'gemini') {
    return await startVideoGenerationWithGeminiDirect(input);
  } else {
    return await startVideoGenerationWithOpenAIDirect(input);
  }
}

async function pollVideoStatusWithRetry(operationId, provider) {
  if (provider === 'gemini') {
    return await pollVideoStatusGeminiDirect(operationId);
  } else {
    return await pollVideoStatusOpenAIDirect(operationId);
  }
}

/**
 * Iniciar geração de vídeo Gemini (chamada direta)
 */
async function startVideoGenerationWithGeminiDirect(input) {
  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const MODEL = input.model || 'veo-2.0-generate-001';

  // Enriquecer prompt com informações completas do formato
  let enrichedPrompt = input.prompt;
  if (input.output) {
    const formatInfo = [];
    
    // Aspect ratio
    if (input.output.aspectRatio) {
      formatInfo.push(`Proporção: ${input.output.aspectRatio}`);
    }
    
    // Duração
    if (input.output.seconds) {
      formatInfo.push(`Duração: ${input.output.seconds} segundos`);
    }
    
    // Nome e descrição do formato
    if (input.output.formatName) {
      formatInfo.push(`Formato: ${input.output.formatName}`);
      if (input.output.formatDescription) {
        formatInfo.push(`Descrição: ${input.output.formatDescription}`);
      }
    }
    
    // Dimensões (se disponível)
    if (input.output.size) {
      const [width, height] = input.output.size.split('x').map(Number);
      formatInfo.push(`Dimensões: ${width}x${height} pixels (${input.output.size})`);
    }
    
    // Construir prompt enriquecido
    if (formatInfo.length > 0) {
      const formatDetails = formatInfo.join('\n');
      enrichedPrompt = `${input.prompt}\n\n=== CONTEXTO COMERCIAL ===\nEste é um vídeo para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. O vídeo deve ser profissional, comercialmente eficaz, com composição e movimento que direciona atenção para pontos importantes e reforça branding.\n\n=== ESPECIFICAÇÕES DO FORMATO ===\n${formatDetails}\n\nIMPORTANTE: O vídeo deve ser gerado exatamente nestas especificações. Garanta que a composição, movimento, câmera e elementos visuais estejam completamente otimizados para este formato específico do Instagram como um POST COMERCIAL PROFISSIONAL que vende e engaja.`;
    } else {
      enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Este é um vídeo para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. O vídeo deve ser profissional, comercialmente eficaz e adequado para redes sociais de empresas.`;
    }
  } else {
    enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Este é um vídeo para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. O vídeo deve ser profissional, comercialmente eficaz e adequado para redes sociais de empresas.`;
  }

  const response = await fetch(
    `${BASE_URL}/models/${MODEL}:predictLongRunning?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: enrichedPrompt }],
        parameters: {
          durationSeconds: (() => {
            const seconds = input.output?.seconds || 8;
            // Gemini aceita apenas 5-8 segundos
            if (seconds < 5) return 5;
            if (seconds > 8) return 8;
            return seconds;
          })(),
          aspectRatio: input.output?.aspectRatio || '16:9',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Video API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return { operationId: data.name };
}

/**
 * Polling Gemini Video
 */
async function pollVideoStatusGeminiDirect(operationId) {
  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  const response = await fetch(
    `${BASE_URL}/${operationId}?key=${GEMINI_API_KEY}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`Polling error: ${response.status}`);
  }

  const data = await response.json();

  // Log para debug
  console.log(`[marketing-worker] Status do vídeo Gemini:`, {
    done: data.done,
    hasError: !!data.error,
    hasResponse: !!data.response,
    metadata: data.metadata,
  });

  if (data.done) {
    if (data.error) {
      return { done: true, error: data.error.message };
    }

    const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (videoUri) {
      return { done: true, videoUri };
    }
  }

  // Retornar informações de progresso se disponíveis
  const progressInfo = {
    done: false,
    metadata: data.metadata,
  };

  return progressInfo;
}

/**
 * Iniciar geração de vídeo OpenAI (chamada direta)
 */
async function startVideoGenerationWithOpenAIDirect(input) {
  const BASE_URL = 'https://api.openai.com/v1';
  const MODEL = input.model || 'sora-2-pro';

  // Enriquecer prompt com informações completas do formato
  let enrichedPrompt = input.prompt;
  if (input.output) {
    const formatInfo = [];
    
    // Aspect ratio
    if (input.output.aspectRatio) {
      formatInfo.push(`Proporção: ${input.output.aspectRatio}`);
    }
    
    // Duração
    if (input.output.seconds) {
      formatInfo.push(`Duração: ${input.output.seconds} segundos`);
    }
    
    // Nome e descrição do formato
    if (input.output.formatName) {
      formatInfo.push(`Formato: ${input.output.formatName}`);
      if (input.output.formatDescription) {
        formatInfo.push(`Descrição: ${input.output.formatDescription}`);
      }
    }
    
    // Dimensões (se disponível)
    if (input.output.size) {
      const [width, height] = input.output.size.split('x').map(Number);
      formatInfo.push(`Dimensões: ${width}x${height} pixels (${input.output.size})`);
    }
    
    // Construir prompt enriquecido
    if (formatInfo.length > 0) {
      const formatDetails = formatInfo.join('\n');
      enrichedPrompt = `${input.prompt}\n\n=== CONTEXTO COMERCIAL ===\nEste é um vídeo para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. O vídeo deve ser profissional, comercialmente eficaz, com composição e movimento que direciona atenção para pontos importantes e reforça branding.\n\n=== ESPECIFICAÇÕES DO FORMATO ===\n${formatDetails}\n\nIMPORTANTE: O vídeo deve ser gerado exatamente nestas especificações. Garanta que a composição, movimento, câmera e elementos visuais estejam completamente otimizados para este formato específico do Instagram como um POST COMERCIAL PROFISSIONAL que vende e engaja.`;
    } else {
      enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Este é um vídeo para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. O vídeo deve ser profissional, comercialmente eficaz e adequado para redes sociais de empresas.`;
    }
  } else {
    enrichedPrompt = `${input.prompt}\n\nCONTEXTO: Este é um vídeo para POST COMERCIAL profissional em redes sociais de empresa. O objetivo é GERAR VENDAS e ENGAJAMENTO. O vídeo deve ser profissional, comercialmente eficaz e adequado para redes sociais de empresas.`;
  }

  const formData = new FormData();
  formData.append('prompt', enrichedPrompt);
  formData.append('model', MODEL);
  formData.append('size', input.output?.size || '1280x720');
  // Gemini aceita apenas 5-8 segundos
  const seconds = (() => {
    const sec = input.output?.seconds || 8;
    if (sec < 5) return 5;
    if (sec > 8) return 8;
    return sec;
  })();
  formData.append('seconds', seconds.toString());

  const response = await fetch(`${BASE_URL}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Video API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return { operationId: data.id };
}

/**
 * Polling OpenAI Video
 */
async function pollVideoStatusOpenAIDirect(videoId) {
  const BASE_URL = 'https://api.openai.com/v1';

  const response = await fetch(`${BASE_URL}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Polling error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status === 'completed') {
    return { done: true, ready: true };
  }

  if (data.status === 'failed') {
    return { done: true, error: data.error?.message || 'Erro desconhecido' };
  }

  return { done: false };
}

async function downloadVideoFromGemini(videoUri) {
  const response = await fetch(videoUri, {
    method: 'GET',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao baixar vídeo: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download vídeo OpenAI
 */
async function downloadVideoFromOpenAI(videoId) {
  const BASE_URL = 'https://api.openai.com/v1';

  const response = await fetch(`${BASE_URL}/videos/${videoId}/content`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao baixar vídeo: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload de mídia para Supabase Storage (inline para evitar imports complexos)
 */
/**
 * Verificar e criar bucket se não existir
 */
async function ensureMarketingBucket(supabase) {
  try {
    // Tentar listar buckets para verificar se existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.warn('[marketing-worker] Erro ao listar buckets:', listError);
      console.log('[marketing-worker] Tentando criar bucket diretamente (sem verificar lista)...');
    } else {
      const marketingBucket = buckets?.find(b => b.name === 'marketing');
      
      if (marketingBucket) {
        console.log('[marketing-worker] ✅ Bucket "marketing" já existe (encontrado na lista)');
        return; // Bucket existe, não precisa criar
      }
      
      console.log('[marketing-worker] Bucket "marketing" não encontrado na lista, criando...');
    }

    // Bucket não encontrado, criar
    console.log('[marketing-worker] Criando bucket "marketing" com configurações: public=true, fileSizeLimit=50MB');
    
    const bucketConfig = {
      public: true, // Imagens podem ser públicas
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'video/mp4', 'video/webm'],
    };
    
    console.log('[marketing-worker] Configuração do bucket:', JSON.stringify(bucketConfig, null, 2));
    
    const { data: newBucket, error: createError } = await supabase.storage.createBucket('marketing', bucketConfig);

    if (createError) {
      // Se o erro for que o bucket já existe, tudo bem
      const errorMsg = createError.message || String(createError);
      const errorCode = createError.statusCode || createError.code || '';
      
      console.log('[marketing-worker] Erro ao criar bucket:', {
        message: errorMsg,
        code: errorCode,
        error: createError
      });
      
      if (errorMsg && (
        errorMsg.includes('already exists') ||
        errorMsg.includes('duplicate') ||
        errorMsg.includes('Bucket already exists') ||
        errorMsg.includes('already_exists') ||
        errorCode === '409' // Conflict
      )) {
        console.log('[marketing-worker] ✅ Bucket "marketing" já existe (criado por outro processo)');
        return;
      }
      
      // Se for erro de permissão, dar mensagem mais clara
      if (errorMsg.includes('permission') || errorMsg.includes('unauthorized') || errorCode === '401' || errorCode === '403') {
        throw new Error(
          `Erro de permissão ao criar bucket. Verifique se a SERVICE_ROLE_KEY tem permissões de Storage Admin. ` +
          `Erro: ${errorMsg}`
        );
      }
      
      console.error('[marketing-worker] Erro ao criar bucket:', createError);
      throw new Error(`Erro ao criar bucket: ${errorMsg} (código: ${errorCode})`);
    }

    console.log('[marketing-worker] ✅ Bucket "marketing" criado com sucesso!', newBucket);
    
    // Verificar se o bucket foi realmente criado (aguardar um pouco para eventual consistency)
    await delay(1000);
    
    const { data: verifyBuckets, error: verifyError } = await supabase.storage.listBuckets();
    if (!verifyError && verifyBuckets) {
      const verified = verifyBuckets.find(b => b.name === 'marketing');
      if (verified) {
        console.log('[marketing-worker] ✅ Bucket "marketing" verificado e confirmado na lista');
      } else {
        console.warn('[marketing-worker] ⚠️ Bucket criado mas ainda não aparece na lista (eventual consistency)');
      }
    }
    
  } catch (error) {
    console.error('[marketing-worker] Erro ao verificar/criar bucket:', error);
    
    // Se o erro for que o bucket já existe, não é um erro crítico
    const errorMsg = error?.message || String(error);
    if (errorMsg && (
      errorMsg.includes('already exists') ||
      errorMsg.includes('duplicate') ||
      errorMsg.includes('Bucket already exists') ||
      errorMsg.includes('already_exists')
    )) {
      console.log('[marketing-worker] ✅ Bucket "marketing" já existe (erro ignorado)');
      return;
    }
    
    // Re-lançar erro para que o upload possa tratar
    throw error;
  }
}

/**
 * Obter identificador da loja (site_slug se disponível, senão store_id)
 */
async function getStoreIdentifier(supabase, storeId) {
  try {
    const { data: store, error } = await supabase
      .schema('sistemaretiradas')
      .from('stores')
      .select('site_slug, name')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      console.warn(`[marketing-worker] Erro ao buscar loja ${storeId}, usando store_id como fallback:`, error?.message);
      return storeId;
    }

    // Usar site_slug se existir, senão usar store_id
    if (store.site_slug) {
      return store.site_slug;
    }

    // Fallback para store_id
    return storeId;
  } catch (error) {
    console.warn(`[marketing-worker] Erro ao buscar site_slug, usando store_id como fallback:`, error?.message);
    return storeId;
  }
}

/**
 * Função auxiliar para aguardar um tempo (delay)
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadMediaToSupabase(supabase, buffer, mimeType, storeId, userId, assetId, type) {
  // Obter identificador da loja (site_slug se disponível, senão store_id)
  const storeIdentifier = await getStoreIdentifier(supabase, storeId);

  // Determinar extensão
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('jpg') || mimeType.includes('jpeg') ? 'jpg' : type === 'video' ? 'mp4' : 'png';

  // Gerar path estruturado usando site_slug quando disponível
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const path = `marketing/${storeIdentifier}/${userId}/${type}/${year}/${month}/${assetId}.${extension}`;

  // Tentar upload com retry automático
  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Garantir que o bucket existe antes de cada tentativa
    try {
      await ensureMarketingBucket(supabase);
      // Aguardar um pouco após criar o bucket (eventual consistency)
      if (attempt > 1) {
        console.log(`[marketing-worker] Aguardando 2s após criar bucket (tentativa ${attempt}/${MAX_RETRIES})...`);
        await delay(2000);
      }
    } catch (bucketError) {
      console.warn(`[marketing-worker] Erro ao garantir bucket (tentativa ${attempt}/${MAX_RETRIES}):`, bucketError.message);
      // Continuar - pode ser que o bucket já exista mas não esteja visível na listagem
    }

    // Tentar upload
    const uploadResult = await supabase.storage.from('marketing').upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: type === 'video' ? '3600' : '31536000',
    });

    // Se sucesso, retornar
    if (!uploadResult.error) {
      if (attempt > 1) {
        console.log(`[marketing-worker] ✅ Upload bem-sucedido na tentativa ${attempt}`);
      }
      lastError = null;
      break;
    }

    // Se erro for "Bucket not found", tentar criar novamente na próxima iteração
    const errorMsg = uploadResult.error?.message || String(uploadResult.error);
    if (errorMsg && errorMsg.includes('Bucket not found')) {
      console.log(`[marketing-worker] ⚠️ Bucket não encontrado (tentativa ${attempt}/${MAX_RETRIES}), tentando criar...`);
      lastError = uploadResult.error;
      
      // Se não for a última tentativa, continuar loop
      if (attempt < MAX_RETRIES) {
        continue;
      }
    } else {
      // Outro tipo de erro, lançar imediatamente
      throw new Error(`Erro ao fazer upload: ${errorMsg}`);
    }
  }

  // Se ainda houver erro após todas as tentativas
  if (lastError) {
    const errorMsg = lastError.message || String(lastError);
    throw new Error(
      `Bucket "marketing" não encontrado após ${MAX_RETRIES} tentativas. ` +
      `O bucket pode não ter sido criado com sucesso ou há um problema de permissões. ` +
      `Por favor, verifique no Supabase Dashboard: Storage → Buckets → "marketing" deve existir e ser público. ` +
      `Erro original: ${errorMsg}`
    );
  }

  // Gerar URLs
  const { data: publicUrlData } = supabase.storage.from('marketing').getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  let signedUrl;
  let signedExpiresAt;

  if (type === 'video') {
    const expiresIn = 24 * 60 * 60;
    const { data: signedData, error: signedError } = await supabase.storage
      .from('marketing')
      .createSignedUrl(path, expiresIn);

    if (!signedError && signedData) {
      signedUrl = signedData.signedUrl;
      signedExpiresAt = new Date(Date.now() + expiresIn * 1000);
    }
  }

  return {
    path,
    publicUrl: type === 'image' ? publicUrl : undefined,
    signedUrl: type === 'video' ? signedUrl : undefined,
    signedExpiresAt,
  };
}

