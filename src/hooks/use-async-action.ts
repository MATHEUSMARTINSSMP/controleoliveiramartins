import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseAsyncActionOptions<T, A extends unknown[]> {
  action: (...args: A) => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

interface UseAsyncActionResult<T, A extends unknown[]> {
  execute: (...args: A) => Promise<T | undefined>;
  isLoading: boolean;
  error: Error | null;
  data: T | null;
  reset: () => void;
}

export function useAsyncAction<T, A extends unknown[] = []>({
  action,
  onSuccess,
  onError,
  successMessage,
  errorMessage = "Ocorreu um erro. Tente novamente.",
  showSuccessToast = false,
  showErrorToast = true,
}: UseAsyncActionOptions<T, A>): UseAsyncActionResult<T, A> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const { toast } = useToast();

  const execute = useCallback(
    async (...args: A): Promise<T | undefined> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await action(...args);
        setData(result);
        onSuccess?.(result);

        if (showSuccessToast && successMessage) {
          toast({
            title: "Sucesso",
            description: successMessage,
          });
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);

        if (showErrorToast) {
          toast({
            title: "Erro",
            description: errorMessage,
            variant: "destructive",
          });
        }

        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [action, onSuccess, onError, successMessage, errorMessage, showSuccessToast, showErrorToast, toast]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { execute, isLoading, error, data, reset };
}

interface UseLoadingStateOptions {
  initialLoading?: boolean;
  minimumDuration?: number;
}

export function useLoadingState({
  initialLoading = false,
  minimumDuration = 300,
}: UseLoadingStateOptions = {}) {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setLoadingStartTime(Date.now());
  }, []);

  const stopLoading = useCallback(() => {
    if (loadingStartTime === null) {
      setIsLoading(false);
      return;
    }

    const elapsed = Date.now() - loadingStartTime;
    const remaining = Math.max(0, minimumDuration - elapsed);

    setTimeout(() => {
      setIsLoading(false);
      setLoadingStartTime(null);
    }, remaining);
  }, [loadingStartTime, minimumDuration]);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      startLoading();
      try {
        return await fn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  return { isLoading, startLoading, stopLoading, withLoading };
}
