/**
 * Enriquecimento e Validação de Prompts
 * 
 * Gera múltiplas alternativas de prompts detalhados a partir de um prompt simples,
 * usando IA para garantir prompts robustos e completos.
 */

export interface PromptAlternative {
  prompt: string;
  description: string; // Explicação do que o prompt gera
  style?: string; // "futurista", "realista", "minimalista", etc
  tags?: string[]; // Tags para categorização
}

export interface ExpandPromptOptions {
  provider?: 'gemini' | 'openai';
  count?: number; // Quantidade de alternativas (padrão: 5)
  context?: {
    storeName?: string;
    brandColors?: string[];
    targetAudience?: string;
    useCase?: 'product' | 'promotional' | 'educational' | 'lifestyle';
  };
}

export interface ExpandPromptResult {
  original: string;
  alternatives: PromptAlternative[];
  recommendations?: {
    bestFor?: string;
    tips?: string[];
  };
}

/**
 * Factory para escolher provider de expansão
 */
export async function expandPrompt(
  originalPrompt: string,
  options: ExpandPromptOptions = {}
): Promise<ExpandPromptResult> {
  const provider = options.provider || 'gemini';
  const count = options.count || 5;

  if (provider === 'gemini') {
    return await expandPromptWithGemini(originalPrompt, { ...options, count });
  } else {
    return await expandPromptWithOpenAI(originalPrompt, { ...options, count });
  }
}

/**
 * Expandir prompt usando Gemini
 */
