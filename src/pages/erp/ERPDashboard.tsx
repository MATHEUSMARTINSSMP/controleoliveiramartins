/**
 * Dashboard ERP para Loja
 * Passo 14: Criar Dashboard ERP integrando todos os componentes
 * 
 * Mostra KPIs, pedidos sincronizados, status da última sincronização
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, Package, Users, DollarSign, TrendingUp, AlertCircle, CheckCircle2, LogOut, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { syncTinyOrders, syncTinyContacts } from '@/lib/erp/syncTiny';
import TinyOrdersList from '@/components/erp/TinyOrdersList';
import TinyContactsList from '@/components/erp/TinyContactsList';
import CashbackSettings from '@/components/erp/CashbackSettings';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Store {
  id: string;
  name: string;
  sistema_erp: string | null;
}

interface SyncLog {
  id: string;
  tipo_sync: string;
  status: string;
  registros_sincronizados: number;
  registros_atualizados: number;
  registros_com_erro: number;
  sync_at: string;
  error_message: string | null;
}

export default function ERPDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [kpis, setKpis] = useState({
    totalPedidos: 0,
    totalClientes: 0,
    totalVendas: 0,
    ticketMedio: 0,
  });
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      navigate('/erp/login');
      return;
    }

    // Apenas ADMIN e LOJA podem acessar ERP
    if (profile.role !== 'ADMIN' && profile.role !== 'LOJA') {
      navigate('/erp/login');
      return;
    }

    fetchStores();
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchKPIs();
      fetchLastSync();
    }
  }, [selectedStoreId]);

  // ✅ FASE 1: AUTO-REFRESH OTIMIZADO - Sincronização quase em tempo real (5-10s)
  useEffect(() => {
    if (!selectedStoreId) return;

    let isSyncing = false; // Prevenir múltiplas sincronizações simultâneas

    // Verificar se a loja tem integração ERP configurada
    const checkAndSync = async () => {
      // Se já está sincronizando, pular
      if (isSyncing) {
        console.log('[ERPDashboard] ⏭️ Sincronização já em andamento, pulando...');
        return;
      }

      const { data: integration } = await supabase
        .schema('sistemaretiradas')
        .from('erp_integrations')
        .select('id, sistema_erp, access_token, sync_status')
        .eq('store_id', selectedStoreId)
        .maybeSingle();

      if (integration && integration.access_token && integration.sync_status === 'CONNECTED') {
        isSyncing = true;
        const syncStartTime = Date.now();
        
        try {
          console.log(`[ERPDashboard] 🔄 Auto-sincronização iniciada (${new Date().toLocaleTimeString()})...`);
          
          // ✅ FASE 1: Sincronização incremental otimizada
          // Busca apenas pedidos novos desde última sincronização
          const result = await syncTinyOrders(selectedStoreId, {
            incremental: true,
            limit: 50, // Limitar para sincronização rápida
            maxPages: 2, // Máximo 2 páginas por sincronização (100 pedidos)
          });

          const syncDuration = Date.now() - syncStartTime;
          
          if (result.success) {
            console.log(`[ERPDashboard] ✅ Auto-sincronização concluída em ${syncDuration}ms: ${result.message}`);
            
            // Atualizar KPIs e última sincronização silenciosamente
            await Promise.all([
              fetchKPIs(),
              fetchLastSync(),
            ]);
          } else {
            console.warn(`[ERPDashboard] ⚠️ Auto-sincronização com problemas: ${result.message}`);
          }
        } catch (error: any) {
          // Erros silenciosos no auto-refresh (não mostrar toast para não poluir)
          console.warn('[ERPDashboard] ⚠️ Erro no auto-refresh:', error.message || error);
        } finally {
          isSyncing = false;
        }
      }
    };

    // ✅ FASE 1: Primeira sincronização após 3 segundos (mais rápido)
    const initialTimeout = setTimeout(checkAndSync, 3000);

    // ✅ FASE 1: Sincronizar a cada 10 segundos (quase tempo real)
    // Balanceamento: 10s é rápido o suficiente para ser "quase tempo real"
    // mas não sobrecarrega a API do Tiny ERP
    const interval = setInterval(checkAndSync, 10000); // 10 segundos

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      let query = supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, sistema_erp')
        .eq('active', true)
        .order('name');

      // Se for LOJA, filtrar apenas sua loja
      // Para LOJA, usar store_default se store_id não estiver disponível
      const lojaStoreId = profile?.role === 'LOJA' 
        ? (profile.store_id || profile.store_default)
        : null;
      
      if (lojaStoreId) {
        query = query.eq('id', lojaStoreId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setStores(data || []);

      // Auto-selecionar loja com integração ERP configurada
      if (data && data.length > 0) {
        if (lojaStoreId) {
          setSelectedStoreId(lojaStoreId);
        } else {
          // Buscar qual loja tem integração ERP configurada
          const { data: integrations } = await supabase
            .schema('sistemaretiradas')
            .from('erp_integrations')
            .select('store_id')
            .eq('active', true)
            .not('access_token', 'is', null);
          
          const storesWithIntegration = integrations?.map(i => i.store_id) || [];
          
          // Tentar selecionar primeira loja com integração
          const storeWithIntegration = data.find(s => storesWithIntegration.includes(s.id));
          
          if (storeWithIntegration) {
            setSelectedStoreId(storeWithIntegration.id);
          } else if (data.length > 0) {
            // Se não houver loja com integração, selecionar primeira mesmo assim
            setSelectedStoreId(data[0].id);
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIs = async () => {
    if (!selectedStoreId) return;

    try {
      // Total de pedidos
      const { count: pedidosCount } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', selectedStoreId);

      // Total de clientes
      const { count: clientesCount } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', selectedStoreId);

      // Total de vendas e ticket médio
      const { data: orders } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('valor_total')
        .eq('store_id', selectedStoreId);

      const totalVendas = orders?.reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0) || 0;
      const ticketMedio = orders && orders.length > 0 ? totalVendas / orders.length : 0;

      setKpis({
        totalPedidos: pedidosCount || 0,
        totalClientes: clientesCount || 0,
        totalVendas,
        ticketMedio,
      });
    } catch (error: any) {
      console.error('Erro ao buscar KPIs:', error);
    }
  };

  const fetchLastSync = async () => {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('erp_sync_logs')
        .select('*')
        .eq('store_id', selectedStoreId)
        .eq('sistema_erp', 'TINY')
        .order('sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLastSync(data);
    } catch (error: any) {
      console.error('Erro ao buscar última sincronização:', error);
    }
  };

  // ✅ SEGURANÇA: Sincronização manual apenas incremental (não hard sync)
  // Hard Sync fica APENAS no painel dev (/dev/erp-config) para evitar uso indevido
  const handleSyncOrders = async () => {
    if (!selectedStoreId) {
      toast.error('Selecione uma loja');
      return;
    }

    // Verificar se a loja tem integração ERP configurada
    const { data: integration } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('id, sistema_erp, access_token, sync_status')
      .eq('store_id', selectedStoreId)
      .maybeSingle();

    if (!integration || !integration.access_token) {
      toast.error('Esta loja não tem integração ERP configurada. Configure primeiro em /dev/erp-config');
      return;
    }

    try {
      setSyncing(true);
      toast.info('Sincronizando pedidos (incremental)...');

      // ✅ SEGURANÇA: Apenas sincronização incremental (não hard sync)
      // Hard sync disponível apenas em /dev/erp-config
      const result = await syncTinyOrders(selectedStoreId, {
        incremental: true,
        hardSync: false, // Sempre false no dashboard normal
      });

      if (result.success) {
        toast.success(result.message);
        await fetchKPIs();
        await fetchLastSync();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar pedidos:', error);
      const errorMessage = error.message || 'Erro ao sincronizar pedidos';
      
      // Se for erro de token, mostrar mensagem específica com botão de reautorização
      if (errorMessage.includes('renovar token') || errorMessage.includes('Reautorize')) {
        toast.error(errorMessage, {
          duration: 10000,
          action: {
            label: 'Reautorizar',
            onClick: () => {
              // Redirecionar para página de configuração para reautorizar
              window.location.href = `/dev/erp-config?store=${selectedStoreId}`;
            },
          },
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSyncing(false);
    }
  };

  // ✅ SEGURANÇA: Sincronização manual apenas padrão (não hard sync)
  // Hard Sync fica APENAS no painel dev (/dev/erp-config) para evitar uso indevido
  const handleSyncContacts = async () => {
    if (!selectedStoreId) {
      toast.error('Selecione uma loja');
      return;
    }

    // Verificar se a loja tem integração ERP configurada
    const { data: integration } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('id, sistema_erp, access_token, sync_status')
      .eq('store_id', selectedStoreId)
      .maybeSingle();

    if (!integration || !integration.access_token) {
      toast.error('Esta loja não tem integração ERP configurada. Configure primeiro em /dev/erp-config');
      return;
    }

    try {
      setSyncing(true);
      toast.info('Sincronizando clientes...');

      // ✅ SEGURANÇA: Apenas sincronização padrão (não hard sync)
      // Hard sync disponível apenas em /dev/erp-config
      const result = await syncTinyContacts(selectedStoreId, {
        hardSync: false, // Sempre false no dashboard normal
      });

      if (result.success) {
        toast.success(result.message);
        await fetchKPIs();
        await fetchLastSync();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar clientes:', error);
      const errorMessage = error.message || 'Erro ao sincronizar clientes';
      
      // Se for erro de token, mostrar mensagem específica com botão de reautorização
      if (errorMessage.includes('renovar token') || errorMessage.includes('Reautorize')) {
        toast.error(errorMessage, {
          duration: 10000,
          action: {
            label: 'Reautorizar',
            onClick: () => {
              // Redirecionar para página de configuração para reautorizar
              window.location.href = `/dev/erp-config?store=${selectedStoreId}`;
            },
          },
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/erp/login');
      toast.success('Logout realizado com sucesso');
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard ERP</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie dados sincronizados do Tiny ERP
          </p>
        </div>
        <div className="flex items-center gap-4">
          {stores.length > 0 && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/erp/category-reports')}
              variant="outline"
            >
              Relatórios
            </Button>
            <Button
              onClick={() => navigate('/erp/product-intelligence')}
              variant="outline"
            >
              Inteligência de Produtos
            </Button>
            {profile?.role === 'ADMIN' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dev/erp-config')}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Status da Última Sincronização */}
      {lastSync && (
        <Alert variant={lastSync.status === 'SUCCESS' ? 'default' : 'destructive'}>
          <div className="flex items-center gap-2">
            {lastSync.status === 'SUCCESS' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>Última sincronização ({lastSync.tipo_sync}):</strong>{' '}
                  {format(new Date(lastSync.sync_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {' - '}
                  {lastSync.registros_sincronizados} novos, {lastSync.registros_atualizados} atualizados
                  {lastSync.registros_com_erro > 0 && `, ${lastSync.registros_com_erro} erros`}
                </div>
                {lastSync.error_message && (
                  <Badge variant="destructive" className="ml-2">
                    {lastSync.error_message.substring(0, 50)}...
                  </Badge>
                )}
              </div>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalPedidos.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalClientes.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalVendas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.ticketMedio)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Botões de Sincronização */}
      <Card>
        <CardHeader>
          <CardTitle>Sincronização Manual</CardTitle>
          <CardDescription>
            Sincronize pedidos e clientes manualmente do Tiny ERP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handleSyncOrders}
              disabled={syncing || !selectedStoreId}
              className="flex items-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Pedidos
            </Button>
            <Button
              onClick={handleSyncContacts}
              disabled={syncing || !selectedStoreId}
              variant="outline"
              className="flex items-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Clientes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      {selectedStoreId && (
        <TinyOrdersList storeId={selectedStoreId} limit={20} />
      )}

      {/* Lista de Clientes */}
      {selectedStoreId && (
        <TinyContactsList storeId={selectedStoreId} limit={20} />
      )}

      {/* Configurações de Cashback */}
      {profile?.role === 'ADMIN' && (
        <CashbackSettings storeId={selectedStoreId || undefined} />
      )}
    </div>
  );
}

