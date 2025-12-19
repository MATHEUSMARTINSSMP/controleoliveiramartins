import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, KeyRound, Bell, Settings, ExternalLink, BarChart, TrendingUp, Package, Brain, Gift, Sparkles, MessageSquare, Clock, Users, Wallet, RefreshCw, AlertTriangle, Plus, Link2, Target } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { WhatsAppManagement } from "@/components/admin/WhatsAppManagement";
import { GoalsTracking } from "@/components/admin/GoalsTracking";
import { CashbackStoreConfig } from "@/components/admin/CashbackStoreConfig";
import { CRMStoreConfig } from "@/components/admin/CRMStoreConfig";
import { ModulesStoreConfig } from "@/components/admin/ModulesStoreConfig";
import { CRMManagement } from "@/components/admin/CRMManagement";
import { TimeClockManagement } from "@/components/timeclock/TimeClockManagement";
import { DailyGoalCheckReports } from "@/components/admin/DailyGoalCheckReports";
import { ConditionalsAdjustmentsManager } from "@/components/admin/ConditionalsAdjustmentsManager";
import GestaoMetasTab from "@/components/admin/GestaoMetasTab";
import { BillingManagement } from "@/components/admin/BillingManagement";
import { BillingAccessGuard } from "@/components/BillingAccessGuard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminPendingAdiantamentos } from "@/hooks/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";

interface UnmappedVendorInfo {
  storeId: string;
  storeName: string;
  unmappedCount: number;
  pendingOrders: number;
}

