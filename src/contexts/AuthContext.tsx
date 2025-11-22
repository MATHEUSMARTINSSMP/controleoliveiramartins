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

  const fetchProfile = useCallback(async (userId: string) => {
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
    isFetchingProfileRef.current = true;
    currentUserIdRef.current = userId;
    setLoading(true);

    // Safety timeout: if fetch takes more than 5 seconds, force completion
    const safetyTimeout = setTimeout(() => {
      if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
        console.error("[AuthContext] ⚠️ Safety timeout reached (5s), forcing loading to false");
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        setLoading(false);
        // Don't set profile to null here, let it keep what it had
      }
    }, 5000);

    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      if (!userEmail) {
        console.error("[AuthContext] No email found for user");
        clearTimeout(safetyTimeout);
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      console.log("[AuthContext] Searching for profile with email:", userEmail);

      // Try exact match first (faster), then case-insensitive if not found
      let { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();

      // If exact match not found, try case-insensitive
      if (!data && !error) {
        console.log("[AuthContext] Exact match not found, trying case-insensitive search...");
        const result = await supabase
          .schema("sistemaretiradas")
          .from("profiles")
          .select("*")
          .ilike("email", userEmail)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("[AuthContext] Error fetching profile by email:", error);
        clearTimeout(safetyTimeout);
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      if (!data) {
        console.error("[AuthContext] ❌ NO PROFILE FOUND for email:", userEmail);
        console.error("[AuthContext] This means the profile doesn't exist or email doesn't match");
        clearTimeout(safetyTimeout);
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
        clearTimeout(safetyTimeout);
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      console.log("[AuthContext] Setting profile state...");
      clearTimeout(safetyTimeout);
      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.error("[AuthContext] Error in fetchProfile:", error);
      clearTimeout(safetyTimeout);
      setProfile(null);
      setLoading(false);
    } finally {
      clearTimeout(safetyTimeout);
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

        if (session?.user) {
          // Reset loading state and fetch profile (fetchProfile will handle duplicates)
          setLoading(true);
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
          isFetchingProfileRef.current = false;
          currentUserIdRef.current = null;
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      initialSessionChecked = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setLoading(false);
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
