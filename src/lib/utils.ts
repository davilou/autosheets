import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza o formato do placar para usar sempre hífen como separador
 * Converte formatos como "1x0", "2 x 1", "0-0" para o padrão "1-0", "2-1", "0-0"
 */
export function normalizeScore(score: string): string {
  if (!score) return '0-0';
  
  // Remove espaços extras e normaliza o separador
  const normalized = score
    .trim()
    .replace(/\s*[xX×]\s*/g, '-')  // Substitui x, X, × por hífen
    .replace(/\s*-\s*/g, '-');     // Remove espaços ao redor do hífen
  
  return normalized;
}

/**
 * Formata um número decimal para usar vírgula como separador decimal (padrão brasileiro)
 * Converte números como 1.85 para "1,85"
 */
export function formatOddBrazilian(odd: number | string): string {
  if (typeof odd === 'string') {
    const parsed = parseFloat(odd.replace(',', '.'));
    if (isNaN(parsed)) return odd;
    odd = parsed;
  }
  
  return odd.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
