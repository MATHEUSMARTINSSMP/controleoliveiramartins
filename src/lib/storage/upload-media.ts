/**
 * Upload de Mídia para Supabase Storage
 * 
 * Path estruturado: marketing/{site_slug ou store_id}/{user_id}/{type}/{yyyy}/{mm}/{asset_id}.{ext}
 */

import { createClient } from '@supabase/supabase-js';
import { ensureMarketingBucket, getStoreIdentifier } from './ensure-bucket';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface UploadMediaOptions {
  buffer: Buffer;
  mimeType: string;
  storeId: string;
  userId: string;
  assetId: string;
  type: 'image' | 'video';
}

export interface UploadResult {
  path: string;
  publicUrl?: string;
  signedUrl?: string;
  signedExpiresAt?: Date;
}

/**
 * Upload de mídia para Supabase Storage
 */
export async function uploadMedia(options: UploadMediaOptions): Promise<UploadResult> {
  const { buffer, mimeType, storeId, userId, assetId, type } = options;

  // Criar cliente Supabase com service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  // Garantir que o bucket existe (criação automática)
  await ensureMarketingBucket(supabase);

  // Obter identificador da loja (site_slug se disponível, senão store_id)
  const storeIdentifier = await getStoreIdentifier(supabase, storeId);

  // Determinar extensão do arquivo
  const extension = getExtensionFromMimeType(mimeType);

  // Gerar path estruturado usando site_slug quando disponível
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const path = `marketing/${storeIdentifier}/${userId}/${type}/${year}/${month}/${assetId}.${extension}`;

  // Upload para Supabase Storage (com retry se bucket não encontrado)
  let uploadResult = await supabase.storage
    .from('marketing')
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false, // Não sobrescrever se existir
      cacheControl: type === 'video' ? '3600' : '31536000', // 1h para vídeo, 1 ano para imagem
    });

  // Se o erro for "Bucket not found", tentar criar bucket novamente e fazer retry
  if (uploadResult.error && uploadResult.error.message && uploadResult.error.message.includes('Bucket not found')) {
    console.log('[uploadMedia] Bucket não encontrado, tentando criar novamente...');
    await ensureMarketingBucket(supabase);
    
    // Retry do upload
    uploadResult = await supabase.storage
      .from('marketing')
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: type === 'video' ? '3600' : '31536000',
      });
  }

  if (uploadResult.error) {
    throw new Error(`Erro ao fazer upload: ${uploadResult.error.message}`);
  }

  // Gerar URL pública (se bucket for público)
  const { data: publicUrlData } = supabase.storage
    .from('marketing')
    .getPublicUrl(path);

  const publicUrl = publicUrlData.publicUrl;

  // Para vídeos, gerar URL assinada (privado)
  let signedUrl: string | undefined;
  let signedExpiresAt: Date | undefined;

  if (type === 'video') {
    const expiresIn = 24 * 60 * 60; // 24 horas
    const { data: signedData, error: signedError } = await supabase.storage
      .from('marketing')
      .createSignedUrl(path, expiresIn);

    if (signedError) {
      console.warn('Erro ao gerar URL assinada:', signedError);
    } else {
      signedUrl = signedData.signedUrl;
      signedExpiresAt = new Date(Date.now() + expiresIn * 1000);
    }
  }

  return {
    path,
    publicUrl: type === 'image' ? publicUrl : undefined, // Imagens podem ser públicas
    signedUrl: type === 'video' ? signedUrl : undefined, // Vídeos sempre assinados
    signedExpiresAt,
  };
}

/**
 * Upload de thumbnail
 */
export async function uploadThumbnail(
  buffer: Buffer,
  mimeType: string,
  storeId: string,
  userId: string,
  assetId: string
): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  // Garantir que o bucket existe (criação automática)
  await ensureMarketingBucket(supabase);

  // Obter identificador da loja (site_slug se disponível, senão store_id)
  const storeIdentifier = await getStoreIdentifier(supabase, storeId);

  const extension = getExtensionFromMimeType(mimeType);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const path = `marketing/${storeIdentifier}/${userId}/thumbs/${year}/${month}/${assetId}.${extension}`;

  const { error } = await supabase.storage.from('marketing').upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
    cacheControl: '31536000', // 1 ano
  });

  if (error) {
    throw new Error(`Erro ao fazer upload do thumbnail: ${error.message}`);
  }

  const { data } = supabase.storage.from('marketing').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Obter extensão do arquivo baseado no MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };

  return mimeMap[mimeType.toLowerCase()] || 'bin';
}

/**
 * Deletar mídia do storage
 */
export async function deleteMedia(path: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  const { error } = await supabase.storage.from('marketing').remove([path]);

  if (error) {
    throw new Error(`Erro ao deletar mídia: ${error.message}`);
  }
}

/**
 * Verificar se arquivo existe
 */
export async function mediaExists(path: string): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  const { data, error } = await supabase.storage.from('marketing').list(path.split('/').slice(0, -1).join('/'), {
    search: path.split('/').pop(),
  });

  if (error) {
    return false;
  }

  return data && data.length > 0;
}

