/**
 * Verificação de Quotas
 * 
 * Verifica limites diários e mensais por loja usando marketing_usage
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface QuotaInfo {
  withinLimit: boolean;
  currentCount: number;
  limitCount: number;
  remaining: number;
  periodType: 'daily' | 'monthly';
  periodStart: Date;
}

export interface PlanLimits {
  daily: number;
  monthly: number;
  costPerImage?: number;
  costPerVideo?: number;
}

// Limites padrão por plano (TODO: buscar do banco de dados)
const DEFAULT_PLAN_LIMITS: PlanLimits = {
  daily: 100,
  monthly: 2000,
  costPerImage: 0.02,
  costPerVideo: 0.10,
};

/**
 * Verificar quota para uma loja
 */
export async function checkQuota(
  storeId: string,
  type: 'image' | 'video' | 'total',
  periodType: 'daily' | 'monthly' = 'monthly',
  planLimits?: PlanLimits
): Promise<QuotaInfo> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  // Usar limites do plano ou padrão
  const limits = planLimits || DEFAULT_PLAN_LIMITS;
  const limitCount = periodType === 'daily' ? limits.daily : limits.monthly;

  // Calcular início do período
  const now = new Date();
  const periodStart =
    periodType === 'daily'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), 1);

  // Buscar uso atual
  const { data, error } = await supabase
    .from('marketing_usage')
    .select('count')
    .eq('store_id', storeId)
    .eq('period_start', periodStart.toISOString())
    .eq('period_type', periodType)
    .eq('type', type)
    .single();

  const currentCount = data?.count || 0;
  const remaining = Math.max(0, limitCount - currentCount);
  const withinLimit = currentCount < limitCount;

  return {
    withinLimit,
    currentCount,
    limitCount,
    remaining,
    periodType,
    periodStart,
  };
}

/**
 * Verificar quota total (daily + monthly)
 */
export async function checkQuotaTotal(
  storeId: string,
  type: 'image' | 'video' | 'total',
  planLimits?: PlanLimits
): Promise<{
  daily: QuotaInfo;
  monthly: QuotaInfo;
  canProceed: boolean;
}> {
  const [daily, monthly] = await Promise.all([
    checkQuota(storeId, type, 'daily', planLimits),
    checkQuota(storeId, type, 'monthly', planLimits),
  ]);

  const canProceed = daily.withinLimit && monthly.withinLimit;

  return {
    daily,
    monthly,
    canProceed,
  };
}

/**
 * Incrementar uso (chamado após criação de job)
 */
export async function incrementUsage(
  storeId: string,
  type: 'image' | 'video',
  costEstimate?: number
): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'sistemaretiradas' },
  });

  // Usar função do banco
  const { error } = await supabase.rpc('increment_marketing_usage', {
    p_store_id: storeId,
    p_type: type,
    p_cost_estimate: costEstimate || 0,
  });

  if (error) {
    console.error('Erro ao incrementar uso:', error);
    // Não falhar silenciosamente em produção, mas logar
  }
}

/**
 * Obter limites do plano da loja (TODO: implementar tabela de planos)
 */
export async function getPlanLimits(storeId: string): Promise<PlanLimits> {
  // Por enquanto, retorna limites padrão
  // TODO: Buscar de tabela stores ou subscriptions
  return DEFAULT_PLAN_LIMITS;
}

/**
 * Estimar custo por tipo de mídia
 */
export function estimateCost(
  type: 'image' | 'video',
  provider: 'gemini' | 'openai',
  quality: 'low' | 'medium' | 'high' = 'high'
): number {
  // Estimativas aproximadas (ajustar conforme custos reais)
  const costs: Record<string, Record<string, number>> = {
    gemini: {
      image: 0.01,
      video: 0.08,
    },
    openai: {
      image: 0.03,
      video: 0.12,
    },
  };

  const baseCost = costs[provider]?.[type] || 0.02;

  // Ajustar por qualidade
  const qualityMultiplier: Record<string, number> = {
    low: 0.7,
    medium: 0.9,
    high: 1.0,
  };

  return baseCost * qualityMultiplier[quality];
}

