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
    // gpt-image-1-mini: melhor custo/benefício (MVP) - recomendado para uso geral
    // gpt-image-1.5: melhor equilíbrio qualidade/custo quando precisa subir um nível
    // gpt-image-1: modelo anterior, pior custo/benefício
    // DALL·E 2 e 3: modelos especializados (deprecated, não recomendado)
    imageModels: [
      'gpt-image-1-mini', // Melhor custo/benefício (recomendado)
      'gpt-image-1.5', // Melhor equilíbrio qualidade/custo
      'gpt-image-1', // Modelo anterior
      'chatgpt-image-latest',
      'dall-e-2', // Deprecated
      'dall-e-3', // Deprecated
    ] as const,
    defaultImageModel: 'gpt-image-1-mini' as const, // Melhor custo/benefício
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

