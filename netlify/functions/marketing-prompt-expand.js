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
            'Você é um especialista em criação de prompts para geração de imagens. Gere alternativas detalhadas e profissionais em JSON. IMPORTANTE: TODAS as respostas, prompts e descrições DEVEM estar em PORTUGUÊS DO BRASIL (pt-BR). Nunca use inglês ou outros idiomas.',
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
  let systemPrompt = `Você é o MELHOR SOCIAL MEDIA MANAGER do mundo, especializado em criação de conteúdo comercial de alta performance para redes sociais de empresas. Seu trabalho é criar posts profissionais com intenção de VENDAS e ENGAJAMENTO.

CONTEXTO COMERCIAL CRÍTICO:
⚠️ IMPORTANTE: Estes NÃO são posts avulsos ou imagens casuais. São CONTEÚDOS COMERCIAIS PROFISSIONAIS criados para:
- GERAR VENDAS diretas
- AUMENTAR ENGAJAMENTO nas redes sociais
- REFORÇAR BRANDING e identidade visual da marca
- CONVERTER seguidores em clientes
- FORTALECER a presença digital da empresa

O usuário forneceu um prompt simples/incompleto: "${originalPrompt}"

Sua tarefa é trabalhar como o MELHOR SOCIAL MEDIA MANAGER e gerar ${count} alternativas de prompts DETALHADOS, COMPLETOS e PROFISSIONAIS em PORTUGUÊS DO BRASIL que uma IA de geração de imagens entenderá perfeitamente.

IMPORTANTE: TODAS as respostas, prompts alternativos, descrições e recomendações DEVEM estar em PORTUGUÊS DO BRASIL (pt-BR). Nunca use inglês ou outros idiomas.

COMO O MELHOR SOCIAL MEDIA, VOCÊ DEVE CONSIDERAR:
1. BRANDING E IDENTIDADE VISUAL:
   - Se houver logo anexada, a imagem deve integrar a logo de forma profissional e harmoniosa
   - Manter consistência visual com a identidade da marca
   - Cores da marca devem ser respeitadas e utilizadas estrategicamente
   - Tipografia e elementos gráficos alinhados ao brandbook

2. INTENÇÃO COMERCIAL:
   - Posts com propósito claro: vender, engajar, educar, construir relacionamento
   - Elementos visuais que chamam atenção e geram ação (CTAs visuais)
   - Composição que direciona o olhar para pontos importantes
   - Mensagem visual que comunica valor e diferenciação

3. TENDÊNCIAS E MELHORES PRÁTICAS:
   - Considere o que está em alta nas redes sociais no momento
   - Formatos que performam melhor (carrossel, stories, feed, reels)
   - Estética moderna e alinhada com o público-alvo da empresa
   - Elementos visuais que geram compartilhamento e engajamento

4. ÁREA DE ATUAÇÃO DA EMPRESA:
   - Conhecimento do setor/segmento da empresa
   - Linguagem visual apropriada para o mercado
   - Referências visuais relevantes para o público-alvo
   - Elementos que ressoam com a área de negócio

Cada alternativa deve incluir (TUDO em português do Brasil):
- Descrição detalhada da cena/composição COM INTENÇÃO COMERCIAL clara
- Estilo visual profissional (futurista, realista, minimalista, moderno, elegante, etc)
- Iluminação e atmosfera adequada para posts comerciais (luz natural, estúdio profissional, dramática, suave, etc)
- Cores e paleta alinhadas ao branding e tendências de mercado
- Ângulo e perspectiva que destacam o produto/serviço/mensagem comercial
- Qualidade técnica profissional (alta resolução, profissional, cinematográfico, adequado para redes sociais)
- Elementos visuais que reforçam branding (espaço para logo, cores da marca, identidade visual)
- Contexto e detalhes que tornam o post comercialmente eficaz

`;

  if (context.storeName) {
    systemPrompt += `EMPRESA/MARCA: ${context.storeName}\n`;
    systemPrompt += `Considere a identidade visual e valores da marca "${context.storeName}" ao criar os prompts.\n`;
  }

  if (context.brandColors && context.brandColors.length > 0) {
    systemPrompt += `CORES DA MARCA (OBRIGATÓRIO considerar): ${context.brandColors.join(', ')}\n`;
    systemPrompt += `As cores da marca DEVEM aparecer estrategicamente nas imagens para reforçar o branding.\n`;
  }

  if (context.targetAudience) {
    systemPrompt += `PÚBLICO-ALVO: ${context.targetAudience}\n`;
    systemPrompt += `Adapte o estilo visual e mensagem para ressoar com este público e gerar engajamento comercial.\n`;
  }

  systemPrompt += `
CONTEXTO DE USO:
- POST COMERCIAL para redes sociais (Instagram, Facebook, TikTok, etc)
- OBJETIVO: Vender produtos/serviços e gerar engajamento
- FORMATO: Post profissional, adequado para redes sociais de empresas
${context.logo_url ? '- LOGO: Logo será anexada - considere composição que integre a logo de forma harmoniosa e profissional\n' : ''}

IMPORTANTE CRÍTICO: 
- TODAS as respostas DEVEM estar em PORTUGUÊS DO BRASIL (pt-BR). Nunca use inglês.
- Cada prompt alternativo deve ser AUTOCONTIDO, COMPLETO e PROFISSIONAL para posts comerciais
- Pense como o MELHOR SOCIAL MEDIA: posts que vendem e engajam
- Seja específico com detalhes visuais, composição e técnica comercial
- Inclua informações técnicas (resolução, qualidade profissional para redes sociais)
- Varie os estilos entre as alternativas mas sempre mantendo profissionalismo comercial
- Mantenha a essência do prompt original mas expanda com foco em COMERCIAL e ENGAJAMENTO
- Use linguagem técnica e profissional adequada para IA de geração
- DESCRIÇÕES, TAGS e RECOMENDAÇÕES também devem estar em PORTUGUÊS DO BRASIL
- CONSIDERE: branding, tendências atuais, área de atuação, público-alvo, intenção de venda

Retorne APENAS um JSON válido com o seguinte formato (sem markdown, sem code blocks). TODOS os textos devem estar em PORTUGUÊS DO BRASIL:
{
  "alternatives": [
    {
      "prompt": "prompt detalhado e completo aqui com todas as especificações técnicas, visuais e comerciais para um post profissional que vende e engaja",
      "description": "breve descrição amigável do que será gerado (1-2 frases) enfatizando o propósito comercial",
      "style": "estilo visual principal adequado para redes sociais comerciais",
      "tags": ["tag1 comercial", "tag2", "tag3"]
    }
  ],
  "recommendations": {
    "bestFor": "qual alternativa é melhor para qual propósito comercial específico (vendas, engajamento, branding, etc)",
    "tips": ["dica comercial prática 1", "dica de social media 2", "dica de engajamento 3"]
  }
}

Gere exatamente ${count} alternativas variadas e bem diferenciadas, sempre pensando como o MELHOR SOCIAL MEDIA MANAGER criando posts comerciais de alta performance.
`;

  return systemPrompt;
}

