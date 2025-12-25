/**
 * Logging de Erros
 * 
 * Log estruturado de erros com contexto completo
 */

import type { ErrorCode } from '@/lib/errors/error-codes';

export interface ErrorLog {
  errorCode: ErrorCode;
  message: string;
  timestamp: Date;
  context: {
    userId?: string;
    storeId?: string;
    jobId?: string;
    endpoint?: string;
    httpMethod?: string;
    requestId?: string;
    [key: string]: any;
  };
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Log de erro com contexto
 */
export function logError(
  errorCode: ErrorCode,
  message: string,
  error?: Error,
  context?: Record<string, any>
): void {
  const severity = getSeverity(errorCode);
  
  const log: ErrorLog = {
    errorCode,
    message,
    timestamp: new Date(),
    context: context || {},
    stack: error?.stack,
    severity,
  };

  // Em produção, enviar para sistema de logs/monitoramento
  if (severity === 'critical' || severity === 'high') {
    console.error('[MARKETING_ERROR]', JSON.stringify(log));
  } else {
    console.warn('[MARKETING_ERROR]', JSON.stringify(log));
  }
}

/**
 * Determinar severidade baseado no código de erro
 */
function getSeverity(errorCode: ErrorCode): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap: Record<ErrorCode, 'low' | 'medium' | 'high' | 'critical'> = {
    VALIDATION_ERROR: 'low',
    INVALID_INPUT: 'low',
    JOB_NOT_FOUND: 'low',
    JOB_CANCELED: 'low',
    RATE_LIMIT: 'medium',
    QUOTA_EXCEEDED: 'medium',
    AUTH_ERROR: 'medium',
    STORAGE_ERROR: 'high',
    PROVIDER_ERROR: 'high',
    UNKNOWN_ERROR: 'critical',
  };

  return severityMap[errorCode] || 'medium';
}

/**
 * Log de requisição HTTP (para debug)
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  context?: Record<string, any>
): void {
  const log = {
    method,
    path,
    statusCode,
    duration,
    context,
    timestamp: new Date(),
  };

  console.log('[MARKETING_REQUEST]', JSON.stringify(log));
}

