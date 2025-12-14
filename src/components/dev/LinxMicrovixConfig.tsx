import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle, Save, Store, Key, Eye, EyeOff, TestTube, RefreshCw, Gift, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { 
  testarConexaoHubFidelidade, 
  testarConexaoWebService,
  syncVendasLinx 
} from "@/lib/linxMicrovix";

interface StoreOption {
  id: string;
  name: string;
}

interface LinxConfig {
  id?: string;
  store_id: string;
  cnpj: string;
  nome_loja: string;
  hub_token_produto: string;
  hub_token_parceiro: string;
  hub_id_parceiro: number | null;
  hub_ambiente: "homologacao" | "producao";
  hub_url_producao: string;
  hub_active: boolean;
  hub_sync_status: string;
  hub_last_sync_at: string | null;
  hub_error_message: string | null;
  ws_portal: string;
  ws_chave: string;
  ws_usuario: string;
  ws_senha: string;
  ws_grupo: string;
  ws_ambiente: "homologacao" | "producao";
  ws_url_producao: string;
  ws_active: boolean;
  ws_sync_status: string;
  ws_last_sync_at: string | null;
  ws_error_message: string | null;
  active: boolean;
}

const defaultConfig: Omit<LinxConfig, 'store_id'> = {
  cnpj: "",
  nome_loja: "",
  hub_token_produto: "",
  hub_token_parceiro: "",
  hub_id_parceiro: null,
  hub_ambiente: "homologacao",
  hub_url_producao: "",
  hub_active: false,
  hub_sync_status: "DISCONNECTED",
  hub_last_sync_at: null,
  hub_error_message: null,
  ws_portal: "",
  ws_chave: "",
  ws_usuario: "linx_b2c",
  ws_senha: "linx_b2c",
  ws_grupo: "",
  ws_ambiente: "homologacao",
  ws_url_producao: "",
  ws_active: false,
  ws_sync_status: "DISCONNECTED",
  ws_last_sync_at: null,
  ws_error_message: null,
  active: true,
};

