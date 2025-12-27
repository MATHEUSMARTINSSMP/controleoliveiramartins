import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Usar Netlify Functions
const NETLIFY_FUNCTIONS_BASE = import.meta.env.VITE_NETLIFY_FUNCTIONS_BASE || "/.netlify/functions";

interface GoogleAuthStartResponse {
  success: boolean;
  authUrl?: string;
  error?: string;
}

interface GoogleAuthStatus {
  connected: boolean;
  expiresAt?: string;
  hasRefreshToken: boolean;
  scopes?: string;
  profilePictureUrl?: string;
}

export function useGoogleAuth() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  /**
   * Inicia o fluxo de autenticação OAuth do Google
   */
  const startAuth = async (siteSlug: string): Promise<string | null> => {
    if (!user?.email) {
      toast.error("É necessário estar logado para conectar o Google");
      return null;
    }

    setLoading(true);
    try {
      const endpoint = `${NETLIFY_FUNCTIONS_BASE}/google-oauth-start`;
      const url = `${endpoint}?customerId=${encodeURIComponent(user.email)}&siteSlug=${encodeURIComponent(siteSlug)}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Erro ao iniciar autenticação: ${response.statusText}`);
      }

      const data: GoogleAuthStartResponse = await response.json();

      if (!data.success || !data.authUrl) {
        throw new Error(data.error || "Erro ao obter URL de autenticação");
      }

      // Abrir URL de autenticação
      // O callback será processado pela Netlify Function e redirecionará de volta
      window.location.href = data.authUrl;
      return data.authUrl;
    } catch (error: any) {
      console.error("Erro ao iniciar autenticação Google:", error);
      toast.error(error.message || "Erro ao iniciar autenticação");
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifica status da conexão Google
   */
  const checkStatus = async (siteSlug: string): Promise<GoogleAuthStatus | null> => {
    if (!user?.email) {
      return null;
    }

    try {
      // Buscar credenciais do Supabase
      const { supabase } = await import("@/integrations/supabase/client");

      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("google_credentials")
        .select("expires_at, refresh_token, scopes, status, profile_picture_url")
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug)
        .eq("status", "active")
        .maybeSingle();

      // Se erro for 403 ou 404 (não encontrado), retornar não conectado (não é erro crítico)
      if (error) {
        if (error.code === 'PGRST116' || error.code === 'PGRST301') {
          // Não encontrado - não é erro, apenas não está conectado
          return { connected: false, hasRefreshToken: false };
        }
        console.error("[useGoogleAuth] Erro ao verificar status:", error);
        return { connected: false, hasRefreshToken: false };
      }

      if (!data) {
        return { connected: false, hasRefreshToken: false };
      }

      const expiresAt = data.expires_at ? new Date(data.expires_at).toISOString() : undefined;
      const hasRefreshToken = !!(data.refresh_token && data.refresh_token.trim());

      return {
        connected: true,
        expiresAt,
        hasRefreshToken,
        scopes: data.scopes || undefined,
        profilePictureUrl: data.profile_picture_url || undefined,
      };
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      return null;
    }
  };

  /**
   * Busca informações do perfil Google conectado
   */
  const getProfileInfo = async (): Promise<{ name?: string; email?: string; picture?: string } | null> => {
    if (!user?.email) {
      return null;
    }

    try {
      // Usar o token para buscar informações do perfil
      // Por enquanto, retornar apenas o email do usuário
      return {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
        picture: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      };
    } catch (error) {
      console.error("Erro ao buscar informações do perfil:", error);
      return null;
    }
  };

  /**
   * Desconecta a conta Google (remove credenciais)
   */
  const disconnect = async (siteSlug: string): Promise<boolean> => {
    if (!user?.email) {
      toast.error("É necessário estar logado");
      return false;
    }

    setLoading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");

      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("google_credentials")
        .update({ status: "revoked" })
        .eq("customer_id", user.email)
        .eq("site_slug", siteSlug);

      if (error) {
        throw error;
      }

      toast.success("Conta Google desconectada com sucesso");
      return true;
    } catch (error: any) {
      console.error("Erro ao desconectar:", error);
      toast.error(error.message || "Erro ao desconectar conta Google");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    startAuth,
    checkStatus,
    disconnect,
    getProfileInfo,
    loading,
  };
}

