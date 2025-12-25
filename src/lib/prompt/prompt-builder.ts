/**
 * PromptBuilder - LLM que transforma inputs do usuário em PromptSpec profissional
 * 
 * Sistema de meta-prompting: gera 3 variações (conservador/editorial/ousado)
 * com checklist de qualidade
 */

import type { PromptSpec, MediaFormat, Tone, VisualStyle } from './prompt-spec';
import { PROMPT_TEMPLATES, validatePromptSpec } from './prompt-spec';

export interface UserInput {
  format: MediaFormat;
  theme: string; // Tema/tópico
  objective: string; // Objetivo de negócio
  targetAudience?: string;
  tone?: Tone;
  brandColors?: string[];
  storeName?: string;
  context?: {
    useCase?: 'product' | 'promotional' | 'educational' | 'lifestyle';
    additionalInfo?: string;
  };
}

export interface PromptBuilderResult {
  specs: Array<{ variant: 'conservative' | 'editorial' | 'bold'; spec: PromptSpec }>;
  recommendations: {
    bestFor: string;
    qualityScore: number;
    tips: string[];
  };
}

/**
 * Construir PromptSpec profissional a partir de input do usuário
 */
export async function buildPromptSpec(
  input: UserInput,
  provider: 'gemini' | 'openai' = 'gemini'
): Promise<PromptBuilderResult> {
  const template = PROMPT_TEMPLATES[input.format] || {};

  // Construir prompt de sistema para o LLM
  const systemPrompt = buildSystemPrompt(input, template);

  // Chamar LLM para gerar spec
  const llmResponse = await callLLMForSpec(systemPrompt, provider);

  // Parse e validação
  const specs = parseLLMResponse(llmResponse, input, template);
  
  // Validar cada spec
  const validatedSpecs = specs.map(item => ({
    ...item,
    spec: validateAndFix(item.spec),
  }));

  // Gerar recomendações
  const recommendations = generateRecommendations(validatedSpecs);

  return {
    specs: validatedSpecs,
    recommendations,
  };
}

/**
 * Construir prompt de sistema para o LLM gerar PromptSpec
 */
function buildSystemPrompt(
  input: UserInput,
  template: Partial<PromptSpec>
): string {
  return `Você é um Diretor Criativo especialista em conteúdo editorial premium para redes sociais.

TAREFA: Gerar 3 variações de PromptSpec profissional em JSON (conservative, editorial, bold).

INPUT DO USUÁRIO:
- Formato: ${input.format}
- Tema: ${input.theme}
- Objetivo: ${input.objective}
- Público: ${input.targetAudience || 'geral'}
- Tom: ${input.tone || 'editorial'}
${input.brandColors ? `- Cores da marca: ${input.brandColors.join(', ')}` : ''}
${input.storeName ? `- Loja: ${input.storeName}` : ''}

REGRAS OBRIGATÓRIAS:
1. Cada variação deve ser um PromptSpec JSON completo e válido
2. Conservative: seguro, profissional, mainstream
3. Editorial: sofisticado, minimalista, alto padrão
4. Bold: criativo, arrojado, diferenciado

TEMPLATE BASE:
${JSON.stringify(template, null, 2)}

CAMPOS OBRIGATÓRIOS para ${input.format}:
${getRequiredFieldsForFormat(input.format)}

VALIDAÇÃO:
- objective deve ser claro e específico
- targetAudience deve ser detalhado (não apenas "geral")
- constraints.avoid deve ter pelo menos 3 itens específicos
- visualStyle deve estar alinhado com o tom
- Se ${input.format} === "video" ou "reels": camera, lighting, rhythm são obrigatórios
- Se ${input.format} === "carousel": slides[] é obrigatório com pelo menos ${template.slideCount || 5} slides

ESTÉTICA PREMIUM:
- Usar termos como "editorial", "cinematográfico", "alto contraste", "espaço em branco"
- Evitar "banner barato", "comercial excessivo", "poluição visual"
- Priorizar minimalismo e sofisticação

RETORNE APENAS JSON válido (sem markdown, sem code blocks):
{
  "specs": [
    {
      "variant": "conservative",
      "spec": { ...PromptSpec completo ... }
    },
    {
      "variant": "editorial",
      "spec": { ...PromptSpec completo ... }
    },
    {
      "variant": "bold",
      "spec": { ...PromptSpec completo ... }
    }
  ],
  "recommendations": {
    "bestFor": "descrição de qual usar para qual propósito",
    "qualityScore": 85,
    "tips": ["dica 1", "dica 2", "dica 3"]
  }
}`;
}

/**
 * Obter campos obrigatórios por formato
 */
