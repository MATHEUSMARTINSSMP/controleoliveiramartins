import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink, Settings } from "lucide-react";
import { toast } from "sonner";
import { getTinyAuthorizationUrl, testTinyConnection } from "@/lib/tinyApi";

interface TinyCredentials {
  id: string;
  sync_status: string;
  last_sync_at: string | null;
  error_message: string | null;
  token_expires_at: string | null;
}

const TinyApiConfig = () => {
  const { profile, loading: authLoading } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<TinyCredentials | null>(null);
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
        fetchCredentials();
      }
    }
  }, [profile, authLoading, navigate]);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("tiny_api_credentials")
        .select("*")
        .eq("active", true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setCredentials(data);
    } catch (error: any) {
      console.error("Erro ao buscar credenciais:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      // Buscar tenant_id do profile (se houver)
      // Por enquanto, não passamos tenant_id (usa padrão)
      const authUrl = await getTinyAuthorizationUrl();
      window.location.href = authUrl;
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar URL de autorização");
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testTinyConnection();
      setTestResult(result);
      
      if (result.success) {
        toast.success(result.message);
        await fetchCredentials(); // Atualizar status
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
    if (!credentials) {
      return <Badge variant="outline">Não Configurado</Badge>;
    }

    switch (credentials.sync_status) {
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
    if (!credentials?.token_expires_at) return false;
    return new Date(credentials.token_expires_at) <= new Date();
  };

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
            <h1 className="text-2xl font-bold">Configuração Tiny ERP</h1>
            <p className="text-muted-foreground">Gerencie a integração com o Tiny ERP</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Voltar
          </Button>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Status da Conexão
            </CardTitle>
            <CardDescription>
              Informações sobre a conexão com o Tiny ERP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              {getStatusBadge()}
            </div>

            {credentials && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Última Sincronização:</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(credentials.last_sync_at)}
                  </span>
                </div>

                {credentials.token_expires_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Token Expira em:</span>
                    <span className={`text-sm ${isTokenExpired() ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatDate(credentials.token_expires_at)}
                      {isTokenExpired() && " (Expirado)"}
                    </span>
                  </div>
                )}

                {credentials.error_message && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{credentials.error_message}</AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {!credentials && (
              <Alert>
                <AlertDescription>
                  Nenhuma conexão configurada. Clique em "Conectar com Tiny ERP" para começar.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
            <CardDescription>
              Conecte ou teste a integração com o Tiny ERP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {!credentials || credentials.sync_status !== 'CONNECTED' ? (
                <Button onClick={handleConnect} className="flex-1">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Conectar com Tiny ERP
                </Button>
              ) : (
                <Button onClick={handleConnect} variant="outline" className="flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reautorizar Conexão
                </Button>
              )}

              {credentials && (
                <Button
                  onClick={handleTestConnection}
                  disabled={testing}
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

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • A conexão com Tiny ERP permite sincronizar produtos, pedidos e estoque.
            </p>
            <p>
              • O token de acesso expira após algumas horas e será renovado automaticamente.
            </p>
            <p>
              • Se a conexão falhar, clique em "Reautorizar Conexão" para obter um novo token.
            </p>
            <p>
              • Cada tenant (empresa) pode ter suas próprias credenciais Tiny ERP.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TinyApiConfig;

