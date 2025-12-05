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
      <div className="page-container flex flex-col items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="floating-orb w-96 h-96 top-1/4 left-1/4"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="floating-orb-2 w-80 h-80 bottom-1/4 right-1/4"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 text-center space-y-6"
        >
          <motion.div 
            className="w-20 h-20 mx-auto rounded-2xl gradient-primary glow flex items-center justify-center shadow-2xl"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </motion.div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Carregando</h2>
            <p className="text-muted-foreground">Preparando painel administrativo</p>
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
    <div className="page-container">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="floating-orb w-[600px] h-[600px] -top-64 -left-64 opacity-50"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="floating-orb-2 w-[500px] h-[500px] -bottom-32 -right-32 opacity-40"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <header className="header-futuristic border-b border-primary/10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold gradient-text">
              Dashboard Admin
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground break-words">Bem-vindo, {profile.name}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto items-center flex-wrap">
            <ThemeToggle />
            {pendingAdiantamentos > 0 && (
              <Button
                variant="outline"
                onClick={() => navigate("/admin/adiantamentos")}
                className="border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs sm:text-sm flex-1 sm:flex-initial relative"
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
              className="border-primary/20 text-xs sm:text-sm flex-1 sm:flex-initial"
              size="sm"
            >
              <KeyRound className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Alterar Senha</span>
              <span className="sm:hidden">Senha</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-primary/20 text-xs sm:text-sm flex-1 sm:flex-initial"
              size="sm"
            >
              <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Tabs defaultValue="gestao-metas" className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-5 max-w-5xl glass-card p-1 rounded-xl">
              <TabsTrigger value="gestao-metas" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-sm">
                <span className="hidden sm:inline">Gestao de Metas</span>
                <span className="sm:hidden">Metas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-pessoas" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-sm">
                <span className="hidden sm:inline">Gestao de Pessoas</span>
                <span className="sm:hidden">Pessoas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-sistemas" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-sm">
                <span className="hidden sm:inline">Gestao de Sistemas</span>
                <span className="sm:hidden">Sistemas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-crm" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-sm">
                <span className="hidden sm:inline">Gestao CRM</span>
                <span className="sm:hidden">CRM</span>
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:glow-sm">
                <span className="hidden sm:inline">Configuracoes</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gestao-metas" className="space-y-4 sm:space-y-6 animate-fade-in">
              <div className="flex flex-wrap gap-2 sm:gap-4">
                <Button
                  onClick={() => navigate("/admin/metas")}
                  className="btn-futuristic text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
                >
                  <span className="hidden sm:inline">Gerenciar Metas</span>
                  <span className="sm:hidden">Metas</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/bonus")}
                  className="border-primary/30 text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
                >
                  <span className="hidden sm:inline">Gerenciar Bonus</span>
                  <span className="sm:hidden">Bonus</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/relatorios")}
                  className="border-primary/30 text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
                >
                  Relatorios
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/benchmarks")}
                  className="border-primary/30 text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
                >
                  Benchmarks
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/colaboradores")}
                  className="border-primary/30 text-xs sm:text-sm flex-1 sm:flex-initial"
                  size="sm"
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
                <TabsList className="grid w-full grid-cols-5 max-w-5xl glass-card p-1 rounded-xl">
                  <TabsTrigger value="dashboard" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
                    <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="categorias" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
                    <BarChart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Relatorios</span>
                  </TabsTrigger>
                  <TabsTrigger value="produtos" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Produtos</span>
                  </TabsTrigger>
                  <TabsTrigger value="clientes" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
                    <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Clientes</span>
                  </TabsTrigger>
                  <TabsTrigger value="cashback" className="rounded-lg text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground">
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
              
              <Card className="glass-card border-primary/20">
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
        <DialogContent className="glass-card max-w-[95vw] sm:max-w-md">
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
