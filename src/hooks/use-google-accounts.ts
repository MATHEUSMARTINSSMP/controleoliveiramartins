import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface GoogleBusinessAccount {
  id?: number;
  customer_id: string;
  site_slug: string;
  account_id: string;
  account_name?: string;
  account_type?: string;
  location_id?: string;
  location_name?: string;
  location_address?: string;
  location_phone?: string;
  location_website?: string;
  location_category?: string;
  location_latitude?: number;
  location_longitude?: number;
  is_primary?: boolean;
}

/**
 * Hook para gerenciar accounts e locations do Google My Business
 */
export function useGoogleAccounts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<GoogleBusinessAccount[]>([]);

  /**
   * Busca todas as accounts/locations de um customer/site
   */
  const fetchAccounts = async (siteSlug: string): Promise<GoogleBusinessAccount[]> => {
    if (!user?.email) {
      return [];
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("google_business_accounts")
        .select("*")
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug)
        .order("is_primary", { ascending: false })
        .order("location_name");

      if (error) {
        throw error;
      }

      setAccounts(data || []);
      return data || [];
    } catch (error: any) {
      console.error("Erro ao buscar accounts:", error);
      toast.error("Erro ao buscar locations do Google");
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Salva ou atualiza uma account/location
   */
  const saveAccount = async (account: GoogleBusinessAccount): Promise<boolean> => {
    if (!user?.email) {
      toast.error("É necessário estar logado");
      return false;
    }

    setLoading(true);
    try {
      const accountData = {
        ...account,
        customer_id: user.email,
      };

      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("google_business_accounts")
        .upsert(accountData, {
          onConflict: "customer_id,site_slug,account_id,location_id",
        });

      if (error) {
        throw error;
      }

      // Atualizar lista local
      await fetchAccounts(account.site_slug);
      return true;
    } catch (error: any) {
      console.error("Erro ao salvar account:", error);
      toast.error("Erro ao salvar location do Google");
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Define uma location como primária
   */
  const setPrimaryLocation = async (
    siteSlug: string,
    accountId: string,
    locationId: string
  ): Promise<boolean> => {
    if (!user?.email) {
      return false;
    }

    setLoading(true);
    try {
      // Primeiro, remover is_primary de todas as locations deste customer/site
      await supabase
        .schema("sistemaretiradas")
        .from("google_business_accounts")
        .update({ is_primary: false })
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug);

      // Depois, definir a location selecionada como primária
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("google_business_accounts")
        .update({ is_primary: true })
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug)
        .eq("account_id", accountId)
        .eq("location_id", locationId);

      if (error) {
        throw error;
      }

      // Atualizar lista local
      await fetchAccounts(siteSlug);
      toast.success("Location primária atualizada");
      return true;
    } catch (error: any) {
      console.error("Erro ao definir location primária:", error);
      toast.error("Erro ao atualizar location primária");
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca a location primária ou primeira disponível
   */
  const getPrimaryLocation = async (
    siteSlug: string
  ): Promise<{ accountId: string; locationId: string } | null> => {
    if (!user?.email) {
      return null;
    }

    try {
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
        return null;
      }

      return {
        accountId: data.account_id,
        locationId: data.location_id || "",
      };
    } catch (error) {
      console.error("Erro ao buscar location primária:", error);
      return null;
    }
  };

  /**
   * Remove uma account/location
   */
  const deleteAccount = async (
    siteSlug: string,
    accountId: string,
    locationId: string
  ): Promise<boolean> => {
    if (!user?.email) {
      return false;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("google_business_accounts")
        .delete()
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug)
        .eq("account_id", accountId)
        .eq("location_id", locationId);

      if (error) {
        throw error;
      }

      // Atualizar lista local
      await fetchAccounts(siteSlug);
      toast.success("Location removida");
      return true;
    } catch (error: any) {
      console.error("Erro ao remover account:", error);
      toast.error("Erro ao remover location");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    accounts,
    loading,
    fetchAccounts,
    saveAccount,
    setPrimaryLocation,
    getPrimaryLocation,
    deleteAccount,
  };
}

