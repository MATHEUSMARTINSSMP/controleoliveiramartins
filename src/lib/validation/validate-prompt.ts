/**
 * Validação de Prompts
 * 
 * Valida tamanho, conteúdo proibido, qualidade
 */

export interface PromptValidation {
  valid: boolean;
  score: number; // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 2000; // Aumentado para prompts profissionais detalhados

// Palavras/conteúdo proibido (ajustar conforme política)
const PROHIBITED_CONTENT = [
  'nude',
  'nudity',
  'explicit',
  'violence',
  'hate',
  'discrimination',
  // Adicionar mais conforme necessário
];

// Palavras que indicam qualidade baixa
const LOW_QUALITY_INDICATORS = [
  'coisa',
  'algo',
  'qualquer',
  'tipo',
  'meio',
];

// Palavras que indicam qualidade alta (prompts profissionais)
const HIGH_QUALITY_INDICATORS = [
  'editorial',
  'premium',
  'cinematográfico',
  'alto contraste',
  'minimalista',
  'sofisticado',
  'iluminação',
  'composição',
  'perspectiva',
  'textura',
  'paleta',
  'estética',
];

/**
 * Validar prompt
 */
export function validatePrompt(prompt: string): PromptValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Validação de tamanho
  if (prompt.length < MIN_PROMPT_LENGTH) {
    errors.push(`Prompt muito curto (mínimo ${MIN_PROMPT_LENGTH} caracteres)`);
    score -= 30;
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    errors.push(`Prompt muito longo (máximo ${MAX_PROMPT_LENGTH} caracteres)`);
    score -= 20;
  }

  // Verificar conteúdo proibido
  const lowerPrompt = prompt.toLowerCase();
  const foundProhibited = PROHIBITED_CONTENT.filter((word) =>
    lowerPrompt.includes(word)
  );

  if (foundProhibited.length > 0) {
    errors.push(`Conteúdo proibido detectado: ${foundProhibited.join(', ')}`);
    score -= 100; // Falha crítica
  }

  // Verificar qualidade
  const lowQualityCount = LOW_QUALITY_INDICATORS.filter((word) =>
    lowerPrompt.includes(word)
  ).length;

  if (lowQualityCount > 3) {
    warnings.push('Prompt contém muitas palavras vagas. Tente ser mais específico.');
    score -= 15;
  }

  const highQualityCount = HIGH_QUALITY_INDICATORS.filter((word) =>
    lowerPrompt.includes(word)
  ).length;

  if (highQualityCount > 2) {
    score += 10; // Bônus por termos profissionais
  }

  // Verificar se tem detalhes visuais
  const visualKeywords = [
    'cor',
    'cores',
    'estilo',
    'iluminação',
    'fundo',
    'perspectiva',
    'ângulo',
    'composição',
    'textura',
    'material',
    'resolução',
    'qualidade',
    'paleta',
    'mood',
    'atmosfera',
  ];

  const hasVisualDetails = visualKeywords.some((keyword) =>
    lowerPrompt.includes(keyword)
  );

  if (!hasVisualDetails && prompt.length > 50) {
    warnings.push(
      'Considere adicionar detalhes visuais: cores, estilo, iluminação, perspectiva'
    );
    score -= 10;
  }

  // Verificar estrutura (para prompts profissionais)
  const hasStructure = /(OBJETIVO|FORMATO|CÂMERA|ILUMINAÇÃO|COMPOSIÇÃO|RESTRIÇÕES)/i.test(prompt);
  
  if (hasStructure) {
    score += 15; // Bônus por estrutura profissional
  } else if (prompt.length > 200) {
    suggestions.push(
      'Considere estruturar o prompt em seções (OBJETIVO, CÂMERA, ILUMINAÇÃO, RESTRIÇÕES)'
    );
  }

  // Verificar se é muito genérico
  const genericWords = ['legal', 'bonito', 'bom', 'interessante'];
  const genericCount = genericWords.filter((word) =>
    lowerPrompt.includes(word)
  ).length;

  if (genericCount > 2) {
    warnings.push('Evite palavras genéricas. Seja específico e descritivo.');
    score -= 10;
  }

  // Validar proporções de score
  score = Math.max(0, Math.min(100, score));

  return {
    valid: errors.length === 0 && score >= 50,
    score,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validar prompt para vídeo (requisitos adicionais)
 */
export function validateVideoPrompt(prompt: string): PromptValidation {
  const baseValidation = validatePrompt(prompt);
  const errors = [...baseValidation.errors];
  const warnings = [...baseValidation.warnings];
  let score = baseValidation.score;

  const lowerPrompt = prompt.toLowerCase();

  // Verificar se tem especificações de câmera
  const hasCamera = /(câmera|camera|shot|movimento|movement|enquadramento|frame)/i.test(
    lowerPrompt
  );

  if (!hasCamera) {
    warnings.push('Vídeo: adicione especificações de câmera (shot, movimento, enquadramento)');
    score -= 10;
  }

  // Verificar se tem especificações de iluminação
  const hasLighting = /(iluminação|lighting|luz|light)/i.test(lowerPrompt);

  if (!hasLighting) {
    warnings.push('Vídeo: adicione especificações de iluminação');
    score -= 10;
  }

  // Verificar se tem ritmo/movimento
  const hasRhythm = /(ritmo|rhythm|movimento|movement|transição|transition|tempo|pace)/i.test(
    lowerPrompt
  );

  if (!hasRhythm) {
    warnings.push('Vídeo: adicione informações sobre ritmo e movimento');
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    valid: baseValidation.valid && errors.length === 0 && score >= 50,
    score,
    errors,
    warnings,
    suggestions: baseValidation.suggestions,
  };
}

