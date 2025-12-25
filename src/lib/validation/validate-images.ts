/**
 * Validação de Imagens
 * 
 * Valida MIME types, tamanho máximo, dimensões
 */

import type { ImageInfo } from '@/lib/ai-providers/image-utils';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export interface ImageValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info?: {
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
  };
}

/**
 * Validar imagem base64 ou buffer
 */
export async function validateImage(
  image: ImageInfo | Buffer | string,
  mimeType?: string
): Promise<ImageValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let actualMimeType: string | undefined = mimeType;
  let sizeBytes: number;
  let buffer: Buffer;

  // Normalizar entrada
  if (typeof image === 'string') {
    // Base64
    const base64 = image.includes(',') ? image.split(',')[1] : image;
    buffer = Buffer.from(base64, 'base64');
    sizeBytes = buffer.length;
    
    if (image.startsWith('data:')) {
      actualMimeType = image.split(';')[0].split(':')[1];
    }
  } else if (Buffer.isBuffer(image)) {
    buffer = image;
    sizeBytes = buffer.length;
  } else {
    // ImageInfo
    buffer = Buffer.from(image.data, 'base64');
    sizeBytes = image.sizeBytes;
    actualMimeType = image.mimeType;
  }

  // Validar MIME type
  if (!actualMimeType || !ALLOWED_IMAGE_MIME_TYPES.includes(actualMimeType as any)) {
    errors.push(
      `MIME type não permitido: ${actualMimeType}. Permitidos: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`
    );
  }

  // Validar tamanho
  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    errors.push(
      `Imagem muito grande: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB. Máximo: ${(MAX_IMAGE_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB`
    );
  }

  if (sizeBytes < 1024) {
    warnings.push('Imagem muito pequena, pode ter baixa qualidade');
  }

  // Tentar obter dimensões (opcional, pode falhar se imagem inválida)
  let width: number | undefined;
  let height: number | undefined;

  try {
    // Usar sharp ou outra biblioteca de imagem se disponível
    // Por enquanto, vamos assumir que dimensões serão validadas depois
    // Ou usar uma biblioteca leve como image-size
  } catch (error) {
    warnings.push('Não foi possível validar dimensões da imagem');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info: actualMimeType
      ? {
          mimeType: actualMimeType,
          sizeBytes,
          width,
          height,
        }
      : undefined,
  };
}

/**
 * Validar múltiplas imagens
 */
export async function validateMultipleImages(
  images: Array<ImageInfo | Buffer | string>,
  mimeTypes?: string[]
): Promise<{
  valid: boolean;
  results: ImageValidation[];
  overallErrors: string[];
}> {
  const results = await Promise.all(
    images.map((img, index) =>
      validateImage(img, mimeTypes?.[index])
    )
  );

  const valid = results.every((r) => r.valid);
  const overallErrors = results.flatMap((r) => r.errors);

  return {
    valid,
    results,
    overallErrors,
  };
}

/**
 * Validar vídeo (buffer ou tamanho)
 */
export function validateVideo(
  buffer: Buffer,
  mimeType?: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validar tamanho
  if (buffer.length > MAX_VIDEO_SIZE_BYTES) {
    errors.push(
      `Vídeo muito grande: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Máximo: ${(MAX_VIDEO_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB`
    );
  }

  // Validar MIME type (se fornecido)
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (mimeType && !allowedVideoTypes.includes(mimeType)) {
    warnings.push(`MIME type de vídeo não padrão: ${mimeType}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

