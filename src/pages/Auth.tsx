import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8 z-10"
        >
          <motion.div 
            className="relative"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div 
              className="w-24 h-24 mx-auto rounded-2xl gradient-primary glow flex items-center justify-center shadow-2xl"
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-12 h-12 text-primary-foreground" />
            </motion.div>
          </motion.div>
          <div className="space-y-3">
            <motion.h2 
              className="text-3xl font-bold text-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Entrando
            </motion.h2>
            <motion.p 
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Preparando seu painel
            </motion.p>
          </div>
          <motion.div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 rounded-full gradient-primary"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent/10 to-transparent rounded-full blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], rotate: [0, -5, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-1/4 right-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary mb-4 shadow-2xl glow"
            transition={{ duration: 3, repeat: Infinity }}
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </motion.div>
          <h1 className="text-4xl font-bold text-foreground mb-2 tracking-tight">
            EleveaOne
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema de Gestao Inteligente
          </p>
        </motion.div>

        <Card className="glass-card shadow-2xl">
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
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground font-semibold py-5 rounded-xl glow-sm transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                data-testid="button-submit"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {isLogin ? "Entrar" : "Criar conta"}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
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
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setFormData({ ...formData, password: "", name: "" });
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                data-testid="button-toggle-mode"
              >
                {isLogin ? (
                  <>Nao tem conta? <span className="text-primary font-medium">Cadastre-se</span></>
                ) : (
                  <>Ja tem conta? <span className="text-primary font-medium">Faca login</span></>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
        
        <motion.p 
          className="text-center text-muted-foreground/50 text-xs mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          2024 EleveaOne. Todos os direitos reservados.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Auth;
