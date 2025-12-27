import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/google-api-retry";

const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

export interface GooglePerformanceMetrics {
  views: { total: number; change: number };
  clicks: { total: number; change: number };
  calls: { total: number; change: number };
  directions: { total: number; change: number };
  messages?: { total: number; change: number };
}

interface GooglePerformanceResponse {
  success: boolean;
  metrics: GooglePerformanceMetrics;
  rawData?: any;
  period?: string;
  startDate?: string;
  endDate?: string;
  error?: string;
}

export function useGooglePerformance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<GooglePerformanceMetrics | null>(null);

  const fetchPerformance = async (
    siteSlug: string,
    period: string = "30d",
    locationId?: string
  ): Promise<GooglePerformanceMetrics | null> => {
    if (!user?.email) {
      toast.error("É necessário estar logado");
      return null;
    }

    setLoading(true);

    try {
      const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-performance-fetch`;

      const response = await fetchWithRetry(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            siteSlug,
            userEmail: user.email,
            locationId,
            period,
          }),
        },
        {
          maxRetries: 3,
          retryDelay: 1000,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: GooglePerformanceResponse = await response.json();

      if (!data.success || !data.metrics) {
        throw new Error(data.error || "Resposta inválida da API");
      }

      setMetrics(data.metrics);
      return data.metrics;
    } catch (error: any) {
      console.error("[useGooglePerformance] Erro ao buscar métricas:", error);
      // Não mostrar toast para erro de performance (pode não estar disponível)
      setMetrics(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    metrics,
    loading,
    fetchPerformance,
  };
}