function getRequiredFieldsForFormat(format: MediaFormat): string {
  const requirements: Record<MediaFormat, string> = {
    carousel: '- slides[] (array com headline, body?, visualDirection, bgStyle, layoutNotes)\n- slideCount\n- content.hierarchy',
    post: '- subject ou scene\n- composition\n- content.headline',
    story: '- content.headline\n- content.cta\n- layout.safeAreas',
    reels: '- duration (8-15s)\n- camera (shot, movement)\n- lighting\n- rhythm\n- action',
    video: '- duration\n- camera (shot, movement, lens)\n- lighting\n- scene\n- rhythm\n- transitions?',
    image_edit: '- editTask (imageA, imageB, preserve, change)\n- subject\n- quality',
  };

  return requirements[format] || '- subject\n- scene';
}

/**
 * Chamar LLM para gerar spec
 */
async function callLLMForSpec(
  systemPrompt: string,
  provider: 'gemini' | 'openai'
): Promise<any> {
  if (provider === 'gemini') {
    return await callGeminiForSpec(systemPrompt);
  } else {
    return await callOpenAIForSpec(systemPrompt);
  }
}

/**
 * Chamar Gemini
 */
async function callGeminiForSpec(prompt: string): Promise<any> {
  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const API_KEY = process.env.GEMINI_API_KEY!;

  const response = await fetch(
    `${BASE_URL}/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.8, // Criatividade para variações
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  return JSON.parse(content);
}

/**
 * Chamar OpenAI
 */
async function callOpenAIForSpec(prompt: string): Promise<any> {
  const API_KEY = process.env.OPENAI_API_KEY!;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um Diretor Criativo especialista em conteúdo editorial premium. Gere PromptSpec JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

/**
 * Parse resposta do LLM
 */
function parseLLMResponse(
  llmResponse: any,
  input: UserInput,
  template: Partial<PromptSpec>
): Array<{ variant: 'conservative' | 'editorial' | 'bold'; spec: PromptSpec }> {
  const specs = llmResponse.specs || [];

  return specs.map((item: any) => ({
    variant: item.variant,
    spec: {
      ...template,
      ...item.spec,
      format: input.format,
      objective: input.objective,
      targetAudience: input.targetAudience || 'geral',
      tone: input.tone || 'editorial',
      aspectRatio: template.aspectRatio || '1:1',
      brandColors: input.brandColors,
      visualStyle: item.spec.visualStyle || template.visualStyle || 'editorial',
      constraints: {
        ...template.constraints,
        ...item.spec.constraints,
      },
    } as PromptSpec,
  }));
}

/**
 * Validar e corrigir spec
 */
function validateAndFix(spec: PromptSpec): PromptSpec {
  const validation = validatePromptSpec(spec);

  if (!validation.valid) {
    // Corrigir automaticamente quando possível
    const fixed = { ...spec };

    if (!fixed.constraints.avoid || fixed.constraints.avoid.length === 0) {
      fixed.constraints.avoid = ['poluição visual', 'estilo comercial barato', 'excesso de elementos'];
    }

    if (fixed.format === 'video' || fixed.format === 'reels') {
      if (!fixed.duration) fixed.duration = fixed.format === 'reels' ? 8 : 15;
      if (!fixed.camera) {
        fixed.camera = {
          shot: 'medium shot',
          movement: 'smooth',
          lens: 'natural',
        };
      }
    }

    return fixed;
  }

  return spec;
}

/**
 * Gerar recomendações
 */
function generateRecommendations(
  specs: Array<{ variant: string; spec: PromptSpec }>
): { bestFor: string; qualityScore: number; tips: string[] } {
  // Calcular score baseado em completude
  const scores = specs.map(item => {
    let score = 100;
    const spec = item.spec;

    if (!spec.mood) score -= 5;
    if (!spec.lighting && (spec.format === 'video' || spec.format === 'reels')) score -= 10;
    if (!spec.composition) score -= 5;
    if (!spec.brandColors) score -= 5;
    if (!spec.constraints.avoid || spec.constraints.avoid.length < 3) score -= 10;

    return { variant: item.variant, score };
  });

  const best = scores.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));

  const tips: string[] = [];
  tips.push(`Use "${best.variant}" para máxima qualidade (score: ${best.score}/100)`);
  tips.push('Revise constraints.avoid para garantir restrições específicas');
  tips.push('Adicione brandColors para consistência visual');
  
  if (specs[0].spec.format === 'video' || specs[0].spec.format === 'reels') {
    tips.push('Especifique camera.movement para controle total do movimento');
  }

  return {
    bestFor: `Variação "${best.variant}" é recomendada para produção premium`,
    qualityScore: best.score,
    tips,
  };
}

