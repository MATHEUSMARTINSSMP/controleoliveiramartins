/**
 * Utilitário para retry com backoff exponencial em chamadas à API do Google
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 segundo
  maxDelay: 30000, // 30 segundos
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504], // Rate limit e erros de servidor
};

/**
 * Aguarda um tempo específico
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Calcula o delay para o próximo retry usando backoff exponencial
 */
const calculateDelay = (
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number => {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  return Math.min(delay, maxDelay);
};

/**
 * Verifica se um erro é retryable baseado no status code
 */
const isRetryable = (
  statusCode: number | undefined,
  retryableStatusCodes: number[]
): boolean => {
  if (!statusCode) return false;
  return retryableStatusCodes.includes(statusCode);
};

/**
 * Executa uma função com retry e backoff exponencial
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Se não é a última tentativa e o erro é retryable
      if (attempt < opts.maxRetries) {
        const statusCode = error.statusCode || error.status || error.response?.status;
        
        if (isRetryable(statusCode, opts.retryableStatusCodes)) {
          const delay = calculateDelay(
            attempt,
            opts.initialDelay,
            opts.maxDelay,
            opts.backoffMultiplier
          );

          console.log(
            `[Google API Retry] Tentativa ${attempt + 1}/${opts.maxRetries + 1} falhou. ` +
            `Tentando novamente em ${delay}ms...`
          );

          await sleep(delay);
          continue;
        }
      }

      // Se não é retryable ou esgotou tentativas, lançar erro
      throw error;
    }
  }

  // Não deveria chegar aqui, mas TypeScript exige
  throw lastError || new Error("Erro desconhecido no retry");
}

/**
 * Wrapper para fetch com retry automático
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, options);

    // Se a resposta não é ok, lançar erro com status code
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.statusCode = response.status;
      error.status = response.status;
      error.response = response;
      throw error;
    }

    return response;
  }, retryOptions);
}

