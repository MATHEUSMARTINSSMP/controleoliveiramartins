import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor numérico como moeda brasileira (R$ 1.234,56)
 * @param value - Valor numérico a ser formatado
 * @param options - Opções de formatação (decimais, símbolo)
 * @returns String formatada no padrão brasileiro
 */
export function formatCurrency(value: number | string | null | undefined, options?: {
  decimals?: number;
  showSymbol?: boolean;
}): string {
  const { decimals = 2, showSymbol = true } = options || {};
  
  if (value === null || value === undefined || value === '') {
    return showSymbol ? 'R$ 0,00' : '0,00';
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return showSymbol ? 'R$ 0,00' : '0,00';
  }
  
  // Formata com separador de milhar (.) e decimal (,)
  const formatted = numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  return showSymbol ? `R$ ${formatted}` : formatted;
}

/**
 * Alias curto para formatCurrency - formata valor em Reais brasileiros
 * Usa formato brasileiro: R$ 1.234,56 (ponto para milhares, vírgula para centavos)
 * @param value - Valor numérico
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada (ex: "R$ 1.234,56")
 */
export function formatBRL(value: number | string | null | undefined, decimals: number = 2): string {
  return formatCurrency(value, { decimals, showSymbol: true });
}

/**
 * Formata número no padrão brasileiro sem símbolo de moeda
 * @param value - Valor numérico
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada (ex: "1.234,56")
 */
export function formatNumber(value: number | string | null | undefined, decimals: number = 2): string {
  return formatCurrency(value, { decimals, showSymbol: false });
}

export const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

export function getBrazilNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: BRAZIL_TIMEZONE }));
}

export function getBrazilISOString(): string {
  const now = new Date();
  const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: BRAZIL_TIMEZONE }));
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  const hours = String(brazilDate.getHours()).padStart(2, '0');
  const minutes = String(brazilDate.getMinutes()).padStart(2, '0');
  const seconds = String(brazilDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
}

export function getBrazilDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: BRAZIL_TIMEZONE });
}
