import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const POLLING_INTERVAL_PROCESSING = 3000; // 3 segundos para jobs em processamento
const POLLING_INTERVAL_IDLE = 10000; // 10 segundos quando não há jobs em processamento

export interface MarketingJob {
  id: string;
  store_id: string;
  user_id: string;
  type: "image" | "video" | "carousel" | "batch";
  provider: string;
  provider_model: string;
  status: "queued" | "processing" | "done" | "failed" | "canceled";
  progress: number | null;
  input: Record<string, any>; // JSONB
  prompt_original: string | null;
  prompt_final: string | null;
  provider_ref: string | null;
  result: {
    assetId?: string;
    assetIds?: string[]; // Para múltiplas alternativas
    mediaUrl?: string;
    mediaUrls?: string[]; // Para múltiplas alternativas
    thumbnailUrl?: string;
    thumbnailUrls?: string[];
    meta?: Record<string, any>;
  } | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  
  // Helper para compatibilidade
  result_asset_id?: string | null;
}

export function useMarketingJobs(storeId: string | undefined) {
  const [jobs, setJobs] = useState<MarketingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = async () => {
    if (!storeId) {
      console.log("[useMarketingJobs] storeId não fornecido, limpando jobs");
      setJobs([]);
      setLoading(false);
      return;
    }

    try {
      console.log("[useMarketingJobs] Buscando jobs para storeId:", storeId);
      setError(null);

      const { data, error: fetchError } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_jobs")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error("[useMarketingJobs] Erro na query:", fetchError);
        
        // Se JWT expirou, tentar renovar a sessão
        if (fetchError.code === 'PGRST303' || fetchError.message?.includes('JWT expired')) {
          console.log("[useMarketingJobs] JWT expirado, tentando renovar sessão...");
          try {
            const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error("[useMarketingJobs] Erro ao renovar sessão:", refreshError);
              throw fetchError; // Lançar erro original
            }
            if (newSession) {
              console.log("[useMarketingJobs] Sessão renovada, tentando novamente...");
              // Tentar novamente após renovar
              const { data: retryData, error: retryError } = await supabase
                .schema("sistemaretiradas")
                .from("marketing_jobs")
                .select("*")
                .eq("store_id", storeId)
                .order("created_at", { ascending: false })
                .limit(50);
              
              if (retryError) {
                throw retryError;
              }
              
              const mappedJobs = (retryData || []).map((job: any) => ({
                ...job,
                result_asset_id: job.result?.assetId || job.result?.assetIds?.[0] || null,
              }));
              
              setJobs(mappedJobs as MarketingJob[]);
              return; // Sucesso após retry
            }
          } catch (refreshErr) {
            console.error("[useMarketingJobs] Erro ao renovar sessão:", refreshErr);
          }
        }
        
        throw fetchError;
      }

      console.log("[useMarketingJobs] Jobs encontrados:", data?.length || 0, data);

      // Mapear dados do banco para a interface
      const mappedJobs = (data || []).map((job: any) => ({
        ...job,
        // Helper para compatibilidade com código existente
        result_asset_id: job.result?.assetId || job.result?.assetIds?.[0] || null,
      }));

      console.log("[useMarketingJobs] Jobs mapeados:", mappedJobs.length);
      setJobs(mappedJobs as MarketingJob[]);
    } catch (err: any) {
      console.error("[useMarketingJobs] Erro ao buscar jobs:", err);
      console.error("[useMarketingJobs] Detalhes do erro:", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
      });
      setError(err.message || "Erro ao carregar jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // Polling automático contínuo (sempre ativo para detectar novos jobs)
  useEffect(() => {
    fetchJobs();

    // Sempre manter polling ativo para atualização em tempo real
    // Intervalo menor quando há jobs em processamento, maior quando idle
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      const hasProcessingJobs = jobs.some(j => j.status === "queued" || j.status === "processing");
      const interval = hasProcessingJobs ? POLLING_INTERVAL_PROCESSING : POLLING_INTERVAL_IDLE;

      pollingIntervalRef.current = setInterval(() => {
        fetchJobs();
      }, interval);
    };

    startPolling();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Ajustar intervalo de polling baseado no status dos jobs
  useEffect(() => {
    if (!pollingIntervalRef.current) return;

    const hasProcessingJobs = jobs.some(j => j.status === "queued" || j.status === "processing");
    const currentInterval = hasProcessingJobs ? POLLING_INTERVAL_PROCESSING : POLLING_INTERVAL_IDLE;

    // Reiniciar polling com novo intervalo se necessário
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      fetchJobs();
    }, currentInterval);
  }, [jobs, fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}

export function useMarketingJobStatus(jobId: string | null) {
  const [job, setJob] = useState<MarketingJob | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJob = async () => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;

      setJob(data as MarketingJob);

      // Parar polling se job terminou (done, failed, canceled)
      if (data && ["done", "failed", "canceled"].includes(data.status)) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (err: any) {
      console.error("Erro ao buscar job:", err);
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();

    // Polling para jobs em processamento
    if (jobId) {
      pollingIntervalRef.current = setInterval(() => {
        fetchJob();
      }, 2000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return { job, loading, refetch: fetchJob };
}

