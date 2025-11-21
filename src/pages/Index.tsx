import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingBag } from "lucide-react";

const Index = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[Index] Effect triggered - loading:", loading, "profile:", profile);

    if (!loading) {
      console.log("[Index] Not loading anymore");

      if (!profile) {
        console.log("[Index] No profile found, redirecting to /auth");
        navigate("/auth");
      } else if (profile.store_default && profile.role === "ADMIN") {
        // Usuário de LOJA (tem store_default definido)
        console.log("[Index] Store user detected, redirecting to /loja");
        navigate("/loja");
      } else if (profile.role === "ADMIN") {
        // ADMIN sem store_default = Oliveira (admin real)
        console.log("[Index] Admin role detected, redirecting to /admin");
        navigate("/admin");
      } else {
        console.log("[Index] Colaboradora role detected, redirecting to /me");
        navigate("/me");
      }
    } else {
      console.log("[Index] Still loading, waiting...");
    }
  }, [profile, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="text-center">
        <div className="inline-block p-6 rounded-full bg-gradient-to-br from-primary to-accent mb-6 animate-pulse">
          <ShoppingBag className="w-16 h-16 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
          Dashboard de Compras
        </h1>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

export default Index;
