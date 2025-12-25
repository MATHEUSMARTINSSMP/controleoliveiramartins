/**
 * PromptSpec - Schema JSON padronizado para prompts profissionais
 * 
 * Sistema em camadas: brief → plano → prompt de geração → QA → iteração
 * Baseado nas melhores práticas de Google Gemini e OpenAI
 */

export type MediaFormat = 'carousel' | 'post' | 'story' | 'reels' | 'video' | 'image_edit';
export type AspectRatio = '1:1' | '9:16' | '16:9';
export type Tone = 'intellectual' | 'editorial' | 'minimalist' | 'commercial' | 'lifestyle' | 'educational';
export type VisualStyle = 'premium' | 'editorial' | 'realistic' | 'artistic' | 'minimalist' | 'cinematic';

/**
 * Spec completo para geração profissional
 */
export interface PromptSpec {
  // Meta
  format: MediaFormat;
  objective: string;
  targetAudience: string;
  tone: Tone;
  
  // Formato técnico
  aspectRatio: AspectRatio;
  dimensions?: string; // "1024x1024", "1080x1920"
  duration?: number; // Para vídeo (segundos)
  slideCount?: number; // Para carousel
  
  // Direção criativa
  visualStyle: VisualStyle;
  mood: string; // Descrição do mood/atmosfera
  references?: string[]; // Referências genéricas de estilo
  
  // Sistema visual
  brandColors?: string[]; // ["#hex1", "#hex2"]
  typography?: {
    heading?: string;
    body?: string;
  };
  layout?: {
    margins?: string; // "8-10%"
    safeAreas?: {
      top?: number;
      bottom?: number;
    };
  };
  
  // Conteúdo
  subject?: string;
  scene?: string;
  action?: string;
  
  // Especificações técnicas (imagem)
  lighting?: string;
  composition?: string;
  camera?: {
    shot?: string; // "medium shot", "close-up", etc
    movement?: string; // "slow dolly-in", "static", etc
    lens?: string; // "natural", "wide-angle", etc
  };
  
  // Vídeo específico
  rhythm?: string;
  transitions?: string;
  audio?: {
    dialogue?: Array<{ character: string; text: string }>;
    sfx?: string[];
    music?: string;
  };
  
  // Restrições
  constraints: {
    preserve?: string[]; // O que preservar (para edições)
    change?: string[]; // O que alterar (para edições)
    avoid?: string[]; // O que evitar
    textRendering?: 'none' | 'minimal' | 'full'; // Se deve renderizar texto
    logoPlacement?: 'after' | 'included' | 'none';
  };
  
  // Hierarquia de informação (para carrossel/post)
  content?: {
    headline?: string;
    subheadline?: string;
    body?: string;
    cta?: string;
    emphasisWords?: string[];
  };
  
  // Carousel específico
  slides?: Array<{
    role: string; // "intro", "problem", "solution", "cta"
    headline: string;
    body?: string;
    emphasisWords?: string[];
    visualDirection: string;
    bgStyle: string;
    layoutNotes: string;
  }>;
  
  // Edição específico
  editTask?: {
    imageA?: {
      type: string; // "product", "model", "background"
      description: string;
    };
    imageB?: {
      type: string;
      description: string;
    };
    preserve: string[];
    change: string[];
    quality: string;
  };
  
  // Saída estruturada
  outputRequirements: {
    renderText: boolean; // Se deve renderizar texto na imagem
    spaceForText?: {
      position: string;
      percentage: number;
    };
    format: 'png' | 'jpg' | 'mp4';
    quality: 'standard' | 'hd' | '4k';
  };
}

/**
 * Template base por formato
 */
export const PROMPT_TEMPLATES: Record<MediaFormat, Partial<PromptSpec>> = {
  carousel: {
    format: 'carousel',
    aspectRatio: '1:1',
    visualStyle: 'editorial',
    tone: 'intellectual',
    constraints: {
      textRendering: 'none',
      logoPlacement: 'after',
      avoid: ['emojis', 'elementos infantis', 'poluição visual'],
    },
    layout: {
      margins: '8-10%',
    },
  },
  post: {
    format: 'post',
    aspectRatio: '1:1',
    visualStyle: 'premium',
    tone: 'editorial',
    constraints: {
      textRendering: 'minimal',
      logoPlacement: 'after',
      avoid: ['banner barato', 'excesso de props', 'poluição visual'],
    },
  },
  story: {
    format: 'story',
    aspectRatio: '9:16',
    visualStyle: 'editorial',
    tone: 'minimalist',
    constraints: {
      textRendering: 'minimal',
      logoPlacement: 'after',
      avoid: ['emojis', 'elementos chamativos'],
    },
    layout: {
      safeAreas: {
        top: 250,
        bottom: 350,
      },
    },
  },
  reels: {
    format: 'reels',
    aspectRatio: '9:16',
    duration: 8,
    visualStyle: 'cinematic',
    tone: 'editorial',
    constraints: {
      textRendering: 'none',
      logoPlacement: 'after',
      avoid: ['cortes agressivos', 'look comercial barato'],
    },
  },
  video: {
    format: 'video',
    aspectRatio: '16:9',
    duration: 15,
    visualStyle: 'cinematic',
    tone: 'editorial',
    constraints: {
      textRendering: 'none',
      logoPlacement: 'after',
      avoid: ['movimento excessivo', 'transições agressivas'],
    },
  },
  image_edit: {
    format: 'image_edit',
    aspectRatio: '1:1',
    visualStyle: 'realistic',
    tone: 'editorial',
    constraints: {
      textRendering: 'none',
      logoPlacement: 'none',
    },
  },
};

