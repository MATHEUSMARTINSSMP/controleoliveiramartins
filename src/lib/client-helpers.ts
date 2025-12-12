/**
 * Helper functions for client operations
 */

import { normalizeCPF } from './cpf';

/**
 * Normaliza nome: primeira letra de cada palavra maiúscula
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Ignorar palavras vazias ou muito pequenas (artigos, preposições)
      if (word.length <= 2) return word;
      // Primeira letra maiúscula
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .trim();
}

/**
 * Normaliza telefone: remove tudo que não é número
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

/**
 * Valida CPF básico (formato e tamanho)
 */
export function validateCPF(cpf: string): { valid: boolean; error?: string } {
  const normalized = normalizeCPF(cpf);
  
  if (!normalized) {
    return { valid: true }; // CPF opcional
  }
  
  if (normalized.length !== 11) {
    return { valid: false, error: 'CPF deve ter 11 dígitos' };
  }
  
  // Verificar se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(normalized)) {
    return { valid: false, error: 'CPF inválido' };
  }
  
  // Validação de dígitos verificadores
  let sum = 0;
  let remainder: number;
  
  // Validar primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(normalized.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(normalized.substring(9, 10))) {
    return { valid: false, error: 'CPF inválido' };
  }
  
  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(normalized.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(normalized.substring(10, 11))) {
    return { valid: false, error: 'CPF inválido' };
  }
  
  return { valid: true };
}

/**
 * Valida telefone básico (formato brasileiro)
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const normalized = normalizePhone(phone);
  
  if (!normalized) {
    return { valid: true }; // Telefone opcional
  }
  
  // Telefone brasileiro: 10 ou 11 dígitos (DDD + número)
  if (normalized.length < 10 || normalized.length > 11) {
    return { valid: false, error: 'Telefone deve ter 10 ou 11 dígitos (DDD + número)' };
  }
  
  return { valid: true };
}

/**
 * Constante para "Consumidor Final"
 */
export const CONSUMIDOR_FINAL = {
  id: 'CONSUMIDOR_FINAL',
  nome: 'Consumidor Final',
  cpf: null,
  telefone: null,
  email: null,
  data_nascimento: null,
};

