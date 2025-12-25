/**
 * Netlify Function: Expandir/Enriquecer Prompt
 * 
 * POST /api/marketing/prompt/expand
 * 
 * Recebe um prompt simples e retorna 5 alternativas detalhadas usando IA
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Validar método
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Método não permitido' }),
      };
    }

    // Validar autenticação
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Não autorizado' }),
      };
    }

    // Parse body
    const body = JSON.parse(event.body || '{}');
    const { prompt, provider = 'gemini', count = 5, context = {} } = body;

    if (!prompt || prompt.trim().length < 3) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Prompt inválido',
          code: 'INVALID_INPUT',
        }),
      };
    }

    // Buscar dados da loja se context.storeId fornecido
    let storeContext = context;
    if (context.storeId) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { db: { schema: 'sistemaretiradas' } }
      );

      const { data: store } = await supabase
        .from('stores')
        .select('name, brand_colors, logo_url')
        .eq('id', context.storeId)
        .single();

      if (store) {
        storeContext = {
          ...context,
          storeName: store.name,
          brandColors: store.brand_colors?.primary 
            ? [store.brand_colors.primary, store.brand_colors.secondary].filter(Boolean)
            : undefined,
        };
      }
    }

    // Expandir prompt usando IA
    const result = await expandPromptWithAI(prompt, {
      provider,
      count,
      context: storeContext,
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[prompt-expand] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'Erro interno',
        code: 'PROVIDER_ERROR',
      }),
    };
  }
};

/**
 * Expandir prompt usando Gemini ou OpenAI
 */
async function expandPromptWithAI(prompt, options) {
  const { provider = 'gemini', count = 5, context = {} } = options;

  if (provider === 'gemini') {
    return await expandWithGemini(prompt, count, context);
  } else {
    return await expandWithOpenAI(prompt, count, context);
  }
}

/**
 * Expandir com Gemini
 */
async function expandWithGemini(prompt, count, context) {
  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  // Construir prompt de expansão
  const expansionPrompt = buildExpansionPrompt(prompt, count, context);

  // Usar gemini-2.0-flash ou gemini-1.5-pro para expansão de prompts
  const MODEL = 'gemini-2.0-flash';
  
  const response = await fetch(
    `${BASE_URL}/models/${MODEL}:generateContent?key=${API_KEY}`,
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
    original: prompt,
    alternatives: result.alternatives || [],
    recommendations: result.recommendations || {},
  };
}

/**
 * Expandir com OpenAI GPT
 */
async function expandWithOpenAI(prompt, count, context) {
  const API_KEY = process.env.OPENAI_API_KEY;

  if (!API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const expansionPrompt = buildExpansionPrompt(prompt, count, context);

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
          content:
            'Você é um especialista em criação de prompts para geração de imagens. Gere alternativas detalhadas e profissionais em JSON.',
        },
        {
          role: 'user',
          content: expansionPrompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const result = JSON.parse(content);

  return {
    original: prompt,
    alternatives: result.alternatives || [],
    recommendations: result.recommendations || {},
  };
}

/**
 * Construir prompt de sistema para expansão
 */
function buildExpansionPrompt(originalPrompt, count, context) {
  let systemPrompt = `Você é um especialista em criação de prompts detalhados para geração de imagens/vídeos com IA.

O usuário forneceu um prompt simples/incompleto: "${originalPrompt}"

Sua tarefa é gerar ${count} alternativas de prompts DETALHADOS, COMPLETOS e PROFISSIONAIS que uma IA de geração de imagens entenderá perfeitamente.

Cada alternativa deve incluir:
- Descrição detalhada da cena/composição
- Estilo visual (futurista, realista, minimalista, vintage, artístico, etc)
- Iluminação e atmosfera (luz natural, estúdio, dramática, suave, etc)
- Cores e paleta (se relevante para o contexto)
- Ângulo e perspectiva (close-up, wide shot, overhead, etc)
- Qualidade técnica (4K, alta resolução, profissional, cinematográfico)
- Contexto e detalhes adicionais que enriquecem a descrição

`;

  if (context.storeName) {
    systemPrompt += `Contexto da loja/marca: ${context.storeName}\n`;
  }

  if (context.brandColors && context.brandColors.length > 0) {
    systemPrompt += `Cores da marca a considerar (opcional, mas recomendado): ${context.brandColors.join(', ')}\n`;
  }

  if (context.targetAudience) {
    systemPrompt += `Público-alvo: ${context.targetAudience}\n`;
  }

  if (context.useCase) {
    const useCaseMap = {
      product: 'imagem de produto para e-commerce/marketing',
      promotional: 'conteúdo promocional para redes sociais',
      educational: 'conteúdo educativo/informativo',
      lifestyle: 'conteúdo de estilo de vida/inspiração',
    };
    systemPrompt += `Uso pretendido: ${useCaseMap[context.useCase] || context.useCase}\n`;
  }

  systemPrompt += `
IMPORTANTE: 
- Cada prompt alternativo deve ser AUTOCONTIDO e COMPLETO
- Seja específico com detalhes visuais, composição e técnica
- Inclua informações técnicas (resolução, qualidade, estilo fotográfico)
- Varie os estilos entre as alternativas para dar opções ao usuário
- Mantenha a essência do prompt original mas expanda significativamente
- Use linguagem técnica e profissional adequada para IA de geração

Retorne APENAS um JSON válido com o seguinte formato (sem markdown, sem code blocks):
{
  "alternatives": [
    {
      "prompt": "prompt detalhado e completo aqui com todas as especificações técnicas e visuais",
      "description": "breve descrição amigável do que será gerado (1-2 frases)",
      "style": "estilo visual principal",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ],
  "recommendations": {
    "bestFor": "qual alternativa é melhor para qual propósito específico",
    "tips": ["dica prática 1", "dica prática 2", "dica prática 3"]
  }
}

Gere exatamente ${count} alternativas variadas e bem diferenciadas.
`;

  return systemPrompt;
}

