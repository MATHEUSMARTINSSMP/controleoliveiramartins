import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShoppingBag, Loader2, Database } from "lucide-react";
import { StoreLogo } from "@/lib/storeLogo";

const ERPLogin = () => {
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
      // User is already logged in, check role and redirect
      console.log("[ERPLogin] User already logged in, checking role:", profile.role);
      if (profile.role === "ADMIN" || profile.role === "LOJA") {
        navigate("/erp/dashboard", { replace: true });
      } else {
        // User doesn't have permission for ERP, redirect to main login
        navigate("/", { replace: true });
      }
    }
  }, [profile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Safety timeout: reset loading after 15 seconds maximum
    const safetyTimeout = setTimeout(() => {
      console.warn("[ERPLogin] Safety timeout reached (15s), resetting loading state");
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
        await new Promise(resolve => setTimeout(resolve, 300));

        // Wait for profile to load and check role
        const checkProfileAndRedirect = async () => {
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: profileData } = await supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .maybeSingle();
              
              if (profileData) {
                if (profileData.role === "ADMIN" || profileData.role === "LOJA") {
                  navigate("/erp/dashboard", { replace: true });
                  return;
                } else {
                  await supabase.auth.signOut();
                  toast.error("Acesso negado. Apenas administradores e gestores podem acessar o ERP.");
                  return;
                }
              }
            }
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          // If profile not loaded after max attempts, redirect to main login
          navigate("/", { replace: true });
        };
        
        checkProfileAndRedirect();
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: "COLABORADORA",
            },
            emailRedirectTo: `${window.location.origin}/erp/login`,
          },
        });
        if (error) throw error;
        toast.success("Cadastro realizado com sucesso! Verifique seu email.");
        clearTimeout(safetyTimeout);
        setLoading(false);
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
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
              <Database className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ERP Dashboard
          </CardTitle>
          <CardDescription>
            Sistema de relatórios e inteligência comercial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={loading}
                  required={!isLogin}
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
                disabled={loading}
                required
                autoComplete="email"
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
                disabled={loading}
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Entrando..." : "Criando conta..."}
                </>
              ) : (
                <>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  {isLogin ? "Entrar" : "Criar conta"}
                </>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
              disabled={loading}
            >
              {isLogin
                ? "Não tem uma conta? Criar conta"
                : "Já tem uma conta? Fazer login"}
            </button>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Acesso restrito para administradores e gestores de loja
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ERPLogin;

