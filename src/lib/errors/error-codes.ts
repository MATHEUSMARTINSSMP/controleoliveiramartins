/**
 * Códigos de Erro Padronizados
 */

export type ErrorCode = 
  | 'RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'VALIDATION_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'STORAGE_ERROR'
  | 'AUTH_ERROR'
  | 'INVALID_INPUT'
  | 'JOB_NOT_FOUND'
  | 'JOB_CANCELED'
  | 'UNKNOWN_ERROR';

export interface MarketingError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: any;
}

export function createError(
  code: ErrorCode,
  message: string,
  details?: any
): MarketingError {
  const statusCodes: Record<ErrorCode, number> = {
    RATE_LIMIT: 429,
    PROVIDER_ERROR: 502,
    VALIDATION_ERROR: 400,
    QUOTA_EXCEEDED: 403,
    STORAGE_ERROR: 500,
    AUTH_ERROR: 401,
    INVALID_INPUT: 400,
    JOB_NOT_FOUND: 404,
    JOB_CANCELED: 409,
    UNKNOWN_ERROR: 500,
  };

  const error = new Error(message) as MarketingError;
  error.code = code;
  error.statusCode = statusCodes[code];
  error.details = details;

  return error;
}

