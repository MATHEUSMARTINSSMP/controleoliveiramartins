import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, KeyRound, Bell, DollarSign, Settings, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialDashboard } from "@/components/admin/CommercialDashboard";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { StorePerformanceReports } from "@/components/admin/StorePerformanceReports";
import { WhatsAppNotificationConfig } from "@/components/admin/WhatsAppNotificationConfig";
import { GoalsTracking } from "@/components/admin/GoalsTracking";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AdminDashboard = () => {
  const { profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pendingAdiantamentos, setPendingAdiantamentos] = useState(0);

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      } else {
        // Buscar adiantamentos pendentes
        fetchPendingAdiantamentos();
        // Atualizar a cada 30 segundos
        const interval = setInterval(fetchPendingAdiantamentos, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [profile, loading, navigate]);

  const fetchPendingAdiantamentos = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .select("id")
        .eq("status", "PENDENTE");

      if (error) {
        console.error("Erro ao buscar adiantamentos pendentes:", error);
        return;
      }

      setPendingAdiantamentos(data?.length || 0);
    } catch (error) {
      console.error("Erro ao buscar adiantamentos pendentes:", error);
    }
  };

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
    navigate("/");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="mb-6">
          <img src="/elevea.png" alt="EleveaOne" className="h-16 w-auto animate-pulse max-w-[200px]" />
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <header className="bg-card/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50 shadow-[var(--shadow-card)]">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dashboard Admin
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground break-words">Bem-vindo, {profile.name}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto items-center">
            {/* Badge de notificação de adiantamentos pendentes */}
            {pendingAdiantamentos > 0 && (
              <Button
                variant="outline"
                onClick={() => navigate("/admin/adiantamentos")}
                className="border-orange-500/50 bg-orange-50 hover:bg-orange-100 text-orange-700 hover:text-orange-800 text-xs sm:text-sm flex-1 sm:flex-initial relative"
                size="sm"
              >
                <Bell className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Adiantamentos</span>
                <span className="sm:hidden">Adiant.</span>
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold animate-pulse"
                >
                  {pendingAdiantamentos > 99 ? '99+' : pendingAdiantamentos}
                </Badge>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setPasswordDialog(true)}
              className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
              size="sm"
            >
              <KeyRound className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Alterar Senha</span>
              <span className="sm:hidden">Senha</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
              size="sm"
            >
              <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Tabs defaultValue="comercial" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-[600px] bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="comercial" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Comercial & Metas</span>
              <span className="sm:hidden">Comercial</span>
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Financeiro & RH</span>
              <span className="sm:hidden">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comercial" className="space-y-4 sm:space-y-6 animate-in fade-in-50 duration-500">
            {/* Botões de Ação Rápida Comercial */}
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <Button
                onClick={() => navigate("/admin/metas")}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md text-xs sm:text-sm flex-1 sm:flex-initial"
                size="sm"
              >
                <span className="hidden sm:inline">Gerenciar Metas</span>
                <span className="sm:hidden">Metas</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/bonus")}
                className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                size="sm"
              >
                <span className="hidden sm:inline">Gerenciar Bônus</span>
                <span className="sm:hidden">Bônus</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/relatorios")}
                className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                size="sm"
              >
                <span className="hidden sm:inline">Relatórios</span>
                <span className="sm:hidden">Relatórios</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/benchmarks")}
                className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                size="sm"
              >
                <span className="hidden sm:inline">Benchmarks</span>
                <span className="sm:hidden">Benchmarks</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/metas-semanais")}
                className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                size="sm"
              >
                <span className="hidden sm:inline">Gincanas Semanais</span>
                <span className="sm:hidden">Semanais</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/colaboradores")}
                className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                size="sm"
              >
                <span className="hidden sm:inline">Colaboradoras & Lojas</span>
                <span className="sm:hidden">Perfis</span>
              </Button>
            </div>

            <CommercialDashboard />

            {/* Relatórios de Performance por Loja */}
            <StorePerformanceReports />

            {/* Acompanhamento de Metas */}
            <GoalsTracking />
          </TabsContent>

          <TabsContent value="financeiro" className="animate-in fade-in-50 duration-500">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="configuracoes" className="animate-in fade-in-50 duration-500 space-y-4 sm:space-y-6">
            <WhatsAppNotificationConfig />
            
            {/* Integrações ERP */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                  Integrações ERP
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Configure integrações ERP por loja (Tiny, Bling, Microvix, Conta Azul, etc)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate("/admin/erp-integrations")}
                  variant="outline"
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  <ExternalLink className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Gerenciar Integrações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-xs sm:text-sm">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="text-xs sm:text-sm"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs sm:text-sm">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="text-xs sm:text-sm"
                placeholder="Digite novamente"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-3 sm:pt-4">
              <Button variant="outline" onClick={() => setPasswordDialog(false)} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                Cancelar
              </Button>
              <Button onClick={handleChangePassword} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
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
