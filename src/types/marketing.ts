/**
 * Types para Módulo de Marketing com IA
 */

export type MediaType = 'image' | 'video' | 'carousel' | 'batch';
export type Provider = 'gemini' | 'openai';
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'canceled';

// Modelos permitidos (sem descontinuados)
// Documentação: https://ai.google.dev/docs/generate_images
export type GeminiImageModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type GeminiVideoModel = 'veo-2.0-generate-001' | 'veo-3.0-generate-001' | 'veo-3.1-generate-preview';
export type OpenAIImageModel = `gpt-image-${string}`; // gpt-image-001, etc
export type OpenAIVideoModel = `sora-${string}`; // sora-2-pro, etc

export type ImageModel = GeminiImageModel | OpenAIImageModel;
export type VideoModel = GeminiVideoModel | OpenAIVideoModel;

// Input para criação de mídia
export interface CreateMediaInput {
  type: MediaType;
  provider: Provider;
  model: string;
  prompt: string;
  output?: {
    // Aspect ratios suportados conforme documentação Gemini/OpenAI
    // Gemini: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
    // OpenAI: 1:1, 9:16, 16:9 (limitações dependem do modelo)
    aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
    size?: string; // "1024x1024", "1280x720"
    seconds?: number; // Para vídeos
  };
  brand?: {
    apply: boolean;
    storeId?: string;
  };
  inputImages?: string[]; // Array de base64 ou URLs
  mask?: string; // Base64 PNG para inpainting (OpenAI)
  callbackUrl?: string | null;
}

// Resposta de expansão de prompt
export interface PromptAlternative {
  prompt: string;
  description: string;
  style?: string;
  tags?: string[];
}

export interface ExpandPromptResponse {
  original: string;
  alternatives: PromptAlternative[];
  recommendations?: {
    bestFor?: string;
    tips?: string[];
  };
}

// Resposta de criação (sempre retorna job)
export interface CreateMediaResponse {
  jobId: string;
  status: 'queued';
}

// Status do job
export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress?: number; // 0-100
  asset?: {
    assetId: string;
    type: MediaType;
    mediaUrl: string;
    thumbnailUrl?: string | null;
    mime: string;
    meta: {
      width?: number;
      height?: number;
      duration?: number;
      [key: string]: any;
    };
  };
  error?: {
    message: string;
    code: string;
  };
}

// Asset resultante
export interface MarketingAsset {
  id: string;
  storeId: string;
  userId: string;
  type: MediaType;
  provider: Provider;
  providerModel: string;
  prompt: string;
  promptHash?: string;
  storagePath: string;
  publicUrl?: string;
  signedUrl?: string;
  signedExpiresAt?: string;
  meta: Record<string, any>;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
}

// Job assíncrono
export interface MarketingJob {
  id: string;
  storeId: string;
  userId: string;
  type: MediaType;
  provider: Provider;
  providerModel: string;
  status: JobStatus;
  progress: number;
  input: CreateMediaInput;
  promptOriginal?: string; // Prompt original do usuário
  promptFinal?: string; // Prompt final usado (após expansão)
  providerRef?: string; // operation_name ou video_id
  result?: {
    assetId: string;
    mediaUrl: string;
    thumbnailUrl?: string;
    meta: Record<string, any>;
  };
  errorMessage?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// Erros padronizados
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

export interface MarketingError {
  code: ErrorCode;
  message: string;
  details?: any;
}

// Provider adapter interfaces
export interface ImageGenerationResult {
  imageData: Buffer | string; // Base64 ou Buffer
  width: number;
  height: number;
  mimeType: string;
}

export interface VideoGenerationOperation {
  operationId: string; // Para polling
  estimatedTime?: number; // Segundos
}

export interface VideoGenerationResult {
  videoData: Buffer;
  duration: number;
  width: number;
  height: number;
  mimeType: string;
}

// Configuração de provider
export interface ProviderConfig {
  gemini: {
    apiKey: string;
    baseUrl: string;
    imageModel: GeminiImageModel;
    videoModel: GeminiVideoModel;
  };
  openai: {
    apiKey: string;
    baseUrl: string;
    imageModel: OpenAIImageModel;
    videoModel: OpenAIVideoModel;
  };
}

// Quota/Limites
export interface QuotaInfo {
  withinLimit: boolean;
  currentCount: number;
  limitCount: number;
  remaining: number;
}
