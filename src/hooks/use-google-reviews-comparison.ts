import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

interface GoogleStatsResponse {
  success: boolean;
  ok: boolean;
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  responseRate: number;
  repliedReviews: number;
  period: string;
}

interface ComparisonStats {
  current: GoogleStatsResponse | null;
  previous: GoogleStatsResponse | null;
  loading: boolean;
}

/**
 * Hook para buscar estatísticas comparativas de períodos
 */
export function useGoogleReviewsComparison() {
  const { user } = useAuth();
  const [comparison, setComparison] = useState<ComparisonStats>({
    current: null,
    previous: null,
    loading: false,
  });

  const fetchComparison = async (
    siteSlug: string,
    currentPeriod: string,
    previousPeriod: string
  ): Promise<ComparisonStats | null> => {
    if (!user?.email) {
      return null;
    }

    setComparison((prev) => ({ ...prev, loading: true }));

    try {
      // Buscar estatísticas do período atual e anterior em paralelo
      const [currentResponse, previousResponse] = await Promise.all([
        fetch(
          `${NETLIFY_FUNCTIONS_BASE}/google-reviews-stats?siteSlug=${encodeURIComponent(
            siteSlug
          )}&customerId=${encodeURIComponent(user.email)}&period=${encodeURIComponent(
            currentPeriod
          )}`
        ),
        fetch(
          `${NETLIFY_FUNCTIONS_BASE}/google-reviews-stats?siteSlug=${encodeURIComponent(
            siteSlug
          )}&customerId=${encodeURIComponent(user.email)}&period=${encodeURIComponent(
            previousPeriod
          )}`
        ),
      ]);

      if (!currentResponse.ok || !previousResponse.ok) {
        throw new Error("Erro ao buscar estatísticas comparativas");
      }

      const currentData: GoogleStatsResponse = await currentResponse.json();
      const previousData: GoogleStatsResponse = await previousResponse.json();

      if (!currentData.success || !previousData.success) {
        throw new Error("Erro ao processar estatísticas");
      }

      const result = {
        current: currentData,
        previous: previousData,
        loading: false,
      };

      setComparison(result);
      return result;
    } catch (error: any) {
      console.error("Erro ao buscar comparação:", error);
      toast.error(error.message || "Erro ao buscar estatísticas comparativas");
      setComparison((prev) => ({ ...prev, loading: false }));
      return null;
    }
  };

  return {
    comparison,
    fetchComparison,
  };
}