const AdminDashboard = () => {
  const { profile, signOut, loading, billingStatus } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [adminStores, setAdminStores] = useState<{ id: string; name: string }[]>([]);
  const [isReloading, setIsReloading] = useState(false);
  const [unmappedVendors, setUnmappedVendors] = useState<UnmappedVendorInfo[]>([]);

  const { data: pendingAdiantamentos = 0 } = useAdminPendingAdiantamentos();

  const handleReloadData = async () => {
    setIsReloading(true);
    try {
      await fetchAdminStores();
      window.location.reload();
    } finally {
      setIsReloading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      } else if (billingStatus && !billingStatus.has_access) {
        // Billing bloqueado - usuário pode ver mensagem mas acesso limitado
        console.warn("[AdminDashboard] Acesso bloqueado por billing:", billingStatus.reason);
      }
    }
  }, [profile, loading, billingStatus, navigate]);

  useEffect(() => {
    if (profile?.id) {
      fetchAdminStores();
    }
  }, [profile?.id]);

  const fetchAdminStores = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name')
        .eq('admin_id', profile.id)
        .order('name');

      if (error) throw error;
      setAdminStores(data || []);

      if (!data || data.length === 0) {
        // Se não tem loja, redirecionar para onboarding
        navigate("/obrigado");
        return;
      }

      if (data && data.length > 0) {
        fetchUnmappedVendors(data);
      }
    } catch (err) {
      console.error('[AdminDashboard] Erro ao buscar lojas:', err);
    }
  };

  const fetchUnmappedVendors = async (stores: { id: string; name: string }[]) => {
    const results: UnmappedVendorInfo[] = [];

    for (const store of stores) {
      try {
        const response = await fetch("/.netlify/functions/list-erp-vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store_id: store.id }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.resumo) {
            if (data.resumo.nao_mapeados > 0 || data.resumo.pedidos_sem_colaboradora > 0) {
              results.push({
                storeId: store.id,
                storeName: store.name,
                unmappedCount: data.resumo.nao_mapeados,
                pendingOrders: data.resumo.pedidos_sem_colaboradora,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[AdminDashboard] Erro ao verificar vendedores da loja ${store.name}:`, err);
      }
    }

    setUnmappedVendors(results);
  };

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
      <div className="page-container flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4 relative z-10"
        >
          <div className="w-12 h-12 mx-auto border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b relative">
        {/* Banner de Aviso de Billing - Removido conforme solicitado */}
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold">Dashboard Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReloadData}
                disabled={isReloading}
                title="Atualizar dados"
                data-testid="button-mobile-reload"
              >
                <RefreshCw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
              </Button>
            )}
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
            <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full max-w-4xl">
              <TabsTrigger value="gestao-metas" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[50px] justify-center">
                <span className="hidden sm:inline">Gestao de Metas</span>
                <span className="sm:hidden">Metas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-pessoas" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[50px] justify-center">
                <span className="hidden sm:inline">Gestao de Pessoas</span>
                <span className="sm:hidden">Pessoas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-sistemas" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[50px] justify-center">
                <span className="hidden sm:inline">Gestao de Sistemas</span>
                <span className="sm:hidden">Sistemas</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-crm" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[50px] justify-center">
                <span className="hidden sm:inline">Gestao CRM</span>
                <span className="sm:hidden">CRM</span>
              </TabsTrigger>
              <TabsTrigger value="gestao-dre" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[50px] justify-center">
                <span className="hidden sm:inline">Gestao DRE</span>
                <span className="sm:hidden">DRE</span>
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[50px] justify-center">
                <span className="hidden sm:inline">Configuracoes</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
              <TabsTrigger value="whatsapp-massa" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[50px] justify-center">
                <MessageSquare className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">WhatsApp Massa</span>
                <span className="sm:hidden">WhatsApp</span>
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
              </div>

              <CommercialDashboard />
              <StorePerformanceReports />
              <GoalsTracking />
              <DailyGoalCheckReports />
            </TabsContent>

            <TabsContent value="gestao-pessoas" className="animate-fade-in space-y-4 sm:space-y-6">
              <Tabs defaultValue="financeiro" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full max-w-2xl">
                  <TabsTrigger value="financeiro" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] justify-center" data-testid="tab-gp-financeiro">
                    <Wallet className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Financeiro</span>
                    <span className="sm:hidden">Fin.</span>
                  </TabsTrigger>
                  <TabsTrigger value="colaboradoras" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] justify-center" data-testid="tab-gp-colaboradoras">
                    <Users className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Colaboradoras</span>
                    <span className="sm:hidden">Colab.</span>
                  </TabsTrigger>
                  <TabsTrigger value="ponto" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] justify-center" data-testid="tab-gp-ponto">
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Ponto & Jornada</span>
                    <span className="sm:hidden">Ponto</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="financeiro" className="space-y-4">
                  <div className="flex flex-wrap gap-2 sm:gap-4">
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

                <TabsContent value="colaboradoras" className="space-y-4">
                  <div className="flex flex-wrap gap-2 sm:gap-4">
                    <Button
                      onClick={() => navigate("/admin/colaboradores")}
                      className="text-xs sm:text-sm flex-1 sm:flex-initial"
                      size="sm"
                    >
                      <span className="hidden sm:inline">Gerenciar Colaboradoras & Lojas</span>
                      <span className="sm:hidden">Gerenciar Perfis</span>
                    </Button>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Gestao de Colaboradoras
                      </CardTitle>
                      <CardDescription>
                        Gerencie perfis, lojas e permissoes das colaboradoras
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Acesse o gerenciamento completo de colaboradoras e lojas clicando no botao acima.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="ponto" className="space-y-4">
                  <TimeClockManagement
                    stores={adminStores}
                    showStoreSelector={adminStores.length > 1}
                    storeId={adminStores.length === 1 ? adminStores[0]?.id : undefined}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="gestao-sistemas" className="animate-fade-in space-y-4 sm:space-y-6">
              <Tabs defaultValue="dashboard" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full max-w-5xl">
                  <TabsTrigger value="dashboard" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">
                    <Package className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                  <TabsTrigger value="categorias" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">
                    <BarChart className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Relatorios</span>
                  </TabsTrigger>
                  <TabsTrigger value="produtos" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Produtos</span>
                  </TabsTrigger>
                  <TabsTrigger value="clientes" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">
                    <Brain className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Clientes</span>
                  </TabsTrigger>
                  <TabsTrigger value="config-metas" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center" data-testid="tab-gestao-metas">
                    <Target className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Metas</span>
                  </TabsTrigger>
                  <TabsTrigger value="cashback" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">
                    <Gift className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Cashback</span>
                  </TabsTrigger>
                  <TabsTrigger value="ajustes-condicionais" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">
                    <Package className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Ajustes & Condicionais</span>
                    <span className="sm:hidden">Ajustes</span>
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

                <TabsContent value="config-metas" className="space-y-4">
                  <GestaoMetasTab />
                </TabsContent>

                <TabsContent value="cashback" className="space-y-4">
                  <CashbackManagement />
                </TabsContent>

                <TabsContent value="ajustes-condicionais" className="space-y-4">
                  <ConditionalsAdjustmentsManager />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="gestao-crm" className="animate-fade-in space-y-4 sm:space-y-6">
              <CRMManagement />
            </TabsContent>

            <TabsContent value="gestao-dre" className="animate-fade-in space-y-4 sm:space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    Gestão DRE
                  </CardTitle>
                  <CardDescription>
                    Demonstração do Resultado do Exercício - Gerencie receitas, despesas e investimentos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Sistema completo de DRE com lançamentos manuais, IA para processamento de linguagem natural,
                      assistente financeiro inteligente, multi-loja e exportação Excel.
                    </p>
                    <Button onClick={() => navigate("/admin/dre")} className="w-full sm:w-auto">
                      <BarChart className="mr-2 h-4 w-4" />
                      Acessar Gestão DRE
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="whatsapp-massa" className="animate-fade-in space-y-4 sm:space-y-6">
              <BillingAccessGuard allowReadOnly>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Envio em Massa - WhatsApp
                    </CardTitle>
                    <CardDescription>
                      Envie mensagens personalizadas para múltiplos clientes de uma vez com filtros avançados e controle total
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Filtros Avançados
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Clientes que compraram há X dias</li>
                          <li>Clientes que não compram desde data</li>
                          <li>Maior faturamento (top N ou todos)</li>
                          <li>Maior ticket médio</li>
                          <li>Maior número de visitas</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Recursos
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Múltiplas variações de mensagem</li>
                          <li>Placeholders automáticos</li>
                          <li>Agendamento de envios</li>
                          <li>Controle de horários</li>
                          <li>Rotação de números WhatsApp</li>
                          <li>Limites por contato e total</li>
                        </ul>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <Button 
                        onClick={() => navigate("/admin/whatsapp-bulk-send")} 
                        className="w-full sm:w-auto"
                        size="lg"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Criar Campanha de Envio em Massa
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </BillingAccessGuard>
            </TabsContent>

            <TabsContent value="configuracoes" className="animate-fade-in space-y-6 sm:space-y-8">
              {/* Seção 3: Pagamentos e Billing - SEMPRE ACESSÍVEL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Pagamentos e Assinatura</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Gerencie sua assinatura, visualize histórico de pagamentos e registre pagamentos manuais.
                  Esta seção permanece acessível mesmo em caso de atraso no pagamento.
                </p>
                <BillingManagement />
              </div>

              {/* Separador */}
              <div className="border-t border-border my-6" />

              {/* Seção 1: Módulos do Sistema */}
              <BillingAccessGuard allowReadOnly>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Módulos do Sistema</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ative ou desative os módulos disponíveis para cada loja. Cada módulo oferece funcionalidades específicas.
                  </p>
                  <ModulesStoreConfig />
                </div>
              </BillingAccessGuard>

              {/* Separador */}
              <div className="border-t border-border my-6" />

              {/* Seção 2: Central WhatsApp (Conexões + Destinatários + Alertas) */}
              <BillingAccessGuard allowReadOnly>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">WhatsApp</h3>
                  <WhatsAppManagement />
                </div>
              </BillingAccessGuard>

              {/* Separador */}
              <div className="border-t border-border my-6" />

              {/* Seção 4: Integrações ERP */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Integrações ERP</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure integrações ERP por loja (Tiny, Bling, Microvix, Conta Azul, etc). As vendas são sincronizadas automaticamente.
                </p>

                {unmappedVendors.length > 0 && (
                  <Alert variant="destructive" data-testid="alert-unmapped-vendors">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Vendedores ERP sem mapeamento</AlertTitle>
                    <AlertDescription className="mt-2 space-y-2">
                      <p>
                        Existem vendedores do ERP que nao estao vinculados a colaboradoras.
                        Isso impede o registro correto das vendas.
                      </p>
                      <ul className="text-sm list-disc pl-4">
                        {unmappedVendors.map((info) => (
                          <li key={info.storeId}>
                            <strong>{info.storeName}</strong>: {info.unmappedCount} vendedor(es) nao mapeado(s)
                            {info.pendingOrders > 0 && ` - ${info.pendingOrders} pedido(s) pendente(s)`}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/admin/erp-mapping")}
                        className="mt-2"
                        data-testid="button-goto-erp-mapping"
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Mapear Vendedores
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => navigate("/admin/erp-integrations")}
                        variant="outline"
                        className="w-full sm:w-auto border-primary/30"
                        size="sm"
                      >
                        <ExternalLink className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Gerenciar Integrações ERP
                      </Button>
                      <Button
                        onClick={() => navigate("/admin/erp-mapping")}
                        variant="outline"
                        className="w-full sm:w-auto"
                        size="sm"
                        data-testid="button-erp-mapping-nav"
                      >
                        <Link2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Mapeamento ERP
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
