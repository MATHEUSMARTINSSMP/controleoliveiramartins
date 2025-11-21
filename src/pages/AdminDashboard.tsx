import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialDashboard } from "@/components/admin/CommercialDashboard";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AdminDashboard = () => {
  const { profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/auth");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      }
    }
  }, [profile, loading, navigate]);

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setPasswordDialog(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast.error("Erro ao alterar senha: " + error.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <header className="bg-card/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50 shadow-[var(--shadow-card)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dashboard Admin
            </h1>
            <p className="text-sm text-muted-foreground">Bem-vindo, {profile.name}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPasswordDialog(true)}
              className="border-primary/20 hover:bg-primary/10"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Alterar Senha
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-primary/20 hover:bg-primary/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="comercial" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="comercial" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Comercial & Metas
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Financeiro & RH
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comercial" className="space-y-6 animate-in fade-in-50 duration-500">
            {/* Botões de Ação Rápida Comercial */}
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => navigate("/admin/metas")}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md"
              >
                Gerenciar Metas
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/bonus")}
                className="border-primary/20 hover:bg-primary/10"
              >
                Gerenciar Bônus
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/relatorios")}
                className="border-primary/20 hover:bg-primary/10"
              >
                Relatórios Detalhados
              </Button>
            </div>

            <CommercialDashboard />
          </TabsContent>

          <TabsContent value="financeiro" className="animate-in fade-in-50 duration-500">
            <FinancialDashboard />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setPasswordDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
