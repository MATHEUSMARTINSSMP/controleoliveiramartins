import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  Store,
  Settings,
  CreditCard,
  Package,
  Key,
  Mail,
  Globe,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  Trash2,
  Lock,
  Unlock,
  Activity,
  BarChart3,
  MessageSquare,
  TestTube,
  AlertCircle,
  UserCheck,
  UserX,
  Building2,
  UserCog,
  Shield,
  Database,
  ExternalLink,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppGlobalConfig } from "@/components/dev/WhatsAppGlobalConfig";
import { PaymentGatewaysConfig } from "@/components/dev/PaymentGatewaysConfig";
import { WebhookTester } from "@/components/admin/WebhookTester";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean; // Alias para is_active (compatibilidade)
  is_active?: boolean; // Campo real do banco
  created_at: string;
  last_sign_in_at: string | null;
  login_count?: number;
  stores_count?: number;
  colaboradoras_count?: number;
}

interface StoreData {
  id: string;
  name: string;
  site_slug: string;
  active: boolean;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  cashback_ativo: boolean;
  crm_ativo: boolean;
  wishlist_ativo: boolean;
  ponto_ativo: boolean;
  ajustes_condicionais_ativo: boolean;
  erp_ativo?: boolean; // Opcional - pode não existir em todas as instalações
  check_meta_ativo?: boolean; // Opcional - pode não existir em todas as instalações
  created_at: string;
}

interface SubscriptionData {
  id: string;
  admin_id: string;
  admin_email?: string;
  admin_name?: string;
  plan_id: string;
  plan_name?: string;
  status: string;
  payment_status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  last_payment_date: string | null;
  next_payment_date: string | null;
  payment_gateway: string;
  days_overdue?: number;
}

