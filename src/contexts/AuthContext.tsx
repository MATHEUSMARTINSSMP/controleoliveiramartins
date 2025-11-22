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
    // Prevent duplicate calls for the same user
    if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
      console.log("[AuthContext] Already fetching profile for this user, skipping...");
      return;
    }

    // If fetching for a different user, wait a bit
    if (isFetchingProfileRef.current && currentUserIdRef.current !== userId) {
      console.log("[AuthContext] Waiting for previous fetch to complete...");
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (isFetchingProfileRef.current && currentUserIdRef.current === userId) {
      return;
    }

    console.log("[AuthContext] Fetching profile for userId:", userId);
    isFetchingProfileRef.current = true;
    currentUserIdRef.current = userId;
    setLoading(true);

    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      if (!userEmail) {
        console.error("[AuthContext] No email found for user");
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      console.log("[AuthContext] Searching for profile with email (case-insensitive):", userEmail);

      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .ilike("email", userEmail) // Case-insensitive search
        .maybeSingle();

      if (error) {
        console.error("[AuthContext] Error fetching profile by email:", error);
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      if (!data) {
        console.error("[AuthContext] ❌ NO PROFILE FOUND for email:", userEmail);
        console.error("[AuthContext] This means the profile doesn't exist or email doesn't match");
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
        setProfile(null);
        setLoading(false);
        isFetchingProfileRef.current = false;
        currentUserIdRef.current = null;
        return;
      }

      console.log("[AuthContext] Setting profile state...");
      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.error("[AuthContext] Error in fetchProfile:", error);
      setProfile(null);
      setLoading(false);
    } finally {
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
          // Skip if we're already fetching for this user
          if (isFetchingProfileRef.current && currentUserIdRef.current === session.user.id) {
            console.log("[AuthContext] Already fetching profile for this user, skipping...");
            return;
          }

          // Reset loading state and fetch profile
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
