/**
 * Gemini Video Adapter (Veo)
 * 
 * Geração de vídeos usando Gemini Veo
 * Suporta: texto para vídeo, imagem para vídeo
 * Processamento assíncrono com polling
 */

import type { VideoGenerationOperation, VideoGenerationResult, CreateMediaInput } from '@/types/marketing';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export type VeoModel = 'veo-2.0-generate-001' | 'veo-3.0-generate-001' | 'veo-3.1-generate-preview';

export interface GeminiVideoOptions {
  prompt: string;
  inputImage?: string; // Base64 opcional para imagem → vídeo
  duration?: number; // Segundos (padrão: 8)
  aspectRatio?: '1:1' | '9:16' | '16:9';
  model?: VeoModel;
  apiKey: string;
}

/**
 * Iniciar geração de vídeo (retorna operation para polling)
 */
export async function startVideoGenerationWithGemini(
  options: GeminiVideoOptions
): Promise<VideoGenerationOperation> {
  const {
    prompt,
    inputImage,
    duration = 8,
    aspectRatio = '16:9',
    model = 'veo-2.0-generate-001',
    apiKey,
  } = options;

  // Construir payload
  const instances: any[] = [
    {
      prompt,
    },
  ];

  // Se tem imagem de entrada, adicionar
  if (inputImage) {
    // Normalizar base64
    let normalizedImage = inputImage;
    if (inputImage.startsWith('data:')) {
      normalizedImage = inputImage.split(',')[1];
    }

    let mimeType = 'image/png';
    if (inputImage.includes('jpeg') || inputImage.includes('jpg')) {
      mimeType = 'image/jpeg';
    } else if (inputImage.includes('webp')) {
      mimeType = 'image/webp';
    }

    instances[0].image = {
      bytesBase64Encoded: normalizedImage,
    };
  }

  // Adicionar parâmetros de duração e aspect ratio se suportado
  // Nota: Verificar documentação para parâmetros exatos
  const parameters: any = {
    durationSeconds: duration,
  };

  if (aspectRatio) {
    // Mapear aspect ratio para formato esperado pela API
    const ratioMap: Record<string, string> = {
      '1:1': '1:1',
      '9:16': '9:16',
      '16:9': '16:9',
    };
    parameters.aspectRatio = ratioMap[aspectRatio] || '16:9';
  }

  // Fazer requisição para iniciar operação assíncrona
  const response = await fetch(
    `${BASE_URL}/models/${model}:predictLongRunning?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances,
        parameters,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini Video API error: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  // Extrair operation name
  const operationName = data.name;
  if (!operationName) {
    throw new Error('Resposta do Gemini não contém operation name');
  }

  return {
    operationId: operationName,
    estimatedTime: duration * 2, // Estimativa conservadora
  };
}

/**
 * Polling: Verificar status da operação
 */
export async function pollVideoGenerationStatus(
  operationId: string,
  apiKey: string
): Promise<{ done: boolean; error?: string; videoUri?: string }> {
  const response = await fetch(
    `${BASE_URL}/${operationId}?key=${apiKey}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini Video Polling error: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  // Verificar se está completo
  if (data.done) {
    // Verificar se houve erro
    if (data.error) {
      return {
        done: true,
        error: data.error.message || 'Erro desconhecido na geração',
      };
    }

    // Extrair URI do vídeo
    const response_data = data.response?.generateVideoResponse;
    const videoSample = response_data?.generatedSamples?.[0];
    const videoUri = videoSample?.video?.uri;

    if (!videoUri) {
      return {
        done: true,
        error: 'Vídeo gerado mas URI não encontrada',
      };
    }

    return {
      done: true,
      videoUri,
    };
  }

  return {
    done: false,
  };
}

/**
 * Download vídeo usando URI (requer API key no header)
 */
export async function downloadVideoFromGemini(
  videoUri: string,
  apiKey: string
): Promise<Buffer> {
  const response = await fetch(videoUri, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Erro ao baixar vídeo: ${response.status} - ${errorText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Processar geração completa de vídeo (iniciar + polling + download)
 */
export async function generateVideoWithGemini(
  options: GeminiVideoOptions,
  onProgress?: (progress: number) => void
): Promise<VideoGenerationResult> {
  // 1. Iniciar geração
  const operation = await startVideoGenerationWithGemini(options);
  onProgress?.(10);

  // 2. Polling até completar
  const maxAttempts = 60; // 5 minutos máximo (5s por tentativa)
  const pollInterval = 5000; // 5 segundos

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const status = await pollVideoGenerationStatus(operation.operationId, options.apiKey);
    
    // Progresso estimado (10% a 90%)
    const progress = 10 + Math.min(80, (attempt / maxAttempts) * 80);
    onProgress?.(progress);

    if (status.done) {
      if (status.error) {
        throw new Error(status.error);
      }

      if (!status.videoUri) {
        throw new Error('Vídeo gerado mas URI não disponível');
      }

      // 3. Download do vídeo
      onProgress?.(95);
      const videoBuffer = await downloadVideoFromGemini(
        status.videoUri,
        options.apiKey
      );
      onProgress?.(100);

      // Obter dimensões e duração (assumir padrão, ou extrair do metadata se disponível)
      const duration = options.duration || 8;
      let width = 1920;
      let height = 1080;

      if (options.aspectRatio === '9:16') {
        width = 1080;
        height = 1920;
      } else if (options.aspectRatio === '1:1') {
        width = 1080;
        height = 1080;
      }

      return {
        videoData: videoBuffer,
        duration,
        width,
        height,
        mimeType: 'video/mp4',
      };
    }
  }

  throw new Error('Timeout: geração de vídeo excedeu tempo máximo');
}

/**
 * Helper: Converter CreateMediaInput para GeminiVideoOptions
 */
export function convertToGeminiVideoOptions(
  input: CreateMediaInput,
  apiKey: string
): GeminiVideoOptions {
  return {
    prompt: input.prompt,
    inputImage: input.inputImages?.[0], // Primeira imagem se houver
    duration: input.output?.seconds || 8,
    aspectRatio: input.output?.aspectRatio || '16:9',
    model: input.model as VeoModel || 'veo-2.0-generate-001',
    apiKey,
  };
}

