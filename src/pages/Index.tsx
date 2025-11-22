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

    // Monitor for stuck loading state
    // If loading is true for more than 12 seconds with a user but no profile, force redirect
    if (loading && user && !profile) {
      const stuckLoadingTimeout = setTimeout(() => {
        if (!redirectAttempted.current && loading && user && !profile) {
          console.error("[Index] ⚠️ Loading stuck for 12s with user but no profile, forcing redirect to login");
          redirectAttempted.current = true;
          navigate("/", { replace: true });
        }
      }, 12000);

      return () => clearTimeout(stuckLoadingTimeout);
    }

    // Maximum timeout to prevent infinite loading (15 seconds)
    // Force redirect even if loading is still true
    const maxTimeout = setTimeout(() => {
      if (!redirectAttempted.current) {
        console.log("[Index] ⚠️ Maximum timeout reached (15s), forcing redirect");
        redirectAttempted.current = true;
        if (user && !profile) {
          // User has session but no profile after 15s - redirect to login
          console.log("[Index] User session exists but profile not loaded, redirecting to login");
          navigate("/", { replace: true });
        } else if (!user) {
          // No user session - redirect to login
          navigate("/", { replace: true });
        } else if (profile) {
          // Profile loaded - redirect to dashboard
          if (profile.role === "LOJA") {
            navigate("/loja", { replace: true });
          } else if (profile.role === "ADMIN") {
            navigate("/admin", { replace: true });
          } else {
            navigate("/me", { replace: true });
          }
        }
      }
    }, 15000);

    // Only redirect when loading is complete
    if (!loading) {
      console.log("[Index] Not loading anymore");
      clearTimeout(maxTimeout);

      // Check if user has active session
      const hasSession = user !== null;

      if (!hasSession) {
        console.log("[Index] No session found, redirecting to /");
        redirectAttempted.current = true;
        navigate("/", { replace: true });
        return;
      }

      // If user has session but no profile yet, wait a bit more
      if (!profile) {
        console.log("[Index] User has session but no profile yet, waiting...");
        // Give a bit more time for profile to load (max 5 seconds)
        const profileTimeout = setTimeout(() => {
          if (!redirectAttempted.current && !profile) {
            console.log("[Index] Still no profile after 5s timeout, redirecting to login");
            redirectAttempted.current = true;
            navigate("/", { replace: true });
          }
        }, 5000);

        return () => {
          clearTimeout(profileTimeout);
          clearTimeout(maxTimeout);
        };
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

    return () => {
      clearTimeout(maxTimeout);
    };
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
        <div className="mb-6 flex justify-center">
          <img src="/elevea.png" alt="EleveaOne" className="h-16 w-auto animate-pulse max-w-[200px]" />
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
