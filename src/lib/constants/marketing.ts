/**
 * Constantes do Módulo de Marketing
 * Centraliza valores mágicos e configurações
 */

// Limites de Upload
export const MAX_INPUT_IMAGES = 5;
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
export const MAX_VIDEO_SIZE_MB = 500;
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// Polling e Timeouts
export const POLLING_INTERVAL_MS = 3000; // 3 segundos
export const MAX_POLLING_ATTEMPTS = 200; // ~10 minutos para vídeos
export const VIDEO_POLLING_INTERVAL_MS = 5000; // 5 segundos para vídeos

// Worker
export const MAX_JOBS_PER_RUN = 5;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;

// Quotas Padrão (podem vir do plano)
export const DEFAULT_DAILY_QUOTA = 100;
export const DEFAULT_MONTHLY_QUOTA = 2000;

// Rate Limiting
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 10;
export const DEFAULT_RATE_LIMIT_PER_HOUR = 100;

// Storage
export const SIGNED_URL_EXPIRY_HOURS = 24;
export const STORAGE_BUCKET = 'marketing-assets';

// MIME Types Permitidos
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
] as const;

export const ALLOWED_MASK_MIME_TYPES = [
  'image/png', // Apenas PNG para máscaras
] as const;

// Tamanhos de Saída Padrão
export const DEFAULT_IMAGE_SIZE = '1024x1024';
export const DEFAULT_VIDEO_SIZE = '1280x720';
export const DEFAULT_VIDEO_DURATION_SECONDS = 8;

// Status de Jobs
export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
  CANCELED: 'canceled',
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

// Tipos de Mídia
export const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export type MediaType = typeof MEDIA_TYPES[keyof typeof MEDIA_TYPES];

// Providers
export const PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
} as const;

export type Provider = typeof PROVIDERS[keyof typeof PROVIDERS];

