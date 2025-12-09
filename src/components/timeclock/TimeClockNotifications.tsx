/**
 * Componente para configuracao de notificacoes WhatsApp do Controle de Ponto
 * Permite ativar/desativar notificacoes e configurar destinatarios
 * Usa fallback global quando a loja nao tem WhatsApp proprio
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bell, 
  BellOff, 
  Phone, 
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  CheckCircle,
  AlertTriangle,
  Globe,
  MessageSquare,
  Clock,
  FileEdit,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';

interface TimeClockNotificationsProps {
  storeId: string;
}

interface NotificationConfig {
  id?: string;
  store_id: string;
  notifications_enabled: boolean;
  notify_clock_in: boolean;
  notify_clock_out: boolean;
  notify_change_requests: boolean;
  notify_request_approved: boolean;
  notify_request_rejected: boolean;
  recipient_phones: string[];
}

interface WhatsAppCredential {
  id: string;
  uazapi_status: string | null;
  uazapi_phone_number: string | null;
  is_global: boolean;
}

export function TimeClockNotifications({ storeId }: TimeClockNotificationsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<NotificationConfig>({
    store_id: storeId,
    notifications_enabled: false,
    notify_clock_in: true,
    notify_clock_out: true,
    notify_change_requests: true,
    notify_request_approved: true,
    notify_request_rejected: true,
    recipient_phones: [],
  });
  const [newPhone, setNewPhone] = useState('');
  const [storeWhatsApp, setStoreWhatsApp] = useState<WhatsAppCredential | null>(null);
  const [globalWhatsApp, setGlobalWhatsApp] = useState<WhatsAppCredential | null>(null);

  useEffect(() => {
    if (storeId) {
      fetchConfig();
      fetchWhatsAppCredentials();
    }
  }, [storeId]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_notification_config')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[TimeClockNotifications] Erro ao buscar config:', error);
      }

      if (data) {
        setConfig({
          id: data.id,
          store_id: data.store_id,
          notifications_enabled: data.notifications_enabled ?? false,
          notify_clock_in: data.notify_clock_in ?? true,
          notify_clock_out: data.notify_clock_out ?? true,
          notify_change_requests: data.notify_change_requests ?? true,
          notify_request_approved: data.notify_request_approved ?? true,
          notify_request_rejected: data.notify_request_rejected ?? true,
          recipient_phones: data.recipient_phones || [],
        });
      }
    } catch (err) {
      console.error('[TimeClockNotifications] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsAppCredentials = async () => {
    try {
      const { data: storeData } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('site_slug')
        .eq('id', storeId)
        .single();

      if (storeData?.site_slug) {
        const { data: storeWa } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_credentials')
          .select('id, uazapi_status, uazapi_phone_number, is_global')
          .eq('site_slug', storeData.site_slug)
          .eq('is_global', false)
          .maybeSingle();

        if (storeWa) {
          setStoreWhatsApp(storeWa);
        }
      }

      const { data: globalWa } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_credentials')
        .select('id, uazapi_status, uazapi_phone_number, is_global')
        .eq('is_global', true)
        .maybeSingle();

      if (globalWa) {
        setGlobalWhatsApp(globalWa);
      }
    } catch (err) {
      console.error('[TimeClockNotifications] Erro ao buscar WhatsApp:', err);
    }
  };

  const handleSave = async () => {
    if (config.notifications_enabled && config.recipient_phones.length === 0) {
      toast.error('Adicione pelo menos um numero de telefone');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        store_id: storeId,
        notifications_enabled: config.notifications_enabled,
        notify_clock_in: config.notify_clock_in,
        notify_clock_out: config.notify_clock_out,
        notify_change_requests: config.notify_change_requests,
        notify_request_approved: config.notify_request_approved,
        notify_request_rejected: config.notify_request_rejected,
        recipient_phones: config.recipient_phones,
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('time_clock_notification_config')
          .update(payload)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('time_clock_notification_config')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setConfig(prev => ({ ...prev, id: data.id }));
        }
      }

      toast.success('Configuracoes salvas!');
    } catch (error: any) {
      console.error('[TimeClockNotifications] Erro ao salvar:', error);
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55')) {
      return digits;
    }
    return '55' + digits;
  };

  const addPhone = () => {
    if (!newPhone.trim()) {
      toast.error('Digite um numero de telefone');
      return;
    }

    const formattedPhone = formatPhoneNumber(newPhone);
    
    if (formattedPhone.length < 12 || formattedPhone.length > 13) {
      toast.error('Numero invalido. Use o formato: (XX) XXXXX-XXXX');
      return;
    }

    if (config.recipient_phones.includes(formattedPhone)) {
      toast.error('Numero ja adicionado');
      return;
    }

    setConfig(prev => ({
      ...prev,
      recipient_phones: [...prev.recipient_phones, formattedPhone],
    }));
    setNewPhone('');
    toast.success('Numero adicionado');
  };

  const removePhone = (phone: string) => {
    setConfig(prev => ({
      ...prev,
      recipient_phones: prev.recipient_phones.filter(p => p !== phone),
    }));
  };

  const formatDisplayPhone = (phone: string): string => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    } else if (phone.length === 12) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const getWhatsAppStatus = () => {
    const storeConnected = storeWhatsApp?.uazapi_status === 'connected';
    const globalConnected = globalWhatsApp?.uazapi_status === 'connected';

    if (storeConnected) {
      return {
        type: 'store',
        connected: true,
        phone: storeWhatsApp?.uazapi_phone_number,
        label: 'WhatsApp da Loja',
      };
    } else if (globalConnected) {
      return {
        type: 'global',
        connected: true,
        phone: globalWhatsApp?.uazapi_phone_number,
        label: 'WhatsApp Global (Elevea)',
      };
    } else {
      return {
        type: 'none',
        connected: false,
        phone: null,
        label: 'Nenhum WhatsApp conectado',
      };
    }
  };

  const whatsAppStatus = getWhatsAppStatus();

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notificacoes WhatsApp - Ponto
          </CardTitle>
          <CardDescription>
            Configure as notificacoes de WhatsApp para eventos do controle de ponto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">Remetente:</span>
                {whatsAppStatus.connected ? (
                  <Badge className="bg-green-500 text-white text-xs">
                    {whatsAppStatus.type === 'global' && <Globe className="h-3 w-3 mr-1" />}
                    {whatsAppStatus.label}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    {whatsAppStatus.label}
                  </Badge>
                )}
              </div>
              {whatsAppStatus.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{whatsAppStatus.phone}</span>
                </div>
              )}
            </div>
          </div>

          {!whatsAppStatus.connected && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhum WhatsApp conectado. Configure o WhatsApp da loja ou o WhatsApp Global para enviar notificacoes.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Ativar Notificacoes</Label>
              <p className="text-sm text-muted-foreground">
                Habilitar envio de notificacoes WhatsApp
              </p>
            </div>
            <Switch
              checked={config.notifications_enabled}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, notifications_enabled: checked }))}
              disabled={!whatsAppStatus.connected}
              data-testid="switch-notifications-enabled"
            />
          </div>

          {config.notifications_enabled && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <Label className="text-sm font-medium">Tipos de Notificacao</Label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Entrada registrada</span>
                    </div>
                    <Switch
                      checked={config.notify_clock_in}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, notify_clock_in: checked }))}
                      data-testid="switch-notify-clock-in"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <span className="text-sm">Saida registrada</span>
                    </div>
                    <Switch
                      checked={config.notify_clock_out}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, notify_clock_out: checked }))}
                      data-testid="switch-notify-clock-out"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <FileEdit className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Nova solicitacao</span>
                    </div>
                    <Switch
                      checked={config.notify_change_requests}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, notify_change_requests: checked }))}
                      data-testid="switch-notify-change-requests"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Solicitacao aprovada</span>
                    </div>
                    <Switch
                      checked={config.notify_request_approved}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, notify_request_approved: checked }))}
                      data-testid="switch-notify-request-approved"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Solicitacao rejeitada</span>
                    </div>
                    <Switch
                      checked={config.notify_request_rejected}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, notify_request_rejected: checked }))}
                      data-testid="switch-notify-request-rejected"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Destinatarios</Label>
                <p className="text-xs text-muted-foreground">
                  Adicione os numeros de telefone que receberao as notificacoes
                </p>

                <div className="flex gap-2">
                  <Input
                    placeholder="(XX) XXXXX-XXXX"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPhone()}
                    className="flex-1"
                    data-testid="input-recipient-phone"
                  />
                  <Button onClick={addPhone} size="icon" data-testid="button-add-phone">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {config.recipient_phones.length > 0 ? (
                  <div className="space-y-2">
                    {config.recipient_phones.map((phone, index) => (
                      <div 
                        key={phone} 
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        data-testid={`recipient-phone-${index}`}
                      >
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-mono">{formatDisplayPhone(phone)}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removePhone(phone)}
                          className="h-8 w-8"
                          data-testid={`button-remove-phone-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Nenhum destinatario adicionado
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-notifications">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configuracoes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
