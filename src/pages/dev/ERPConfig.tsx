import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Save, Store, Key, Eye, EyeOff, ExternalLink, TestTube, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { getERPAuthorizationUrl, testERPConnection } from "@/lib/erpIntegrations";
import { syncTinyOrders, syncTinyContacts } from "@/lib/erp/syncTiny";
import { WebhookConfig } from "@/components/dev/WebhookConfig";
import { UazapiConfig } from "@/components/dev/UazapiConfig";

interface Store {
  id: string;
  name: string;
  sistema_erp: string | null;
  active: boolean;
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

const ERPConfig = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [storeIntegrations, setStoreIntegrations] = useState<Record<string, ERPIntegration>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedSistema, setSelectedSistema] = useState<string>("TINY");
  const [integration, setIntegration] = useState<ERPIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  
  const [formData, setFormData] = useState({
    client_id: "",
    client_secret: "",
  });

  useEffect(() => {
    // Aguardar carregamento da autenticação
    if (authLoading) {
      return;
    }

    // Se não tem usuário logado, redirecionar para login dev
    if (!profile) {
      navigate("/dev/login", { replace: true });
      return;
    }

    // Verificar se é o usuário dev@dev.com
    if (profile.email !== "dev@dev.com") {
      toast.error("Acesso restrito. Apenas usuário dev autorizado.");
      navigate("/dev/login", { replace: true });
      return;
    }

    // Se chegou aqui, é o usuário dev - carregar dados
    fetchStores();
  }, [profile, authLoading, navigate]);


  // Verificar se voltou do OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const storeId = params.get('store_id');

    if (success === 'true' && storeId) {
      toast.success("Conexão OAuth autorizada com sucesso!");
      // Limpar URL
      window.history.replaceState({}, '', window.location.pathname);
      // Recarregar integração
      if (storeId === selectedStoreId) {
        fetchIntegration();
      } else {
        setSelectedStoreId(storeId);
      }
    } else if (error) {
      toast.error(`Erro na autorização OAuth: ${decodeURIComponent(error)}`);
      // Limpar URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      
      // Buscar TODAS as lojas (ativas e inativas)
      const { data: storesData, error: storesError } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name, sistema_erp, active")
        .order("name");

      if (storesError) throw storesError;

      const allStoresData = storesData || [];
      setAllStores(allStoresData);
      setStores(allStoresData); // Inicialmente todas as lojas
      
      // Buscar TODAS as integrações ERP de uma vez
      const { data: integrationsData, error: integrationsError } = await supabase
        .schema("sistemaretiradas")
        .from("erp_integrations")
        .select("*")
        .eq("active", true);

      if (integrationsError && integrationsError.code !== 'PGRST116') {
        console.error("Erro ao buscar integrações:", integrationsError);
      }

      // Criar mapa de integrações por store_id
      const integrationsMap: Record<string, ERPIntegration> = {};
      if (integrationsData) {
        integrationsData.forEach((int: any) => {
          integrationsMap[int.store_id] = int;
        });
      }
      setStoreIntegrations(integrationsMap);
      
      // Não selecionar loja por padrão - usuário deve escolher
    } catch (error: any) {
      console.error("Erro ao buscar lojas:", error);
      toast.error("Erro ao carregar lojas");
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegration = async () => {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("erp_integrations")
        .select("*")
        .eq("store_id", selectedStoreId)
        .eq("active", true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setIntegration(data);
        setFormData({
          client_id: data.client_id || "",
          client_secret: data.client_secret || "",
        });
        setSelectedSistema(data.sistema_erp || "TINY");
      } else {
        setIntegration(null);
        setFormData({ client_id: "", client_secret: "" });
        // Usar sistema_erp da loja se existir
        const store = stores.find(s => s.id === selectedStoreId);
        if (store?.sistema_erp) {
          setSelectedSistema(store.sistema_erp);
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar integração:", error);
      toast.error("Erro ao carregar configurações");
    }
  };

  const handleConnect = async () => {
    if (!selectedStoreId || !integration) {
      toast.error("Configure as credenciais primeiro");
      return;
    }

    if (!integration.client_id || !integration.client_secret) {
      toast.error("Client ID e Client Secret são obrigatórios");
      return;
    }

    setConnecting(true);
    try {
      const authUrl = await getERPAuthorizationUrl(selectedStoreId);
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Erro ao gerar URL de autorização:", error);
      toast.error(error.message || "Erro ao iniciar conexão OAuth");
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    if (!integration || integration.sync_status !== 'CONNECTED') {
      toast.error("Conecte a integração OAuth primeiro");
      return;
    }

    setTesting(true);
    try {
      const result = await testERPConnection(selectedStoreId);
      
      if (result.success) {
        toast.success(result.message);
        // Recarregar integração para atualizar last_sync_at
        await fetchIntegration();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error("Erro ao testar conexão:", error);
      toast.error(error.message || "Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const handleSyncOrders = async (hardSync: boolean = false) => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    if (!integration || integration.sync_status !== 'CONNECTED') {
      toast.error("Conecte a integração OAuth primeiro");
      return;
    }

    setSyncing(true);
    try {
      // ✅ HARD SYNC: Usar Edge Function do Supabase (tem timeout maior e melhor infraestrutura)
      // ✅ SYNC INCREMENTAL: Usar Netlify Function (mais rápido para syncs pequenos)
      if (hardSync) {
        toast.info("🔥 HARD SYNC ABSOLUTO: Iniciando sincronização via Edge Function... Você pode fechar a página! Isso pode levar HORAS.");
        
        // ✅ Para hard sync, usar Edge Function do Supabase
        const supabaseUrl = (await import('@/integrations/supabase/client')).supabase.supabaseUrl;
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/sync-tiny-orders`;
        
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
            'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            store_id: selectedStoreId,
            sync_type: 'ORDERS',
            hard_sync: true,
            data_inicio: '2010-01-01',
            max_pages: 99999,
            limit: hardSync ? undefined : 100, // Hard sync sem limite
          }),
        }).catch((fetchError: any) => {
          console.error("❌ Erro ao chamar Edge Function:", fetchError);
          throw new Error(`Erro ao iniciar hard sync: ${fetchError.message}`);
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
        }
        
        const responseText = await response.text();
        let data;
        try {
          data = responseText ? JSON.parse(responseText) : { success: true };
        } catch {
          data = { success: true };
        }
        
        if (data?.success || response.status === 202) {
          toast.success(`✅ Hard sync iniciado via Edge Function! Você pode fechar a página. Isso pode levar várias horas.`);
          await fetchIntegration();
        } else {
          throw new Error(data?.error || data?.message || 'Erro ao iniciar hard sync');
        }
        
        return;
      }
      
      // ✅ SYNC INCREMENTAL: Usar Netlify Function (mais rápido)
      toast.info("🔄 Sincronização incremental iniciada em background... Você pode fechar a página!");
      
      const netlifyFunctionUrl = '/.netlify/functions/sync-tiny-orders-background';
      
      const response = await fetch(netlifyFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: selectedStoreId,
          data_inicio: hardSync ? '2010-01-01' : undefined,
          incremental: !hardSync,
          limit: 100,
          max_pages: hardSync ? 99999 : 50,
          hard_sync: hardSync,
        }),
      }).catch((fetchError: any) => {
        console.error("❌ Erro ao chamar Netlify Function:", fetchError);
        throw new Error(`Erro ao iniciar sincronização: ${fetchError.message}`);
      });

      // ✅ Para hard sync, aceitar status 202 (Accepted) como sucesso
      // Status 202 indica que a requisição foi aceita para processamento assíncrono
      const isAccepted = response.status === 202;
      const isOk = response.ok || isAccepted;
      
      if (!isOk) {
        const errorText = await response.text();
        throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
      }

      // Verificar se a resposta está vazia antes de fazer parse
      const responseText = await response.text();
      
      // ✅ Se status 202 e resposta vazia, considerar sucesso (processamento em background)
      if (isAccepted && (!responseText || responseText.trim() === '')) {
        toast.success(`✅ Hard sync iniciado em background! Você pode fechar a página. Isso pode levar várias horas.`);
        await fetchIntegration();
        return;
      }
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Resposta vazia do servidor. Tente novamente.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        // ✅ Se status 202 e parse falhou, ainda considerar sucesso para hard sync
        if (isAccepted) {
          toast.success(`✅ Hard sync iniciado em background! Você pode fechar a página. Isso pode levar várias horas.`);
          await fetchIntegration();
          return;
        }
        console.error('Erro ao fazer parse da resposta:', parseError);
        throw new Error(`Erro ao processar resposta do servidor: ${parseError.message}`);
      }
      
      if (data?.success || isAccepted) {
        toast.success(`✅ Sincronização iniciada em background! Você pode fechar a página. ${data?.message || 'Processando...'}`);
        await fetchIntegration();
      } else {
        throw new Error(data?.error || data?.message || 'Erro ao iniciar sincronização');
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar pedidos:", error);
      toast.error(error.message || "Erro ao sincronizar pedidos");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncContacts = async (hardSync: boolean = false) => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    if (!integration || integration.sync_status !== 'CONNECTED') {
      toast.error("Conecte a integração OAuth primeiro");
      return;
    }

    setSyncing(true);
    try {
      // ✅ TODAS AS SINCRONIZAÇÕES MANUAIS RODAM EM BACKGROUND
      // Chamar diretamente a Netlify Function (backend) para rodar em background
      if (hardSync) {
        toast.info("🔥 HARD SYNC ABSOLUTO: Sincronizando TODAS as clientes em background... Você pode fechar a página! Isso pode levar HORAS.");
      } else {
        toast.info("🔄 Sincronização de clientes iniciada em background... Você pode fechar a página!");
      }
      
      // ✅ Chamar diretamente a Netlify Function (roda em background no servidor)
      const netlifyFunctionUrl = '/.netlify/functions/sync-tiny-contacts-background';
      
      const response = await fetch(netlifyFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_id: selectedStoreId,
          limit: 100,
          max_pages: hardSync ? 9999 : 50,
          hard_sync: hardSync,
        }),
      }).catch((fetchError: any) => {
        console.error("❌ Erro ao chamar Netlify Function:", fetchError);
        throw new Error(`Erro ao iniciar sincronização: ${fetchError.message}`);
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
      }

      // ✅ Para hard sync, aceitar status 202 (Accepted) como sucesso
      const isAccepted = response.status === 202;
      const isOk = response.ok || isAccepted;
      
      if (!isOk) {
        const errorText = await response.text();
        throw new Error(`Erro na sincronização: ${errorText || response.statusText}`);
      }

      // Verificar se a resposta está vazia antes de fazer parse
      const responseText = await response.text();
      
      // ✅ Se status 202 e resposta vazia, considerar sucesso (processamento em background)
      if (isAccepted && (!responseText || responseText.trim() === '')) {
        toast.success(`✅ Hard sync de clientes iniciado em background! Você pode fechar a página. Isso pode levar várias horas.`);
        await fetchIntegration();
        return;
      }
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Resposta vazia do servidor. Tente novamente.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        // ✅ Se status 202 e parse falhou, ainda considerar sucesso para hard sync
        if (isAccepted) {
          toast.success(`✅ Hard sync de clientes iniciado em background! Você pode fechar a página. Isso pode levar várias horas.`);
          await fetchIntegration();
          return;
        }
        console.error('Erro ao fazer parse da resposta:', parseError);
        throw new Error(`Erro ao processar resposta do servidor: ${parseError.message}`);
      }
      
      if (data?.success || isAccepted) {
        toast.success(`✅ Sincronização de clientes iniciada em background! Você pode fechar a página. ${data?.message || 'Processando...'}`);
        await fetchIntegration();
      } else {
        throw new Error(data?.error || data?.message || 'Erro ao iniciar sincronização');
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar clientes:", error);
      toast.error(error.message || "Erro ao sincronizar clientes");
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    if (!formData.client_id || !formData.client_secret) {
      toast.error("Preencha Client ID e Client Secret");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        store_id: selectedStoreId,
        sistema_erp: selectedSistema,
        client_id: formData.client_id.trim(),
        client_secret: formData.client_secret.trim(),
        sync_status: 'DISCONNECTED',
        active: true,
      };

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

      await fetchIntegration();
    } catch (error: any) {
      console.error("Erro ao salvar credenciais:", error);
      toast.error(error.message || "Erro ao salvar credenciais");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
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

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  // Filtrar lojas baseado no termo de busca
  const filteredStores = allStores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (store.sistema_erp && store.sistema_erp.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Atualizar stores filtradas quando searchTerm muda
  useEffect(() => {
    setStores(filteredStores);
  }, [searchTerm, allStores]);

  // Atualizar integration quando seleciona loja (usar dados já carregados se disponível)
  useEffect(() => {
    if (selectedStoreId && storeIntegrations[selectedStoreId]) {
      const existingIntegration = storeIntegrations[selectedStoreId];
      setIntegration(existingIntegration);
      setFormData({
        client_id: existingIntegration.client_id || "",
        client_secret: existingIntegration.client_secret || "",
      });
      setSelectedSistema(existingIntegration.sistema_erp || "TINY");
    } else if (selectedStoreId) {
      // Se não tem nos dados carregados, buscar
      fetchIntegration();
    } else {
      setIntegration(null);
      setFormData({ client_id: "", client_secret: "" });
    }
  }, [selectedStoreId]);

  // Mostrar loading enquanto autentica ou carrega dados
  if (authLoading || (profile && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Se não tem profile ainda (mas authLoading já terminou), não renderizar nada
  // O useEffect vai redirecionar
  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Painel Dev - Configuração ERP</h1>
            <p className="text-muted-foreground">Configure credenciais de integração ERP por loja</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Voltar
          </Button>
        </div>

        {/* Lista de Lojas com Tokens Configurados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Lojas e Integrações ERP ({allStores.length} lojas)
            </CardTitle>
            <CardDescription>
              Todas as lojas e suas configurações de integração ERP. Clique em uma loja para configurar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campo de Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome da loja ou sistema ERP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tabela de Lojas */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sistema ERP</TableHead>
                    <TableHead>Integração</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma loja encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStores.map((store) => {
                      const storeIntegration = storeIntegrations[store.id];
                      const isSelected = selectedStoreId === store.id;
                      
                      return (
                        <TableRow
                          key={store.id}
                          className={isSelected ? "bg-primary/10" : "cursor-pointer hover:bg-muted/50"}
                          onClick={() => setSelectedStoreId(store.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {store.name}
                              {!store.active && (
                                <Badge variant="outline" className="text-xs">Inativa</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {store.active ? (
                              <Badge className="bg-green-500">Ativa</Badge>
                            ) : (
                              <Badge variant="outline">Inativa</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {store.sistema_erp ? (
                              <Badge variant="outline">{store.sistema_erp}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {storeIntegration ? (
                              <Badge
                                className={
                                  storeIntegration.sync_status === 'CONNECTED'
                                    ? 'bg-green-500'
                                    : storeIntegration.sync_status === 'ERROR'
                                    ? 'bg-red-500'
                                    : 'bg-yellow-500'
                                }
                              >
                                {storeIntegration.sync_status === 'CONNECTED' ? 'Conectado' :
                                 storeIntegration.sync_status === 'ERROR' ? 'Erro' :
                                 'Desconectado'}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Não Configurado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {storeIntegration?.client_id ? (
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[150px]">
                                  {storeIntegration.client_id.substring(0, 20)}...
                                </code>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {storeIntegration?.last_sync_at ? (
                              <span className="text-sm text-muted-foreground">
                                {new Date(storeIntegration.last_sync_at).toLocaleDateString("pt-BR")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStoreId(store.id);
                              }}
                            >
                              {isSelected ? "Selecionada" : "Selecionar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Configuração de Credenciais */}
        {selectedStoreId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Credenciais de Integração
              </CardTitle>
              <CardDescription>
                {selectedStore && `Loja: ${selectedStore.name}`}
                {integration && (
                  <>
                    {" | "}
                    Status: {getStatusBadge()}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sistema ERP */}
              <div className="space-y-2">
                <Label>Sistema ERP:</Label>
                <Select value={selectedSistema} onValueChange={setSelectedSistema}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TINY">Tiny ERP</SelectItem>
                    <SelectItem value="BLING" disabled>Bling (Em breve)</SelectItem>
                    <SelectItem value="MICROVIX" disabled>Microvix (Em breve)</SelectItem>
                    <SelectItem value="CONTA_AZUL" disabled>Conta Azul (Em breve)</SelectItem>
                  </SelectContent>
                </Select>
                {selectedStore?.sistema_erp && selectedStore.sistema_erp !== selectedSistema && (
                  <Alert>
                    <AlertDescription>
                      ⚠️ A loja está configurada com sistema <strong>{selectedStore.sistema_erp}</strong>, 
                      mas você está configurando <strong>{selectedSistema}</strong>.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Client ID */}
              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID:</Label>
                <Input
                  id="client_id"
                  type="text"
                  placeholder="Cole o Client ID aqui"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Client ID gerado no aplicativo OAuth do sistema ERP
                </p>
              </div>

              {/* Client Secret */}
              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret:</Label>
                <div className="relative">
                  <Input
                    id="client_secret"
                    type={showSecret ? "text" : "password"}
                    placeholder="Cole o Client Secret aqui"
                    value={formData.client_secret}
                    onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? (
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
                  onClick={handleSave}
                  disabled={saving || connecting || !formData.client_id || !formData.client_secret}
                  className="flex-1"
                >
                  {saving ? (
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
                    onClick={handleConnect}
                    disabled={saving || connecting}
                    variant="outline"
                    className="flex-1"
                  >
                    {connecting ? (
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
            </CardContent>
          </Card>
        )}

        {/* Sincronização */}
        {integration && integration.sync_status === 'CONNECTED' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Sincronização
              </CardTitle>
              <CardDescription>
                Sincronize dados do Tiny ERP. Use Hard Sync para sincronização inicial completa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Testar Conexão */}
              <div className="flex gap-2">
                <Button
                  onClick={handleTestConnection}
                  disabled={testing || syncing}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? (
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
                    onClick={() => handleSyncOrders(false)}
                    disabled={syncing || testing}
                    variant="outline"
                    className="flex-1"
                  >
                    {syncing ? (
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
                    onClick={() => handleSyncOrders(true)}
                    disabled={syncing || testing}
                    variant="default"
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        🔥 HARD SYNC ABSOLUTO Pedidos (Todos desde sempre)
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Incremental: apenas novos. Hard Sync Absoluto: TODOS os pedidos desde sempre (pode levar HORAS).
                </p>
              </div>

              {/* Sincronização de Clientes */}
              <div className="space-y-2">
                <Label>Clientes:</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSyncContacts(false)}
                    disabled={syncing || testing}
                    variant="outline"
                    className="flex-1"
                  >
                    {syncing ? (
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
                    onClick={() => handleSyncContacts(true)}
                    disabled={syncing || testing}
                    variant="default"
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        🔥 HARD SYNC ABSOLUTO Clientes (Todas desde sempre)
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Padrão: até 50 páginas. Hard Sync Absoluto: TODAS as clientes desde sempre (pode levar HORAS).
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* UazAPI Config Section */}
        <UazapiConfig />

        {/* Webhook Config Section */}
        <WebhookConfig />

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • Cada loja precisa criar seu próprio aplicativo OAuth no sistema ERP.
            </p>
            <p>
              • Após criar o aplicativo, copie o Client ID e Client Secret.
            </p>
            <p>
              • Cole as credenciais aqui e salve.
            </p>
            <p>
              • Após salvar, você poderá iniciar o fluxo OAuth para autorizar o acesso.
            </p>
            <p className="pt-2 font-semibold">
              • 🔥 HARD SYNC: Use para sincronização inicial completa. Pode levar vários minutos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ERPConfig;

