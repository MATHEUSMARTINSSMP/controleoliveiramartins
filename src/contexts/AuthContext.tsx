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

      console.log("[AuthContext] Searching profile by email:", userEmail);

      // SIMPLIFIED: Search ONLY by email
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

      if (error) {
        console.error("[AuthContext] Error fetching profile by email:", error);
        throw error;
      }

      if (!data) {
        console.error("[AuthContext] No profile found for email:", userEmail);
        console.log("[AuthContext] Auto-signing out to clear broken session...");

        // Auto sign out if profile not found (broken session)
        await supabase.auth.signOut();

        throw new Error("Profile not found for email: " + userEmail);
      }

      console.log("[AuthContext] Profile found by email:", data);
      console.log("[AuthContext] User role:", data.role);

      // Update profile ID to match auth user ID if different
      if (data.id !== userId) {
        console.log("[AuthContext] ID mismatch! Updating profile ID from", data.id, "to", userId);

        const { error: updateError } = await supabase
          .schema("sistemaretiradas")
          .from("profiles")
          .update({ id: userId })
          .eq("email", userEmail);

        if (updateError) {
          console.error("[AuthContext] Failed to update ID:", updateError);
        } else {
          console.log("[AuthContext] ID updated successfully");
          data.id = userId;
        }
      }

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
