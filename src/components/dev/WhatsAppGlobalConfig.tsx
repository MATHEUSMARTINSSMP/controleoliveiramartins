import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageSquare, 
  Wifi, 
  WifiOff, 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  QrCode,
  Phone,
  Save,
  Globe
} from "lucide-react";
import { toast } from "sonner";
import { fetchWhatsAppStatus, connectWhatsApp, isTerminalStatus, type WhatsAppStatusResponse } from "@/lib/whatsapp";

interface GlobalCredential {
  id: string;
  customer_id: string;
  site_slug: string;
  display_name: string | null;
  uazapi_instance_id: string | null;
  uazapi_token: string | null;
  uazapi_phone_number: string | null;
  uazapi_qr_code: string | null;
  uazapi_status: string | null;
  status: string;
  updated_at: string | null;
}

export const WhatsAppGlobalConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [credential, setCredential] = useState<GlobalCredential | null>(null);
  const [statusResponse, setStatusResponse] = useState<WhatsAppStatusResponse | null>(null);
  const [polling, setPolling] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_id: 'elevea@eleveaagencia.com.br',
    site_slug: 'elevea_global',
    display_name: 'Elevea Global',
  });

  useEffect(() => {
    fetchGlobalCredential();
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (polling && credential) {
      intervalId = setInterval(() => {
        handleCheckStatus();
      }, 5000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [polling, credential]);

  const fetchGlobalCredential = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_credentials')
        .select('*')
        .eq('is_global', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar credencial global:', error);
      }

      if (data) {
        setCredential(data as GlobalCredential);
        setFormData({
          customer_id: data.customer_id || 'elevea@eleveaagencia.com.br',
          site_slug: data.site_slug || 'elevea_global',
          display_name: data.display_name || 'Elevea Global',
        });
      }
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar configuracao global');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.customer_id.trim() || !formData.site_slug.trim()) {
      toast.error('Preencha Customer ID e Site Slug');
      return;
    }

    setSaving(true);
    try {
      if (credential) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_credentials')
          .update({
            customer_id: formData.customer_id.trim(),
            site_slug: formData.site_slug.trim(),
            display_name: formData.display_name.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', credential.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_credentials')
          .insert({
            customer_id: formData.customer_id.trim(),
            site_slug: formData.site_slug.trim(),
            display_name: formData.display_name.trim(),
            is_global: true,
            status: 'active',
          });

        if (error) throw error;
      }

      toast.success('Configuracao salva!');
      await fetchGlobalCredential();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!credential) {
      toast.error('Salve as configuracoes primeiro');
      return;
    }

    setConnecting(true);
    toast.info('Iniciando conexao WhatsApp...');

    try {
      const result = await connectWhatsApp({
        siteSlug: credential.site_slug,
        customerId: credential.customer_id,
      });

      console.log('[WhatsApp Global] Resultado conexao:', { 
        success: result.success, 
        hasQrCode: !!result.qrCode,
        qrCodeLength: result.qrCode?.length || 0,
        status: result.status 
      });

      if (result.success) {
        if (result.qrCode) {
          setStatusResponse({
            success: true,
            ok: true,
            connected: false,
            status: 'qr_required',
            qrCode: result.qrCode,
            instanceId: result.instanceId,
            phoneNumber: null,
          });
          
          setCredential(prev => prev ? {
            ...prev,
            uazapi_status: 'qr_required',
            uazapi_qr_code: result.qrCode,
          } : null);

          await supabase
            .schema('sistemaretiradas')
            .from('whatsapp_credentials')
            .update({
              uazapi_status: 'qr_required',
              uazapi_qr_code: result.qrCode,
              updated_at: new Date().toISOString(),
            })
            .eq('id', credential.id);

          toast.success('QR Code gerado! Escaneie com o WhatsApp.');
        } else {
          toast.success('Conexao iniciada! Aguarde o QR Code...');
        }
        setPolling(true);
        setTimeout(() => handleCheckStatus(), 3000);
      } else {
        toast.error(result.message || 'Erro ao iniciar conexao');
      }
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error('Erro ao conectar: ' + error.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleCheckStatus = useCallback(async () => {
    if (!credential) return;

    setCheckingStatus(true);
    try {
      const status = await fetchWhatsAppStatus({
        siteSlug: credential.site_slug,
        customerId: credential.customer_id,
      });

      setStatusResponse(status);

      await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_credentials')
        .update({
          uazapi_status: status.status,
          uazapi_phone_number: status.phoneNumber || credential.uazapi_phone_number,
          uazapi_qr_code: status.qrCode || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', credential.id);

      setCredential(prev => prev ? {
        ...prev,
        uazapi_status: status.status,
        uazapi_phone_number: status.phoneNumber || prev.uazapi_phone_number,
        uazapi_qr_code: status.qrCode || null,
      } : null);

      if (isTerminalStatus(status.status)) {
        setPolling(false);
        if (status.connected) {
          toast.success('WhatsApp Global conectado!');
        }
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
    } finally {
      setCheckingStatus(false);
    }
  }, [credential]);

  const getStatusBadge = () => {
    const status = credential?.uazapi_status || statusResponse?.status;
    
    if (!status) {
      return <Badge variant="outline">Nao verificado</Badge>;
    }

    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500 text-white">Conectado</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Desconectado</Badge>;
      case 'qr_required':
        return <Badge className="bg-amber-500 text-white">Aguardando QR</Badge>;
      case 'connecting':
        return <Badge className="bg-blue-500 text-white">Conectando...</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-muted-foreground">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = credential?.uazapi_status === 'connected' || statusResponse?.connected;
  const showQrCode = credential?.uazapi_qr_code || statusResponse?.qrCode;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-green-600" />
          WhatsApp Global (Numero Elevea)
        </CardTitle>
        <CardDescription>
          Configure o numero WhatsApp global que sera usado como remetente para todas as lojas que nao tem numero proprio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">Status:</span>
              {getStatusBadge()}
            </div>
            {credential?.uazapi_phone_number && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{credential.uazapi_phone_number}</span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckStatus}
            disabled={checkingStatus || !credential}
            data-testid="button-check-global-status"
          >
            {checkingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {showQrCode && !isConnected && (
          <Alert className="border-amber-500">
            <QrCode className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">Escaneie o QR Code no WhatsApp:</p>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img 
                    src={showQrCode} 
                    alt="QR Code WhatsApp" 
                    className="max-w-[250px]"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Abra o WhatsApp no celular, va em Dispositivos Conectados e escaneie o codigo
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isConnected && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              WhatsApp Global conectado e pronto para enviar mensagens!
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Nome de Exibicao</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="Ex: Elevea Global"
              data-testid="input-global-display-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_id">Customer ID (Email N8N)</Label>
            <Input
              id="customer_id"
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              placeholder="Ex: elevea@eleveaagencia.com.br"
              data-testid="input-global-customer-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site_slug">Site Slug</Label>
            <Input
              id="site_slug"
              value={formData.site_slug}
              onChange={(e) => setFormData({ ...formData, site_slug: e.target.value })}
              placeholder="Ex: elevea_global"
              data-testid="input-global-site-slug"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
            data-testid="button-save-global-config"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configuracao
          </Button>

          <Button
            variant={isConnected ? "outline" : "default"}
            onClick={handleConnect}
            disabled={connecting || !credential}
            className="flex-1"
            data-testid="button-connect-global-whatsapp"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isConnected ? (
              <Wifi className="h-4 w-4 mr-2" />
            ) : (
              <WifiOff className="h-4 w-4 mr-2" />
            )}
            {isConnected ? 'Reconectar' : 'Conectar WhatsApp'}
          </Button>
        </div>

        {polling && (
          <p className="text-sm text-center text-muted-foreground animate-pulse">
            Verificando status automaticamente...
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppGlobalConfig;