const SuperAdmin = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Overview Stats
  const [stats, setStats] = useState({
    totalAdmins: 0,
    totalStores: 0,
    totalColaboradoras: 0,
    activeSubscriptions: 0,
    overdueSubscriptions: 0,
  });

  // Users Management
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [colaboradoras, setColaboradoras] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Stores Management
  const [stores, setStores] = useState<StoreData[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeFormData, setStoreFormData] = useState({
    name: "",
    site_slug: "",
    active: true,
  });

  // Subscriptions Management
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionData | null>(null);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [subscriptionFormData, setSubscriptionFormData] = useState({
    status: "",
    payment_status: "",
    current_period_end: "",
    last_payment_date: "",
  });

  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      navigate("/dev/login", { replace: true });
      return;
    }

    if (!profile.is_super_admin) {
      toast.error("Acesso restrito. Apenas Super Admin autorizado.");
      navigate("/dev/login", { replace: true });
      return;
    }

    fetchAllData();
  }, [profile, authLoading, navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchUsers(),
        fetchColaboradoras(),
        fetchStores(),
        fetchSubscriptions(),
      ]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Total de admins
      const { count: adminsCount } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "ADMIN");

      // Total de lojas
      const { count: storesCount } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("*", { count: "exact", head: true });

      // Total de colaboradoras
      const { count: colaboradorasCount } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "COLABORADORA");

      // Assinaturas ativas
      const { count: activeSubsCount } = await supabase
        .schema("sistemaretiradas")
        .from("admin_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIVE");

      // Assinaturas atrasadas
      const { data: overdueSubs } = await supabase
        .schema("sistemaretiradas")
        .from("admin_subscriptions")
        .select("id, current_period_end")
        .eq("status", "ACTIVE");

      const overdueCount = overdueSubs?.filter((sub) => {
        if (!sub.current_period_end) return false;
        return new Date(sub.current_period_end) < new Date();
      }).length || 0;

      setStats({
        totalAdmins: adminsCount || 0,
        totalStores: storesCount || 0,
        totalColaboradoras: colaboradorasCount || 0,
        activeSubscriptions: activeSubsCount || 0,
        overdueSubscriptions: overdueCount,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select(`
          id,
          email,
          name,
          role,
          is_active,
          created_at,
          store_id,
          store_default
        `)
        .eq("role", "ADMIN")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar dados de auth.users para last_sign_in_at via Netlify Function
      const { data: { session } } = await supabase.auth.getSession();
      let authUsers: any[] = [];
      
      if (session) {
        try {
          const response = await fetch(
            '/.netlify/functions/admin-list-users',
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );
          
          if (response.ok) {
            const authUsersData = await response.json();
            authUsers = authUsersData?.users || [];
          } else {
            console.warn('Erro ao buscar usuários auth:', await response.text());
          }
        } catch (error) {
          console.warn('Erro ao buscar usuários auth:', error);
        }
      }

      // Contar lojas e colaboradoras por admin
      const usersWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Contar lojas
          const { count: storesCount } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("*", { count: "exact", head: true })
            .eq("admin_id", profile.id);

          // Contar colaboradoras
          const { count: colaboradorasCount } = await supabase
            .schema("sistemaretiradas")
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("role", "COLABORADORA")
            .in(
              "store_id",
              (
                await supabase
                  .schema("sistemaretiradas")
                  .from("stores")
                  .select("id")
                  .eq("admin_id", profile.id)
              ).data?.map((s) => s.id) || []
            );

          const authUser = authUsers.find((u: any) => u.id === profile.id);

          return {
            ...profile,
            active: profile.is_active ?? true, // Mapear is_active para active (compatibilidade)
            last_sign_in_at: authUser?.last_sign_in_at || null,
            login_count: authUser ? 1 : 0, // Simplificado - pode ser melhorado com tracking de logins
            stores_count: storesCount || 0,
            colaboradoras_count: colaboradorasCount || 0,
          };
        })
      );

      setUsers(usersWithStats);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao buscar usuários");
    }
  };

  const fetchColaboradoras = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select(`
          id,
          email,
          name,
          role,
          is_active,
          store_id,
          store_default,
          created_at
        `)
        .eq("role", "COLABORADORA")
        .order("name");

      if (error) throw error;

      setColaboradoras(data || []);
    } catch (error) {
      console.error("Erro ao buscar colaboradoras:", error);
      toast.error("Erro ao buscar colaboradoras");
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select(`
          id,
          name,
          site_slug,
          active,
          admin_id,
          cashback_ativo,
          crm_ativo,
          wishlist_ativo,
          ponto_ativo,
          ajustes_condicionais_ativo,
          created_at,
          profiles!stores_admin_id_fkey(id, name, email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const storesWithAdmin = (data || []).map((store: any) => ({
        ...store,
        admin_name: store.profiles?.name,
        admin_email: store.profiles?.email,
      }));

      setStores(storesWithAdmin);
    } catch (error) {
      console.error("Erro ao buscar lojas:", error);
      toast.error("Erro ao buscar lojas");
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("admin_subscriptions")
        .select(`
          id,
          admin_id,
          plan_id,
          status,
          payment_status,
          billing_cycle,
          current_period_start,
          current_period_end,
          last_payment_date,
          next_payment_date,
          profiles!admin_subscriptions_admin_id_fkey(id, email, name),
          subscription_plans!admin_subscriptions_plan_id_fkey(id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const subsWithDetails = (data || []).map((sub: any) => {
        const daysOverdue =
          sub.current_period_end && new Date(sub.current_period_end) < new Date()
            ? Math.floor(
                (new Date().getTime() - new Date(sub.current_period_end).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0;

        return {
          ...sub,
          admin_email: sub.profiles?.email,
          admin_name: sub.profiles?.name,
          plan_name: sub.subscription_plans?.name,
          days_overdue: daysOverdue,
        };
      });

      setSubscriptions(subsWithDetails);
    } catch (error) {
      console.error("Erro ao buscar assinaturas:", error);
      toast.error("Erro ao buscar assinaturas");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast.error("Preencha a nova senha");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch('/.netlify/functions/admin-reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          new_password: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao resetar senha');
      }

      toast.success("Senha resetada com sucesso!");
      setResetPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (error: any) {
      console.error("Erro ao resetar senha:", error);
      toast.error(`Erro ao resetar senha: ${error.message}`);
    }
  };

  const handleUpdateStore = async () => {
    if (!selectedStore || !profile?.id) return;

    try {
      // Se está alterando active, usar função RPC do Super Admin
      if (storeFormData.active !== selectedStore.active) {
        const { data, error: toggleError } = await supabase
          .rpc('super_admin_toggle_store_active', {
            p_super_admin_id: profile.id,
            p_store_id: selectedStore.id,
            p_active: storeFormData.active
          });

        if (toggleError) throw toggleError;
      }

      // Atualizar outros campos normalmente
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .update({
          name: storeFormData.name,
          site_slug: storeFormData.site_slug,
          active: storeFormData.active,
        })
        .eq("id", selectedStore.id);

      if (error) throw error;

      toast.success("Loja atualizada com sucesso!");
      setStoreDialogOpen(false);
      fetchStores();
    } catch (error: any) {
      console.error("Erro ao atualizar loja:", error);
      toast.error(`Erro ao atualizar loja: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleToggleStoreModule = async (
    storeId: string,
    module: string,
    currentValue: boolean
  ) => {
    if (!profile?.id) {
      toast.error("Erro: Perfil não encontrado");
      return;
    }

    try {
      // Usar função RPC que verifica Super Admin e sobrescreve billing
      const { data, error } = await supabase
        .rpc('super_admin_toggle_store_module', {
          p_super_admin_id: profile.id,
          p_store_id: storeId,
          p_module_name: module,
          p_active: !currentValue
        });

      if (error) throw error;

      toast.success(`Módulo ${module} ${!currentValue ? "ativado" : "desativado"} com sucesso!`);
      fetchStores();
    } catch (error: any) {
      console.error("Erro ao alterar módulo:", error);
      toast.error(`Erro ao alterar módulo: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!selectedSubscription || !profile?.id) return;

    try {
      // Usar função RPC do Super Admin que sobrescreve verificação automática
      const { data, error } = await supabase
        .rpc('super_admin_update_billing_status', {
          p_super_admin_id: profile.id,
          p_target_admin_id: selectedSubscription.admin_id,
          p_status: subscriptionFormData.status,
          p_payment_status: subscriptionFormData.payment_status,
          p_current_period_end: subscriptionFormData.current_period_end || null,
          p_last_payment_date: subscriptionFormData.last_payment_date || null
        });

      if (error) throw error;

      toast.success("Assinatura atualizada com sucesso! Status de billing sobrescrito.");
      setSubscriptionDialogOpen(false);
      fetchSubscriptions();
      fetchUsers(); // Atualizar lista de usuários também
    } catch (error: any) {
      console.error("Erro ao atualizar assinatura:", error);
      toast.error(`Erro ao atualizar assinatura: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    if (!profile?.id) {
      toast.error("Erro: Perfil não encontrado");
      return;
    }

    try {
      // Usar função RPC que verifica Super Admin e sobrescreve billing
      const { data, error } = await supabase
        .rpc('super_admin_toggle_user_active', {
          p_super_admin_id: profile.id,
          p_target_user_id: userId,
          p_active: !currentActive
        });

      if (error) throw error;

      toast.success(`Usuário ${!currentActive ? "ativado" : "desativado"} com sucesso!`);
      fetchUsers();
    } catch (error: any) {
      console.error("Erro ao alterar status do usuário:", error);
      toast.error(`Erro: ${error.message || 'Erro desconhecido'}`);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Super Admin
            </h1>
            <p className="text-muted-foreground mt-1">
              Painel de controle completo do sistema
            </p>
          </div>
          <Button onClick={fetchAllData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="stores">Lojas</TabsTrigger>
            <TabsTrigger value="colaboradoras">Colaboradoras</TabsTrigger>
            <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
            <TabsTrigger value="modules">Módulos</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
          </TabsList>

          {/* VISÃO GERAL */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Admins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAdmins}</div>
                  <p className="text-xs text-muted-foreground">Total de administradores</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Lojas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalStores}</div>
                  <p className="text-xs text-muted-foreground">Total de lojas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Colaboradoras
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalColaboradoras}</div>
                  <p className="text-xs text-muted-foreground">Total de colaboradoras</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Assinaturas Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
                  <p className="text-xs text-muted-foreground">Em funcionamento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Atrasadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {stats.overdueSubscriptions}
                  </div>
                  <p className="text-xs text-muted-foreground">Pagamentos pendentes</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* USUÁRIOS */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Usuários Administradores</CardTitle>
                <CardDescription>
                  Gerencie todos os administradores do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lojas</TableHead>
                        <TableHead>Colaboradoras</TableHead>
                        <TableHead>Último Acesso</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={user.active ? "default" : "secondary"}>
                              {user.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.stores_count || 0}</TableCell>
                          <TableCell>{user.colaboradoras_count || 0}</TableCell>
                          <TableCell>
                            {user.last_sign_in_at
                              ? format(new Date(user.last_sign_in_at), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })
                              : "Nunca"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setResetPasswordDialogOpen(true);
                                }}
                              >
                                <Key className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleUserActive(user.id, user.active)}
                              >
                                {user.active ? (
                                  <UserX className="h-3 w-3 text-red-500" />
                                ) : (
                                  <UserCheck className="h-3 w-3 text-green-500" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LOJAS */}
          <TabsContent value="stores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Lojas</CardTitle>
                <CardDescription>
                  Gerencie todas as lojas do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Site Slug</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stores.map((store) => (
                        <TableRow key={store.id}>
                          <TableCell className="font-medium">{store.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {store.site_slug || "-"}
                            </code>
                          </TableCell>
                          <TableCell>{store.admin_email || "-"}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{store.admin_name || "-"}</div>
                              <div className="text-xs text-muted-foreground">
                                {store.admin_email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={store.active ? "default" : "secondary"}>
                              {store.active ? "Ativa" : "Inativa"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedStore(store);
                                setStoreFormData({
                                  name: store.name,
                                  site_slug: store.site_slug || "",
                                  active: store.active,
                                });
                                setStoreDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSINATURAS */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Assinaturas</CardTitle>
                <CardDescription>
                  Gerencie todas as assinaturas e status de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admin</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Próximo Pagamento</TableHead>
                        <TableHead>Atraso</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{sub.admin_name || "-"}</div>
                              <div className="text-xs text-muted-foreground">
                                {sub.admin_email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{sub.plan_name || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sub.status === "ACTIVE"
                                  ? "default"
                                  : sub.status === "CANCELED"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sub.payment_status === "PAID"
                                  ? "default"
                                  : sub.payment_status === "FAILED"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {sub.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.next_payment_date
                              ? format(
                                  new Date(sub.next_payment_date),
                                  "dd/MM/yyyy",
                                  { locale: ptBR }
                                )
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {sub.days_overdue && sub.days_overdue > 0 ? (
                              <Badge variant="destructive">
                                {sub.days_overdue} dias
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setSubscriptionFormData({
                                  status: sub.status,
                                  payment_status: sub.payment_status,
                                  current_period_end: sub.current_period_end
                                    ? format(
                                        new Date(sub.current_period_end),
                                        "yyyy-MM-dd"
                                      )
                                    : "",
                                  last_payment_date: sub.last_payment_date
                                    ? format(
                                        new Date(sub.last_payment_date),
                                        "yyyy-MM-dd"
                                      )
                                    : "",
                                });
                                setSubscriptionDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MÓDULOS */}
          <TabsContent value="modules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Módulos por Loja</CardTitle>
                <CardDescription>
                  Ative ou desative módulos específicos para cada loja
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stores.map((store) => (
                    <Card key={store.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{store.name}</CardTitle>
                          <Badge variant={store.active ? "default" : "secondary"}>
                            {store.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <CardDescription>{store.admin_email}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label>Cashback</Label>
                            <Switch
                              checked={store.cashback_ativo}
                              onCheckedChange={() =>
                                handleToggleStoreModule(
                                  store.id,
                                  "cashback",
                                  store.cashback_ativo
                                )
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label>CRM</Label>
                            <Switch
                              checked={store.crm_ativo}
                              onCheckedChange={() =>
                                handleToggleStoreModule(store.id, "crm", store.crm_ativo)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label>Wishlist</Label>
                            <Switch
                              checked={store.wishlist_ativo}
                              onCheckedChange={() =>
                                handleToggleStoreModule(
                                  store.id,
                                  "wishlist",
                                  store.wishlist_ativo
                                )
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label>Ponto</Label>
                            <Switch
                              checked={store.ponto_ativo}
                              onCheckedChange={() =>
                                handleToggleStoreModule(store.id, "ponto", store.ponto_ativo)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label>Ajustes</Label>
                            <Switch
                              checked={store.ajustes_condicionais_ativo}
                              onCheckedChange={() =>
                                handleToggleStoreModule(
                                  store.id,
                                  "ajustes",
                                  store.ajustes_condicionais_ativo
                                )
                              }
                            />
                          </div>
                          {store.erp_ativo !== undefined && (
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                              <Label>ERP</Label>
                              <Switch
                                checked={store.erp_ativo}
                                onCheckedChange={() =>
                                  handleToggleStoreModule(store.id, "erp", store.erp_ativo)
                                }
                              />
                            </div>
                          )}
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label>Check Meta</Label>
                            <Switch
                              checked={store.check_meta_ativo}
                              onCheckedChange={() =>
                                handleToggleStoreModule(
                                  store.id,
                                  "check_meta",
                                  store.check_meta_ativo
                                )
                              }
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COLABORADORAS */}
          <TabsContent value="colaboradoras" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Colaboradoras</CardTitle>
                <CardDescription>
                  Gerencie todas as colaboradoras do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stores.map((store) => {
                    const storeColaboradoras = colaboradoras.filter(
                      (colab) => (colab.store_id === store.id || colab.store_default === store.id)
                    ).map(colab => ({
                      ...colab,
                      active: colab.is_active ?? true
                    }));
                    return (
                      <Card key={store.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{store.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {storeColaboradoras.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {storeColaboradoras.map((colab) => (
                                  <TableRow key={colab.id}>
                                    <TableCell>{colab.name}</TableCell>
                                    <TableCell>{colab.email}</TableCell>
                                    <TableCell>
                                      <Badge variant={colab.active ? "default" : "secondary"}>
                                        {colab.active ? "Ativa" : "Inativa"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleToggleUserActive(colab.id, colab.active)}
                                      >
                                        {colab.active ? "Desativar" : "Ativar"}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Nenhuma colaboradora cadastrada nesta loja
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SISTEMA */}
          <TabsContent value="system" className="space-y-6">
            <Tabs defaultValue="erp" className="w-full">
              <TabsList>
                <TabsTrigger value="erp">Configuração ERP</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp Global</TabsTrigger>
                <TabsTrigger value="gateways">Gateways de Pagamento</TabsTrigger>
                <TabsTrigger value="webhook">Webhook Tester</TabsTrigger>
              </TabsList>
              <TabsContent value="erp">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuração de ERP</CardTitle>
                    <CardDescription>
                      Configure as integrações de ERP para cada loja
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stores.map((store) => (
                        <Card key={store.id}>
                          <CardHeader>
                            <CardTitle className="text-lg">{store.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {store.erp_ativo !== undefined && (
                                <div className="flex items-center justify-between">
                                  <Label>ERP Ativo</Label>
                                  <Switch
                                    checked={store.erp_ativo}
                                    onCheckedChange={() =>
                                      handleToggleStoreModule(store.id, "erp", store.erp_ativo)
                                    }
                                  />
                                </div>
                              )}
                              <p className="text-sm text-muted-foreground">
                                Ative ou desative a integração de ERP para esta loja
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="whatsapp">
                <WhatsAppGlobalConfig />
              </TabsContent>
              <TabsContent value="gateways">
                <PaymentGatewaysConfig />
              </TabsContent>
              <TabsContent value="webhook">
                <WebhookTester />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* DIALOGS */}
        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resetar Senha</DialogTitle>
              <DialogDescription>
                Definir nova senha para {selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nova Senha</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResetPasswordDialogOpen(false);
                    setNewPassword("");
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleResetPassword}>Resetar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Store Dialog */}
        <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Loja</DialogTitle>
              <DialogDescription>
                Alterar informações da loja {selectedStore?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={storeFormData.name}
                  onChange={(e) =>
                    setStoreFormData({ ...storeFormData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Site Slug</Label>
                <Input
                  value={storeFormData.site_slug}
                  onChange={(e) =>
                    setStoreFormData({ ...storeFormData, site_slug: e.target.value })
                  }
                  placeholder="exemplo-loja"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativa</Label>
                <Switch
                  checked={storeFormData.active}
                  onCheckedChange={(checked) =>
                    setStoreFormData({ ...storeFormData, active: checked })
                  }
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateStore}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog
          open={subscriptionDialogOpen}
          onOpenChange={setSubscriptionDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Assinatura</DialogTitle>
              <DialogDescription>
                Alterar status e informações da assinatura de{" "}
                {selectedSubscription?.admin_email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={subscriptionFormData.status}
                  onValueChange={(value) =>
                    setSubscriptionFormData({ ...subscriptionFormData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="CANCELED">CANCELED</SelectItem>
                    <SelectItem value="PAST_DUE">PAST_DUE</SelectItem>
                    <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status de Pagamento</Label>
                <Select
                  value={subscriptionFormData.payment_status}
                  onValueChange={(value) =>
                    setSubscriptionFormData({
                      ...subscriptionFormData,
                      payment_status: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">PAID</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="FAILED">FAILED</SelectItem>
                    <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fim do Período Atual</Label>
                <Input
                  type="date"
                  value={subscriptionFormData.current_period_end}
                  onChange={(e) =>
                    setSubscriptionFormData({
                      ...subscriptionFormData,
                      current_period_end: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Último Pagamento</Label>
                <Input
                  type="date"
                  value={subscriptionFormData.last_payment_date}
                  onChange={(e) =>
                    setSubscriptionFormData({
                      ...subscriptionFormData,
                      last_payment_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSubscriptionDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleUpdateSubscription}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SuperAdmin;

