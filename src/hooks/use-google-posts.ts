import { useState } from "react";
import { toast } from "sonner";

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
    topicType: "STANDARD" | "EVENT" | "OFFER" | "ALERT";
}

export function useGooglePosts() {
    const [posts, setPosts] = useState<GooglePost[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchPosts = async (locationId: string) => {
        setLoading(true);
        // Simulação de delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Dados simulados
        const mockPosts: GooglePost[] = [
            {
                name: "posts/1",
                summary: "Venha conferir nossas ofertas de fim de ano! Descontos imperdíveis em toda a loja.",
                callToAction: {
                    actionType: "SHOP",
                    url: "https://exemplo.com/ofertas",
                },
                createTime: new Date().toISOString(),
                state: "LIVE",
                topicType: "OFFER",
                media: [{ googleUrl: "https://placehold.co/600x400", sourceUrl: "https://placehold.co/600x400" }]
            },
            {
                name: "posts/2",
                summary: "Estamos com horário especial neste feriado. Abriremos das 09h às 18h.",
                createTime: new Date(Date.now() - 86400000).toISOString(),
                state: "LIVE",
                topicType: "STANDARD",
            }
        ];

        setPosts(mockPosts);
        setLoading(false);
    };

    const createPost = async (post: Partial<GooglePost>) => {
        setLoading(true);
        // Simulação
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const newPost: GooglePost = {
            name: `posts/${Date.now()}`,
            summary: post.summary || "",
            callToAction: post.callToAction,
            createTime: new Date().toISOString(),
            state: "LIVE",
            topicType: post.topicType || "STANDARD",
            media: post.media,
        };

        setPosts([newPost, ...posts]);
        setLoading(false);
        toast.success("Postagem criada com sucesso! (Simulação)");
        return newPost;
    };

    const deletePost = async (postName: string) => {
        setLoading(true);
        // Simulação
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setPosts(posts.filter(p => p.name !== postName));
        setLoading(false);
        toast.success("Postagem removida com sucesso! (Simulação)");
    };

    return {
        posts,
        loading,
        fetchPosts,
        createPost,
        deletePost,
    };
}
