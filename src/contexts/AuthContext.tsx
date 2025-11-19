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

      console.log("[AuthContext] User email:", userEmail);

      // First try to find by ID
      let { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      // If not found by ID, try by email
      if (error && error.code === 'PGRST116' && userEmail) {
        console.log("[AuthContext] Profile not found by ID, trying by email...");

        const { data: profileByEmail, error: emailError } = await supabase
          .schema("sistemaretiradas")
          .from("profiles")
          .select("*")
          .eq("email", userEmail)
          .single();

        if (!emailError && profileByEmail) {
          console.log("[AuthContext] Profile found by email! Updating ID to match auth.user.id");

          // Update profile ID to match auth user ID and normalize CPF
          const { error: updateError } = await supabase
            .schema("sistemaretiradas")
            .from("profiles")
            .update({
              id: userId,
              cpf: normalizeCPF(profileByEmail.cpf || "")
            })
            .eq("email", userEmail);

          if (updateError) {
            console.error("[AuthContext] Error updating profile ID:", updateError);
          } else {
            console.log("[AuthContext] Profile ID updated successfully");
            data = { ...profileByEmail, id: userId, cpf: normalizeCPF(profileByEmail.cpf || "") };
          }
        } else {
          // Last attempt: try to find by user metadata (if CPF was stored there)
          const userCPF = user?.user_metadata?.cpf;
          if (userCPF) {
            console.log("[AuthContext] Email not found, trying by CPF from metadata...");

            const normalizedCPF = normalizeCPF(userCPF);
            const { data: profileByCPF, error: cpfError } = await supabase
              .schema("sistemaretiradas")
              .from("profiles")
              .select("*")
              .eq("cpf", normalizedCPF)
              .single();

            if (!cpfError && profileByCPF) {
              console.log("[AuthContext] Profile found by CPF! Updating ID and email");

              // Update profile to match auth user
              const { error: updateError } = await supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .update({ id: userId, email: userEmail })
                .eq("cpf", normalizedCPF);

              if (updateError) {
                console.error("[AuthContext] Error updating profile:", updateError);
              } else {
                console.log("[AuthContext] Profile updated successfully");
                data = { ...profileByCPF, id: userId, email: userEmail };
              }
            } else {
              throw new Error("Profile not found by ID, email or CPF");
            }
          } else {
            throw new Error("Profile not found by ID or email");
          }
        }
      } else if (error) {
        console.error("[AuthContext] Error fetching profile:", error);
        throw error;
      }

      console.log("[AuthContext] Profile loaded successfully:", data);
      console.log("[AuthContext] User role:", data?.role);
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
