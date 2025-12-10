import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  Store,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Save,
  ExternalLink,
  TestTube,
  Package,
  Plus,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { getERPAuthorizationUrl, testERPConnection } from "@/lib/erpIntegrations";

interface StoreData {
  id: string;
  name: string;
  site_slug: string;
  active: boolean;
  admin_id: string;
}

interface ERPIntegration {
  id: string;
  store_id: string;
  sistema_erp: string;
  client_id: string;
  client_secret: string;
  sync_status: string;
  last_sync_at: string | null;
  error_message: string | null;
}

interface ERPConfigSuperAdminProps {
  stores: StoreData[];
}

// Lista de ERPs suportados (preparado para 10+ tipos)
const ERP_TYPES = [
  { value: "TINY", label: "Tiny ERP", available: true },
  { value: "BLING", label: "Bling", available: true },
  { value: "MICROVIX", label: "Microvix", available: true },
  { value: "CONTA_AZUL", label: "Conta Azul", available: true },
  { value: "OMIE", label: "Omie", available: true },
  { value: "NEXO", label: "Nexo", available: true },
  { value: "LINX", label: "Linx", available: true },
  { value: "TOTVS", label: "Totvs", available: true },
  { value: "SANKHYA", label: "Sankhya", available: true },
  { value: "OUTRO", label: "Outro", available: true },
];

