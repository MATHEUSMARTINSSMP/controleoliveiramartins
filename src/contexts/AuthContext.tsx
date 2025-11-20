import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCPF } from "@/lib/cpf";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "COLABORADORA";
  store_default: string | null;
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    console.log("[AuthContext] Fetching profile for userId:", userId);
    try {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      if (!userEmail) {
        console.error("[AuthContext] No email found for user");
        throw new Error("No email found");
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
        throw error;
      }

      if (!data) {
        console.error("[AuthContext] ❌ NO PROFILE FOUND for email:", userEmail);
        console.error("[AuthContext] This means the profile doesn't exist or email doesn't match");
        throw new Error("Profile not found for email: " + userEmail);
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
        throw new Error("Profile ID mismatch - contact admin");
      }

      console.log("[AuthContext] Setting profile state...");
      setProfile(data);
    } catch (error) {
      console.error("[AuthContext] Error in fetchProfile:", error);
      setProfile(null);
    } finally {
      setLoading(false);
      console.log("[AuthContext] Loading set to false");
    }
  };

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
