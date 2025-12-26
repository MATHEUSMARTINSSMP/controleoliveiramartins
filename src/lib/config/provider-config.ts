/**
 * Configuração de Providers e Modelos Permitidos
 * Modelos descontinuados NÃO estão incluídos
 */

import type { Provider, ImageModel, VideoModel } from '@/types/marketing';

export const PROVIDER_CONFIG = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    // Modelos de imagem
    imageModels: [
      'gemini-2.5-flash-image', // Nano Banana
    ] as const,
    defaultImageModel: 'gemini-2.5-flash-image' as const,
    // Modelos de vídeo
    videoModels: [
      'veo-2.0-generate-001', // Estável
      'veo-3.0-generate-001', // Estável
      'veo-3.1-generate-preview', // Preview
    ] as const,
    defaultVideoModel: 'veo-2.0-generate-001' as const,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: 'https://api.openai.com/v1',
    // Modelos de imagem válidos conforme documentação oficial OpenAI
    // Documentação: https://platform.openai.com/docs/guides/images-vision
    // gpt-image-1 é o modelo principal nativo multimodal
    // DALL·E 2 e 3 são modelos especializados
    imageModels: [
      'gpt-image-1', // Modelo principal (multimodal LLM)
      'gpt-image-1-mini',
      'gpt-image-1.5',
      'chatgpt-image-latest',
      'dall-e-2', // Modelo especializado
      'dall-e-3', // Modelo especializado
    ] as const,
    defaultImageModel: 'gpt-image-1' as const, // Modelo principal conforme documentação
    // Modelos de vídeo (Sora - preview)
    videoModels: [
      'sora-2-pro', // Preview
      // Adicionar outros modelos Sora conforme disponibilidade
    ] as const,
    defaultVideoModel: 'sora-2-pro' as const,
  },
} as const;

/**
 * Valida se um modelo está permitido
 */
export function isValidModel(
  provider: Provider,
  model: string,
  type: 'image' | 'video'
): boolean {
  const config = PROVIDER_CONFIG[provider];
  
  if (type === 'image') {
    return (config.imageModels as readonly string[]).includes(model);
  } else {
    return (config.videoModels as readonly string[]).includes(model);
  }
}

/**
 * Retorna o modelo padrão para um provider e tipo
 */
export function getDefaultModel(
  provider: Provider,
  type: 'image' | 'video'
): string {
  const config = PROVIDER_CONFIG[provider];
  return type === 'image' 
    ? config.defaultImageModel 
    : config.defaultVideoModel;
}

/**
 * Lista todos os modelos permitidos
 */
export function getAllowedModels(provider: Provider, type: 'image' | 'video'): string[] {
  const config = PROVIDER_CONFIG[provider];
  return type === 'image'
    ? [...config.imageModels]
    : [...config.videoModels];
}

