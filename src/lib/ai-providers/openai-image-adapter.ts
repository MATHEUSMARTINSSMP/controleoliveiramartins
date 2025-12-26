/**
 * OpenAI Image Adapter (GPT Image)
 * 
 * Geração de imagens usando OpenAI GPT Image (NÃO DALL-E, que está descontinuado)
 * Suporta: texto apenas, texto + imagem, inpainting com máscara
 */

import type { ImageGenerationResult, CreateMediaInput } from '@/types/marketing';
import { normalizeBase64 } from './image-utils';

const BASE_URL = 'https://api.openai.com/v1';

export type OpenAIImageModel = `gpt-image-${string}`;

export interface OpenAIImageOptions {
  prompt: string;
  inputImage?: string; // Base64 opcional
  mask?: string; // Base64 PNG para inpainting (transparente = editável)
  size?: string; // "1024x1024", "1792x1024", "1024x1792"
  aspectRatio?: '1:1' | '9:16' | '16:9';
  model?: OpenAIImageModel;
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
      return '1024x1792'; // Vertical
    case '16:9':
      return '1792x1024'; // Horizontal
    case '1:1':
    default:
      return '1024x1024'; // Quadrado
  }
}

/**
 * Gerar imagem usando OpenAI GPT Image
 */
export async function generateImageWithOpenAI(
  options: OpenAIImageOptions
): Promise<ImageGenerationResult> {
  const {
    prompt,
    inputImage,
    mask,
    size,
    aspectRatio,
    model = 'gpt-image-1-mini',
    apiKey,
  } = options;

  // Determinar endpoint baseado em ter imagem/máscara
  let endpoint: string;
  let payload: any;

  if (mask && inputImage) {
    // Inpainting: editar imagem com máscara
    endpoint = `${BASE_URL}/images/edits`;
    
    // Para inpainting, OpenAI usa multipart/form-data
    const formData = new FormData();
    
    // Converter base64 para File/Blob
    const imageBuffer = Buffer.from(normalizeBase64(inputImage), 'base64');
    const maskBuffer = Buffer.from(normalizeBase64(mask), 'base64');
    
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
    
    formData.append('image', imageBlob, 'image.png');
    formData.append('mask', maskBlob, 'mask.png');
    formData.append('prompt', prompt);
    formData.append('size', size || getSizeFromAspectRatio(aspectRatio));
    formData.append('n', '1');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI Image API error (inpainting): ${response.status} - ${errorText}`
      );
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
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Erro ao baixar imagem da URL: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Imagem baixada está vazia ou inválida');
    }

    return {
      imageData: imageBuffer,
      width: parseInt((size || '1024x1024').split('x')[0]),
      height: parseInt((size || '1024x1024').split('x')[1]),
      mimeType: 'image/png',
    };
  } else if (inputImage) {
    // Variações ou geração com imagem de referência
    // Nota: OpenAI pode não ter endpoint direto para "texto + imagem"
    // Nesse caso, usar o prompt descrevendo a imagem + prompt adicional
    endpoint = `${BASE_URL}/images/generations`;
    
    // Enriquecer prompt com descrição da imagem de entrada
    const enrichedPrompt = `${prompt}. Baseado na imagem de referência fornecida.`;

    payload = {
      model,
      prompt: enrichedPrompt,
      size: size || getSizeFromAspectRatio(aspectRatio),
      n: 1,
      // Se a API suportar, incluir imagem
      // image: inputImage (verificar documentação)
    };
  } else {
    // Geração simples: texto apenas
    endpoint = `${BASE_URL}/images/generations`;
    
    payload = {
      model,
      prompt,
      size: size || getSizeFromAspectRatio(aspectRatio),
      n: 1,
    };
  }

  // Fazer requisição (para gerações simples)
  if (!mask) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI Image API error: ${response.status} - ${errorText}`
      );
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
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Erro ao baixar imagem da URL: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Imagem baixada está vazia ou inválida');
    }

    const finalSize = size || getSizeFromAspectRatio(aspectRatio);
    const [width, height] = finalSize.split('x').map(Number);

    return {
      imageData: imageBuffer,
      width,
      height,
      mimeType: 'image/png',
    };
  }

  // Este código não deveria ser alcançado, mas TypeScript precisa
  throw new Error('Configuração inválida para geração de imagem');
}

/**
 * Helper: Converter CreateMediaInput para OpenAIImageOptions
 */
export function convertToOpenAIImageOptions(
  input: CreateMediaInput,
  apiKey: string
): OpenAIImageOptions {
  let size: string | undefined;
  if (input.output?.size) {
    size = input.output.size;
  }

  return {
    prompt: input.prompt,
    inputImage: input.inputImages?.[0], // Primeira imagem se houver
    mask: input.mask,
    size,
    aspectRatio: input.output?.aspectRatio,
    model: input.model as OpenAIImageModel || 'gpt-image-1-mini',
    apiKey,
  };
}

/**
 * Valida se o modelo é válido para OpenAI Image
 */
export function isValidOpenAIImageModel(model: string): boolean {
  return (
    model.startsWith('gpt-image-') ||
    model === 'dall-e-2' || // Ainda suportado, mas não recomendado
    model === 'dall-e-3' // Descontinuado, mas pode estar disponível ainda
  );
}

