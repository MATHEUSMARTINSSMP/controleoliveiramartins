/**
 * Utilitários para processamento de imagens
 * Conversão, validação, encoding
 */

export interface ImageInfo {
  data: string; // Base64
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
}

/**
 * Valida MIME types permitidos
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Converte File para base64
 */
export async function fileToBase64(file: File): Promise<ImageInfo> {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as any)) {
    throw new Error(`MIME type não permitido: ${file.type}. Permitidos: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`);
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Imagem muito grande: ${file.size} bytes. Máximo: ${MAX_IMAGE_SIZE_BYTES} bytes`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      // Remover prefixo data:image/...;base64,
      const base64 = result.split(',')[1];
      
      resolve({
        data: base64,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Converte URL para base64 (via fetch)
 */
export async function urlToBase64(url: string): Promise<ImageInfo> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar imagem: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !ALLOWED_IMAGE_MIME_TYPES.includes(contentType as any)) {
      throw new Error(`MIME type não permitido: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const sizeBytes = arrayBuffer.byteLength;

    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Imagem muito grande: ${sizeBytes} bytes. Máximo: ${MAX_IMAGE_SIZE_BYTES} bytes`);
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      data: base64,
      mimeType: contentType,
      sizeBytes,
    };
  } catch (error: any) {
    throw new Error(`Erro ao converter URL para base64: ${error.message}`);
  }
}

/**
 * Valida se uma string é base64 válido
 */
export function isValidBase64(str: string): boolean {
  try {
    // Remover prefixo data: se existir
    const base64 = str.includes(',') ? str.split(',')[1] : str;
    return btoa(atob(base64)) === base64;
  } catch {
    return false;
  }
}

/**
 * Normaliza base64 (remove prefixo data: se existir)
 */
export function normalizeBase64(base64: string): string {
  if (base64.includes(',')) {
    return base64.split(',')[1];
  }
  return base64;
}

/**
 * Valida array de imagens (base64 ou URLs)
 */
export async function validateImages(images: string[]): Promise<ImageInfo[]> {
  const validated: ImageInfo[] = [];

  for (const img of images) {
    if (img.startsWith('http://') || img.startsWith('https://')) {
      // É URL
      const info = await urlToBase64(img);
      validated.push(info);
    } else if (isValidBase64(img)) {
      // É base64
      const normalized = normalizeBase64(img);
      // Estimar tamanho (base64 é ~33% maior que binário)
      const sizeBytes = Math.floor((normalized.length * 3) / 4);
      
      if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(`Imagem base64 muito grande: ~${sizeBytes} bytes`);
      }

      // Tentar detectar MIME type do prefixo ou assumir PNG
      let mimeType = 'image/png';
      if (img.startsWith('data:image/')) {
        mimeType = img.split(';')[0].split(':')[1];
      }

      validated.push({
        data: normalized,
        mimeType,
        sizeBytes,
      });
    } else {
      throw new Error(`Formato de imagem inválido: deve ser URL ou base64`);
    }
  }

  return validated;
}

/**
 * Extrai dimensões de uma imagem base64
 */
export async function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const dataUrl = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
    };
    
    img.onerror = () => {
      reject(new Error('Erro ao carregar imagem para obter dimensões'));
    };
    
    img.src = dataUrl;
  });
}

