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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isFetchingProfileRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    // Validate userId before proceeding
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn("[AuthContext] Invalid userId provided to fetchProfile:", userId);
      setLoading(false);
      isFetchingProfileRef.current = false;
      currentUserIdRef.current = null;
      return;
    }

    // Double-check that we have a valid session before proceeding
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id || session.user.id !== userId) {
      console.warn("[AuthContext] Session invalid or user ID mismatch, skipping fetchProfile");
      setLoading(false);
      setProfile(null);
      isFetchingProfileRef.current = false;
      currentUserIdRef.current = null;
      return;
    }

    // If already fetching for the same user, wait for it to complete
    if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
      console.log("[AuthContext] Already fetching profile for this user, waiting for result...");
      // Wait up to 6 seconds for the current fetch to complete
      let attempts = 0;
      while (isFetchingProfileRef.current && attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      // After waiting, check if still fetching
      if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
        console.log("[AuthContext] Still fetching after wait (6s), forcing completion and retrying...");
        // Force clear the flags and set loading to false
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        setLoading(false);
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Fetch completed, return - loading should already be false
        console.log("[AuthContext] Fetch completed while waiting, returning");
        return;
      }
    }

    // If fetching for a different user, wait a bit for it to finish
    if (isFetchingProfileRef.current && currentUserIdRef.current !== userId) {
      console.log("[AuthContext] Waiting for previous fetch to complete...");
      await new Promise(resolve => setTimeout(resolve, 200));
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

    // Safety timeout: if fetch takes more than 6 seconds, force completion
    // Only create timeout if we have a valid session
    // Only log as warning, not error, to avoid confusing console errors
    // Store timeout in ref so we can clear it if needed
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user?.id === userId) {
      safetyTimeoutRef.current = setTimeout(() => {
        if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
          console.warn("[AuthContext] ⚠️ Profile fetch timeout (6s), forcing loading to false. This may indicate a slow query or network issue.");
          isFetchingProfileRef.current = false;
          currentUserIdRef.current = null;
          setLoading(false);
          safetyTimeoutRef.current = null;
          // Don't set profile to null here, let it keep what it had
        }
      }, 6000);
    } else {
      console.warn("[AuthContext] Session invalid during fetchProfile, aborting");
      isFetchingProfileRef.current = false;
      currentUserIdRef.current = null;
      setLoading(false);
      return;
    }

    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      if (!userEmail) {
        console.error("[AuthContext] No email found for user");
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      console.log("[AuthContext] Searching for profile with email:", userEmail);
      const queryStartTime = Date.now();

      // Try exact match first (faster), then case-insensitive if not found
      let { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();

      const queryTime = Date.now() - queryStartTime;
      console.log(`[AuthContext] Exact match query took ${queryTime}ms`);

      // If exact match not found, try case-insensitive
      if (!data && !error) {
        console.log("[AuthContext] Exact match not found, trying case-insensitive search...");
        const caseInsensitiveStartTime = Date.now();
        const result = await supabase
          .schema("sistemaretiradas")
          .from("profiles")
          .select("*")
          .ilike("email", userEmail)
          .maybeSingle();
        
        const caseInsensitiveTime = Date.now() - caseInsensitiveStartTime;
        console.log(`[AuthContext] Case-insensitive query took ${caseInsensitiveTime}ms`);
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("[AuthContext] Error fetching profile by email:", error);
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      if (!data) {
        console.error("[AuthContext] ❌ NO PROFILE FOUND for email:", userEmail);
        console.error("[AuthContext] This means the profile doesn't exist or email doesn't match");
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      console.log("[AuthContext] ✅ PROFILE FOUND!");
      console.log("[AuthContext] Profile ID:", data.id);
      console.log("[AuthContext] Auth User ID:", userId);
      console.log("[AuthContext] IDs match:", data.id === userId);
      console.log("[AuthContext] User role:", data.role);

      // Critical: Profile ID MUST match auth user ID for RLS
      if (data.id !== userId) {
        console.error("[AuthContext] ❌ CRITICAL: ID MISMATCH!");
        console.error("[AuthContext] Profile ID:", data.id);
        console.error("[AuthContext] Auth User ID:", userId);
        console.error("[AuthContext] This will cause RLS to block access!");
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      console.log("[AuthContext] Setting profile state...");
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.error("[AuthContext] Error in fetchProfile:", error);
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      setProfile(null);
      setLoading(false);
    } finally {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      isFetchingProfileRef.current = false;
      if (currentUserIdRef.current === userId) {
        currentUserIdRef.current = null;
      }
      console.log("[AuthContext] Profile fetch completed, loading set to false");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialSessionChecked = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log("[AuthContext] Auth state changed:", event);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user?.id && session.expires_at) {
          // Check if session is not expired
          const expiresAt = new Date(session.expires_at * 1000);
          const now = new Date();
          if (expiresAt > now) {
            // Reset loading state and fetch profile (fetchProfile will handle duplicates)
            console.log("[AuthContext] Valid session user detected, fetching profile");
            setLoading(true);
            await fetchProfile(session.user.id);
          } else {
            console.log("[AuthContext] Session expired, clearing profile");
            setProfile(null);
            setLoading(false);
            isFetchingProfileRef.current = false;
            currentUserIdRef.current = null;
          }
        } else {
          setProfile(null);
          setLoading(false);
          isFetchingProfileRef.current = false;
          currentUserIdRef.current = null;
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;

      initialSessionChecked = true;
      
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
          console.log("[AuthContext] Initial session check - valid user session found, fetching profile");
          await fetchProfile(session.user.id);
        } else {
          console.log("[AuthContext] Initial session check - session expired or about to expire");
          setLoading(false);
          setProfile(null);
          // Sign out expired session
          await supabase.auth.signOut();
        }
      } else {
        console.log("[AuthContext] Initial session check - no valid user session found");
        setLoading(false);
        setProfile(null);
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
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
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
