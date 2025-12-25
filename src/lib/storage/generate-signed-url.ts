/**
 * Gerar URLs Assinadas para Supabase Storage
 * 
 * URLs assinadas expiram após período definido (padrão: 24h para vídeos)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface SignedUrlOptions {
  path: string;
  expiresIn?: number; // Segundos (padrão: 24h)
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  expiresIn: number;
}

/**
 * Gerar URL assinada para mídia
 */
export async function generateSignedUrl(
  options: SignedUrlOptions
): Promise<SignedUrlResult> {
  const { path, expiresIn = 24 * 60 * 60 } = options; // Padrão: 24 horas

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  const { data, error } = await supabase.storage
    .from('marketing')
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error('URL assinada não foi gerada');
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    url: data.signedUrl,
    expiresAt,
    expiresIn,
  };
}

/**
 * Renovar URL assinada (gerar nova se estiver expirada ou próxima de expirar)
 */
export async function renewSignedUrlIfNeeded(
  path: string,
  currentExpiresAt?: Date | string,
  thresholdHours: number = 1 // Renovar se faltar menos de 1 hora
): Promise<SignedUrlResult | null> {
  if (!currentExpiresAt) {
    // Sem data de expiração, gerar nova
    return await generateSignedUrl({ path });
  }

  const expiresAt = typeof currentExpiresAt === 'string' 
    ? new Date(currentExpiresAt) 
    : currentExpiresAt;

  const now = new Date();
  const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilExpiry <= thresholdHours) {
    // Renovar
    return await generateSignedUrl({ path });
  }

  // Ainda válida, retornar null para indicar que não precisa renovar
  return null;
}

/**
 * Gerar múltiplas URLs assinadas de uma vez
 */
export async function generateMultipleSignedUrls(
  paths: string[],
  expiresIn?: number
): Promise<Map<string, SignedUrlResult>> {
  const results = new Map<string, SignedUrlResult>();

  await Promise.all(
    paths.map(async (path) => {
      try {
        const result = await generateSignedUrl({ path, expiresIn });
        results.set(path, result);
      } catch (error) {
        console.error(`Erro ao gerar URL assinada para ${path}:`, error);
      }
    })
  );

  return results;
}

