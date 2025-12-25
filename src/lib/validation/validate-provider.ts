/**
 * Validação de Provider e Model
 * 
 * Verifica se provider/model está permitido e é compatível
 */

import type { Provider, MediaType } from '@/types/marketing';
import { isValidModel, getAllowedModels } from '@/lib/config/provider-config';

export interface ProviderValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Validar provider e model
 */
export function validateProvider(
  provider: Provider,
  model: string,
  type: MediaType
): ProviderValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Verificar se provider é válido
  if (provider !== 'gemini' && provider !== 'openai') {
    errors.push(`Provider inválido: ${provider}. Permitidos: gemini, openai`);
    return { valid: false, errors, warnings, suggestions };
  }

  // Verificar se model é válido para o tipo
  if (!isValidModel(provider, model, type === 'image' ? 'image' : 'video')) {
    errors.push(
      `Modelo "${model}" não é válido para ${provider} ${type === 'image' ? 'image' : 'video'}`
    );

    // Sugerir modelos permitidos
    const allowed = getAllowedModels(
      provider,
      type === 'image' ? 'image' : 'video'
    );
    if (allowed.length > 0) {
      suggestions.push(
        `Modelos permitidos para ${provider} ${type}: ${allowed.join(', ')}`
      );
    }
  }

  // Avisos específicos por provider
  if (provider === 'openai') {
    // Verificar se está usando modelo descontinuado
    if (model.startsWith('dall-e-3')) {
      warnings.push(
        'DALL-E 3 está em rota de descontinuação. Considere usar gpt-image-*'
      );
    }

    // Verificar se é modelo de preview
    if (model.includes('preview') || model.includes('beta')) {
      warnings.push(
        'Modelo em preview/beta pode ter limitações ou mudanças na API'
      );
    }
  }

  if (provider === 'gemini') {
    // Verificar se é modelo de preview
    if (model.includes('preview') || model.includes('beta')) {
      warnings.push(
        'Modelo em preview pode ter limitações ou quotas restritas'
      );
    }

    // Aviso sobre Veo
    if (model.startsWith('veo-') && type === 'video') {
      warnings.push(
        'Veo pode exigir acesso especial e tem quotas limitadas'
      );
    }
  }

  // Verificar compatibilidade tipo/model
  if (type === 'image' && !model.includes('image') && model !== 'gemini-2.5-flash-image') {
    warnings.push(
      `Modelo "${model}" pode não ser otimizado para geração de imagens`
    );
  }

  if (type === 'video' && !model.includes('veo') && !model.includes('sora')) {
    warnings.push(
      `Modelo "${model}" pode não ser otimizado para geração de vídeos`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validar configuração completa de geração
 */
export function validateGenerationConfig(
  provider: Provider,
  model: string,
  type: MediaType,
  hasInputImages: boolean,
  hasMask: boolean
): ProviderValidation {
  const baseValidation = validateProvider(provider, model, type);
  const errors = [...baseValidation.errors];
  const warnings = [...baseValidation.warnings];
  const suggestions = [...baseValidation.suggestions];

  // Verificar suporte a múltiplas imagens
  if (hasInputImages && provider === 'openai' && type === 'image') {
    // OpenAI pode não suportar múltiplas imagens diretamente
    warnings.push(
      'OpenAI pode ter suporte limitado a múltiplas imagens. Considere usar Gemini ou processar uma imagem por vez.'
    );
  }

  // Verificar suporte a máscara
  if (hasMask && provider !== 'openai') {
    errors.push(
      'Máscara para inpainting só é suportada por OpenAI atualmente'
    );
  }

  if (hasMask && type !== 'image') {
    errors.push('Máscara só é suportada para geração de imagens');
  }

  // Verificar se modelo suporta as features necessárias
  if (type === 'image' && hasInputImages) {
    if (provider === 'gemini') {
      // Gemini suporta multi-image nativamente
      // Tudo OK
    } else if (provider === 'openai') {
      warnings.push(
        'OpenAI pode requerer processamento especial para múltiplas imagens'
      );
    }
  }

  return {
    valid: baseValidation.valid && errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

