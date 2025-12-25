import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MarketingAsset {
  id: string;
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

export function useMarketingAssets(storeId: string | undefined, type?: "image" | "video") {
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    if (!storeId) {
      setAssets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .schema("sistemaretiradas")
        .from("marketing_assets")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);

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
    }
  };

  useEffect(() => {
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, type]);

  return { assets, loading, error, refetch: fetchAssets };
}

