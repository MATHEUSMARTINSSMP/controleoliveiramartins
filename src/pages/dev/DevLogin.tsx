import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Code } from "lucide-react";
import { toast } from "sonner";

const DevLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error("Preencha email e senha");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      // Verificar se é o usuário dev@dev.com
      if (data.user?.email !== "dev@dev.com") {
        await supabase.auth.signOut();
        toast.error("Acesso restrito. Apenas usuário dev@dev.com autorizado.");
        return;
      }

      // Aguardar um pouco para o AuthContext processar
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verificar se o profile existe e é ADMIN
      const { data: profile, error: profileError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Erro ao buscar profile:", profileError);
        await supabase.auth.signOut();
        toast.error("Erro ao buscar perfil. Tente novamente.");
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        toast.error("Perfil não encontrado. Execute a migration para criar o profile.");
        return;
      }

      // Verificar se é ADMIN
      if (profile.role !== "ADMIN") {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Perfil não tem permissão de ADMIN.");
        return;
      }

      // Redirecionar para painel dev
      toast.success("Login realizado com sucesso!");
      navigate("/dev/erp-config", { replace: true });
    } catch (error: any) {
      console.error("Erro no login:", error);
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-md border-purple-500/20 bg-slate-900/50 backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
              <Code className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Painel Dev</CardTitle>
          <CardDescription className="text-slate-400">
            Acesso restrito para desenvolvedores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="dev@dev.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={loading}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-xs text-slate-500">
              Apenas usuário dev@dev.com tem acesso
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DevLogin;

