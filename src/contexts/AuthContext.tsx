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
        console.error("[AuthContext] ❌ NO PROFILE FOUND for userId:", userId);
        console.error("[AuthContext] This could mean:");
        console.error("[AuthContext] 1. Profile doesn't exist in database");
        console.error("[AuthContext] 2. RLS is blocking access");
        console.error("[AuthContext] 3. Profile ID doesn't match userId");
        throw new Error("Profile not found");
      }

      console.log("[AuthContext] ✅ PROFILE FOUND! Role:", data.role, "Name:", data.name);

      // Set profile and clear timeout
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      setProfile(data);
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
