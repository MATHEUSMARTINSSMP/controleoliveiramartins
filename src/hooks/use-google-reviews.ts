import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/google-api-retry";

// Usar Netlify Functions
const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

export interface GoogleReview {
  review_id?: number;
  review_id_external: string;
  rating: number;
  comment?: string;
  author_name?: string;
  review_date: string;
  reply?: string;
  account_id?: string;
  location_id?: string;
  is_read?: boolean;
}

interface GoogleReviewsResponse {
  success: boolean;
  ok: boolean;
  error?: string;
  reviews?: GoogleReview[];
  account?: {
    name: string;
  };
  averageRating?: number;
  totalReviews?: number;
}

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

export function useGoogleReviews() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [stats, setStats] = useState<GoogleStatsResponse | null>(null);

  /**
   * Busca reviews do Google My Business
   */
  const fetchReviews = async (siteSlug: string): Promise<GoogleReview[] | null> => {
    if (!user?.email) {
      toast.error("É necessário estar logado");
      return null;
    }

    setLoading(true);
    try {
      const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-reviews-fetch`;

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
          }),
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          retryableStatusCodes: [429, 500, 502, 503, 504],
        }
      );

      if (!response.ok) {
        // Tratamento específico de erros HTTP com retry
        if (response.status === 401) {
          throw new Error("Token expirado. Reconecte sua conta Google.");
        } else if (response.status === 403) {
          throw new Error("Sem permissão para acessar reviews. Verifique os escopos OAuth.");
        } else if (response.status === 404) {
          throw new Error("Recurso não encontrado. Verifique se a location está configurada corretamente.");
        } else if (response.status === 429) {
          // Rate limit - tentar novamente após delay
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // 1 minuto padrão
          throw new Error(`Limite de requisições excedido. Tente novamente em ${Math.ceil(delay / 1000)} segundos.`);
        } else if (response.status >= 500) {
          throw new Error("Erro no servidor. Tente novamente mais tarde.");
        }
        throw new Error(`Erro ao buscar reviews: ${response.statusText}`);
      }

      const data: GoogleReviewsResponse = await response.json();

      if (!data.success || !data.ok) {
        // Tratamento de erros específicos da API
        if (data.error?.includes("needsReauth") || data.error?.includes("token expirado")) {
          throw new Error("Token expirado. Reconecte sua conta Google.");
        } else if (data.error?.includes("rate limit")) {
          throw new Error("Limite de requisições excedido. Aguarde alguns minutos.");
        }
        throw new Error(data.error || "Erro ao buscar reviews");
      }

      // Se não tem reviews no response, buscar do banco
      if (!data.reviews || data.reviews.length === 0) {
        const { createClient } = await import("@/integrations/supabase/client");
        const supabase = createClient();

        const { data: dbReviews, error } = await supabase
          .schema("sistemaretiradas")
          .from("google_reviews")
          .select("*")
          .eq("customer_id", user.email)
          .eq("site_slug", siteSlug)
          .order("review_date", { ascending: false })
          .limit(100); // Limitar para performance

        if (error) {
          console.error("Erro ao buscar reviews do banco:", error);
        } else if (dbReviews && dbReviews.length > 0) {
          setReviews(dbReviews as GoogleReview[]);
          return dbReviews as GoogleReview[];
        }
      } else {
        setReviews(data.reviews);
        return data.reviews;
      }

      // Se chegou aqui, não há reviews
      setReviews([]);
      return [];
    } catch (error: any) {
      console.error("Erro ao buscar reviews:", error);
      toast.error(error.message || "Erro ao buscar reviews do Google");
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca estatísticas de reviews
   */
  const fetchStats = async (siteSlug: string, period: string = "30d"): Promise<GoogleStatsResponse | null> => {
    if (!user?.email) {
      return null;
    }

    try {
      const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-reviews-stats?siteSlug=${encodeURIComponent(siteSlug)}&customerId=${encodeURIComponent(user.email)}&period=${encodeURIComponent(period)}`;
      const response = await fetchWithRetry(
        endpoint,
        {
          method: "GET",
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          retryableStatusCodes: [429, 500, 502, 503, 504],
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Token expirado. Reconecte sua conta Google.");
        } else if (response.status === 403) {
          throw new Error("Sem permissão para acessar estatísticas. Verifique os escopos OAuth.");
        } else if (response.status === 404) {
          throw new Error("Recurso não encontrado. Verifique se há reviews disponíveis.");
        } else if (response.status === 429) {
          throw new Error("Limite de requisições excedido. Aguarde alguns minutos.");
        } else if (response.status >= 500) {
          throw new Error("Erro no servidor. Tente novamente mais tarde.");
        }
        throw new Error(`Erro ao buscar estatísticas: ${response.statusText}`);
      }

      const data: GoogleStatsResponse = await response.json();

      if (!data.success || !data.ok) {
        throw new Error("Erro ao buscar estatísticas");
      }

      setStats(data);
      return data;
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas:", error);
      toast.error(error.message || "Erro ao buscar estatísticas");
      return null;
    }
  };

  /**
   * Busca accountId e locationId do banco de dados
   */
  const getAccountAndLocation = async (siteSlug: string): Promise<{ accountId: string; locationId: string } | null> => {
    if (!user?.email) {
      return null;
    }

    try {
      const { createClient } = await import("@/integrations/supabase/client");
      const supabase = createClient();

      // Buscar location primária ou primeira disponível
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("google_business_accounts")
        .select("account_id, location_id")
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug)
        .order("is_primary", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.warn("Account/location não encontrada, tentando buscar da review...");
        // Se não encontrar, tentar buscar de uma review existente
        const { data: reviewData } = await supabase
          .schema("sistemaretiradas")
          .from("google_reviews")
          .select("account_id, location_id")
          .eq("customer_id", user.email)
          .eq("site_slug", siteSlug)
          .not("account_id", "is", null)
          .not("location_id", "is", null)
          .limit(1)
          .single();

        if (reviewData?.account_id && reviewData?.location_id) {
          return {
            accountId: reviewData.account_id,
            locationId: reviewData.location_id,
          };
        }

        return null;
      }

      return {
        accountId: data.account_id,
        locationId: data.location_id || "",
      };
    } catch (error) {
      console.error("Erro ao buscar account/location:", error);
      return null;
    }
  };

  /**
   * Responde a uma review
   */
  const respondToReview = async (
    siteSlug: string,
    reviewId: string,
    reply: string,
    accountId?: string,
    locationId?: string
  ): Promise<boolean> => {
    if (!user?.email) {
      toast.error("É necessário estar logado");
      return false;
    }

    setLoading(true);
    try {
      // Se não fornecido, buscar do banco
      let finalAccountId = accountId;
      let finalLocationId = locationId;

      if (!finalAccountId || !finalLocationId) {
        const accountLocation = await getAccountAndLocation(siteSlug);
        if (!accountLocation) {
          toast.error("Não foi possível encontrar a location do Google. Reconecte sua conta.");
          return false;
        }
        finalAccountId = accountLocation.accountId;
        finalLocationId = accountLocation.locationId;
      }

      const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-reviews-respond`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: user.email,
          siteSlug,
          accountId: finalAccountId,
          locationId: finalLocationId,
          reviewId,
          reply,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Token expirado. Reconecte sua conta Google.");
        } else if (response.status === 403) {
          throw new Error("Sem permissão para responder a este review. Verifique os escopos OAuth.");
        } else if (response.status === 404) {
          throw new Error("Review não encontrado. Verifique se o ID está correto.");
        } else if (response.status === 429) {
          throw new Error("Limite de requisições excedido. Aguarde alguns minutos antes de tentar novamente.");
        } else if (response.status >= 500) {
          throw new Error("Erro no servidor. Tente novamente mais tarde.");
        }
        throw new Error(`Erro ao responder review: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.ok) {
        throw new Error(data.error || "Erro ao responder review");
      }

      toast.success("Resposta enviada com sucesso");
      
      // Atualizar review localmente
      setReviews((prev) =>
        prev.map((r) =>
          r.review_id_external === reviewId ? { ...r, reply } : r
        )
      );

      return true;
    } catch (error: any) {
      console.error("Erro ao responder review:", error);
      toast.error(error.message || "Erro ao responder review");
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Salva reviews no banco (sincronização)
   */
  const saveReviews = async (siteSlug: string, reviewsToSave: GoogleReview[]): Promise<boolean> => {
    // Nota: saveReviews não é mais necessário - a function google-reviews-fetch já salva automaticamente
    // Mantendo apenas para compatibilidade
    toast.info("Reviews são salvos automaticamente ao buscar");
    return true;
  };

  /**
   * Marca review como lida
   */
  const markAsRead = async (siteSlug: string, reviewIdExternal: string): Promise<boolean> => {
    if (!user?.email) {
      return false;
    }

    try {
      const { createClient } = await import("@/integrations/supabase/client");
      const supabase = createClient();

      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("google_reviews")
        .update({ is_read: true })
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug)
        .eq("review_id_external", reviewIdExternal);

      if (error) {
        throw error;
      }

      // Atualizar localmente
      setReviews((prev) =>
        prev.map((r) =>
          r.review_id_external === reviewIdExternal ? { ...r, is_read: true } : r
        )
      );

      return true;
    } catch (error) {
      console.error("Erro ao marcar review como lida:", error);
      return false;
    }
  };

  return {
    reviews,
    stats,
    loading,
    fetchReviews,
    fetchStats,
    respondToReview,
    saveReviews,
    getAccountAndLocation,
    markAsRead,
  };
}

