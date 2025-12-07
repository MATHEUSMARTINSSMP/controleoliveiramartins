/**
 * Hook para polling de status WhatsApp via N8N endpoint
 * 
 * Usa React Query com refetchInterval inteligente:
 * - Polling de 12s enquanto em estado de transicao
 * - Para polling quando conectado ou erro
 * - Botao manual para forcar verificacao
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { 
  fetchWhatsAppStatus, 
  isTerminalStatus, 
  type WhatsAppStatusResponse,
  type FetchStatusParams 
} from '@/lib/whatsapp';

const POLLING_INTERVAL = 12000; // 12 segundos
const MANUAL_POLLING_WINDOW = 60000; // 60 segundos apos clique manual

interface UseWhatsAppStatusOptions {
  siteSlug: string;
  customerId: string;
  enabled?: boolean;
}

interface UseWhatsAppStatusReturn {
  status: WhatsAppStatusResponse | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isPolling: boolean;
  refetch: () => void;
  forceRefresh: () => void;
}

export function useWhatsAppStatus({
  siteSlug,
  customerId,
  enabled = true,
}: UseWhatsAppStatusOptions): UseWhatsAppStatusReturn {
  const queryClient = useQueryClient();
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  const [manualRefreshUntil, setManualRefreshUntil] = useState<number | null>(null);

  const queryKey = ['whatsapp-status', siteSlug, customerId];

  const { data, isLoading, isError, error, refetch } = useQuery<WhatsAppStatusResponse>({
    queryKey,
    queryFn: async () => {
      const params: FetchStatusParams = { siteSlug, customerId };
      return fetchWhatsAppStatus(params);
    },
    enabled: enabled && !!siteSlug && !!customerId,
    staleTime: 10000, // 10 segundos
    refetchInterval: (query) => {
      // Se desabilitado, nao fazer polling
      if (!isPollingEnabled) return false;

      // Se tem janela de refresh manual ativa
      if (manualRefreshUntil && Date.now() < manualRefreshUntil) {
        return POLLING_INTERVAL;
      }

      // Se status terminal (connected/error), parar polling
      const currentData = query.state.data;
      if (currentData && isTerminalStatus(currentData.status)) {
        return false;
      }

      return POLLING_INTERVAL;
    },
  });

  // Parar polling automaticamente quando atingir status terminal
  useEffect(() => {
    if (data && isTerminalStatus(data.status)) {
      setIsPollingEnabled(false);
    }
  }, [data?.status]);

  // Limpar janela de refresh manual quando expirar
  useEffect(() => {
    if (!manualRefreshUntil) return;

    const timeout = setTimeout(() => {
      setManualRefreshUntil(null);
      // Se status ainda nao e terminal, manter polling
      if (data && !isTerminalStatus(data.status)) {
        setIsPollingEnabled(false);
      }
    }, manualRefreshUntil - Date.now());

    return () => clearTimeout(timeout);
  }, [manualRefreshUntil, data?.status]);

  // Forcar refresh manual e habilitar polling por 60 segundos
  const forceRefresh = useCallback(() => {
    setIsPollingEnabled(true);
    setManualRefreshUntil(Date.now() + MANUAL_POLLING_WINDOW);
    refetch();
  }, [refetch]);

  return {
    status: data || null,
    isLoading,
    isError,
    error: error as Error | null,
    isPolling: isPollingEnabled && (!data || !isTerminalStatus(data.status)),
    refetch,
    forceRefresh,
  };
}

/**
 * Hook para gerenciar status de multiplas lojas
 */
interface StoreStatusMap {
  [siteSlug: string]: WhatsAppStatusResponse | null;
}

interface UseMultiStoreWhatsAppStatusOptions {
  stores: Array<{ slug: string; whatsapp_ativo: boolean; hasToken: boolean }>;
  customerId: string;
}

export function useMultiStoreWhatsAppStatus({
  stores,
  customerId,
}: UseMultiStoreWhatsAppStatusOptions) {
  const queryClient = useQueryClient();
  const [statusMap, setStatusMap] = useState<StoreStatusMap>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [pollingMap, setPollingMap] = useState<Record<string, boolean>>({});

  // Funcao para verificar status de uma loja especifica
  const checkStoreStatus = useCallback(async (siteSlug: string) => {
    if (!customerId || !siteSlug) return;

    setLoadingMap(prev => ({ ...prev, [siteSlug]: true }));

    try {
      const status = await fetchWhatsAppStatus({ siteSlug, customerId });
      setStatusMap(prev => ({ ...prev, [siteSlug]: status }));

      // Se nao e status terminal, iniciar polling
      if (!isTerminalStatus(status.status)) {
        setPollingMap(prev => ({ ...prev, [siteSlug]: true }));
        startPolling(siteSlug);
      } else {
        setPollingMap(prev => ({ ...prev, [siteSlug]: false }));
      }
    } catch (error) {
      console.error(`Erro ao verificar status WhatsApp para ${siteSlug}:`, error);
      setStatusMap(prev => ({
        ...prev,
        [siteSlug]: {
          success: false,
          ok: false,
          connected: false,
          status: 'error',
          qrCode: null,
          instanceId: null,
          phoneNumber: null,
        },
      }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [siteSlug]: false }));
    }
  }, [customerId]);

  // Polling para uma loja especifica
  const startPolling = useCallback((siteSlug: string) => {
    const intervalId = setInterval(async () => {
      const currentStatus = statusMap[siteSlug];
      if (currentStatus && isTerminalStatus(currentStatus.status)) {
        clearInterval(intervalId);
        setPollingMap(prev => ({ ...prev, [siteSlug]: false }));
        return;
      }

      try {
        const status = await fetchWhatsAppStatus({ siteSlug, customerId });
        setStatusMap(prev => ({ ...prev, [siteSlug]: status }));

        if (isTerminalStatus(status.status)) {
          clearInterval(intervalId);
          setPollingMap(prev => ({ ...prev, [siteSlug]: false }));
        }
      } catch (error) {
        console.error(`Erro no polling para ${siteSlug}:`, error);
      }
    }, POLLING_INTERVAL);

    // Limpar apos 2 minutos max
    setTimeout(() => {
      clearInterval(intervalId);
      setPollingMap(prev => ({ ...prev, [siteSlug]: false }));
    }, 120000);

    return intervalId;
  }, [customerId, statusMap]);

  return {
    statusMap,
    loadingMap,
    pollingMap,
    checkStoreStatus,
  };
}
