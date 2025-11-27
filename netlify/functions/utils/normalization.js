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

/**
 * Normaliza cores para maiúscula
 * 
 * @param {string|null|undefined} cor - Cor a ser normalizada
 * @returns {string|null} - Cor normalizada em maiúscula ou null
 */
function normalizeCor(cor) {
  if (!cor) return null;
  return String(cor).trim().toUpperCase();
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
  TAMANHOS_VALIDOS
};

