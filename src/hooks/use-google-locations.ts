import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

    const fetchLocations = async (siteSlug: string) => {
        if (!user?.email) return;

        setLoading(true);
        try {
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
        } catch (error: any) {
            console.error("Erro ao buscar locations:", error);
            toast.error("Erro ao carregar locais do Google");
        } finally {
            setLoading(false);
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
        fetchLocations,
        setPrimaryLocation,
    };
}
