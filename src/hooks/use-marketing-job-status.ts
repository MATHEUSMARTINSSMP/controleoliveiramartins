import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MarketingJobStatus {
  id: string;
  status: "queued" | "processing" | "done" | "failed" | "canceled";
  progress: number;
  result_asset_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para acompanhar o status de um job individual
 * Faz polling automático enquanto o job estiver em processamento
 */
export function useMarketingJobStatus(jobId: string | null, pollInterval = 3000) {
  const [job, setJob] = useState<MarketingJobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchJobStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("marketing_jobs")
          .select("id, status, progress, result_asset_id, error_message, created_at, updated_at")
          .eq("id", jobId)
          .single();

        if (fetchError) throw fetchError;

        if (!isMounted) return;

        setJob(data as MarketingJobStatus);

        // Parar polling se job está finalizado (done, failed, canceled)
        if (data?.status === "done" || data?.status === "failed" || data?.status === "canceled") {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Erro ao buscar status do job:", err);
        setError(err.message || "Erro ao buscar status do job");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Buscar imediatamente
    fetchJobStatus();

    // Se job está em processamento, iniciar polling
    if (jobId) {
      intervalId = setInterval(() => {
        fetchJobStatus();
      }, pollInterval);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, pollInterval]);

  return {
    job,
    loading,
    error,
    isComplete: job?.status === "done",
    isFailed: job?.status === "failed",
    isCanceled: job?.status === "canceled",
    isProcessing: job?.status === "processing" || job?.status === "queued",
  };
}

