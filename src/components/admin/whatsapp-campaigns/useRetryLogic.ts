/**
 * Hook para lógica de retry com exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 segundo
  maxDelay: 10000, // 10 segundos
  backoffMultiplier: 2,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Se é o último attempt, lançar erro
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Aguardar antes do próximo retry
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Aumentar delay exponencialmente
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError || new Error("Retry failed");
}