export function LinxMicrovixConfig() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [config, setConfig] = useState<LinxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingHub, setTestingHub] = useState(false);
  const [testingWS, setTestingWS] = useState(false);
  const [syncingVendas, setSyncingVendas] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  const [formData, setFormData] = useState<Omit<LinxConfig, 'store_id' | 'id'>>({
    ...defaultConfig,
  });

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchConfig();
    } else {
      setConfig(null);
      setFormData({ ...defaultConfig });
    }
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (error) throw error;

      setStores(data || []);
      if (data && data.length > 0) {
        setSelectedStoreId(data[0].id);
      }
    } catch (error: any) {
      console.error("Erro ao buscar lojas:", error);
      toast.error("Erro ao carregar lojas");
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    if (!selectedStoreId) return;

    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("linx_microvix_config")
        .select("*")
        .eq("store_id", selectedStoreId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setConfig(data as LinxConfig);
        setFormData({
          cnpj: data.cnpj || "",
          nome_loja: data.nome_loja || "",
          hub_token_produto: data.hub_token_produto || "",
          hub_token_parceiro: data.hub_token_parceiro || "",
          hub_id_parceiro: data.hub_id_parceiro,
          hub_ambiente: data.hub_ambiente || "homologacao",
          hub_url_producao: data.hub_url_producao || "",
          hub_active: data.hub_active || false,
          hub_sync_status: data.hub_sync_status || "DISCONNECTED",
          hub_last_sync_at: data.hub_last_sync_at,
          hub_error_message: data.hub_error_message,
          ws_portal: data.ws_portal || "",
          ws_chave: data.ws_chave || "",
          ws_usuario: data.ws_usuario || "linx_b2c",
          ws_senha: data.ws_senha || "linx_b2c",
          ws_grupo: data.ws_grupo || "",
          ws_ambiente: data.ws_ambiente || "homologacao",
          ws_url_producao: data.ws_url_producao || "",
          ws_active: data.ws_active || false,
          ws_sync_status: data.ws_sync_status || "DISCONNECTED",
          ws_last_sync_at: data.ws_last_sync_at,
          ws_error_message: data.ws_error_message,
          active: data.active !== false,
        });
      } else {
        setConfig(null);
        setFormData({ ...defaultConfig });
      }
    } catch (error: any) {
      console.error("Erro ao buscar config Linx:", error);
      toast.error("Erro ao carregar configuracao Linx Microvix");
    }
  };

  const handleSave = async () => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    if (!formData.cnpj || !formData.nome_loja) {
      toast.error("CNPJ e Nome da Loja sao obrigatorios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        store_id: selectedStoreId,
        ...formData,
      };

      if (config?.id) {
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("linx_microvix_config")
          .update(payload)
          .eq("id", config.id);

        if (error) throw error;
        toast.success("Configuracao atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("linx_microvix_config")
          .insert(payload);

        if (error) throw error;
        toast.success("Configuracao salva com sucesso!");
      }

      await fetchConfig();
    } catch (error: any) {
      console.error("Erro ao salvar config:", error);
      toast.error(error.message || "Erro ao salvar configuracao");
    } finally {
      setSaving(false);
    }
  };

  const handleTestHub = async () => {
    if (!selectedStoreId) return;

    setTestingHub(true);
    try {
      const result = await testarConexaoHubFidelidade(selectedStoreId);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      await fetchConfig();
    } catch (error: any) {
      toast.error(error.message || "Erro ao testar conexao Hub");
    } finally {
      setTestingHub(false);
    }
  };

  const handleTestWS = async () => {
    if (!selectedStoreId) return;

    setTestingWS(true);
    try {
      const result = await testarConexaoWebService(selectedStoreId);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      await fetchConfig();
    } catch (error: any) {
      toast.error(error.message || "Erro ao testar conexao WebService");
    } finally {
      setTestingWS(false);
    }
  };

  const handleSyncVendas = async () => {
    if (!selectedStoreId) return;

    setSyncingVendas(true);
    try {
      const result = await syncVendasLinx(selectedStoreId);
      if (result.success) {
        toast.success(`Sincronizacao concluida: ${result.registros_inseridos || 0} novos registros`);
      } else {
        toast.error(result.error || "Erro na sincronizacao");
      }
      await fetchConfig();
    } catch (error: any) {
      toast.error(error.message || "Erro ao sincronizar vendas");
    } finally {
      setSyncingVendas(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONNECTED":
        return <Badge className="bg-green-500">Conectado</Badge>;
      case "SYNCING":
        return <Badge className="bg-blue-500">Sincronizando</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">Desconectado</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Nunca";
    return new Date(date).toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Linx Microvix - Selecionar Loja
          </CardTitle>
          <CardDescription>
            Configure integracao Hub Fidelidade e WebService de Saida por loja
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger data-testid="select-linx-store">
              <SelectValue placeholder="Selecione uma loja" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedStoreId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Dados Basicos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    data-testid="input-linx-cnpj"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome_loja">Nome da Loja *</Label>
                  <Input
                    id="nome_loja"
                    placeholder="Nome conforme cadastro Linx"
                    value={formData.nome_loja}
                    onChange={(e) => setFormData({ ...formData, nome_loja: e.target.value })}
                    data-testid="input-linx-nome-loja"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  data-testid="switch-linx-active"
                />
                <Label>Integracao Ativa</Label>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="hub" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hub" className="gap-2" data-testid="tab-linx-hub">
                <Gift className="h-4 w-4" />
                Hub Fidelidade
              </TabsTrigger>
              <TabsTrigger value="ws" className="gap-2" data-testid="tab-linx-ws">
                <ShoppingCart className="h-4 w-4" />
                WebService Vendas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hub" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Gift className="h-5 w-5" />
                      Hub Fidelidade (Cashback/Pontos)
                    </span>
                    {getStatusBadge(formData.hub_sync_status)}
                  </CardTitle>
                  <CardDescription>
                    Integracao com programa de fidelidade Linx
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.hub_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, hub_active: checked })}
                      data-testid="switch-hub-active"
                    />
                    <Label>Hub Fidelidade Ativo</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Ambiente</Label>
                    <Select
                      value={formData.hub_ambiente}
                      onValueChange={(v) => setFormData({ ...formData, hub_ambiente: v as "homologacao" | "producao" })}
                    >
                      <SelectTrigger data-testid="select-hub-ambiente">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homologacao">Homologacao</SelectItem>
                        <SelectItem value="producao">Producao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.hub_ambiente === "producao" && (
                    <div className="space-y-2">
                      <Label htmlFor="hub_url_producao">URL de Producao</Label>
                      <Input
                        id="hub_url_producao"
                        placeholder="https://..."
                        value={formData.hub_url_producao}
                        onChange={(e) => setFormData({ ...formData, hub_url_producao: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Tokens de Autenticacao</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTokens(!showTokens)}
                      >
                        {showTokens ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Input
                      placeholder="Token Produto (Microvix)"
                      type={showTokens ? "text" : "password"}
                      value={formData.hub_token_produto}
                      onChange={(e) => setFormData({ ...formData, hub_token_produto: e.target.value })}
                      data-testid="input-hub-token-produto"
                    />
                    <Input
                      placeholder="Token Parceiro"
                      type={showTokens ? "text" : "password"}
                      value={formData.hub_token_parceiro}
                      onChange={(e) => setFormData({ ...formData, hub_token_parceiro: e.target.value })}
                      data-testid="input-hub-token-parceiro"
                    />
                    <Input
                      placeholder="ID Parceiro (numero)"
                      type="number"
                      value={formData.hub_id_parceiro ?? ""}
                      onChange={(e) => setFormData({ ...formData, hub_id_parceiro: e.target.value ? parseInt(e.target.value) : null })}
                      data-testid="input-hub-id-parceiro"
                    />
                  </div>

                  {formData.hub_error_message && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{formData.hub_error_message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Ultima sincronizacao:</span>
                    <span>{formatDate(formData.hub_last_sync_at)}</span>
                  </div>

                  <Button
                    onClick={handleTestHub}
                    disabled={testingHub || !formData.hub_active}
                    variant="outline"
                    className="w-full"
                    data-testid="button-test-hub"
                  >
                    {testingHub ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>
                        <TestTube className="mr-2 h-4 w-4" />
                        Testar Conexao Hub Fidelidade
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ws" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      WebService de Saida (Vendas)
                    </span>
                    {getStatusBadge(formData.ws_sync_status)}
                  </CardTitle>
                  <CardDescription>
                    Sincronizacao de vendas do Microvix (similar ao Tiny)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.ws_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, ws_active: checked })}
                      data-testid="switch-ws-active"
                    />
                    <Label>WebService Ativo</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Ambiente</Label>
                    <Select
                      value={formData.ws_ambiente}
                      onValueChange={(v) => setFormData({ ...formData, ws_ambiente: v as "homologacao" | "producao" })}
                    >
                      <SelectTrigger data-testid="select-ws-ambiente">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homologacao">Homologacao</SelectItem>
                        <SelectItem value="producao">Producao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.ws_ambiente === "producao" && (
                    <div className="space-y-2">
                      <Label htmlFor="ws_url_producao">URL de Producao</Label>
                      <Input
                        id="ws_url_producao"
                        placeholder="http://webapi.microvix.com.br/..."
                        value={formData.ws_url_producao}
                        onChange={(e) => setFormData({ ...formData, ws_url_producao: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ws_portal">Portal</Label>
                      <Input
                        id="ws_portal"
                        placeholder="Nome do portal"
                        value={formData.ws_portal}
                        onChange={(e) => setFormData({ ...formData, ws_portal: e.target.value })}
                        data-testid="input-ws-portal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ws_grupo">Grupo</Label>
                      <Input
                        id="ws_grupo"
                        placeholder="Grupo informado na ativacao"
                        value={formData.ws_grupo}
                        onChange={(e) => setFormData({ ...formData, ws_grupo: e.target.value })}
                        data-testid="input-ws-grupo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ws_chave">Chave de Acesso</Label>
                    <Input
                      id="ws_chave"
                      type={showTokens ? "text" : "password"}
                      placeholder="Chave fornecida na ativacao"
                      value={formData.ws_chave}
                      onChange={(e) => setFormData({ ...formData, ws_chave: e.target.value })}
                      data-testid="input-ws-chave"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ws_usuario">Usuario</Label>
                      <Input
                        id="ws_usuario"
                        placeholder="linx_b2c"
                        value={formData.ws_usuario}
                        onChange={(e) => setFormData({ ...formData, ws_usuario: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ws_senha">Senha</Label>
                      <Input
                        id="ws_senha"
                        type={showTokens ? "text" : "password"}
                        placeholder="linx_b2c"
                        value={formData.ws_senha}
                        onChange={(e) => setFormData({ ...formData, ws_senha: e.target.value })}
                      />
                    </div>
                  </div>

                  {formData.ws_error_message && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{formData.ws_error_message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Ultima sincronizacao:</span>
                    <span>{formatDate(formData.ws_last_sync_at)}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleTestWS}
                      disabled={testingWS || !formData.ws_active}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-test-ws"
                    >
                      {testingWS ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <TestTube className="mr-2 h-4 w-4" />
                          Testar Conexao
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSyncVendas}
                      disabled={syncingVendas || !formData.ws_active || formData.ws_sync_status !== "CONNECTED"}
                      className="flex-1"
                      data-testid="button-sync-vendas"
                    >
                      {syncingVendas ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sincronizar Vendas
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleSave}
                disabled={saving || !formData.cnpj || !formData.nome_loja}
                className="w-full"
                data-testid="button-save-linx-config"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {config ? "Atualizar Configuracao" : "Salvar Configuracao"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informacoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Hub Fidelidade:</strong> Programa de cashback/pontos integrado ao PDV Linx.
              </p>
              <p>
                <strong>WebService Saida:</strong> Sincronizacao de vendas do Microvix (similar ao Tiny ERP).
              </p>
              <p>
                • CNPJ e Nome da Loja devem corresponder ao cadastro na Linx.
              </p>
              <p>
                • Tokens sao fornecidos pela Linx na ativacao do servico.
              </p>
              <p>
                • Use ambiente Homologacao para testes antes de ir para Producao.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
