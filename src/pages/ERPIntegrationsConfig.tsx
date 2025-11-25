import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink, Settings, Store } from "lucide-react";
import { toast } from "sonner";
import { getERPAuthorizationUrl, testERPConnection, type SistemaERP } from "@/lib/erpIntegrations";

interface ERPIntegration {
  id: string;
  store_id: string;
  sistema_erp: string;
  sync_status: string;
  last_sync_at: string | null;
  error_message: string | null;
  token_expires_at: string | null;
}

interface Store {
  id: string;
  name: string;
}

const ERPIntegrationsConfig = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [integration, setIntegration] = useState<ERPIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!profile) {
        navigate("/");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      } else {
        fetchStores();
      }
    }
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchIntegration();
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
      
      // Selecionar primeira loja por padrão
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

      setIntegration(data);
    } catch (error: any) {
      console.error("Erro ao buscar integração:", error);
      toast.error("Erro ao carregar configurações");
    }
  };

  const handleConnect = async () => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    try {
      const authUrl = await getERPAuthorizationUrl(selectedStoreId);
      window.location.href = authUrl;
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar URL de autorização");
    }
  };

  const handleTestConnection = async () => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }

    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testERPConnection(selectedStoreId);
      setTestResult(result);
      
      if (result.success) {
        toast.success(result.message);
        await fetchIntegration(); // Atualizar status
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      const errorMessage = error.message || "Erro ao testar conexão";
      setTestResult({ success: false, message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setTesting(false);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    try {
      return new Date(dateString).toLocaleString("pt-BR");
    } catch {
      return "Data inválida";
    }
  };

  const isTokenExpired = () => {
    if (!integration?.token_expires_at) return false;
    return new Date(integration.token_expires_at) <= new Date();
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Integrações ERP</h1>
            <p className="text-muted-foreground">Configure integrações ERP por loja</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Voltar
          </Button>
        </div>

        {/* Seleção de Loja e Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Selecionar Loja e Sistema ERP
            </CardTitle>
            <CardDescription>
              Cada loja pode ter integração com diferentes sistemas ERP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Loja:</label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
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
            </div>

            {integration && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Sistema ERP Configurado:</label>
                <div className="p-3 bg-muted rounded-md">
                  <Badge variant="outline" className="text-base">
                    {integration.sistema_erp}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Card */}
        {selectedStoreId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Status da Conexão
              </CardTitle>
            <CardDescription>
              {selectedStore && `Loja: ${selectedStore.name}${integration ? ` | Sistema: ${integration.sistema_erp}` : ''}`}
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge()}
              </div>

              {integration && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Última Sincronização:</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(integration.last_sync_at)}
                    </span>
                  </div>

                  {integration.token_expires_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Token Expira em:</span>
                      <span className={`text-sm ${isTokenExpired() ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {formatDate(integration.token_expires_at)}
                        {isTokenExpired() && " (Expirado)"}
                      </span>
                    </div>
                  )}

                  {integration.error_message && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{integration.error_message}</AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {!integration && (
                <Alert>
                  <AlertDescription>
                    Nenhuma integração configurada para esta loja e sistema. Clique em "Conectar" para começar.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions Card */}
        {selectedStoreId && (
          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
              <CardDescription>
                Conecte ou teste a integração ERP da loja selecionada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {!integration || integration.sync_status !== 'CONNECTED' ? (
                  <Button onClick={handleConnect} className="flex-1" disabled={!selectedStoreId}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {integration ? `Conectar ${integration.sistema_erp}` : 'Configurar Integração'}
                  </Button>
                ) : (
                  <Button onClick={handleConnect} variant="outline" className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reautorizar Conexão
                  </Button>
                )}

                {integration && (
                  <Button
                    onClick={handleTestConnection}
                    disabled={testing || !selectedStoreId}
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
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Testar Conexão
                      </>
                    )}
                  </Button>
                )}
              </div>

              {testResult && (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
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
              • Cada loja tem apenas UMA integração ERP.
            </p>
            <p>
              • Cada loja tem suas próprias credenciais (Client ID e Secret).
            </p>
            <p>
              • O token de acesso expira e será renovado automaticamente.
            </p>
            <p>
              • Sistemas suportados: Tiny ERP (ativo), Bling, Microvix, Conta Azul (em breve).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ERPIntegrationsConfig;

