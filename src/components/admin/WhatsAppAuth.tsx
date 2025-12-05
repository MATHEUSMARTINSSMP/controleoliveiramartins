import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, QrCode, CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface WhatsAppAuthProps {
  storeId: string;
  storeName: string;
  customerId: string; // Email do admin
  siteSlug: string; // Nome da loja (normalizado)
  onAuthSuccess?: () => void;
}

interface AuthStatus {
  status: 'not_configured' | 'connecting' | 'connected' | 'disconnected' | 'error';
  qr_code?: string | null;
  instance_id?: string | null;
  phone_number?: string | null;
  instance_name?: string | null;
}

export const WhatsAppAuth = ({
  storeId,
  storeName,
  customerId,
  siteSlug,
  onAuthSuccess,
}: WhatsAppAuthProps) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Verificar status inicial
  useEffect(() => {
    if (customerId && siteSlug) {
      checkStatus();
    }
  }, [customerId, siteSlug]);

  // Polling para verificar status quando está conectando
  useEffect(() => {
    if (polling && authStatus?.status === 'connecting') {
      pollingIntervalRef.current = setInterval(() => {
        checkStatus(true); // silent check
      }, 5000); // Verificar a cada 5 segundos
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [polling, authStatus?.status]);

  const checkStatus = async (silent = false) => {
    if (!customerId || !siteSlug) return;

    if (!silent) {
      setCheckingStatus(true);
    }

    try {
      const isDevelopment = import.meta.env.DEV;
      const baseUrl = isDevelopment
        ? 'http://localhost:8888'
        : window.location.origin;

      const response = await fetch(`${baseUrl}/.netlify/functions/whatsapp-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
          site_slug: siteSlug,
          store_id: storeId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAuthStatus({
          status: data.status || 'not_configured',
          qr_code: data.qr_code,
          instance_id: data.instance_id,
          phone_number: data.phone_number,
          instance_name: data.instance_name,
        });

        // Se conectou, parar polling e chamar callback
        if (data.status === 'connected' && polling) {
          setPolling(false);
          if (onAuthSuccess) {
            onAuthSuccess();
          }
          toast.success('WhatsApp conectado com sucesso!');
        }
      } else {
        throw new Error(data.error || 'Erro ao verificar status');
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      if (!silent) {
        toast.error('Erro ao verificar status: ' + error.message);
      }
    } finally {
      if (!silent) {
        setCheckingStatus(false);
      }
    }
  };

  const startAuth = async () => {
    if (!customerId || !siteSlug) {
      toast.error('Dados insuficientes para iniciar autenticação');
      return;
    }

    setLoading(true);
    try {
      const isDevelopment = import.meta.env.DEV;
      const baseUrl = isDevelopment
        ? 'http://localhost:8888'
        : window.location.origin;

      const response = await fetch(`${baseUrl}/.netlify/functions/whatsapp-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
          site_slug: siteSlug,
          store_id: storeId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAuthStatus({
          status: data.status || 'connecting',
          qr_code: data.qr_code,
          instance_id: data.instance_id,
          phone_number: data.phone_number,
        });

        // Iniciar polling se estiver conectando
        if (data.status === 'connecting' && data.qr_code) {
          setPolling(true);
          toast.success('QR Code gerado! Escaneie com seu WhatsApp.');
        } else if (data.status === 'connected') {
          if (onAuthSuccess) {
            onAuthSuccess();
          }
          toast.success('WhatsApp já está conectado!');
        }
      } else {
        throw new Error(data.error || 'Erro ao iniciar autenticação');
      }
    } catch (error: any) {
      console.error('Erro ao iniciar autenticação:', error);
      toast.error('Erro ao iniciar autenticação: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!authStatus) {
      return (
        <Badge variant="secondary">
          <WifiOff className="h-3 w-3 mr-1" />
          Não Verificado
        </Badge>
      );
    }

    switch (authStatus.status) {
      case 'connected':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Conectando...
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <WifiOff className="h-3 w-3 mr-1" />
            Não Configurado
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Autenticação WhatsApp
            </CardTitle>
            <CardDescription>
              Conecte seu WhatsApp escaneando o QR Code
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {authStatus?.status === 'connected' && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700 dark:text-green-400">
              WhatsApp Conectado
            </AlertTitle>
            <AlertDescription className="text-green-600 dark:text-green-300">
              {authStatus.phone_number && (
                <p>Número: {authStatus.phone_number}</p>
              )}
              {authStatus.instance_name && (
                <p>Instância: {authStatus.instance_name}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {authStatus?.status === 'connecting' && authStatus.qr_code && (
          <div className="space-y-4">
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <QrCode className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-700 dark:text-yellow-400">
                Escaneie o QR Code
              </AlertTitle>
              <AlertDescription className="text-yellow-600 dark:text-yellow-300">
                <p>Abra o WhatsApp no seu celular e escaneie o código abaixo.</p>
                <p className="text-xs mt-2">Aguardando conexão...</p>
              </AlertDescription>
            </Alert>
            <div className="flex justify-center p-4 bg-background rounded-lg border">
              <img
                src={authStatus.qr_code}
                alt="QR Code WhatsApp"
                className="max-w-[300px] w-full"
              />
            </div>
          </div>
        )}

        {(authStatus?.status === 'not_configured' || authStatus?.status === 'disconnected' || authStatus?.status === 'error') && (
          <Alert className="border-blue-500/50 bg-blue-500/10">
            <QrCode className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700 dark:text-blue-400">
              Iniciar Conexão
            </AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-300">
              Clique no botão abaixo para gerar o QR Code e conectar seu WhatsApp.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={startAuth}
            disabled={loading || checkingStatus}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4" />
                {authStatus?.status === 'connected' ? 'Reconectar' : 'Conectar WhatsApp'}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => checkStatus()}
            disabled={checkingStatus}
            className="gap-2"
          >
            {checkingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verificar Status
          </Button>
        </div>

        {authStatus?.instance_id && (
          <div className="text-xs text-muted-foreground">
            <p>Instance ID: {authStatus.instance_id}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