const ERPConfigSuperAdmin = ({ stores }: ERPConfigSuperAdminProps) => {
  const [integrations, setIntegrations] = useState<Record<string, ERPIntegration | null>>({});
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<Record<string, { sistema_erp: string; client_id: string; client_secret: string }>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllIntegrations();
  }, [stores]);

  // Verificar se voltou do OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const storeId = params.get('store_id');

    if (success === 'true' && storeId) {
      toast.success("Conexão OAuth autorizada com sucesso!");
      window.history.replaceState({}, '', window.location.pathname);
      fetchIntegration(storeId);
    } else if (error) {
      toast.error(`Erro na autorização OAuth: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchAllIntegrations = async () => {
    try {
      setLoading(true);
      const storeIds = stores.map(s => s.id);
      
      if (storeIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("erp_integrations")
        .select("*")
        .in("store_id", storeIds)
        .eq("active", true);

      if (error) throw error;

      // Organizar por store_id (apenas 1 por loja)
      const integrationsMap: Record<string, ERPIntegration | null> = {};
      stores.forEach(store => {
        const integration = (data || []).find((i: ERPIntegration) => i.store_id === store.id);
        integrationsMap[store.id] = integration || null;
        
        // Inicializar formData se não tiver integração
        if (!integration && !formData[store.id]) {
          setFormData(prev => ({
            ...prev,
            [store.id]: {
              sistema_erp: "TINY",
              client_id: "",
              client_secret: "",
            }
          }));
        } else if (integration) {
          setFormData(prev => ({
            ...prev,
            [store.id]: {
              sistema_erp: integration.sistema_erp || "TINY",
              client_id: integration.client_id || "",
              client_secret: integration.client_secret || "",
            }
          }));
        }
      });

      setIntegrations(integrationsMap);
    } catch (error: any) {
      console.error("Erro ao buscar integrações:", error);
      toast.error("Erro ao carregar integrações ERP");
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegration = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("erp_integrations")
        .select("*")
        .eq("store_id", storeId)
        .eq("active", true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIntegrations(prev => ({
        ...prev,
        [storeId]: data || null
      }));

      if (data) {
        setFormData(prev => ({
          ...prev,
          [storeId]: {
            sistema_erp: data.sistema_erp || "TINY",
            client_id: data.client_id || "",
            client_secret: data.client_secret || "",
          }
        }));
      }
    } catch (error: any) {
      console.error("Erro ao buscar integração:", error);
      toast.error("Erro ao carregar configurações");
    }
  };

  const toggleStoreExpanded = (storeId: string) => {
    setExpandedStores(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storeId)) {
        newSet.delete(storeId);
      } else {
        newSet.add(storeId);
      }
      return newSet;
    });
  };

  const handleSave = async (storeId: string) => {
    const storeFormData = formData[storeId];
    if (!storeFormData) {
      toast.error("Dados do formulário não encontrados");
      return;
    }

    if (!storeFormData.client_id || !storeFormData.client_secret) {
      toast.error("Preencha Client ID e Client Secret");
      return;
    }

    setSaving(prev => ({ ...prev, [storeId]: true }));
    try {
      const payload: any = {
        store_id: storeId,
        sistema_erp: storeFormData.sistema_erp,
        client_id: storeFormData.client_id.trim(),
        client_secret: storeFormData.client_secret.trim(),
        sync_status: 'DISCONNECTED',
        active: true,
      };

      const integration = integrations[storeId];
      if (integration) {
        // Atualizar existente
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("erp_integrations")
          .update(payload)
          .eq("id", integration.id);

        if (error) throw error;
        toast.success("Credenciais atualizadas com sucesso!");
      } else {
        // Criar novo
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("erp_integrations")
          .insert(payload);

        if (error) throw error;
        toast.success("Credenciais salvas com sucesso!");
      }

      await fetchIntegration(storeId);
    } catch (error: any) {
      console.error("Erro ao salvar credenciais:", error);
      toast.error(error.message || "Erro ao salvar credenciais");
    } finally {
      setSaving(prev => ({ ...prev, [storeId]: false }));
    }
  };

  const handleConnect = async (storeId: string) => {
    const integration = integrations[storeId];
    if (!integration) {
      toast.error("Configure as credenciais primeiro");
      return;
    }

    if (!integration.client_id || !integration.client_secret) {
      toast.error("Client ID e Client Secret são obrigatórios");
      return;
    }

    setConnecting(prev => ({ ...prev, [storeId]: true }));
    try {
      const authUrl = await getERPAuthorizationUrl(storeId);
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Erro ao gerar URL de autorização:", error);
      toast.error(error.message || "Erro ao iniciar conexão OAuth");
      setConnecting(prev => ({ ...prev, [storeId]: false }));
    }
  };

  const handleTestConnection = async (storeId: string) => {
    const integration = integrations[storeId];
    if (!integration || integration.sync_status !== 'CONNECTED') {
      toast.error("Conecte a integração OAuth primeiro");
      return;
    }

    setTesting(prev => ({ ...prev, [storeId]: true }));
    try {
      const result = await testERPConnection(storeId);
      
      if (result.success) {
        toast.success(result.message);
        await fetchIntegration(storeId);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error("Erro ao testar conexão:", error);
      toast.error(error.message || "Erro ao testar conexão");
    } finally {
      setTesting(prev => ({ ...prev, [storeId]: false }));
    }
  };

  const handleSyncOrders = async (storeId: string, hardSync: boolean = false) => {
    const integration = integrations[storeId];
    if (!integration || integration.sync_status !== 'CONNECTED') {
      toast.error("Conecte a integração OAuth primeiro");
      return;
    }

    setSyncing(prev => ({ ...prev, [storeId]: true }));
    try {
      if (hardSync) {
        toast.info("🔥 HARD SYNC ABSOLUTO: Iniciando sincronização via Edge Function... Você pode fechar a página! Isso pode levar HORAS.");
        
        const supabaseUrl = (await import('@/integrations/supabase/client')).supabase.supabaseUrl;
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/sync-tiny-orders`;
        
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          },
          body: JSON.stringify({
            store_id: storeId,
            sync_type: 'ORDERS',
            hard_sync: true,
            data_inicio: '2010-01-01',
            max_pages: 99999,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
        }

        toast.success(`✅ Hard sync iniciado via Edge Function! Você pode fechar a página. Isso pode levar várias horas.`);
        await fetchIntegration(storeId);
      } else {
        toast.info("🔄 Sincronização incremental iniciada em background... Você pode fechar a página!");
        
        const netlifyFunctionUrl = '/.netlify/functions/sync-tiny-orders-background';
        const response = await fetch(netlifyFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            store_id: storeId,
            incremental: true,
            limit: 100,
            max_pages: 50,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
        }

        toast.success(`✅ Sincronização iniciada em background! Você pode fechar a página.`);
        await fetchIntegration(storeId);
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar pedidos:", error);
      toast.error(error.message || "Erro ao sincronizar pedidos");
    } finally {
      setSyncing(prev => ({ ...prev, [storeId]: false }));
    }
  };

  const handleSyncContacts = async (storeId: string, hardSync: boolean = false) => {
    const integration = integrations[storeId];
    if (!integration || integration.sync_status !== 'CONNECTED') {
      toast.error("Conecte a integração OAuth primeiro");
      return;
    }

    setSyncing(prev => ({ ...prev, [storeId]: true }));
    try {
      if (hardSync) {
        toast.info("🔥 HARD SYNC ABSOLUTO: Sincronizando TODAS as clientes em background... Você pode fechar a página! Isso pode levar HORAS.");
      } else {
        toast.info("🔄 Sincronização de clientes iniciada em background... Você pode fechar a página!");
      }
      
      const netlifyFunctionUrl = '/.netlify/functions/sync-tiny-contacts-background';
      const response = await fetch(netlifyFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: storeId,
          limit: 100,
          max_pages: hardSync ? 9999 : 50,
          hard_sync: hardSync,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
      }

      toast.success(`✅ Sincronização de clientes iniciada em background! Você pode fechar a página.`);
      await fetchIntegration(storeId);
    } catch (error: any) {
      console.error("Erro ao sincronizar clientes:", error);
      toast.error(error.message || "Erro ao sincronizar clientes");
    } finally {
      setSyncing(prev => ({ ...prev, [storeId]: false }));
    }
  };

  const getStatusBadge = (integration: ERPIntegration | null) => {
    if (!integration) {
      return <Badge variant="outline">Não Configurado</Badge>;
    }

    switch (integration.sync_status) {
      case 'CONNECTED':
        return <Badge className="bg-green-500">Conectado</Badge>;
      case 'DISCONNECTED':
        return <Badge variant="destructive">Desconectado</Badge>;
      case 'ERROR':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de ERP</CardTitle>
          <CardDescription>
            Configure as integrações de ERP para cada loja (1 ERP por loja)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stores.map((store) => {
              const integration = integrations[store.id];
              const isExpanded = expandedStores.has(store.id);
              const storeFormData = formData[store.id] || { sistema_erp: "TINY", client_id: "", client_secret: "" };
              const isSaving = saving[store.id] || false;
              const isConnecting = connecting[store.id] || false;
              const isTesting = testing[store.id] || false;
              const isSyncing = syncing[store.id] || false;
              const showSecretForStore = showSecret[store.id] || false;

              return (
                <Card key={store.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Store className="h-5 w-5" />
                        <div>
                          <CardTitle className="text-lg">{store.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(integration)}
                            {integration?.sistema_erp && (
                              <Badge variant="outline">{integration.sistema_erp}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStoreExpanded(store.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-4">
                      {/* Sistema ERP */}
                      <div className="space-y-2">
                        <Label>Sistema ERP:</Label>
                        <Select
                          value={storeFormData.sistema_erp}
                          onValueChange={(value) => {
                            setFormData(prev => ({
                              ...prev,
                              [store.id]: {
                                ...storeFormData,
                                sistema_erp: value
                              }
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ERP_TYPES.map((erp) => (
                              <SelectItem
                                key={erp.value}
                                value={erp.value}
                                disabled={!erp.available}
                              >
                                {erp.label}
                                {!erp.available && " (Em breve)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Client ID */}
                      <div className="space-y-2">
                        <Label htmlFor={`client_id_${store.id}`}>Client ID:</Label>
                        <Input
                          id={`client_id_${store.id}`}
                          type="text"
                          placeholder="Cole o Client ID aqui"
                          value={storeFormData.client_id}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              [store.id]: {
                                ...storeFormData,
                                client_id: e.target.value
                              }
                            }));
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Client ID gerado no aplicativo OAuth do sistema ERP
                        </p>
                      </div>

                      {/* Client Secret */}
                      <div className="space-y-2">
                        <Label htmlFor={`client_secret_${store.id}`}>Client Secret:</Label>
                        <div className="relative">
                          <Input
                            id={`client_secret_${store.id}`}
                            type={showSecretForStore ? "text" : "password"}
                            placeholder="Cole o Client Secret aqui"
                            value={storeFormData.client_secret}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                [store.id]: {
                                  ...storeFormData,
                                  client_secret: e.target.value
                                }
                              }));
                            }}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => {
                              setShowSecret(prev => ({
                                ...prev,
                                [store.id]: !showSecretForStore
                              }));
                            }}
                          >
                            {showSecretForStore ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Client Secret gerado no aplicativo OAuth do sistema ERP
                        </p>
                      </div>

                      {/* Botões: Salvar e Conectar */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => handleSave(store.id)}
                          disabled={isSaving || isConnecting || !storeFormData.client_id || !storeFormData.client_secret}
                          className="flex-1"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              {integration ? "Atualizar Credenciais" : "Salvar Credenciais"}
                            </>
                          )}
                        </Button>

                        {integration && integration.client_id && integration.client_secret && (
                          <Button
                            onClick={() => handleConnect(store.id)}
                            disabled={isSaving || isConnecting}
                            variant="outline"
                            className="flex-1"
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Conectando...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                {integration.sync_status === 'CONNECTED' ? 'Reautorizar' : 'Conectar'}
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Informações */}
                      {integration && (
                        <div className="space-y-2 pt-4 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Última Sincronização:</span>
                            <span>
                              {integration.last_sync_at
                                ? new Date(integration.last_sync_at).toLocaleString("pt-BR")
                                : "Nunca"}
                            </span>
                          </div>
                          {integration.error_message && (
                            <Alert variant="destructive">
                              <XCircle className="h-4 w-4" />
                              <AlertDescription>{integration.error_message}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}

                      {/* Sincronização */}
                      {integration && integration.sync_status === 'CONNECTED' && (
                        <div className="space-y-4 pt-4 border-t">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleTestConnection(store.id)}
                              disabled={isTesting || isSyncing}
                              variant="outline"
                              className="flex-1"
                            >
                              {isTesting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Testando...
                                </>
                              ) : (
                                <>
                                  <TestTube className="mr-2 h-4 w-4" />
                                  Testar Conexão
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Sincronização de Pedidos */}
                          <div className="space-y-2">
                            <Label>Pedidos de Venda:</Label>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSyncOrders(store.id, false)}
                                disabled={isSyncing || isTesting}
                                variant="outline"
                                className="flex-1"
                              >
                                {isSyncing ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sincronizando...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Sincronizar Pedidos
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => handleSyncOrders(store.id, true)}
                                disabled={isSyncing || isTesting}
                                variant="default"
                                className="flex-1 bg-orange-600 hover:bg-orange-700"
                              >
                                {isSyncing ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sincronizando...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    🔥 HARD SYNC Pedidos
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Incremental: apenas novos. Hard Sync: TODOS os pedidos desde sempre (pode levar HORAS).
                            </p>
                          </div>

                          {/* Sincronização de Clientes */}
                          <div className="space-y-2">
                            <Label>Clientes:</Label>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSyncContacts(store.id, false)}
                                disabled={isSyncing || isTesting}
                                variant="outline"
                                className="flex-1"
                              >
                                {isSyncing ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sincronizando...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Sincronizar Clientes
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => handleSyncContacts(store.id, true)}
                                disabled={isSyncing || isTesting}
                                variant="default"
                                className="flex-1 bg-orange-600 hover:bg-orange-700"
                              >
                                {isSyncing ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sincronizando...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    🔥 HARD SYNC Clientes
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Padrão: até 50 páginas. Hard Sync: TODAS as clientes desde sempre (pode levar HORAS).
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ERPConfigSuperAdmin;

