/**
 * Gemini Image Adapter (Nano Banana)
 * 
 * Geração de imagens usando Gemini 2.5 Flash Image
 * Suporta: texto apenas, texto + imagem, múltiplas imagens
 */

import type { ImageGenerationResult, CreateMediaInput } from '@/types/marketing';
import { normalizeBase64 } from './image-utils';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.5-flash-image';

export interface GeminiImageOptions {
  prompt: string;
  inputImages?: string[]; // Array de base64 (sem prefixo data:)
  aspectRatio?: '1:1' | '9:16' | '16:9';
  apiKey: string;
}

/**
 * Gerar imagem usando Gemini (Nano Banana)
 */
export async function generateImageWithGemini(
  options: GeminiImageOptions
): Promise<ImageGenerationResult> {
  const { prompt, inputImages = [], aspectRatio, apiKey } = options;

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

  // Adicionar aspect ratio se fornecido (se a API suportar)
  if (aspectRatio) {
    // Nota: Verificar documentação da API Gemini para suporte a aspect ratio
    // Por enquanto, incluir no prompt se necessário
    if (!payload.generationConfig.responseModalities) {
      payload.generationConfig.responseModalities = ['IMAGE'];
    }
  }

  // Fazer requisição
  const response = await fetch(
    `${BASE_URL}/models/${MODEL}:generateContent?key=${apiKey}`,
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

  // Obter dimensões (assumir padrão, ou extrair se disponível)
  let width = 1024;
  let height = 1024;

  if (aspectRatio === '9:16') {
    width = 768;
    height = 1344;
  } else if (aspectRatio === '16:9') {
    width = 1920;
    height = 1080;
  }

  // Tentar extrair dimensões do metadata se disponível
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
    aspectRatio: input.output?.aspectRatio,
    apiKey,
  };
}

/**
 * Valida se o modelo é válido para Gemini Image
 */
export function isValidGeminiImageModel(model: string): boolean {
  return model === MODEL || model.startsWith('gemini-') && model.includes('image');
}

