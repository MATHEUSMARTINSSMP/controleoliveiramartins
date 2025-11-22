import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShoppingBag, Loader2 } from "lucide-react";
import { StoreLogo } from "@/lib/storeLogo";

const Auth = () => {
  const { profile, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const navigate = useNavigate();

  // Redirect if already logged in (only redirect once)
  useEffect(() => {
    if (!authLoading && profile) {
      // User is already logged in, redirect to appropriate dashboard
      console.log("[Auth] User already logged in, redirecting to dashboard");
      if (profile.role === "LOJA") {
        navigate("/loja", { replace: true });
      } else if (profile.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/me", { replace: true });
      }
    }
  }, [profile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Safety timeout: reset loading after 15 seconds maximum
    // Give more time for fetchProfile to complete (it has 6s timeout)
    const safetyTimeout = setTimeout(() => {
      console.warn("[Auth] Safety timeout reached (15s), resetting loading state");
      setLoading(false);
    }, 15000);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        
        toast.success("Login realizado com sucesso!");
        clearTimeout(safetyTimeout);
        
        // Reset loading before navigation
        setLoading(false);

        // Give AuthContext a moment to process the auth state change
        // The Index page will handle waiting for profile to load
        await new Promise(resolve => setTimeout(resolve, 300));

        // Navigate to home, Index will handle the routing after profile loads
        navigate("/home", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: "COLABORADORA",
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast.success("Cadastro realizado com sucesso!");
        clearTimeout(safetyTimeout);
        
        // Reset loading before navigation
        setLoading(false);
        
        navigate("/home", { replace: true });
      }
    } catch (error: any) {
      clearTimeout(safetyTimeout);
      toast.error(error.message || "Erro ao processar solicitação");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <Card className="w-full max-w-md backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
        <CardHeader className="space-y-2">
          <div className="flex justify-center mb-4 gap-2">
            {/* Mostrar as 3 logos no login */}
            <StoreLogo storeId="5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b" className="w-16 h-16 object-contain" />
            <StoreLogo storeId="c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3" className="w-16 h-16 object-contain" />
            <StoreLogo storeId="cee7d359-0240-4131-87a2-21ae44bd1bb4" className="w-16 h-16 object-contain" />
          </div>
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold">
            Dashboard de Gestão
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin ? "Entre com suas credenciais" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required={!isLogin}
                  className="transition-all focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="transition-all focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="transition-all focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-md hover:shadow-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : isLogin ? (
                "Entrar"
              ) : (
                "Cadastrar"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-primary hover:text-accent transition-colors block mb-2"
            >
              Esqueci minha senha
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-accent transition-colors"
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
