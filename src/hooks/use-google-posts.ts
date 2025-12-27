import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/google-api-retry";

const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

export interface GooglePost {
    name: string; // resource name
    summary: string;
    callToAction?: {
        actionType: "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL";
        url?: string;
    };
    createTime: string;
    state: "LIVE" | "PROCESSING" | "REJECTED";
    media?: {
        googleUrl: string;
        sourceUrl: string;
    }[];
    topicType?: "STANDARD" | "EVENT" | "OFFER" | "ALERT";
}

interface GooglePostsResponse {
    success: boolean;
    posts: GooglePost[];
    total: number;
    error?: string;
}

export function useGooglePosts() {
    const { user } = useAuth();
    const [posts, setPosts] = useState<GooglePost[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchPosts = async (locationId: string, siteSlug?: string) => {
        if (!user?.email) {
            toast.error("É necessário estar logado");
            return;
        }

        setLoading(true);
        try {
            const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-posts-fetch`;

            const response = await fetchWithRetry(
                endpoint,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        locationId,
                        userEmail: user.email,
                        siteSlug: siteSlug || "",
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

            const data: GooglePostsResponse = await response.json();

            if (!data.success || !data.posts) {
                throw new Error(data.error || "Resposta inválida da API");
            }

            setPosts(data.posts);
        } catch (error: any) {
            console.error("[useGooglePosts] Erro ao buscar posts:", error);
            toast.error(error.message || "Erro ao buscar postagens do Google");
            setPosts([]);
        } finally {
            setLoading(false);
        }
    };

    const createPost = async (post: Partial<GooglePost>) => {
        toast.error("Criação de postagens ainda não implementada");
        throw new Error("Funcionalidade em desenvolvimento");
    };

    const deletePost = async (postName: string) => {
        toast.error("Exclusão de postagens ainda não implementada");
        throw new Error("Funcionalidade em desenvolvimento");
    };

    return {
        posts,
        loading,
        fetchPosts,
        createPost,
        deletePost,
    };
}
