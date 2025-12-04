import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-violet-500 to-purple-600 animate-ping opacity-20" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Entrando...</h2>
            <p className="text-slate-400">Preparando seu painel</p>
          </div>
          <div className="flex justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-violet-500/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 mb-4 shadow-lg shadow-violet-500/25">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            EleveaOne
          </h1>
          <p className="text-slate-400">
            Sistema de Gestao Inteligente
          </p>
        </div>

        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl shadow-black/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center text-white">
              {isLogin ? "Bem-vindo de volta" : "Criar conta"}
            </CardTitle>
            <CardDescription className="text-center text-slate-400">
              {isLogin ? "Entre com suas credenciais" : "Preencha os dados abaixo"}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required={!isLogin}
                      className="pl-10 bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                      data-testid="input-name"
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="pl-10 bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                    data-testid="input-email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="pl-10 pr-10 bg-slate-900/50 border-slate-600/50 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20 transition-all"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold py-5 rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
                  className="w-full text-sm text-slate-400 hover:text-violet-400 transition-colors"
                  data-testid="link-forgot-password"
                >
                  Esqueci minha senha
                </button>
              )}
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-800/50 px-2 text-slate-500">ou</span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setFormData({ ...formData, password: "", name: "" });
                }}
                className="w-full text-sm text-slate-400 hover:text-white transition-colors py-2"
                data-testid="button-toggle-mode"
              >
                {isLogin ? (
                  <>Nao tem conta? <span className="text-violet-400 font-medium">Cadastre-se</span></>
                ) : (
                  <>Ja tem conta? <span className="text-violet-400 font-medium">Faca login</span></>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
        
        <p className="text-center text-slate-500 text-xs mt-6">
          2024 EleveaOne. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Auth;
