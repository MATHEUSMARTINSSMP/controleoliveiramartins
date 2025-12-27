import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/google-api-retry";

const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

export interface GoogleMediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: "PHOTO" | "VIDEO";
  category: string;
  views: number;
  uploadDate: string;
  author?: string;
  description?: string;
}

interface GoogleMediaResponse {
  success: boolean;
  mediaItems: GoogleMediaItem[];
  total: number;
  error?: string;
}

export function useGoogleMedia() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mediaItems, setMediaItems] = useState<GoogleMediaItem[]>([]);

  const fetchMedia = async (siteSlug: string, locationId?: string): Promise<GoogleMediaItem[] | null> => {
    if (!user?.email) {
      toast.error("É necessário estar logado");
      return null;
    }

    setLoading(true);

    try {
      const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-media-fetch`;

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

      const data: GoogleMediaResponse = await response.json();

      if (!data.success || !data.mediaItems) {
        throw new Error(data.error || "Resposta inválida da API");
      }

      setMediaItems(data.mediaItems);
      return data.mediaItems;
    } catch (error: any) {
      console.error("[useGoogleMedia] Erro ao buscar mídias:", error);
      toast.error(error.message || "Erro ao buscar mídias do Google");
      setMediaItems([]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    mediaItems,
    loading,
    fetchMedia,
  };
}

