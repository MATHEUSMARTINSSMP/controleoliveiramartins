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
import { Loader2, RefreshCw, Package, Users, DollarSign, TrendingUp, AlertCircle, CheckCircle2, LogOut, Settings, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { syncTinyOrders, syncTinyContacts } from '@/lib/erp/syncTiny';
import TinyOrdersList from '@/components/erp/TinyOrdersList';
import TinyContactsList from '@/components/erp/TinyContactsList';
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

  // ✅ AUTO-REFRESH DESATIVADO
  // O auto-refresh estava usando a função frontend (syncTinyOrders) que só atualiza telefones
  // A sincronização correta deve ser feita APENAS via botão manual, que chama a Netlify Function
  // que tem a lógica de extração de tamanho/cor

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

  // ✅ Sincronização manual com diferentes períodos
  const handleSyncOrders = async (periodo: 'agora' | 'semana' | 'total') => {
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

      let dataInicio: string | undefined;
      let mensagem: string;

      if (periodo === 'agora') {
        // ✅ CORREÇÃO: Buscar APENAS A ÚLTIMA VENDA (últimas 2 horas, limite 1, apenas 1 página)
        const agora = new Date();
        const duasHorasAtras = new Date(agora);
        duasHorasAtras.setHours(agora.getHours() - 2); // Reduzido de 12 para 2 horas
        dataInicio = duasHorasAtras.toISOString().split('T')[0];
        mensagem = 'Sincronizando última venda...';
      } else if (periodo === 'semana') {
        // Buscar últimos 7 dias
        const hoje = new Date();
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 7);
        dataInicio = seteDiasAtras.toISOString().split('T')[0];
        mensagem = 'Sincronizando últimos 7 dias...';
      } else {
        // Sincronização total: últimos 90 dias, mas apenas se houver mudanças
        const hoje = new Date();
        const noventaDiasAtras = new Date(hoje);
        noventaDiasAtras.setDate(hoje.getDate() - 90);
        dataInicio = noventaDiasAtras.toISOString().split('T')[0];
        mensagem = 'Sincronização total (últimos 90 dias)...';
      }

      // ✅ TODAS AS SINCRONIZAÇÕES MANUAIS RODAM EM BACKGROUND
      // Chamar diretamente a Netlify Function (backend) para rodar em background
      toast.info(`${mensagem} (em background - você pode fechar a página)`);

      const netlifyFunctionUrl = '/.netlify/functions/sync-tiny-orders-background';

      console.log(`[ERPDashboard] 🚀 Chamando Netlify Function: ${netlifyFunctionUrl}`);
      console.log(`[ERPDashboard] 📦 Payload:`, {
        store_id: selectedStoreId,
        data_inicio: dataInicio,
        incremental: periodo === 'total',
        limit: 100, // Limite por página (API Tiny)
        max_pages: 999, // SEM LIMITE - busca todas as páginas disponíveis
        hard_sync: false,
      });

      const response = await fetch(netlifyFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: selectedStoreId,
          data_inicio: dataInicio,
          incremental: periodo === 'total',
          limit: 100, // Limite por página (API Tiny)
          max_pages: 999, // SEM LIMITE - busca todas as páginas disponíveis
          hard_sync: false,
        }),
      }).catch((fetchError: any) => {
        console.error("❌ Erro ao chamar Netlify Function:", fetchError);
        throw new Error(`Erro ao iniciar sincronização: ${fetchError.message}`);
      });

      // ✅ CORREÇÃO: Netlify Background Functions retornam 202 Accepted imediatamente
      // Isso significa que o processo iniciou com sucesso em background
      if (response.status === 202) {
        toast.success(`✅ Sincronização iniciada em background! Você pode fechar a página.`);
        setSyncing(false);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
      }

      // Verificar se a resposta está vazia antes de fazer parse
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        throw new Error('Resposta vazia do servidor. Tente novamente.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error('Erro ao fazer parse da resposta:', parseError);
        throw new Error(`Erro ao processar resposta do servidor: ${parseError.message}`);
      }

      if (data?.success) {
        toast.success(`✅ ${data.message || 'Sincronização iniciada em background! Você pode fechar a página.'}`);
        await fetchKPIs();
        await fetchLastSync();
      } else {
        throw new Error(data?.error || data?.message || 'Erro ao iniciar sincronização');
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
            <Button
              onClick={() => navigate('/erp/cashback-management')}
              variant="outline"
              className="gap-2"
            >
              <Gift className="h-4 w-4" />
              Cashback
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

      {/* Botões de Sincronização Manual */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Sincronização Manual</CardTitle>
          <CardDescription className="text-sm">
            Sincronize pedidos manualmente do Tiny ERP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                onClick={() => handleSyncOrders('agora')}
                disabled={syncing || !selectedStoreId}
                className="flex items-center justify-center gap-2 h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md transition-all"
              >
                {syncing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
                <span className="font-semibold">Sincronizar Agora</span>
              </Button>
              <Button
                onClick={() => handleSyncOrders('semana')}
                disabled={syncing || !selectedStoreId}
                variant="outline"
                className="flex items-center justify-center gap-2 h-12 border-2 hover:bg-primary/5 transition-all"
              >
                {syncing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
                <span className="font-semibold">Sincronizar Semana</span>
              </Button>
              <Button
                onClick={() => handleSyncOrders('total')}
                disabled={syncing || !selectedStoreId}
                variant="outline"
                className="flex items-center justify-center gap-2 h-12 border-2 hover:bg-primary/5 transition-all"
              >
                {syncing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5" />
                )}
                <span className="font-semibold">Sincronização Total</span>
              </Button>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-orange-500 font-bold">•</span>
                <div>
                  <strong className="text-foreground">Sincronizar Agora:</strong>
                  <span className="text-muted-foreground"> Busca apenas a última venda (últimas 12 horas)</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">Sincronizar Semana:</strong>
                  <span className="text-muted-foreground"> Busca os últimos 7 dias</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">Sincronização Total:</strong>
                  <span className="text-muted-foreground"> Atualiza últimos 90 dias (apenas se houver mudanças)</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <span className="text-lg">💡</span>
              <span>Sincronização automática ocorre silenciosamente em background a cada 10 segundos</span>
            </div>
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

    </div>
  );
}

