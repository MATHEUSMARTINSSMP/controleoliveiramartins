import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/google-api-retry";

const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

export interface GoogleQuestion {
  id: string;
  name: string;
  text: string;
  authorName: string;
  authorPhoto?: string | null;
  createTime: string;
  updateTime: string;
  upvoteCount: number;
  answerCount: number;
  topAnswer?: {
    text: string;
    createTime: string;
    authorType: "OWNER" | "USER";
    authorName: string;
  } | null;
  answers: Array<{
    text: string;
    createTime: string;
    authorType: "OWNER" | "USER";
    authorName: string;
  }>;
}

interface GoogleQuestionsResponse {
  success: boolean;
  questions: GoogleQuestion[];
  total: number;
  error?: string;
}

export function useGoogleQuestions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<GoogleQuestion[]>([]);

  const fetchQuestions = async (siteSlug: string, locationId?: string): Promise<GoogleQuestion[] | null> => {
    if (!user?.email) {
      toast.error("É necessário estar logado");
      return null;
    }

    setLoading(true);

    try {
      const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-questions-fetch`;

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

      const data: GoogleQuestionsResponse = await response.json();

      if (!data.success || !data.questions) {
        throw new Error(data.error || "Resposta inválida da API");
      }

      setQuestions(data.questions);
      return data.questions;
    } catch (error: any) {
      console.error("[useGoogleQuestions] Erro ao buscar perguntas:", error);
      toast.error(error.message || "Erro ao buscar perguntas do Google");
      setQuestions([]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    questions,
    loading,
    fetchQuestions,
  };
}

