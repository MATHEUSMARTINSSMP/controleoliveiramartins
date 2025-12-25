/**
 * Barrel export para módulo de marketing
 * Facilita imports e mantém modularização
 */

// AI Providers
export * from '../ai-providers/adapter-factory';
export * from '../ai-providers/image-utils';

// Prompt System
export * from '../prompt/prompt-spec';
export * from '../prompt/prompt-builder';
export * from '../prompt/prompt-enricher';

// Storage
export * from '../storage/upload-media';
export * from '../storage/generate-signed-url';

// Validation
export * from '../validation/validate-prompt';
export * from '../validation/validate-images';
export * from '../validation/validate-provider';

// Quota & Rate Limiting
export * from '../quota/check-quota';
export * from '../rate-limit/check-rate-limit';

// Config
export * from '../config/provider-config';

// Errors
export * from '../errors/error-codes';

// Logging
export * from '../logging/log-job';
export * from '../logging/log-error';

