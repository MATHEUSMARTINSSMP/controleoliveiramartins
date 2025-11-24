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
    // Prevent multiple redirects - if already redirected, don't run again
    if (redirectAttempted.current) {
      return;
    }

    // Don't do anything while still loading auth
    if (loading) {
      return;
    }

    console.log("[Index] Effect triggered - loading:", loading, "profile:", profile, "user:", user);

    // If no user session, redirect to login immediately
    if (!user) {
      console.log("[Index] No session found, redirecting to /");
      redirectAttempted.current = true;
      navigate("/", { replace: true });
      return;
    }

    // If user has session but no profile yet
    if (!profile) {
      console.log("[Index] User has session but no profile yet, waiting...");

      // Force redirect to login if profile takes too long (5s)
      // This handles cases where profile fetch failed silently or returned null
      const profileTimeout = setTimeout(() => {
        if (!redirectAttempted.current && !profile) {
          console.log("[Index] Still no profile after timeout, redirecting to login to retry");
          redirectAttempted.current = true;
          navigate("/", { replace: true });
        }
      }, 5000);

      return () => clearTimeout(profileTimeout);
    }

    // Profile loaded, redirect based on role (only once)
    if (!redirectAttempted.current && profile) {
      console.log("[Index] Profile loaded, redirecting based on role:", profile.role);
      redirectAttempted.current = true;

      if (profile.role === "LOJA") {
        navigate("/loja", { replace: true });
      } else if (profile.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/me", { replace: true });
      }
    }
  }, [profile, loading, user, navigate]);

  // Reset redirect flag only when user is explicitly null (not during loading)
  useEffect(() => {
    if (!loading && user === null && !profile) {
      redirectAttempted.current = false;
    }
  }, [user, loading, profile]);

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
