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
