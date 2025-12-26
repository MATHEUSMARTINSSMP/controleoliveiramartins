/**
 * Utilitário para garantir que o bucket "marketing" existe
 * Cria automaticamente se não existir
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Garantir que o bucket "marketing" existe
 * Cria automaticamente se não existir
 */
export async function ensureMarketingBucket(supabase?: SupabaseClient): Promise<void> {
  // Se não foi passado um cliente, criar um novo
  const client = supabase || createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  try {
    // Tentar listar buckets para verificar se existe
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    
    if (listError) {
      console.warn('[ensureMarketingBucket] Erro ao listar buckets:', listError);
      // Se não conseguir listar, tentar criar diretamente
      console.log('[ensureMarketingBucket] Tentando criar bucket diretamente...');
    } else {
      const marketingBucket = buckets?.find(b => b.name === 'marketing');
      
      if (marketingBucket) {
        console.log('[ensureMarketingBucket] ✅ Bucket "marketing" já existe');
        return; // Bucket existe, não precisa criar
      }
    }

    // Bucket não encontrado, criar
    console.log('[ensureMarketingBucket] Bucket "marketing" não encontrado, criando...');
    
    const { data: newBucket, error: createError } = await client.storage.createBucket('marketing', {
      public: true, // Imagens podem ser públicas
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/quicktime',
      ],
    });

    if (createError) {
      // Se o erro for que o bucket já existe, tudo bem
      if (createError.message && (
        createError.message.includes('already exists') ||
        createError.message.includes('duplicate') ||
        createError.message.includes('Bucket already exists')
      )) {
        console.log('[ensureMarketingBucket] ✅ Bucket "marketing" já existe (criado por outro processo)');
        return;
      }
      
      console.error('[ensureMarketingBucket] Erro ao criar bucket:', createError);
      throw new Error(`Erro ao criar bucket: ${createError.message}`);
    }

    console.log('[ensureMarketingBucket] ✅ Bucket "marketing" criado com sucesso');
  } catch (error: any) {
    console.error('[ensureMarketingBucket] Erro ao verificar/criar bucket:', error);
    
    // Se o erro for que o bucket já existe, não é um erro crítico
    if (error?.message && (
      error.message.includes('already exists') ||
      error.message.includes('duplicate') ||
      error.message.includes('Bucket already exists')
    )) {
      console.log('[ensureMarketingBucket] ✅ Bucket "marketing" já existe (erro ignorado)');
      return;
    }
    
    // Re-lançar erro para que o upload possa tratar
    throw error;
  }
}

/**
 * Obter site_slug de uma loja (com fallback para store_id)
 */
export async function getStoreIdentifier(
  supabase: SupabaseClient,
  storeId: string
): Promise<string> {
  try {
    const { data: store, error } = await supabase
      .schema('sistemaretiradas')
      .from('stores')
      .select('site_slug, name')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      console.warn(`[getStoreIdentifier] Erro ao buscar loja ${storeId}, usando store_id como fallback:`, error?.message);
      return storeId;
    }

    // Usar site_slug se existir, senão usar store_id
    if (store.site_slug) {
      return store.site_slug;
    }

    // Fallback para store_id
    return storeId;
  } catch (error: any) {
    console.warn(`[getStoreIdentifier] Erro ao buscar site_slug, usando store_id como fallback:`, error?.message);
    return storeId;
  }
}