async function expandPromptWithGemini(
  originalPrompt: string,
  options: ExpandPromptOptions & { count: number }
): Promise<ExpandPromptResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const API_KEY = process.env.GEMINI_API_KEY;

  // Construir prompt para expansão
  const expansionPrompt = buildExpansionPrompt(originalPrompt, options);

  const response = await fetch(
    `${BASE_URL}/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: expansionPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.8,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  const result = JSON.parse(content);

  return {
    original: originalPrompt,
    alternatives: result.alternatives || [],
    recommendations: result.recommendations,
  };
}

/**
 * Expandir prompt usando OpenAI GPT
 */
async function expandPromptWithOpenAI(
  originalPrompt: string,
  options: ExpandPromptOptions & { count: number }
): Promise<ExpandPromptResult> {
  const OpenAI = (await import('openai')).default;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const expansionPrompt = buildExpansionPrompt(originalPrompt, options);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Usar modelo mais barato para expansão
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em criação de prompts para geração de imagens. Gere alternativas detalhadas e profissionais. IMPORTANTE: TODAS as respostas, prompts e descrições DEVEM estar em PORTUGUÊS DO BRASIL (pt-BR). Nunca use inglês ou outros idiomas.',
      },
      {
        role: 'user',
        content: expansionPrompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8, // Criatividade para gerar variações
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');

  return {
    original: originalPrompt,
    alternatives: result.alternatives || [],
    recommendations: result.recommendations,
  };
}

/**
 * Construir prompt de sistema para expansão
 */
function buildExpansionPrompt(
  originalPrompt: string,
  options: ExpandPromptOptions & { count: number }
): string {
  const context = options.context || {};
  
  let systemPrompt = `Você é um especialista em criação de prompts detalhados para geração de imagens/vídeos com IA.

O usuário forneceu um prompt simples/incompleto: "${originalPrompt}"

Sua tarefa é gerar ${options.count} alternativas de prompts DETALHADOS, COMPLETOS e PROFISSIONAIS que uma IA de geração de imagens entenderá perfeitamente.

Cada alternativa deve incluir:
- Descrição detalhada da cena/composição
- Estilo visual (futurista, realista, minimalista, vintage, etc)
- Iluminação e atmosfera
- Cores e paleta (se relevante)
- Ângulo e perspectiva
- Qualidade técnica (4K, alta resolução, profissional)
- Contexto e detalhes adicionais

`;

  if (context.storeName) {
    systemPrompt += `Contexto da loja: ${context.storeName}\n`;
  }

  if (context.brandColors && context.brandColors.length > 0) {
    systemPrompt += `Cores da marca a considerar: ${context.brandColors.join(', ')}\n`;
  }

  if (context.targetAudience) {
    systemPrompt += `Público-alvo: ${context.targetAudience}\n`;
  }

  if (context.useCase) {
    const useCaseMap = {
      product: 'imagem de produto para e-commerce',
      promotional: 'conteúdo promocional para redes sociais',
      educational: 'conteúdo educativo/informativo',
      lifestyle: 'conteúdo de estilo de vida/inspiração',
    };
    systemPrompt += `Uso pretendido: ${useCaseMap[context.useCase]}\n`;
  }

  systemPrompt += `
Retorne um JSON com o seguinte formato (TODOS os textos em PORTUGUÊS DO BRASIL):
{
  "alternatives": [
    {
      "prompt": "prompt detalhado e completo aqui em português do Brasil",
      "description": "breve descrição do que será gerado em português",
      "style": "estilo visual em português",
      "tags": ["tag1 em português", "tag2 em português"]
    },
    ...mais ${options.count - 1} alternativas
  ],
  "recommendations": {
    "bestFor": "qual alternativa é melhor para qual propósito (em português)",
    "tips": ["dica 1 em português", "dica 2 em português"]
  }
}

IMPORTANTE CRÍTICO: 
- TODAS as respostas DEVEM estar em PORTUGUÊS DO BRASIL (pt-BR). Nunca use inglês.
- Cada prompt alternativo deve ser AUTOCONTIDO, COMPLETO e em PORTUGUÊS DO BRASIL
- Seja específico com detalhes visuais
- Inclua informações técnicas (resolução, qualidade, estilo)
- Varie os estilos entre as alternativas (realista, artístico, minimalista, etc)
- Mantenha a essência do prompt original
- DESCRIÇÕES, TAGS e RECOMENDAÇÕES também devem estar em PORTUGUÊS DO BRASIL
`;

  return systemPrompt;
}

/**
 * Validar qualidade de um prompt antes de gerar
 */
export interface PromptValidation {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  estimatedQuality: 'low' | 'medium' | 'high';
}

export async function validatePromptQuality(
  prompt: string
): Promise<PromptValidation> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Validações básicas
  if (prompt.length < 10) {
    issues.push('Prompt muito curto (mínimo 10 caracteres)');
    score -= 30;
  }

  if (prompt.length > 1000) {
    issues.push('Prompt muito longo (máximo 1000 caracteres)');
    score -= 20;
  }

  // Verificar se tem detalhes visuais
  const visualKeywords = [
    'cor', 'cor', 'cores', 'estilo', 'iluminação', 'fundo', 'perspectiva',
    'ângulo', 'composição', 'textura', 'material', 'resolução', 'qualidade',
  ];

  const hasVisualDetails = visualKeywords.some((keyword) =>
    prompt.toLowerCase().includes(keyword)
  );

  if (!hasVisualDetails) {
    suggestions.push(
      'Considere adicionar detalhes sobre: cores, estilo visual, iluminação, perspectiva'
    );
    score -= 15;
  }

  // Verificar se é muito genérico
  const genericWords = ['coisa', 'algo', 'um', 'uma', 'algum'];
  const genericCount = genericWords.filter((word) =>
    prompt.toLowerCase().includes(word)
  ).length;

  if (genericCount > 3) {
    suggestions.push('Tente ser mais específico e detalhado');
    score -= 10;
  }

  // Determinar qualidade estimada
  let estimatedQuality: 'low' | 'medium' | 'high' = 'medium';
  if (score >= 80) {
    estimatedQuality = 'high';
  } else if (score >= 60) {
    estimatedQuality = 'medium';
  } else {
    estimatedQuality = 'low';
  }

  return {
    isValid: score >= 50 && issues.length === 0,
    score,
    issues,
    suggestions,
    estimatedQuality,
  };
}

/**
 * Validar prompt considerando contexto da loja/marca
 */
export async function validatePromptWithContext(
  prompt: string,
  context?: {
    brandColors?: string[];
    storeName?: string;
    useCase?: string;
  }
): Promise<PromptValidation> {
  const baseValidation = await validatePromptQuality(prompt);
  const suggestions = [...baseValidation.suggestions];

  // Se tem cores da marca, sugerir incluir
  if (context?.brandColors && context.brandColors.length > 0) {
    const hasBrandColors = context.brandColors.some((color) =>
      prompt.toLowerCase().includes(color.toLowerCase())
    );

    if (!hasBrandColors) {
      suggestions.push(
        `Considere incluir as cores da marca: ${context.brandColors.join(', ')}`
      );
    }
  }

  return {
    ...baseValidation,
    suggestions,
  };
}

