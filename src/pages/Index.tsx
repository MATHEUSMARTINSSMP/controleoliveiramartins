import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { profile, loading, user } = useAuth();
  const navigate = useNavigate();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    // Prevent multiple redirects
    if (redirectAttempted.current) {
      return;
    }

    console.log("[Index] Effect triggered - loading:", loading, "profile:", profile, "user:", user);

    // Only redirect when loading is complete
    if (!loading) {
      console.log("[Index] Not loading anymore");

      // Check if user has active session
      const hasSession = user !== null;

      if (!hasSession) {
        console.log("[Index] No session found, redirecting to /auth");
        redirectAttempted.current = true;
        navigate("/auth", { replace: true });
        return;
      }

      // If user has session but no profile yet, wait a bit more
      if (!profile) {
        console.log("[Index] User has session but no profile yet, waiting...");
        // Give a bit more time for profile to load
        const timeout = setTimeout(() => {
          if (!profile) {
            console.log("[Index] Still no profile after timeout, redirecting to /auth");
            redirectAttempted.current = true;
            navigate("/auth", { replace: true });
          }
        }, 2000);

        return () => clearTimeout(timeout);
      }

      // Profile loaded, redirect based on role
      console.log("[Index] Profile loaded, redirecting based on role:", profile.role);
      redirectAttempted.current = true;

      if (profile.role === "LOJA") {
        navigate("/loja", { replace: true });
      } else if (profile.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/me", { replace: true });
      }
    } else {
      console.log("[Index] Still loading, waiting...");
    }
  }, [profile, loading, user, navigate]);

  // Reset redirect flag when user/profile changes significantly
  useEffect(() => {
    if (!loading && user === null) {
      redirectAttempted.current = false;
    }
  }, [user, loading]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="text-center">
        <div className="mb-8 flex justify-center">
          <img src="/elevea.png" alt="EleveaOne" className="h-20 w-auto animate-pulse" />
        </div>
        <div className="inline-block p-6 rounded-full bg-gradient-to-br from-primary to-accent mb-6 animate-pulse">
          <ShoppingBag className="w-16 h-16 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
          Dashboard de Gestão
        </h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

export default Index;
