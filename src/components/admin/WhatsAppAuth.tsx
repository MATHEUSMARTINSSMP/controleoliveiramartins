import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, QrCode, CheckCircle2, XCircle, WifiOff, LogOut } from "lucide-react";
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
  const [disconnecting, setDisconnecting] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [timeoutCountdown, setTimeoutCountdown] = useState<number | null>(null);

  // Cleanup ao desmontar o componente ou mudar de store
  useEffect(() => {
    return () => {
      // Limpar todos os timers e intervalos
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      // Resetar estados
      setPolling(false);
      setLoading(false);
      setTimeoutCountdown(null);
    };
  }, [customerId, siteSlug]);

  // Verificar status inicial
  useEffect(() => {
    if (customerId && siteSlug) {
      checkStatus();
    }
  }, [customerId, siteSlug]);

  // Polling para verificar status quando está conectando
  useEffect(() => {
    if (polling && authStatus?.status === 'connecting') {
      // Iniciar timeout de 2 minutos
      const TIMEOUT_DURATION = 120000; // 2 minutos em milissegundos
      let countdown = 120; // 2 minutos em segundos
      setTimeoutCountdown(countdown);

      // Timer de countdown para exibir na UI
      const countdownInterval = setInterval(() => {
        countdown -= 1;
        if (countdown > 0) {
          setTimeoutCountdown(countdown);
        } else {
          clearInterval(countdownInterval);
        }
      }, 1000);

      // Polling para verificar status
      pollingIntervalRef.current = setInterval(() => {
        checkStatus(true); // silent check
      }, 5000); // Verificar a cada 5 segundos

      // Timeout de 2 minutos - se não conectar, resetar
      connectionTimeoutRef.current = setTimeout(() => {
        console.log('[WhatsAppAuth] ⏱️ Timeout de 2 minutos atingido - resetando conexão');
        
        // Parar polling
        setPolling(false);
        clearInterval(countdownInterval);
        setTimeoutCountdown(null);
        
        // Resetar status
        setAuthStatus({
          status: 'not_configured',
          qr_code: null,
          instance_id: null,
          phone_number: null,
          instance_name: null,
        });
        
        toast.warning('Tempo de conexão expirado. Clique em "Gerar QR Code" para tentar novamente.');
      }, TIMEOUT_DURATION);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        clearInterval(countdownInterval);
        setTimeoutCountdown(null);
      };
    } else {
      // Limpar todos os timers quando não está mais conectando
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setTimeoutCountdown(null);
    }

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        clearInterval(countdownInterval);
        setTimeoutCountdown(null);
      };
  }, [polling, authStatus?.status]);

  const checkStatus = async (silent = false) => {
    if (!customerId || !siteSlug) return;

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
          setTimeoutCountdown(null);
          // Limpar timeout se ainda estiver ativo
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
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
    }
  };

  const startAuth = async () => {
    if (!customerId || !siteSlug) {
      toast.error('Dados insuficientes para iniciar autenticação');
      return;
    }

    // Cancelar qualquer processo em andamento antes de iniciar novo
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    setPolling(false);
    setTimeoutCountdown(null);

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

      console.log('[WhatsAppAuth] Resposta completa:', data);
      console.log('[WhatsAppAuth] QR Code recebido:', data.qr_code);
      console.log('[WhatsAppAuth] Status recebido:', data.status);
      console.log('[WhatsAppAuth] Data completa:', JSON.stringify(data, null, 2));

      if (data.success) {
        // Tentar extrair QR Code de diferentes possíveis estruturas
        const qrCode = data.qr_code || 
                      data.data?.qr_code || 
                      data.data?.qrcode || 
                      data.qrcode ||
                      data.qrCode ||
                      null;

        const status = data.status || 
                      data.data?.status || 
                      'not_configured';

        const instanceId = data.instance_id || 
                          data.data?.instance_id || 
                          data.data?.instanceId ||
                          null;

        const phoneNumber = data.phone_number || 
                          data.data?.phone_number || 
                          data.data?.phoneNumber ||
                          null;

        console.log('[WhatsAppAuth] QR Code extraído:', qrCode ? 'SIM' : 'NÃO');
        console.log('[WhatsAppAuth] Status extraído:', status);

        setAuthStatus({
          status: status,
          qr_code: qrCode,
          instance_id: instanceId,
          phone_number: phoneNumber,
        });

        // Iniciar polling se estiver conectando
        if (status === 'connecting' && qrCode) {
          setPolling(true);
          toast.success('QR Code gerado! Escaneie com seu WhatsApp.');
        } else if (status === 'connected') {
          if (onAuthSuccess) {
            onAuthSuccess();
          }
          toast.success('WhatsApp já está conectado!');
        } else if (status === 'connecting' && !qrCode) {
          console.warn('[WhatsAppAuth] Status é connecting mas não há QR Code!');
          toast.warning('Aguardando QR Code...');
          setPolling(true);
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

  const handleCancel = () => {
    // Cancelar processo de conexão em andamento
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    setPolling(false);
    setLoading(false);
    setTimeoutCountdown(null);
    
    // Resetar status para not_configured para permitir nova tentativa
    setAuthStatus({
      status: 'not_configured',
      qr_code: null,
      instance_id: null,
      phone_number: null,
      instance_name: null,
    });
    
    toast.info('Conexão cancelada. Você pode tentar novamente.');
  };

  const handleDisconnect = async () => {
    if (!customerId || !siteSlug || !authStatus?.instance_id) {
      toast.error('Dados insuficientes para desconectar');
      return;
    }

    setDisconnecting(true);
    try {
      // Atualizar status no banco de dados
      const { supabase } = await import("@/integrations/supabase/client");
      
      // Atualizar whatsapp_credentials
      await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_credentials')
        .update({
          uazapi_status: 'disconnected',
          status: 'inactive',
        })
        .eq('customer_id', customerId)
        .eq('site_slug', siteSlug);

      // Atualizar stores se houver store_id
      if (storeId) {
        await supabase
          .schema('sistemaretiradas')
          .from('stores')
          .update({
            whatsapp_connection_status: 'disconnected',
          })
          .eq('id', storeId);
      }

      // Atualizar estado local
      setAuthStatus({
        status: 'disconnected',
        qr_code: null,
        instance_id: null,
        phone_number: null,
        instance_name: null,
      });

      toast.success('WhatsApp desconectado com sucesso!');
      
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar: ' + error.message);
    } finally {
      setDisconnecting(false);
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
                {timeoutCountdown !== null && (
                  <p className="text-xs mt-2 font-medium">
                    Aguardando conexão... ({Math.floor(timeoutCountdown / 60)}:{(timeoutCountdown % 60).toString().padStart(2, '0')})
                  </p>
                )}
                {timeoutCountdown === null && (
                  <p className="text-xs mt-2">Aguardando conexão...</p>
                )}
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
          {authStatus?.status === 'connecting' ? (
            <>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
                disabled={disconnecting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={startAuth}
                disabled={loading || disconnecting}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={startAuth}
              disabled={loading || disconnecting}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  {authStatus?.status === 'connected' ? 'Reconectar' : 'Gerar QR Code'}
                </>
              )}
            </Button>
          )}

          {authStatus?.status === 'connected' && (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting || loading}
              className="gap-2"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Desconectar
                </>
              )}
            </Button>
          )}
        </div>

      </CardContent>
    </Card>
  );
};

