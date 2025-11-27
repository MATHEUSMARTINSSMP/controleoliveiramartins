/**
 * Funções de Normalização de Dados
 * 
 * Utilitários para normalizar tamanhos, cores e outros dados
 */

// ✅ TAMANHOS VÁLIDOS PARA NORMALIZAÇÃO (SEMPRE EM MAIÚSCULA)
const TAMANHOS_VALIDOS = [
  'XP', 'PP', 'P', 'M', 'G', 'GG', 'XGG', 'XXGG', 'G1', 'G2', 'G3', 'GGG',
  '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
  '50', '52', '54', '56', '58', '60', '62', '64', '66', '68',
  'U', 'UNICO', 'ÚNICO', 'UNIDADE'
];

/**
 * Normaliza tamanhos para maiúscula
 * 
 * @param {string|null|undefined} tamanho - Tamanho a ser normalizado
 * @returns {string|null} - Tamanho normalizado em maiúscula ou null
 */
function normalizeTamanho(tamanho) {
  if (!tamanho) return null;

  // Converter para maiúscula e remover espaços
  const normalized = String(tamanho)
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, ''); // Remove caracteres especiais, mantém apenas letras maiúsculas e números

  // Verificar se está na lista de tamanhos válidos
  const match = TAMANHOS_VALIDOS.find(t =>
    normalized === t ||
    normalized.includes(t) ||
    t.includes(normalized) ||
    normalized.replace(/[^A-Z0-9]/g, '') === t.replace(/[^A-Z0-9]/g, '')
  );

  if (match) {
    // Retornar o tamanho normalizado padrão em MAIÚSCULA
    if (match === 'UNICO' || match === 'ÚNICO') return 'U';
    if (match === 'UNIDADE') return 'U';
    return match.toUpperCase();
  }

  // Se não encontrou match exato, retornar o tamanho original em MAIÚSCULA
  return String(tamanho).trim().toUpperCase();
}

// ✅ CORES VÁLIDAS PARA NORMALIZAÇÃO (SEMPRE EM MAIÚSCULA, SEM ACENTUAÇÃO)
// Lista consolidada de todas as cores identificadas
const CORES_VALIDAS = [
  'PRETO',
  'BLACK',
  'PRETO E BRANCO',
  'GRAFITE',
  'OFF DARK',
  'OFF WHITE',
  'WHITE',
  'CRU',
  'AREIA',
  'AZUL',
  'AZUL MARINHO',
  'BLUE',
  'INDY BLUE',
  'OFF BLUE',
  'JEANS',
  'AMARELO',
  'AMARELO BRISA',
  'AMARELO HONEY',
  'OURO',
  'GOLD',
  'LARANJA',
  'VERDE',
  'VERDE MILITAR',
  'VERDE ARMY',
  'VERDE VIAGEM',
  'VERDE ETERNO',
  'VERDE FOLHA',
  'VERMELHO',
  'VERMELHO HIGH',
  'VERMELHO PEPPER',
  'VERMELHO AURORA',
  'VERMELHO CANDY',
  'ROSA',
  'PINK',
  'CORAL',
  'BEGE',
  'MARROM',
  'CARAMELO',
  'SAND',
  'OLIVA',
  'AMBAR',
  'CAPPUCCINO',
  'CASTANHO',
  'PRATA',
  'DOURADO',
  'LILAS',
  'VIOLETA',
  'ROXO',
  'CINZA',
];

/**
 * Normaliza e valida cores usando mapa de cores válidas
 * 
 * @param {string|null|undefined} cor - Cor a ser normalizada
 * @returns {string|null} - Cor normalizada e validada em maiúscula ou null
 */
function normalizeCor(cor) {
  if (!cor) return null;
  
  // Normalizar: remover acentuação, converter para maiúscula, remover caracteres especiais
  const normalize = (str) => {
    return String(str)
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentuação
      .replace(/[^A-Z0-9\s]/g, '') // Remove caracteres especiais, mantém letras, números e espaços
      .replace(/\s+/g, ' '); // Normaliza espaços múltiplos
  };
  
  let corNormalizada = normalize(cor);
  
  // ✅ CONVERSÃO: PB = PRETO E BRANCO
  if (corNormalizada === 'PB' || corNormalizada === 'P B') {
    corNormalizada = 'PRETO E BRANCO';
  }
  
  // ✅ ESTRATÉGIA 1: Verificar match exato primeiro (mais rápido)
  const matchExato = CORES_VALIDAS.find(c => c === corNormalizada);
  if (matchExato) {
    return matchExato;
  }
  
  // ✅ ESTRATÉGIA 2: Verificar cores compostas primeiro (ex: "OFF WHITE" antes de "OFF")
  // Ordenar cores por tamanho (mais longas primeiro) para priorizar cores compostas
  const coresOrdenadas = [...CORES_VALIDAS].sort((a, b) => b.length - a.length);
  
  for (const corValida of coresOrdenadas) {
    // Normalizar espaços e hífens para comparação
    const corValidaNormalizada = corValida.replace(/[-_]/g, ' ').trim();
    const corInputNormalizada = corNormalizada.replace(/[-_]/g, ' ').trim();
    
    // ✅ Match exato após normalização
    if (corValidaNormalizada === corInputNormalizada) {
      return corValida;
    }
    
    // ✅ Match parcial (um contém o outro)
    if (corValidaNormalizada.includes(corInputNormalizada) || corInputNormalizada.includes(corValidaNormalizada)) {
      // ✅ VALIDAÇÃO CRÍTICA: "OFF" sozinho não é cor válida, apenas "OFF WHITE", "OFF DARK", "OFF BLUE"
      if (corInputNormalizada === 'OFF' && !corValidaNormalizada.startsWith('OFF ')) {
        continue; // Pular "OFF" isolado se não for parte de cor composta
      }
      
      // ✅ VALIDAÇÃO: Ignorar cores muito curtas que podem ser falsos positivos
      // Ex: "OFF" sozinho, palavras comuns de 2-3 letras
      if (corInputNormalizada.length <= 3 && corValidaNormalizada.length <= 3 && corValidaNormalizada !== corInputNormalizada) {
        continue;
      }
      
      return corValida;
    }
  }
  
  // ✅ ESTRATÉGIA 3: Verificar match sem espaços (para cores compostas como "OFF-WHITE")
  const corSemEspacos = corNormalizada.replace(/[-_\s]/g, '');
  for (const corValida of coresOrdenadas) {
    const corValidaSemEspacos = corValida.replace(/[-_\s]/g, '');
    if (corSemEspacos === corValidaSemEspacos || corSemEspacos.includes(corValidaSemEspacos) || corValidaSemEspacos.includes(corSemEspacos)) {
      // ✅ Mesma validação para OFF isolado
      if (corSemEspacos === 'OFF' && !corValidaSemEspacos.startsWith('OFF')) {
        continue;
      }
      return corValida;
    }
  }
  
  // Se não encontrou match válido, retornar null (não é uma cor válida)
  console.warn(`[Normalization] ⚠️ Cor não reconhecida: "${cor}" (normalizada: "${corNormalizada}")`);
  return null;
}

