/**
 * OpenAI Video Adapter (Sora)
 * 
 * Geração de vídeos usando OpenAI Sora
 * Processamento assíncrono com polling
 */

import type { VideoGenerationOperation, VideoGenerationResult, CreateMediaInput } from '@/types/marketing';

const BASE_URL = 'https://api.openai.com/v1';

export type SoraModel = `sora-${string}`;

export interface OpenAIVideoOptions {
  prompt: string;
  size?: string; // "1280x720", "1920x1080"
  seconds?: number; // Duração em segundos (padrão: 8)
  aspectRatio?: '1:1' | '9:16' | '16:9';
  model?: SoraModel;
  apiKey: string;
}

/**
 * Mapear aspect ratio para size
 */
function getSizeFromAspectRatio(
  aspectRatio?: '1:1' | '9:16' | '16:9'
): string {
  switch (aspectRatio) {
    case '9:16':
      return '1080x1920'; // Vertical (TikTok/Reels)
    case '16:9':
      return '1920x1080'; // Horizontal (YouTube)
    case '1:1':
    default:
      return '1080x1080'; // Quadrado (Instagram)
  }
}

/**
 * Iniciar geração de vídeo (retorna video_id para polling)
 */
export async function startVideoGenerationWithOpenAI(
  options: OpenAIVideoOptions
): Promise<VideoGenerationOperation> {
  const {
    prompt,
    size,
    seconds = 8,
    aspectRatio = '16:9',
    model = 'sora-2-pro',
    apiKey,
  } = options;

  const finalSize = size || getSizeFromAspectRatio(aspectRatio);

  // OpenAI Sora usa multipart/form-data
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('model', model);
  formData.append('size', finalSize);
  formData.append('seconds', seconds.toString());

  const response = await fetch(`${BASE_URL}/videos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI Video API error: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  // OpenAI retorna video_id diretamente
  const videoId = data.id;
  if (!videoId) {
    throw new Error('Resposta do OpenAI não contém video ID');
  }

  return {
    operationId: videoId,
    estimatedTime: seconds * 2, // Estimativa conservadora
  };
}

/**
 * Polling: Verificar status da geração
 */
export async function pollVideoGenerationStatus(
  videoId: string,
  apiKey: string
): Promise<{ done: boolean; error?: string; ready?: boolean }> {
  const response = await fetch(`${BASE_URL}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI Video Polling error: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  // OpenAI retorna status diretamente
  if (data.status === 'completed') {
    return {
      done: true,
      ready: true,
    };
  }

  if (data.status === 'failed') {
    return {
      done: true,
      error: data.error?.message || 'Erro desconhecido na geração',
    };
  }

  // Status: pending, processing
  return {
    done: false,
  };
}

/**
 * Download vídeo quando pronto
 */
export async function downloadVideoFromOpenAI(
  videoId: string,
  apiKey: string
): Promise<Buffer> {
  const response = await fetch(`${BASE_URL}/videos/${videoId}/content`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
export async function generateVideoWithOpenAI(
  options: OpenAIVideoOptions,
  onProgress?: (progress: number) => void
): Promise<VideoGenerationResult> {
  // 1. Iniciar geração
  const operation = await startVideoGenerationWithOpenAI(options);
  onProgress?.(10);

  // 2. Polling até completar
  const maxAttempts = 60; // 5 minutos máximo (5s por tentativa)
  const pollInterval = 5000; // 5 segundos

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const status = await pollVideoGenerationStatus(
      operation.operationId,
      options.apiKey
    );

    // Progresso estimado (10% a 90%)
    const progress = 10 + Math.min(80, (attempt / maxAttempts) * 80);
    onProgress?.(progress);

    if (status.done) {
      if (status.error) {
        throw new Error(status.error);
      }

      if (!status.ready) {
        throw new Error('Vídeo não está pronto para download');
      }

      // 3. Download do vídeo
      onProgress?.(95);
      const videoBuffer = await downloadVideoFromOpenAI(
        operation.operationId,
        options.apiKey
      );
      onProgress?.(100);

      // Obter dimensões e duração
      const duration = options.seconds || 8;
      const finalSize = options.size || getSizeFromAspectRatio(options.aspectRatio);
      const [width, height] = finalSize.split('x').map(Number);

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
 * Helper: Converter CreateMediaInput para OpenAIVideoOptions
 */
export function convertToOpenAIVideoOptions(
  input: CreateMediaInput,
  apiKey: string
): OpenAIVideoOptions {
  let size: string | undefined;
  if (input.output?.size) {
    size = input.output.size;
  }

  return {
    prompt: input.prompt,
    size,
    seconds: input.output?.seconds || 8,
    aspectRatio: input.output?.aspectRatio || '16:9',
    model: input.model as SoraModel || 'sora-2-pro',
    apiKey,
  };
}

