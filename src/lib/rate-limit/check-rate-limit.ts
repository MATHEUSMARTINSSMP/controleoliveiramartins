/**
 * Rate Limiting
 * 
 * Verifica limites de requisições por período (minuto, hora)
 * Usa tabela temporária ou cache em memória
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

// Limites padrão (requisições por minuto/hora)
const DEFAULT_RATE_LIMITS = {
  perMinute: 10,
  perHour: 100,
};

/**
 * Verificar rate limit por store_id
 */
export async function checkRateLimit(
  storeId: string,
  window: 'minute' | 'hour' = 'hour'
): Promise<RateLimitInfo> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  const limit = window === 'minute' ? DEFAULT_RATE_LIMITS.perMinute : DEFAULT_RATE_LIMITS.perHour;
  const windowMs = window === 'minute' ? 60 * 1000 : 60 * 60 * 1000;
  
  const windowStart = new Date(Date.now() - windowMs);

  // Buscar requisições no período (usar marketing_jobs como proxy)
  const { data, error, count } = await supabase
    .from('marketing_jobs')
    .select('*', { count: 'exact', head: false })
    .eq('store_id', storeId)
    .gte('created_at', windowStart.toISOString());

  const currentCount = count || 0;
  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount < limit;
  const resetAt = new Date(Date.now() + windowMs);

  return {
    allowed,
    remaining,
    resetAt,
    limit,
  };
}

/**
 * Verificar rate limit em múltiplas janelas
 */
export async function checkRateLimitMulti(
  storeId: string
): Promise<{
  minute: RateLimitInfo;
  hour: RateLimitInfo;
  canProceed: boolean;
}> {
  const [minute, hour] = await Promise.all([
    checkRateLimit(storeId, 'minute'),
    checkRateLimit(storeId, 'hour'),
  ]);

  const canProceed = minute.allowed && hour.allowed;

  return {
    minute,
    hour,
    canProceed,
  };
}

/**
 * Incrementar contador de rate limit (chamado ao criar job)
 * Nota: O contador é incrementado automaticamente ao criar marketing_jobs
 */
export async function incrementRateLimit(storeId: string): Promise<void> {
  // Rate limit é gerenciado automaticamente via contagem de marketing_jobs
  // Não precisa fazer nada aqui
  return;
}

