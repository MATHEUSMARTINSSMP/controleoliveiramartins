import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, Webhook, Loader2, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";

interface WebhookConfig {
  whatsapp_auth_webhook_url: string | null;
  whatsapp_send_webhook_url: string | null;
  n8n_webhook_auth: string | null;
}

export const WebhookConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WebhookConfig>({
    whatsapp_auth_webhook_url: null,
    whatsapp_send_webhook_url: null,
    n8n_webhook_auth: null,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      // Buscar configurações da tabela app_config (estrutura key-value)
      const { data: configs, error } = await supabase
        .schema('sistemaretiradas')
        .from('app_config')
        .select('key, value')
        .in('key', ['whatsapp_auth_webhook_url', 'whatsapp_send_webhook_url', 'n8n_webhook_auth']);

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configurações:', error);
      }

      // Converter array key-value para objeto
      const configMap = new Map<string, string>();
      if (configs) {
        configs.forEach(item => {
          configMap.set(item.key, item.value);
        });
      }

      setConfig({
        whatsapp_auth_webhook_url: configMap.get('whatsapp_auth_webhook_url') || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth',
        whatsapp_send_webhook_url: configMap.get('whatsapp_send_webhook_url') || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send',
        n8n_webhook_auth: configMap.get('n8n_webhook_auth') || null,
      });
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      toast.error('Erro ao carregar configurações');
      // Valores padrão em caso de erro
      setConfig({
        whatsapp_auth_webhook_url: 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth',
        whatsapp_send_webhook_url: 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send',
        n8n_webhook_auth: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validar URLs
      if (config.whatsapp_auth_webhook_url && !isValidUrl(config.whatsapp_auth_webhook_url)) {
        toast.error('URL do webhook de autenticação inválida');
        setSaving(false);
        return;
      }

      if (config.whatsapp_send_webhook_url && !isValidUrl(config.whatsapp_send_webhook_url)) {
        toast.error('URL do webhook de envio inválida');
        setSaving(false);
        return;
      }

      // Salvar na tabela app_config (estrutura key-value, upsert por key)
      const configsToSave = [
        {
          key: 'whatsapp_auth_webhook_url',
          value: config.whatsapp_auth_webhook_url || '',
          description: 'URL do webhook n8n para autenticação WhatsApp',
        },
        {
          key: 'whatsapp_send_webhook_url',
          value: config.whatsapp_send_webhook_url || '',
          description: 'URL do webhook n8n para envio de mensagens WhatsApp',
        },
        {
          key: 'n8n_webhook_auth',
          value: config.n8n_webhook_auth || '',
          description: 'Token de autenticação do webhook n8n (X-APP-KEY)',
        },
      ];

      // Upsert cada configuração
      for (const configItem of configsToSave) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('app_config')
          .upsert({
            key: configItem.key,
            value: configItem.value,
            description: configItem.description,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'key',
          });

        if (error) {
          console.error(`Erro ao salvar ${configItem.key}:`, error);
          throw error;
        }
      }

      toast.success('Configurações salvas com sucesso!');
      await fetchConfig();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            <p className="text-slate-400">Carregando configurações...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-white">Configuração de Webhooks n8n</CardTitle>
        </div>
        <CardDescription className="text-slate-400">
          Configure as URLs dos webhooks do n8n para autenticação e envio de mensagens WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-yellow-500/10 border-yellow-500/20">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-200">Importante</AlertTitle>
          <AlertDescription className="text-yellow-200">
            Estas URLs devem apontar para os webhooks do n8n configurados para autenticação e envio de mensagens WhatsApp.
            Certifique-se de que os webhooks estão ativos e configurados corretamente no n8n.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-webhook-url" className="text-slate-300">
              URL do Webhook de Autenticação *
            </Label>
            <Input
              id="auth-webhook-url"
              type="url"
              placeholder="https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth"
              value={config.whatsapp_auth_webhook_url || ''}
              onChange={(e) => setConfig({ ...config, whatsapp_auth_webhook_url: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400">
              URL do webhook n8n para autenticação WhatsApp (gerar QR code, conectar, verificar status)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-webhook-url" className="text-slate-300">
              URL do Webhook de Envio de Mensagens *
            </Label>
            <Input
              id="send-webhook-url"
              type="url"
              placeholder="https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send"
              value={config.whatsapp_send_webhook_url || ''}
              onChange={(e) => setConfig({ ...config, whatsapp_send_webhook_url: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400">
              URL do webhook n8n para envio de mensagens WhatsApp
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="n8n-auth-key" className="text-slate-300">
              Chave de Autenticação n8n (X-APP-KEY) *
            </Label>
            <Input
              id="n8n-auth-key"
              type="password"
              placeholder="Digite a chave de autenticação do n8n"
              value={config.n8n_webhook_auth || ''}
              onChange={(e) => setConfig({ ...config, n8n_webhook_auth: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400">
              Token de autenticação usado no header X-APP-KEY nas requisições para o n8n
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>

        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-200">Informações</AlertTitle>
          <AlertDescription className="text-blue-200">
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>O webhook de autenticação é usado para conectar WhatsApp via QR Code</li>
              <li>O webhook de envio é usado para enviar mensagens WhatsApp</li>
              <li>A chave de autenticação deve ser configurada no n8n e corresponder ao header X-APP-KEY</li>
              <li>Estas configurações são globais e aplicam-se a todas as lojas</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

