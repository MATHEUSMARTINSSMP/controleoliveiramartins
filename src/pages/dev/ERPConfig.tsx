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
import { Loader2, CheckCircle2, XCircle, Save, Store, Key, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

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
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedSistema, setSelectedSistema] = useState<string>("TINY");
  const [integration, setIntegration] = useState<ERPIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (selectedStoreId) {
      fetchIntegration();
    } else {
      setIntegration(null);
      setFormData({ client_id: "", client_secret: "" });
    }
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name, sistema_erp, active")
        .eq("active", true)
        .order("name");

      if (error) throw error;

      setStores(data || []);
      
      // Selecionar primeira loja por padrão
      if (data && data.length > 0) {
        setSelectedStoreId(data[0].id);
        // Se a loja já tem sistema_erp, usar ele
        if (data[0].sistema_erp) {
          setSelectedSistema(data[0].sistema_erp);
        }
      }
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

        {/* Seleção de Loja */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Selecionar Loja
            </CardTitle>
            <CardDescription>
              Escolha a loja para configurar as credenciais de integração
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Loja:</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                      {store.sistema_erp && (
                        <Badge variant="outline" className="ml-2">
                          {store.sistema_erp}
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

              {/* Botão Salvar */}
              <Button
                onClick={handleSave}
                disabled={saving || !formData.client_id || !formData.client_secret}
                className="w-full"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ERPConfig;

