import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCPF } from "@/lib/cpf";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "LOJA" | "COLABORADORA";
  store_default: string | null;
  store_id: string | null;
  active: boolean;
  is_super_admin?: boolean; // Indica se é Super Admin (dono do sistema)
  tenant_schema?: string | null; // Schema do tenant (opcional, para multi-tenancy)
}

interface BillingStatus {
  has_access: boolean;
  access_level: 'FULL' | 'WARNING' | 'READ_ONLY' | 'BLOCKED';
  reason: string;
  message: string;
  days_overdue?: number;
  payment_status?: string;
  next_payment_date?: string;
  current_period_end?: string;
  last_payment_date?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  billingStatus: BillingStatus | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const isFetchingProfileRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    // Validate userId before proceeding
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn("[AuthContext] Invalid userId provided to fetchProfile");
      setLoading(false);
      return;
    }

    // Prevent duplicate calls for the same user
    if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
      console.log("[AuthContext] Already fetching profile for this user, skipping duplicate call");
      return;
    }

    console.log("[AuthContext] Fetching profile for userId:", userId);
    
    // Clear any existing timeout before creating a new one
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    isFetchingProfileRef.current = true;
    currentUserIdRef.current = userId;
    setLoading(true);

    // Safety timeout: if fetch takes more than 8 seconds, force completion
    safetyTimeoutRef.current = setTimeout(() => {
      if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
        console.warn("[AuthContext] ⚠️ Profile fetch timeout (8s)");
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        setLoading(false);
        safetyTimeoutRef.current = null;
      }
    }, 8000);

    try {
      // Fetch directly by ID - this is the fastest way since userId = profile.id
      console.log("[AuthContext] Starting profile query for userId:", userId);
      const queryStartTime = Date.now();
      
      // Create a promise with timeout
      // Try sistemaretiradas first (tenant padrão)
      // Se não encontrar, pode tentar outros schemas de tenant no futuro
      const queryPromise = supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      // Race between query and timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Query timeout after 5 seconds")), 5000)
      );

      let queryResult;
      try {
        queryResult = await Promise.race([queryPromise, timeoutPromise]);
      } catch (timeoutError: any) {
        if (timeoutError.message === "Query timeout after 5 seconds") {
          console.error("[AuthContext] ❌ Query timed out after 5 seconds!");
          console.error("[AuthContext] This suggests a network issue or RLS problem");
          throw new Error("Query timeout - profile fetch took too long");
        }
        throw timeoutError;
      }

      const { data, error } = queryResult as any;
      const queryTime = Date.now() - queryStartTime;
      console.log(`[AuthContext] Profile query completed in ${queryTime}ms`);

      if (error) {
        console.error("[AuthContext] Error fetching profile:", error);
        console.error("[AuthContext] Error code:", error.code);
        console.error("[AuthContext] Error message:", error.message);
        console.error("[AuthContext] Error details:", JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data) {
        console.warn("[AuthContext] Profile não encontrado no sistemaretiradas para userId:", userId);
        // TODO: Se não encontrar, pode tentar buscar em outros schemas de tenant
        // Por enquanto, apenas loga e retorna null (compatibilidade)
        setProfile(null);
        setLoading(false);
        return;
      }

      console.log("[AuthContext] ✅ PROFILE FOUND! Role:", data.role, "Name:", data.name);

      // Verificar se o perfil está ativo (is_active)
      const isActive = data.is_active !== false; // Default true se não existir
      if (!isActive && data.role === 'ADMIN') {
        console.warn("[AuthContext] ⚠️ Admin desativado (is_active = false)");
        // Não definir profile para bloquear acesso
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        lastLoadedUserIdRef.current = null;
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        return;
      }

      // Set profile and clear timeout
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      // Track the last loaded user ID to prevent duplicate fetches
      lastLoadedUserIdRef.current = userId;
      // Por padrão, tenant usa sistemaretiradas (schema_name = null)
      const profileData = {
        ...data,
        tenant_schema: 'sistemaretiradas', // Default para compatibilidade
      } as Profile;
      setProfile(profileData);
      
      // Verificar billing status se for ADMIN
      if (data.role === 'ADMIN') {
        try {
          const { data: billingData, error: billingError } = await supabase
            .rpc('check_admin_access', { p_admin_id: userId });
          
          if (!billingError && billingData && billingData.length > 0) {
            const billing = billingData[0] as any;
            // Garantir que access_level está presente
            const billingStatus: BillingStatus = {
              has_access: billing.has_access !== false,
              reason: billing.reason || 'UNKNOWN',
              message: billing.message || 'Status de pagamento desconhecido',
              days_overdue: billing.days_overdue || 0,
              access_level: billing.access_level || (billing.has_access ? 'FULL' : 'BLOCKED')
            };
            setBillingStatus(billingStatus);
            
            // PROGRESSÃO DE RESTRIÇÕES:
            // - FULL (0-1 dia): Acesso completo
            // - WARNING (2 dias): Acesso completo com aviso visual
            // - READ_ONLY (3-6 dias): Acesso somente leitura (is_active = true, mas bloqueia ações)
            // - BLOCKED (7+ dias): Bloqueio total (is_active = false, exceto aba billing)
            
            // Se está bloqueado (7+ dias), não permitir login (exceto para acessar aba billing)
            if (billingStatus.access_level === 'BLOCKED') {
              console.warn("[AuthContext] ⚠️ Admin bloqueado devido a billing (7+ dias):", billingStatus.reason);
              // Para BLOCKED, ainda permitir login mas mostrar mensagem de bloqueio
              // O componente BillingAccessGuard vai bloquear ações, mas permite acessar aba billing
              // Não bloquear completamente aqui, apenas marcar o status
            } else if (!billingStatus.has_access && billingStatus.access_level !== 'BLOCKED') {
              // Outros casos sem acesso (sem assinatura, etc)
              console.warn("[AuthContext] ⚠️ Admin sem acesso devido a billing:", billingStatus.reason);
              setProfile(null);
              setLoading(false);
              isFetchingProfileRef.current = false;
              currentUserIdRef.current = null;
              lastLoadedUserIdRef.current = null;
              if (safetyTimeoutRef.current) {
                clearTimeout(safetyTimeoutRef.current);
                safetyTimeoutRef.current = null;
              }
              return;
            }
          }
        } catch (billingCheckError) {
          console.error("[AuthContext] Error checking billing status:", billingCheckError);
          // Em caso de erro, permitir acesso (fail-safe)
          setBillingStatus({
            has_access: true,
            reason: 'CHECK_ERROR',
            message: 'Erro ao verificar billing, acesso permitido temporariamente'
          });
        }
      } else {
        // Para LOJA e COLABORADORA, sempre permitir acesso (billing é só para ADMIN)
        setBillingStatus({
          has_access: true,
          reason: 'NOT_ADMIN',
          message: 'Acesso liberado'
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error("[AuthContext] Error in fetchProfile:", error);
      setProfile(null);
      setLoading(false);
    } finally {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      isFetchingProfileRef.current = false;
      currentUserIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let profileFetchedForInitialSession = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log("[AuthContext] Auth state changed:", event);
        
        // Skip INITIAL_SESSION and TOKEN_REFRESHED - they don't need profile refetch
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          console.log("[AuthContext] Event", event, "- skipping profile fetch (session still valid)");
          // Just update session/user but don't fetch profile again
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        // Handle SIGNED_OUT
        if (event === 'SIGNED_OUT') {
          console.log("[AuthContext] User signed out");
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          isFetchingProfileRef.current = false;
          currentUserIdRef.current = null;
          lastLoadedUserIdRef.current = null;
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user?.id && session.expires_at) {
          // Check if session is not expired
          const expiresAt = new Date(session.expires_at * 1000);
          const now = new Date();
          if (expiresAt > now) {
            // Only fetch profile if:
            // 1. We don't already have a profile loaded for this user ID
            // 2. We're not already fetching for this user ID
            const userId = session.user.id;
            if (lastLoadedUserIdRef.current === userId) {
              console.log("[AuthContext] Profile already loaded for this user, skipping fetch");
              setLoading(false);
            } else if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
              console.log("[AuthContext] Already fetching profile for this user, skipping duplicate call");
            } else {
              console.log("[AuthContext] Valid session user detected, fetching profile");
              setLoading(true);
              await fetchProfile(userId);
            }
          } else {
            console.log("[AuthContext] Session expired, clearing profile");
            setProfile(null);
            setLoading(false);
            isFetchingProfileRef.current = false;
            currentUserIdRef.current = null;
            lastLoadedUserIdRef.current = null;
          }
        } else {
          setProfile(null);
          setLoading(false);
          isFetchingProfileRef.current = false;
          currentUserIdRef.current = null;
          lastLoadedUserIdRef.current = null;
        }
      }
    );

    // Initial session check - this is the ONLY place we fetch profile on mount
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;
      
      // If there's an error getting session, just set loading to false
      if (error) {
        console.log("[AuthContext] Initial session check - error getting session:", error.message);
        setLoading(false);
        setProfile(null);
        setSession(null);
        setUser(null);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      
      // Only fetch profile if we have a valid session and user ID
      // Also check if session is not expired
      if (session?.user?.id && session.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        // Add 5 minute buffer to avoid fetching for sessions about to expire
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        if (expiresAt.getTime() > (now.getTime() + bufferTime)) {
          // Only fetch if not already fetching
          if (!isFetchingProfileRef.current || currentUserIdRef.current !== session.user.id) {
            console.log("[AuthContext] Initial session check - fetching profile");
            profileFetchedForInitialSession = true;
            await fetchProfile(session.user.id);
          } else {
            console.log("[AuthContext] Initial session check - profile already being fetched, skipping");
          }
        } else {
          console.log("[AuthContext] Initial session check - session expired or about to expire");
          setLoading(false);
          setProfile(null);
          lastLoadedUserIdRef.current = null;
          // Don't sign out automatically - let user session expire naturally
          // Automatic signOut can cause login/logout loops
        }
      } else {
        console.log("[AuthContext] Initial session check - no valid user session found");
        setLoading(false);
        setProfile(null);
        lastLoadedUserIdRef.current = null;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    isFetchingProfileRef.current = false;
    currentUserIdRef.current = null;
    lastLoadedUserIdRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, billingStatus, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