/**
 * Validação de PromptSpec
 */
export function validatePromptSpec(spec: PromptSpec): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar campos obrigatórios
  if (!spec.format) errors.push('format é obrigatório');
  if (!spec.objective) errors.push('objective é obrigatório');
  if (!spec.targetAudience) errors.push('targetAudience é obrigatório');
  if (!spec.visualStyle) errors.push('visualStyle é obrigatório');
  if (!spec.constraints) errors.push('constraints é obrigatório');

  // Validar formato específico
  if (spec.format === 'carousel' && !spec.slideCount) {
    errors.push('carousel precisa de slideCount');
  }

  if (spec.format === 'video' || spec.format === 'reels') {
    if (!spec.duration) errors.push('vídeo precisa de duration');
    if (!spec.camera) errors.push('vídeo precisa de especificações de camera');
  }

  if (spec.format === 'image_edit' && !spec.editTask) {
    errors.push('image_edit precisa de editTask');
  }

  // Validar constraints
  if (!spec.constraints.avoid || spec.constraints.avoid.length === 0) {
    errors.push('constraints.avoid não pode estar vazio');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Converter PromptSpec para prompt final do provider
 */
export function specToProviderPrompt(spec: PromptSpec, provider: 'gemini' | 'openai'): string {
  const parts: string[] = [];

  // Cabeçalho com formato
  parts.push(`FORMATO: ${spec.format} ${spec.aspectRatio}, estilo ${spec.visualStyle} premium.`);
  
  if (spec.duration) {
    parts.push(`Duração: ${spec.duration} segundos.`);
  }

  // Objetivo e público
  parts.push(`\nOBJETIVO: ${spec.objective}`);
  parts.push(`PÚBLICO: ${spec.targetAudience}`);
  if (spec.tone) {
    parts.push(`TOM: ${spec.tone}`);
  }

  // Direção criativa
  if (spec.mood) {
    parts.push(`\nMOOD/ATMOSFERA: ${spec.mood}`);
  }
  if (spec.scene) {
    parts.push(`CENA: ${spec.scene}`);
  }
  if (spec.subject) {
    parts.push(`SUJEITO: ${spec.subject}`);
  }
  if (spec.action) {
    parts.push(`AÇÃO: ${spec.action}`);
  }

  // Especificações técnicas
  if (spec.camera) {
    parts.push(`\nCÂMERA:`);
    if (spec.camera.shot) parts.push(`- enquadramento: ${spec.camera.shot}`);
    if (spec.camera.movement) parts.push(`- movimento: ${spec.camera.movement}`);
    if (spec.camera.lens) parts.push(`- lente/estética: ${spec.camera.lens}`);
  }

  if (spec.lighting) {
    parts.push(`ILUMINAÇÃO: ${spec.lighting}`);
  }
  if (spec.composition) {
    parts.push(`COMPOSIÇÃO: ${spec.composition}`);
  }

  // Sistema visual
  if (spec.brandColors && spec.brandColors.length > 0) {
    parts.push(`\nPALETA: ${spec.brandColors.join(', ')} (usar de forma sutil, não saturar)`);
  }

  // Layout
  if (spec.layout) {
    if (spec.layout.margins) {
      parts.push(`MARGENS: ${spec.layout.margins}`);
    }
    if (spec.layout.safeAreas) {
      parts.push(`Safe areas: ${spec.layout.safeAreas.top || 0}px topo, ${spec.layout.safeAreas.bottom || 0}px base`);
    }
  }

  // Restrições
  parts.push(`\nRESTRIÇÕES:`);
  if (spec.constraints.preserve && spec.constraints.preserve.length > 0) {
    parts.push(`- PRESERVAR: ${spec.constraints.preserve.join(', ')}`);
  }
  if (spec.constraints.change && spec.constraints.change.length > 0) {
    parts.push(`- ALTERAR: ${spec.constraints.change.join(', ')}`);
  }
  if (spec.constraints.avoid && spec.constraints.avoid.length > 0) {
    parts.push(`- EVITAR: ${spec.constraints.avoid.join(', ')}`);
  }

  if (spec.constraints.textRendering === 'none') {
    parts.push(`- NÃO incluir texto legível (vou aplicar tipografia depois)`);
  }
  if (spec.constraints.logoPlacement === 'after') {
    parts.push(`- Logo NÃO incluir (será aplicado depois)`);
  }

  // Vídeo específico
  if (spec.format === 'video' || spec.format === 'reels') {
    if (spec.rhythm) {
      parts.push(`RITMO: ${spec.rhythm}`);
    }
    if (spec.transitions) {
      parts.push(`TRANSIÇÕES: ${spec.transitions}`);
    }
    if (spec.audio) {
      parts.push(`\nÁUDIO:`);
      if (spec.audio.dialogue) {
        spec.audio.dialogue.forEach(d => {
          parts.push(`- ${d.character} diz: "${d.text}"`);
        });
      }
      if (spec.audio.sfx) {
        parts.push(`- SFX: ${spec.audio.sfx.join(', ')}`);
      }
      if (spec.audio.music) {
        parts.push(`- Música: ${spec.audio.music}`);
      }
    }
  }

  // Edição específica
  if (spec.format === 'image_edit' && spec.editTask) {
    parts.push(`\nTAREFA: edição/composição usando referências.`);
    if (spec.editTask.imageA) {
      parts.push(`IMAGEM A (${spec.editTask.imageA.type}): ${spec.editTask.imageA.description}`);
    }
    if (spec.editTask.imageB) {
      parts.push(`IMAGEM B (${spec.editTask.imageB.type}): ${spec.editTask.imageB.description}`);
    }
  }

  return parts.join('\n');
}

