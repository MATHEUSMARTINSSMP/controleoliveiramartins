import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, CreditCard, Eye, EyeOff, Copy, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PaymentGateway {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
  webhook_url: string;
  api_key: string | null;
  api_secret: string | null;
  webhook_secret: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

const PAYMENT_GATEWAYS = [
  { value: 'STRIPE', label: 'Stripe', webhook_docs: 'https://stripe.com/docs/webhooks' },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago', webhook_docs: 'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks' },
  { value: 'PAGSEGURO', label: 'PagSeguro', webhook_docs: 'https://dev.pagseguro.uol.com.br/docs/notificacoes' },
  { value: 'ASAAS', label: 'Asaas', webhook_docs: 'https://docs.asaas.com/docs/webhooks' },
  { value: 'CAKTO', label: 'CAKTO', webhook_docs: 'https://burly-level-c93.notion.site/Webhooks-pt-br-13c5b1d7878780d792f0fcda3411955c' },
  { value: 'CUSTOM', label: 'Custom', webhook_docs: null },
];

const WEBHOOK_ENDPOINT = 'https://eleveaone.com.br/.netlify/functions/payment-webhook';

export const PaymentGatewaysConfig = () => {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, {
    api_key: string;
    api_secret: string;
    webhook_secret: string;
    is_active: boolean;
  }>>({});

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      setLoading(true);
      // Buscar gateways da tabela payment_gateways (se existir)
      // Por enquanto, vamos criar a estrutura baseada nos gateways suportados
      let gatewaysData: PaymentGateway[] = PAYMENT_GATEWAYS.map(gw => ({
        id: gw.value,
        name: gw.value,
        display_name: gw.label,
        is_active: false,
        webhook_url: `${WEBHOOK_ENDPOINT}?gateway=${gw.value}`,
        api_key: null,
        api_secret: null,
        webhook_secret: null,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Buscar gateways salvos da tabela payment_gateways
      try {
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('payment_gateways')
          .select('*')
          .order('display_name');

        if (!error && data && data.length > 0) {
          // Substituir dados padrão pelos salvos
          const savedMap = new Map(data.map(g => [g.id, g]));
          gatewaysData = gatewaysData.map(gw => {
            const saved = savedMap.get(gw.id);
            return saved ? { ...gw, ...saved } : gw;
          });
          console.log('[PaymentGatewaysConfig] Gateways carregados do banco:', gatewaysData.map(g => ({
            id: g.id,
            is_active: g.is_active,
            tem_webhook_secret: !!g.webhook_secret
          })));
        } else if (error) {
          // Se erro de permissão, continuar com dados padrão (não quebrar a página)
          if (error.code === '42501' || error.message?.includes('permission')) {
            console.warn('[PaymentGatewaysConfig] Erro de permissão ao buscar gateways (continuando com dados padrão):', error.message);
            // Continuar com gatewaysData padrão (não quebrar a página)
          } else if (error.code !== '42P01') {
            // Erro diferente de "tabela não existe"
            console.error('[PaymentGatewaysConfig] Erro ao buscar gateways:', error);
            toast.error('Erro ao carregar configurações. Algumas funcionalidades podem não estar disponíveis.');
          }
        }
      } catch (err: any) {
        // Tabela pode não existir ainda - usar estrutura padrão
        if (err.code === '42P01') {
          console.log('[PaymentGatewaysConfig] Tabela payment_gateways não encontrada, usando estrutura padrão');
        } else {
          console.error('[PaymentGatewaysConfig] Erro ao buscar gateways:', err);
        }
      }

      setGateways(gatewaysData);

      // Inicializar formData (priorizar dados do banco)
      setFormData(prev => {
        const newFormData: Record<string, any> = {};
        gatewaysData.forEach(gw => {
          const existing = prev[gw.id];
          // Prioridade: dados do banco > dados existentes no formData (se não vazios)
          newFormData[gw.id] = {
            api_key: (gw.api_key && gw.api_key.trim() !== '') ? gw.api_key : (existing?.api_key && existing.api_key.trim() !== '' ? existing.api_key : ''),
            api_secret: (gw.api_secret && gw.api_secret.trim() !== '') ? gw.api_secret : (existing?.api_secret && existing.api_secret.trim() !== '' ? existing.api_secret : ''),
            webhook_secret: (gw.webhook_secret && gw.webhook_secret.trim() !== '') ? gw.webhook_secret : (existing?.webhook_secret && existing.webhook_secret.trim() !== '' ? existing.webhook_secret : ''),
            // CRÍTICO: is_active sempre vem do banco (não preservar do formData)
            is_active: gw.is_active !== undefined ? gw.is_active : false,
          };
        });
        console.log('[PaymentGatewaysConfig] FormData inicializado:', newFormData);
        return newFormData;
      });
    } catch (error: any) {
      console.error('[PaymentGatewaysConfig] Erro ao buscar gateways:', error);
      toast.error('Erro ao carregar configurações de gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (gatewayId: string) => {
    setSaving(gatewayId);
    try {
      const data = formData[gatewayId];
      if (!data) {
        toast.error('Dados não encontrados');
        return;
      }

      // Salvar via RPC function (tem SECURITY DEFINER)
      try {
        console.log('[PaymentGatewaysConfig] Salvando gateway:', gatewayId, {
          api_key: data.api_key ? `${data.api_key.substring(0, 4)}...` : 'null',
          api_secret: data.api_secret ? '***' : 'null',
          webhook_secret: data.webhook_secret ? `${data.webhook_secret.substring(0, 4)}...` : 'null',
          is_active: data.is_active
        });

        const { data: result, error } = await supabase.rpc('save_payment_gateway', {
          p_id: gatewayId,
          p_name: gatewayId,
          p_display_name: PAYMENT_GATEWAYS.find(g => g.value === gatewayId)?.label || gatewayId,
          p_is_active: data.is_active,
          p_webhook_url: `${WEBHOOK_ENDPOINT}?gateway=${gatewayId}`,
          p_api_key: data.api_key && data.api_key.trim() !== '' ? data.api_key.trim() : null,
          p_api_secret: data.api_secret && data.api_secret.trim() !== '' ? data.api_secret.trim() : null,
          p_webhook_secret: data.webhook_secret && data.webhook_secret.trim() !== '' ? data.webhook_secret.trim() : null,
          p_metadata: null,
        });

        if (error) {
          console.error('[PaymentGatewaysConfig] Erro ao salvar via RPC:', error);
          // Se erro de permissão, tentar upsert direto (pode funcionar se RLS permitir)
          if (error.code === '42501' || error.message.includes('permission') || error.message.includes('negado') || error.message.includes('Acesso negado')) {
            console.log('[PaymentGatewaysConfig] Tentando upsert direto como fallback...');
            // Tentar upsert direto como fallback
            const { data: upsertData, error: upsertError } = await supabase
              .schema('sistemaretiradas')
              .from('payment_gateways')
              .upsert({
                id: gatewayId,
                name: gatewayId,
                display_name: PAYMENT_GATEWAYS.find(g => g.value === gatewayId)?.label || gatewayId,
                is_active: data.is_active,
                webhook_url: `${WEBHOOK_ENDPOINT}?gateway=${gatewayId}`,
                api_key: data.api_key && data.api_key.trim() !== '' ? data.api_key.trim() : null,
                api_secret: data.api_secret && data.api_secret.trim() !== '' ? data.api_secret.trim() : null,
                webhook_secret: data.webhook_secret && data.webhook_secret.trim() !== '' ? data.webhook_secret.trim() : null,
              }, { onConflict: 'id' })
              .select();

            if (upsertError) {
              console.error('[PaymentGatewaysConfig] Erro no upsert direto:', upsertError);
              throw upsertError;
            }
            console.log('[PaymentGatewaysConfig] Salvo via upsert direto:', upsertData);
          } else {
            throw error;
          }
        } else {
          console.log('[PaymentGatewaysConfig] Salvo via RPC com sucesso:', result);
        }

        // Verificar se foi salvo no banco antes de recarregar
        console.log('[PaymentGatewaysConfig] Verificando se foi salvo no banco...');
        const { data: verifyData, error: verifyError } = await supabase
          .schema('sistemaretiradas')
          .from('payment_gateways')
          .select('*')
          .eq('id', gatewayId)
          .single();
        
        if (verifyError) {
          console.error('[PaymentGatewaysConfig] Erro ao verificar dados salvos:', verifyError);
          toast.error(`Erro ao verificar salvamento: ${verifyError.message}`);
        } else {
          console.log('[PaymentGatewaysConfig] ✅ Dados confirmados no banco:', {
            id: verifyData.id,
            webhook_secret: verifyData.webhook_secret ? `${verifyData.webhook_secret.substring(0, 4)}...` : 'null',
            is_active: verifyData.is_active,
            updated_at: verifyData.updated_at
          });
        }
        
        toast.success(`Configuração de ${PAYMENT_GATEWAYS.find(g => g.value === gatewayId)?.label} salva com sucesso!`);
        
        // Atualizar gateways localmente primeiro (para manter os dados salvos)
        setGateways(prev => prev.map(gw => 
          gw.id === gatewayId 
            ? { 
                ...gw, 
                api_key: data.api_key || null,
                api_secret: data.api_secret || null,
                webhook_secret: data.webhook_secret || null,
                is_active: data.is_active,
                updated_at: new Date().toISOString()
              }
            : gw
        ));
        
        // Recarregar dados do banco para garantir sincronização
        await fetchGateways();
        
        // Garantir que os dados salvos permaneçam no formData após recarregar
        // (fetchGateways pode ter sobrescrito, então restaurar os valores salvos)
        setFormData(prev => ({
          ...prev,
          [gatewayId]: data // Manter os dados que acabaram de ser salvos
        }));
      } catch (err: any) {
        // Se a tabela não existir, salvar em localStorage como fallback
        if (err.code === '42P01') {
          toast.info('Tabela payment_gateways não existe ainda. Salvo localmente.');
          localStorage.setItem(`payment_gateway_${gatewayId}`, JSON.stringify(data));
        } else {
          console.error('[PaymentGatewaysConfig] Erro ao salvar:', err);
          toast.error(`Erro ao salvar: ${err.message || 'Erro desconhecido'}`);
        }
      }
    } catch (error: any) {
      console.error('[PaymentGatewaysConfig] Erro ao salvar:', error);
      toast.error(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  const toggleShowSecret = (gatewayId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [gatewayId]: !prev[gatewayId],
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configuração de Gateways de Pagamento
          </CardTitle>
          <CardDescription>
            Configure os gateways de pagamento e seus webhooks. As configurações são globais e afetam todo o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Endpoint do Webhook:</strong>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                  {WEBHOOK_ENDPOINT}?gateway=GATEWAY_NAME
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(WEBHOOK_ENDPOINT, 'Endpoint')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs">
                Configure este endpoint no painel de cada gateway de pagamento. Use o parâmetro <code>?gateway=GATEWAY_NAME</code> para identificar o gateway.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Lista de Gateways */}
      {gateways.map((gateway) => {
        const gatewayInfo = PAYMENT_GATEWAYS.find(g => g.value === gateway.id);
        const form = formData[gateway.id] || {
          api_key: '',
          api_secret: '',
          webhook_secret: '',
          is_active: false,
        };

        return (
          <Card key={gateway.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {gatewayInfo?.label || gateway.display_name}
                    {form.is_active && (
                      <Badge variant="default" className="bg-green-500">
                        Ativo
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Gateway: <code className="text-xs">{gateway.id}</code>
                  </CardDescription>
                </div>
                {gatewayInfo?.webhook_docs && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(gatewayInfo.webhook_docs, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Docs
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Webhook URL */}
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={gateway.webhook_url}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(gateway.webhook_url, 'URL do Webhook')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure esta URL no painel do {gatewayInfo?.label || gateway.id}
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label>API Key / Public Key</Label>
                <Input
                  type="text"
                  placeholder="Cole a API Key aqui"
                  value={form.api_key}
                  onChange={(e) => setFormData({
                    ...formData,
                    [gateway.id]: { ...form, api_key: e.target.value },
                  })}
                />
              </div>

              {/* API Secret */}
              <div className="space-y-2">
                <Label>API Secret / Private Key</Label>
                <div className="relative">
                  <Input
                    type={showSecrets[gateway.id] ? "text" : "password"}
                    placeholder="Cole a API Secret aqui"
                    value={form.api_secret}
                    onChange={(e) => setFormData({
                      ...formData,
                      [gateway.id]: { ...form, api_secret: e.target.value },
                    })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowSecret(gateway.id)}
                  >
                    {showSecrets[gateway.id] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Webhook Secret */}
              <div className="space-y-2">
                <Label>Webhook Secret / Signature Key</Label>
                <div className="relative">
                  <Input
                    type={showSecrets[`${gateway.id}_webhook`] ? "text" : "password"}
                    placeholder="Cole o Webhook Secret aqui (para validação de assinatura)"
                    value={form.webhook_secret}
                    onChange={(e) => setFormData({
                      ...formData,
                      [gateway.id]: { ...form, webhook_secret: e.target.value },
                    })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowSecret(`${gateway.id}_webhook`)}
                  >
                    {showSecrets[`${gateway.id}_webhook`] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado para validar a assinatura dos webhooks recebidos
                </p>
              </div>

              {/* Ativo */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`active_${gateway.id}`}
                  checked={form.is_active}
                  onChange={(e) => setFormData({
                    ...formData,
                    [gateway.id]: { ...form, is_active: e.target.checked },
                  })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor={`active_${gateway.id}`} className="cursor-pointer">
                  Gateway ativo (habilitar processamento de webhooks)
                </Label>
              </div>

              {/* Botão Salvar */}
              <Button
                onClick={() => handleSave(gateway.id)}
                disabled={saving === gateway.id}
                className="w-full"
              >
                {saving === gateway.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Configuração
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* Informações Adicionais */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Cada gateway precisa ter seu webhook configurado no painel do gateway.</p>
          <p>• O endpoint é o mesmo para todos: <code className="text-xs bg-muted px-1 rounded">{WEBHOOK_ENDPOINT}</code></p>
          <p>• Use o parâmetro <code className="text-xs bg-muted px-1 rounded">?gateway=GATEWAY_NAME</code> para identificar o gateway.</p>
          <p>• O Webhook Secret é usado para validar a assinatura dos eventos recebidos.</p>
          <p>• Mantenha as credenciais seguras e nunca as compartilhe.</p>
        </CardContent>
      </Card>
    </div>
  );
};

