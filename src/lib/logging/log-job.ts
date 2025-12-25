/**
 * Logging de Jobs
 * 
 * Log estruturado de jobs com custo estimado e contexto
 */

export interface JobLog {
  jobId: string;
  storeId: string;
  userId: string;
  type: 'image' | 'video';
  provider: 'gemini' | 'openai';
  model: string;
  costEstimate: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface JobLogContext {
  promptLength?: number;
  hasInputImages?: boolean;
  hasMask?: boolean;
  quality?: 'low' | 'medium' | 'high';
  duration?: number; // Para vídeo
  dimensions?: string;
}

/**
 * Log de criação de job
 */
export function logJobCreated(
  jobId: string,
  storeId: string,
  userId: string,
  type: 'image' | 'video',
  provider: 'gemini' | 'openai',
  model: string,
  costEstimate: number,
  context?: JobLogContext
): void {
  const log: JobLog = {
    jobId,
    storeId,
    userId,
    type,
    provider,
    model,
    costEstimate,
    timestamp: new Date(),
    metadata: {
      promptLength: context?.promptLength,
      hasInputImages: context?.hasInputImages,
      hasMask: context?.hasMask,
      quality: context?.quality,
      duration: context?.duration,
      dimensions: context?.dimensions,
    },
  };

  // Em produção, enviar para sistema de logs (Sentry, CloudWatch, etc)
  console.log('[MARKETING_JOB_CREATED]', JSON.stringify(log));
}

/**
 * Log de conclusão de job
 */
export function logJobCompleted(
  jobId: string,
  duration: number, // Tempo de processamento em ms
  success: boolean,
  error?: string
): void {
  const log = {
    jobId,
    duration,
    success,
    error,
    timestamp: new Date(),
  };

  console.log('[MARKETING_JOB_COMPLETED]', JSON.stringify(log));
}

/**
 * Log de erro em job
 */
export function logJobError(
  jobId: string,
  error: Error,
  context?: Record<string, any>
): void {
  const log = {
    jobId,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    context,
    timestamp: new Date(),
  };

  console.error('[MARKETING_JOB_ERROR]', JSON.stringify(log));
}

/**
 * Log de custo acumulado
 */
export function logCostAccumulated(
  storeId: string,
  periodType: 'daily' | 'monthly',
  totalCost: number,
  itemCount: number
): void {
  const log = {
    storeId,
    periodType,
    totalCost,
    itemCount,
    timestamp: new Date(),
  };

  console.log('[MARKETING_COST_ACCUMULATED]', JSON.stringify(log));
}

