/**
 * Gemini Image Adapter (Nano Banana / Nano Banana Pro)
 * 
 * Geração de imagens usando Gemini Image Models
 * Suporta: texto apenas, texto + imagem, múltiplas imagens
 * 
 * Documentação: https://ai.google.dev/docs/generate_images
 */

import type { ImageGenerationResult, CreateMediaInput } from '@/types/marketing';
import { normalizeBase64 } from './image-utils';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

// Aspect ratios suportados conforme documentação Gemini
export type GeminiAspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

export interface GeminiImageOptions {
  prompt: string;
  inputImages?: string[]; // Array de base64 (sem prefixo data:)
  aspectRatio?: GeminiAspectRatio;
  model?: string; // gemini-2.5-flash-image ou gemini-3-pro-image-preview
  apiKey: string;
}

// Mapear aspect ratio para dimensões conforme documentação Gemini
// Documentação: https://ai.google.dev/docs/generate_images
function getDimensionsFromAspectRatio(aspectRatio?: GeminiAspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case '1:1': return { width: 1024, height: 1024 };
    case '2:3': return { width: 832, height: 1248 };
    case '3:2': return { width: 1248, height: 832 };
    case '3:4': return { width: 864, height: 1184 };
    case '4:3': return { width: 1184, height: 864 };
    case '4:5': return { width: 896, height: 1152 };
    case '5:4': return { width: 1152, height: 896 };
    case '9:16': return { width: 768, height: 1344 };
    case '16:9': return { width: 1344, height: 768 };
    case '21:9': return { width: 1536, height: 672 };
    default: return { width: 1024, height: 1024 }; // Padrão 1:1
  }
}

/**
 * Gerar imagem usando Gemini (Nano Banana / Nano Banana Pro)
 */
export async function generateImageWithGemini(
  options: GeminiImageOptions
): Promise<ImageGenerationResult> {
  const { prompt, inputImages = [], aspectRatio, model = DEFAULT_MODEL, apiKey } = options;

  // Construir parts: texto + imagens
  const parts: any[] = [
    {
      text: prompt,
    },
  ];

  // Adicionar imagens se fornecidas
  for (const imgBase64 of inputImages) {
    const normalized = normalizeBase64(imgBase64);
    
    // Tentar detectar MIME type (assumir PNG se não detectado)
    let mimeType = 'image/png';
    if (imgBase64.startsWith('data:image/')) {
      mimeType = imgBase64.split(';')[0].split(':')[1];
    } else if (imgBase64.includes('jpeg') || imgBase64.includes('jpg')) {
      mimeType = 'image/jpeg';
    } else if (imgBase64.includes('webp')) {
      mimeType = 'image/webp';
    }

    parts.push({
      inlineData: {
        mimeType,
        data: normalized,
      },
    });
  }

  // Construir payload
  const payload: any = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };

  // Adicionar image_config com aspect_ratio conforme documentação Gemini
  // Documentação: https://ai.google.dev/docs/generate_images#aspect-ratio
  if (aspectRatio) {
    payload.generationConfig.imageConfig = {
      aspectRatio: aspectRatio,
    };
    
    // Para gemini-3-pro-image-preview, também pode incluir image_size (1K, 2K, 4K)
    // Por padrão usa 1K (1024px)
    // Se quiséssemos suportar 2K/4K, poderíamos adicionar aqui
  }

  // Fazer requisição
  const response = await fetch(
    `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini Image API error: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  // Extrair imagem gerada
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('Nenhuma imagem gerada na resposta do Gemini');
  }

  const imagePart = candidate.content?.parts?.find(
    (part: any) => part.inlineData
  );

  if (!imagePart?.inlineData) {
    throw new Error('Resposta do Gemini não contém imagem');
  }

  const imageBase64 = imagePart.inlineData.data;
  const imageMimeType = imagePart.inlineData.mimeType || 'image/png';

  // Converter base64 para Buffer
  const imageBuffer = Buffer.from(imageBase64, 'base64');

  // Obter dimensões baseadas no aspect ratio
  const dimensions = getDimensionsFromAspectRatio(aspectRatio);
  let width = dimensions.width;
  let height = dimensions.height;

  // Tentar extrair dimensões do metadata se disponível (tem prioridade)
  if (candidate.metadata?.dimensions) {
    width = candidate.metadata.dimensions.width || width;
    height = candidate.metadata.dimensions.height || height;
  }

  return {
    imageData: imageBuffer,
    width,
    height,
    mimeType: imageMimeType,
  };
}

/**
 * Helper: Converter CreateMediaInput para GeminiImageOptions
 */
export function convertToGeminiImageOptions(
  input: CreateMediaInput,
  apiKey: string
): GeminiImageOptions {
  return {
    prompt: input.prompt,
    inputImages: input.inputImages || [],
    aspectRatio: input.output?.aspectRatio as GeminiAspectRatio | undefined,
    model: input.model || DEFAULT_MODEL,
    apiKey,
  };
}

/**
 * Valida se o modelo é válido para Gemini Image
 */
export function isValidGeminiImageModel(model: string): boolean {
  return model === DEFAULT_MODEL || model === 'gemini-3-pro-image-preview' || 
    (model.startsWith('gemini-') && model.includes('image'));
}

