import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/google-api-retry";

const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

export interface GoogleLocation {
    id: number;
    account_id: string;
    account_name?: string;
    location_id: string;
    location_name: string;
    location_address?: string;
    location_phone?: string;
    location_website?: string;
    location_category?: string;
    is_primary: boolean;
    updated_at?: string;
}

export function useGoogleLocations() {
    const { user } = useAuth();
    const [locations, setLocations] = useState<GoogleLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchLocations = async (siteSlug: string, refreshFromApi = false) => {
        if (!user?.email) return;

        if (refreshFromApi) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            if (refreshFromApi) {
                // Atualizar locations da API do Google
                const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-locations-refresh`;
                
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
                        retryDelay: 1000,
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const data = await response.json();
                if (data.success && data.locations) {
                    setLocations(data.locations as GoogleLocation[]);
                    toast.success(`${data.locationsCount} local(is) atualizado(s) com sucesso`);
                } else {
                    throw new Error(data.error || "Erro ao atualizar locations");
                }
            } else {
                // Buscar locations do banco de dados
                const { data, error } = await supabase
                    .schema("sistemaretiradas")
                    .from("google_business_accounts")
                    .select("*")
                    .eq("customer_id", user.email)
                    .eq("site_slug", siteSlug)
                    .order("is_primary", { ascending: false });

                if (error) {
                    throw error;
                }

                setLocations(data as GoogleLocation[]);
            }
        } catch (error: any) {
            console.error("Erro ao buscar locations:", error);
            toast.error(error.message || "Erro ao carregar locais do Google");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const setPrimaryLocation = async (id: number, siteSlug: string) => {
        if (!user?.email) return;

        try {
            // Primeiro, remove o status de primário de todas as locations deste site
            await supabase
                .schema("sistemaretiradas")
                .from("google_business_accounts")
                .update({ is_primary: false })
                .eq("customer_id", user.email)
                .eq("site_slug", siteSlug);

            // Define a nova location primária
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from("google_business_accounts")
                .update({ is_primary: true })
                .eq("id", id);

            if (error) throw error;

            toast.success("Local principal atualizado com sucesso");
            fetchLocations(siteSlug);
        } catch (error) {
            console.error("Erro ao definir local principal:", error);
            toast.error("Erro ao atualizar local principal");
        }
    };

    return {
        locations,
        loading,
        refreshing,
        fetchLocations,
        setPrimaryLocation,
        refreshLocations: (siteSlug: string) => fetchLocations(siteSlug, true),
    };
}
