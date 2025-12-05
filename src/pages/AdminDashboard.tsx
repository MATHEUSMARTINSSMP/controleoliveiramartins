import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, KeyRound, Bell, Settings, ExternalLink, BarChart, TrendingUp, Package, Brain, Gift, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ERPDashboard from "@/pages/erp/ERPDashboard";
import CategoryReports from "@/pages/erp/CategoryReports";
import ProductSalesIntelligence from "@/pages/erp/ProductSalesIntelligence";
import CustomerIntelligence from "@/pages/erp/CustomerIntelligence";
import CashbackManagement from "@/pages/erp/CashbackManagement";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialDashboard } from "@/components/admin/CommercialDashboard";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { StorePerformanceReports } from "@/components/admin/StorePerformanceReports";
import { WhatsAppNotificationConfig } from "@/components/admin/WhatsAppNotificationConfig";
import { GoalsTracking } from "@/components/admin/GoalsTracking";
import { CashbackStoreConfig } from "@/components/admin/CashbackStoreConfig";
import { CRMStoreConfig } from "@/components/admin/CRMStoreConfig";
import { ModulesStoreConfig } from "@/components/admin/ModulesStoreConfig";
import { CRMManagement } from "@/components/admin/CRMManagement";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminPendingAdiantamentos } from "@/hooks/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";

const AdminDashboard = () => {
  const { profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  
  const { data: pendingAdiantamentos = 0 } = useAdminPendingAdiantamentos();

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      }
    }
  }, [profile, loading, navigate]);

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("As senhas nao coincidem");
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-12 h-12 mx-auto border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold">Dashboard Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            {pendingAdiantamentos > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/adiantamentos")}
                className="relative text-xs"
              >
                <Bell className="h-4 w-4 mr-1" />
                Adiantamentos
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {pendingAdiantamentos > 99 ? '99+' : pendingAdiantamentos}
                </Badge>
              </Button>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPasswordDialog(true)}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Tabs defaultValue="gestao-metas" className="space-y-6">
            <TabsList className="w-full grid grid-cols-5 h-9 max-w-4xl">
              <TabsTrigger value="gestao-metas" className="text-xs">
                <span className="hidden sm:inline">Gestao de Metas</span>
                <span className="sm:hidden">Metas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-pessoas" className="text-xs">
                <span className="hidden sm:inline">Gestao de Pessoas</span>
                <span className="sm:hidden">Pessoas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-sistemas" className="text-xs">
                <span className="hidden sm:inline">Gestao de Sistemas</span>
                <span className="sm:hidden">Sistemas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-crm" className="text-xs">
                <span className="hidden sm:inline">Gestao CRM</span>
                <span className="sm:hidden">CRM</span>
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="text-xs">
                <span className="hidden sm:inline">Configuracoes</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gestao-metas" className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => navigate("/admin/metas")}
                  size="sm"
                >
                  <span className="hidden sm:inline">Gerenciar Metas</span>
                  <span className="sm:hidden">Metas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/bonus")}
                  size="sm"
                >
                  <span className="hidden sm:inline">Gerenciar Bonus</span>
                  <span className="sm:hidden">Bonus</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/relatorios")}
                >
                  Relatorios
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/benchmarks")}
                >
                  Benchmarks
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/colaboradores")}
                >
                  <span className="hidden sm:inline">Colaboradoras & Lojas</span>
                  <span className="sm:hidden">Perfis</span>
                </Button>
              </div>

              <CommercialDashboard />
              <StorePerformanceReports />
              <GoalsTracking />
            </TabsContent>

            <TabsContent value="gestao-pessoas" className="animate-fade-in space-y-4 sm:space-y-6">
              <div className="flex flex-wrap gap-2 sm:gap-4">
                <Button
                  onClick={() => navigate("/admin/colaboradores")}
                  className="btn-futuristic text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
                >
                  <span className="hidden sm:inline">Colaboradoras & Lojas</span>
                  <span className="sm:hidden">Perfis</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/adiantamentos")}
                  className="border-primary/30 text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
                >
                  Adiantamentos
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/lancamentos")}
                  className="border-primary/30 text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
                >
                  Lancamentos
                </Button>
              </div>
              <FinancialDashboard />
            </TabsContent>
            
            <TabsContent value="gestao-sistemas" className="animate-fade-in space-y-4 sm:space-y-6">
              <Tabs defaultValue="dashboard" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5 max-w-5xl">
                  <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
                    <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="categorias" className="text-xs sm:text-sm">
                    <BarChart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Relatorios</span>
                  </TabsTrigger>
                  <TabsTrigger value="produtos" className="text-xs sm:text-sm">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Produtos</span>
                  </TabsTrigger>
                  <TabsTrigger value="clientes" className="text-xs sm:text-sm">
                    <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Clientes</span>
                  </TabsTrigger>
                  <TabsTrigger value="cashback" className="text-xs sm:text-sm">
                    <Gift className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Cashback</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="dashboard" className="space-y-4">
                  <ERPDashboard />
                </TabsContent>
                
                <TabsContent value="categorias" className="space-y-4">
                  <CategoryReports />
                </TabsContent>
                
                <TabsContent value="produtos" className="space-y-4">
                  <ProductSalesIntelligence />
                </TabsContent>
                
                <TabsContent value="clientes" className="space-y-4">
                  <CustomerIntelligence />
                </TabsContent>
                
                <TabsContent value="cashback" className="space-y-4">
                  <CashbackManagement />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="gestao-crm" className="animate-fade-in space-y-4 sm:space-y-6">
              <CRMManagement />
            </TabsContent>

            <TabsContent value="configuracoes" className="animate-fade-in space-y-4 sm:space-y-6">
              <WhatsAppNotificationConfig />
              <ModulesStoreConfig />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                    Integracoes ERP
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Configure integracoes ERP por loja (Tiny, Bling, Microvix, Conta Azul, etc)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => navigate("/admin/erp-integrations")}
                      variant="outline"
                      className="w-full sm:w-auto border-primary/30"
                      size="sm"
                    >
                      <ExternalLink className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Gerenciar Integracoes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
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
                placeholder="Minimo 6 caracteres"
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
              <Button onClick={handleChangePassword} className="btn-futuristic w-full sm:w-auto text-xs sm:text-sm" size="sm">
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