/**
 * Extrai cor da descrição do produto usando o mapa de cores válidas
 * 
 * @param {string} descricao - Descrição do produto
 * @returns {string|null} - Cor encontrada e validada ou null
 */
function extrairCorDaDescricao(descricao) {
  if (!descricao) return null;
  
  let descricaoUpper = String(descricao).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // ✅ CONVERSÃO: PB = PRETO E BRANCO (substituir na descrição antes de buscar)
  descricaoUpper = descricaoUpper.replace(/\bPB\b/g, 'PRETO E BRANCO');
  descricaoUpper = descricaoUpper.replace(/\bP B\b/g, 'PRETO E BRANCO');
  
  // ✅ Priorizar cores compostas (mais longas primeiro) para evitar falsos positivos
  // Ex: "OFF WHITE" antes de "OFF", "VERDE MILITAR" antes de "VERDE"
  const coresOrdenadas = [...CORES_VALIDAS].sort((a, b) => b.length - a.length);
  
  // ✅ ESTRATÉGIA 1: Buscar cores compostas completas primeiro (ex: "OFF WHITE", "VERDE MILITAR")
  // Essas devem ser encontradas antes de cores simples para evitar falsos positivos
  for (const corValida of coresOrdenadas) {
    // Normalizar espaços e hífens: "OFF WHITE" também aceita "OFF-WHITE" ou "OFFWHITE"
    // Criar regex flexível que aceita espaço, hífen ou sem separador
    const corNormalizada = corValida.replace(/\s+/g, '[\\s\\-]?'); // Aceitar espaço ou hífen opcional
    // Usar word boundary para evitar match parcial em palavras maiores
    const regex = new RegExp(`\\b${corNormalizada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    
    if (regex.test(descricaoUpper)) {
      return corValida;
    }
  }
  
  // ✅ ESTRATÉGIA 2: Buscar cores simples (apenas se não encontrar composta)
  // Mas evitar cores muito curtas que podem ser falsos positivos
  for (const corValida of coresOrdenadas) {
    // ✅ IGNORAR cores muito curtas que podem ser falsos positivos
    // Ex: "OFF" sozinho não é cor válida, apenas "OFF WHITE", "OFF DARK", "OFF BLUE"
    if (corValida.length <= 3) {
      // Verificar se é uma cor válida curta que pode estar sozinha (ex: "RED", "BLUE")
      // Mas ignorar "OFF" que sempre precisa estar acompanhado
      if (corValida === 'OFF') {
        continue; // Ignorar "OFF" isolado
      }
      // Outras cores curtas como "RED", "BLUE" são válidas, continuar
    }
    
    // Buscar palavra completa (word boundary)
    const regex = new RegExp(`\\b${corValida.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    
    if (regex.test(descricaoUpper)) {
      return corValida;
    }
  }
  
  return null;
}

/**
 * Normaliza CPF/CNPJ removendo caracteres especiais
 * 
 * @param {string|null|undefined} cpfCnpj - CPF/CNPJ a ser normalizado
 * @returns {string|null} - CPF/CNPJ normalizado (apenas números) ou null
 */
function normalizeCPFCNPJ(cpfCnpj) {
  if (!cpfCnpj) return null;
  return String(cpfCnpj).replace(/\D/g, '');
}

/**
 * Normaliza telefone removendo caracteres especiais
 * 
 * @param {string|null|undefined} telefone - Telefone a ser normalizado
 * @returns {string|null} - Telefone normalizado (apenas números) ou null
 */
function normalizeTelefone(telefone) {
  if (!telefone) return null;
  return String(telefone).replace(/\D/g, '');
}

/**
 * Normaliza nome removendo espaços extras
 * 
 * @param {string|null|undefined} nome - Nome a ser normalizado
 * @returns {string|null} - Nome normalizado ou null
 */
function normalizeNome(nome) {
  if (!nome) return null;
  return String(nome).trim().replace(/\s+/g, ' ');
}

module.exports = {
  normalizeTamanho,
  normalizeCor,
  normalizeCPFCNPJ,
  normalizeTelefone,
  normalizeNome,
  extrairCorDaDescricao,
  TAMANHOS_VALIDOS,
  CORES_VALIDAS,
};

