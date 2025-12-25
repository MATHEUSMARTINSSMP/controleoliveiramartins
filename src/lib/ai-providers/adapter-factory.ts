/**
 * Adapter Factory
 * 
 * Factory pattern para escolher o provider correto
 * baseado no tipo de mídia e provider solicitado
 */

import type {
  Provider,
  MediaType,
  CreateMediaInput,
  ImageGenerationResult,
  VideoGenerationResult,
} from '@/types/marketing';
import { PROVIDER_CONFIG } from '@/lib/config/provider-config';
import {
  generateImageWithGemini,
  convertToGeminiImageOptions,
} from './gemini-image-adapter';
import {
  startVideoGenerationWithGemini,
  pollVideoGenerationStatus,
  downloadVideoFromGemini,
  convertToGeminiVideoOptions,
} from './gemini-video-adapter';
import {
  generateImageWithOpenAI,
  convertToOpenAIImageOptions,
} from './openai-image-adapter';
import {
  startVideoGenerationWithOpenAI,
  pollVideoGenerationStatus as pollOpenAIVideoStatus,
  downloadVideoFromOpenAI,
  convertToOpenAIVideoOptions,
} from './openai-video-adapter';

export interface GenerationOptions {
  onProgress?: (progress: number) => void;
}

/**
 * Gerar imagem usando provider especificado
 */
export async function generateImage(
  input: CreateMediaInput,
  options: GenerationOptions = {}
): Promise<ImageGenerationResult> {
  const { provider, type } = input;

  if (type !== 'image') {
    throw new Error('Tipo de mídia deve ser "image"');
  }

  const config = PROVIDER_CONFIG[provider];
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY não configurada`);
  }

  if (provider === 'gemini') {
    const geminiOptions = convertToGeminiImageOptions(input, apiKey);
    return await generateImageWithGemini(geminiOptions);
  } else if (provider === 'openai') {
    const openaiOptions = convertToOpenAIImageOptions(input, apiKey);
    return await generateImageWithOpenAI(openaiOptions);
  } else {
    throw new Error(`Provider não suportado: ${provider}`);
  }
}

/**
 * Iniciar geração de vídeo (assíncrono - retorna operation ID)
 */
export async function startVideoGeneration(
  input: CreateMediaInput,
  options: GenerationOptions = {}
): Promise<{ operationId: string; provider: Provider }> {
  const { provider, type } = input;

  if (type !== 'video') {
    throw new Error('Tipo de mídia deve ser "video"');
  }

  const config = PROVIDER_CONFIG[provider];
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY não configurada`);
  }

  if (provider === 'gemini') {
    const geminiOptions = convertToGeminiVideoOptions(input, apiKey);
    const operation = await startVideoGenerationWithGemini(geminiOptions);
    return {
      operationId: operation.operationId,
      provider: 'gemini',
    };
  } else if (provider === 'openai') {
    const openaiOptions = convertToOpenAIVideoOptions(input, apiKey);
    const operation = await startVideoGenerationWithOpenAI(openaiOptions);
    return {
      operationId: operation.operationId,
      provider: 'openai',
    };
  } else {
    throw new Error(`Provider não suportado: ${provider}`);
  }
}

/**
 * Verificar status de geração de vídeo
 */
export async function pollVideoStatus(
  operationId: string,
  provider: Provider
): Promise<{ done: boolean; error?: string; videoUri?: string; ready?: boolean }> {
  const config = PROVIDER_CONFIG[provider];
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY não configurada`);
  }

  if (provider === 'gemini') {
    return await pollVideoGenerationStatus(operationId, apiKey);
  } else if (provider === 'openai') {
    return await pollOpenAIVideoStatus(operationId, apiKey);
  } else {
    throw new Error(`Provider não suportado: ${provider}`);
  }
}

/**
 * Download vídeo quando pronto
 */
export async function downloadVideo(
  operationId: string,
  provider: Provider
): Promise<Buffer> {
  const config = PROVIDER_CONFIG[provider];
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY não configurada`);
  }

  if (provider === 'gemini') {
    // Gemini precisa do URI do vídeo, não do operation ID
    // Isso deve ser chamado após polling retornar videoUri
    throw new Error('Use downloadVideoFromGemini com videoUri diretamente');
  } else if (provider === 'openai') {
    return await downloadVideoFromOpenAI(operationId, apiKey);
  } else {
    throw new Error(`Provider não suportado: ${provider}`);
  }
}

/**
 * Gerar vídeo completo (iniciar + polling + download) - para uso síncrono
 */
export async function generateVideo(
  input: CreateMediaInput,
  options: GenerationOptions = {}
): Promise<VideoGenerationResult> {
  const { provider, type } = input;

  if (type !== 'video') {
    throw new Error('Tipo de mídia deve ser "video"');
  }

  const config = PROVIDER_CONFIG[provider];
  const apiKey = config.apiKey;

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY não configurada`);
  }

  if (provider === 'gemini') {
    const { generateVideoWithGemini } = await import('./gemini-video-adapter');
    const geminiOptions = convertToGeminiVideoOptions(input, apiKey);
    return await generateVideoWithGemini(geminiOptions, options.onProgress);
  } else if (provider === 'openai') {
    const { generateVideoWithOpenAI } = await import('./openai-video-adapter');
    const openaiOptions = convertToOpenAIVideoOptions(input, apiKey);
    return await generateVideoWithOpenAI(openaiOptions, options.onProgress);
  } else {
    throw new Error(`Provider não suportado: ${provider}`);
  }
}

/**
 * Valida se provider/model é suportado
 */
export function isSupported(
  provider: Provider,
  model: string,
  type: MediaType
): boolean {
  const config = PROVIDER_CONFIG[provider];

  if (type === 'image') {
    return (config.imageModels as readonly string[]).includes(model);
  } else if (type === 'video') {
    return (config.videoModels as readonly string[]).includes(model);
  }

  return false;
}

