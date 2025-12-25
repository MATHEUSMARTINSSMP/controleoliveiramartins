import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MarketingJob {
  id: string;
  type: "image_generation" | "video_generation" | "image_edit" | "carousel_generation" | "prompt_expansion";
  status: "queued" | "processing" | "done" | "failed" | "canceled";
  provider: string | null;
  provider_model: string | null;
  original_prompt: string;
  final_prompt_spec: Record<string, any> | null;
  input_images_refs: any[] | null;
  mask_ref: any | null;
  provider_ref: string | null;
  result_asset_id: string | null;
  progress: number;
  error_message: string | null;
  cost_estimate: number | null;
  created_at: string;
  updated_at: string;
}

export function useMarketingJobs(storeId: string | undefined) {
  const [jobs, setJobs] = useState<MarketingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = async () => {
    if (!storeId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_jobs")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setJobs((data || []) as MarketingJob[]);
    } catch (err: any) {
      console.error("Erro ao buscar jobs:", err);
      setError(err.message || "Erro ao carregar jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // Polling automático para jobs em processamento
  useEffect(() => {
    fetchJobs();

    // Verificar se há jobs em processamento
    const hasProcessingJobs = jobs.some(j => j.status === "queued" || j.status === "processing");

    if (hasProcessingJobs) {
      // Polling a cada 3 segundos para jobs em processamento
      pollingIntervalRef.current = setInterval(() => {
        fetchJobs();
      }, 3000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Limpar polling quando não houver mais jobs em processamento
  useEffect(() => {
    const hasProcessingJobs = jobs.some(j => j.status === "queued" || j.status === "processing");

    if (!hasProcessingJobs && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    } else if (hasProcessingJobs && !pollingIntervalRef.current) {
      pollingIntervalRef.current = setInterval(() => {
        fetchJobs();
      }, 3000);
    }
  }, [jobs]);

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

