import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const Auth = () => {
  const { profile, loading: authLoading, user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const navigate = useNavigate();

  const redirectToDashboard = useCallback((userProfile: typeof profile) => {
    if (!userProfile) return;

    setIsRedirecting(true);

    const targetPath = userProfile.role === "LOJA"
      ? "/loja"
      : userProfile.role === "ADMIN"
        ? "/admin"
        : "/me";

    console.log("[Auth] Redirecting to:", targetPath);

    setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 300);
  }, [navigate]);

  useEffect(() => {
    if (!authLoading && profile && user) {
      console.log("[Auth] User already authenticated, redirecting...");
      redirectToDashboard(profile);
    }
  }, [profile, authLoading, user, redirectToDashboard]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Email ou senha incorretos");
          }
          throw error;
        }

        if (!data.user) {
          throw new Error("Erro ao fazer login");
        }

        toast.success("Login realizado com sucesso!");

        const fetchProfileAndRedirect = async (userId: string, attempts = 0): Promise<void> => {
          const maxAttempts = 10;

          try {
            const { data: profileData, error: profileError } = await supabase
              .schema("sistemaretiradas")
              .from("profiles")
              .select("*")
              .eq("id", userId)
              .maybeSingle();

            if (profileError) {
              console.error("[Auth] Error fetching profile:", profileError);
              if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return fetchProfileAndRedirect(userId, attempts + 1);
              }
              throw profileError;
            }

            if (!profileData) {
              if (attempts < maxAttempts) {
                console.log("[Auth] Profile not found yet, retrying... attempt", attempts + 1);
                await new Promise(resolve => setTimeout(resolve, 500));
                return fetchProfileAndRedirect(userId, attempts + 1);
              }
              throw new Error("Perfil não encontrado");
            }

            console.log("[Auth] Profile loaded:", profileData.role);

            setIsRedirecting(true);

            const targetPath = profileData.role === "LOJA"
              ? "/loja"
              : profileData.role === "ADMIN"
                ? "/admin"
                : "/me";

            setTimeout(() => {
              navigate(targetPath, { replace: true });
            }, 300);

          } catch (err) {
            console.error("[Auth] Failed to fetch profile:", err);
            throw err;
          }
        };

        await fetchProfileAndRedirect(data.user.id);

      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email.trim().toLowerCase(),
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

        toast.success("Cadastro realizado! Verifique seu email para confirmar.");
        setIsLogin(true);
        setFormData({ ...formData, password: "" });
      }
    } catch (error: any) {
      console.error("[Auth] Error:", error);
      toast.error(error.message || "Erro ao processar solicitação");
    } finally {
      setLoading(false);
    }
  };

  if (isRedirecting || (!authLoading && profile && user)) {
    return (
      <div className="page-container flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4 relative z-10"
        >
          <div className="w-12 h-12 mx-auto border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Entrando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-container flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Orbs animados - roxo no dark, dourado no light */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-500/15 dark:bg-violet-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-1/4 -right-20 w-96 h-96 bg-orange-400/12 dark:bg-purple-500/18 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 15, 0],
            y: [0, 15, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <img 
              src="/elevea.png" 
              alt="EleveaOne" 
              className="h-24 w-auto"
            />
          </div>
          <p className="text-muted-foreground">
            Sistema de Gestao Inteligente
          </p>
        </div>

        <Card className="shadow-sm border">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">
              {isLogin ? "Bem-vindo de volta" : "Criar conta"}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin ? "Entre com suas credenciais" : "Preencha os dados abaixo"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required={!isLogin}
                      className="pl-10"
                      data-testid="input-name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="pl-10"
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="........"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="pl-10 pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <LoadingButton
                type="submit"
                isLoading={loading}
                loadingText="Processando..."
                successText="Sucesso!"
                className="w-full"
                data-testid="button-submit"
              >
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? "Entrar" : "Criar conta"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </LoadingButton>
            </form>

            <div className="mt-6 space-y-3">
              {isLogin && (
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-forgot-password"
                >
                  Esqueci minha senha
                </button>
              )}

            </div>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground/60 text-xs mt-6">
          2024 EleveaOne. Todos os direitos reservados.
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
