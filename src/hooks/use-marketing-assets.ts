import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MarketingAsset {
  id: string;
  store_id: string;
  user_id: string;
  job_id: string | null; // ID do job que gerou este asset (para agrupar variações)
  type: "image" | "video" | "audio" | "font" | "other";
  provider: string;
  provider_model: string | null;
  storage_path: string;
  public_url: string | null;
  signed_url: string | null;
  signed_expires_at: string | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  metadata: Record<string, any> | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useMarketingAssets(storeId: string | undefined, type?: "image" | "video", enablePolling = true) {
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  const fetchAssets = async (silent = false) => {
    if (!storeId) {
      setAssets([]);
      setLoading(false);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      let query = supabase
        .schema("sistemaretiradas")
        .from("marketing_assets")
        .select("*, job_id")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200); // Aumentar limite para suportar agrupamento

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setAssets((data || []) as MarketingAsset[]);
    } catch (err: any) {
      console.error("Erro ao buscar assets:", err);
      setError(err.message || "Erro ao carregar assets");
      setAssets([]);
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  };

  // Polling automático a cada 5 segundos
  useEffect(() => {
    fetchAssets();

    if (enablePolling) {
      // Polling a cada 5 segundos para atualização em tempo real
      pollingIntervalRef.current = setInterval(() => {
        fetchAssets(true); // Silent update (não mostra loading)
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, type, enablePolling]);

  return { assets, loading, error, refetch: () => fetchAssets(false) };
}

