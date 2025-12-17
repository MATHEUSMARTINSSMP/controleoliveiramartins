/**
 * Componente para configuracao de notificacoes WhatsApp do Controle de Ponto
 * Permite ativar/desativar notificacoes e configurar destinatarios
 * Usa fallback global quando a loja nao tem WhatsApp proprio
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';

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
  use_global_whatsapp?: boolean;  // Se true, usa WhatsApp Global mesmo quando loja tem próprio
}

interface WhatsAppCredential {
  admin_id: string;
  site_slug: string;
  uazapi_status: string | null;
  uazapi_phone_number: string | null;
  is_global: boolean;
  status?: string | null;
  display_name?: string | null;
}

export function TimeClockNotifications({ storeId }: TimeClockNotificationsProps) {
  const { profile } = useAuth();
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
    use_global_whatsapp: false,
  });
  const [newPhone, setNewPhone] = useState('');
  const [storeWhatsApp, setStoreWhatsApp] = useState<WhatsAppCredential | null>(null);
  const [globalWhatsApp, setGlobalWhatsApp] = useState<WhatsAppCredential | null>(null);

  useEffect(() => {
    if (storeId && profile) {
      const loadData = async () => {
        await fetchConfig();
        // recipient_phones já vem de time_clock_notification_config, não precisa buscar de outra tabela
        await fetchWhatsAppCredentials();
      };
      loadData();
    }
  }, [storeId, profile]);

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
          use_global_whatsapp: data.use_global_whatsapp ?? false,
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
      // Buscar loja para obter nome, admin_id e site_slug
      const { data: storeData } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, site_slug, admin_id')
        .eq('id', storeId)
        .single();

      if (storeData && storeData.admin_id && storeData.site_slug) {
        // Buscar WhatsApp da loja usando admin_id (UUID) e site_slug
        const { data: storeWa, error: storeWaError } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_credentials')
          .select('admin_id, site_slug, uazapi_status, uazapi_phone_number, is_global, status, display_name')
          .eq('admin_id', storeData.admin_id)
          .eq('site_slug', storeData.site_slug)
          .eq('is_global', false)
          .maybeSingle();

        console.log('[TimeClockNotifications] WhatsApp da Loja encontrado:', {
          found: !!storeWa,
          error: storeWaError,
          searchParams: {
            admin_id: storeData.admin_id,
            site_slug: storeData.site_slug,
          },
          data: storeWa ? {
            uazapi_status: storeWa.uazapi_status,
            uazapi_phone_number: storeWa.uazapi_phone_number,
            is_global: storeWa.is_global,
            status: storeWa.status,
          } : null,
        });

        if (storeWa) {
          setStoreWhatsApp(storeWa);
        } else if (storeWaError) {
          console.error('[TimeClockNotifications] Erro ao buscar WhatsApp da Loja:', storeWaError);
        }
      }

      // Buscar WhatsApp Global (sempre verificar, mesmo sem loja)
      const { data: globalWa, error: globalError } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_credentials')
        .select('admin_id, site_slug, uazapi_status, uazapi_phone_number, is_global, status, display_name')
        .eq('is_global', true)
        .maybeSingle();

      console.log('[TimeClockNotifications] WhatsApp Global encontrado:', {
        found: !!globalWa,
        error: globalError,
        data: globalWa ? {
          uazapi_status: globalWa.uazapi_status,
          uazapi_phone_number: globalWa.uazapi_phone_number,
          is_global: globalWa.is_global,
          status: globalWa.status,
        } : null,
      });

      if (globalWa) {
        setGlobalWhatsApp(globalWa);
      } else if (globalError) {
        console.error('[TimeClockNotifications] Erro ao buscar WhatsApp Global:', globalError);
      }
    } catch (err) {
      console.error('[TimeClockNotifications] Erro ao buscar WhatsApp:', err);
    }
  };

  // NOTA: recipient_phones agora são carregados diretamente de time_clock_notification_config
  // Não é mais necessário buscar de whatsapp_notification_config

  const handleSave = async () => {
    if (!profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (config.notifications_enabled && config.recipient_phones.length === 0) {
      toast.error('Adicione pelo menos um numero de telefone');
      return;
    }

    setSaving(true);
    try {
      // 1. Salvar configuração principal em time_clock_notification_config
      const payload = {
        store_id: storeId,
        notifications_enabled: config.notifications_enabled,
        notify_clock_in: config.notify_clock_in,
        notify_clock_out: config.notify_clock_out,
        notify_change_requests: config.notify_change_requests,
        notify_request_approved: config.notify_request_approved,
        notify_request_rejected: config.notify_request_rejected,
        recipient_phones: config.recipient_phones,
        use_global_whatsapp: config.use_global_whatsapp ?? false,
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

      // NOTA: Os telefones são salvos diretamente no array recipient_phones
      // da tabela time_clock_notification_config (payload acima)
      // Não é mais necessário duplicar em whatsapp_notification_config

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

  // ✅ Otimização: usar useMemo para evitar recálculos desnecessários
  const getWhatsAppStatus = useCallback(() => {
    const storeConnected = storeWhatsApp?.uazapi_status === 'connected';
    const globalConnected = globalWhatsApp?.uazapi_status === 'connected';
    const useGlobal = config.use_global_whatsapp ?? false;

    // Determinar qual está selecionado e qual está disponível
    const hasBoth = storeConnected && globalConnected;
    const hasStore = storeConnected;
    const hasGlobal = globalConnected;

    // Se escolheu usar global e global está conectado
    if (useGlobal && globalConnected) {
      return {
        type: 'global',
        connected: true,
        phone: globalWhatsApp?.uazapi_phone_number,
        label: 'WhatsApp Global (Elevea)',
        canChoose: hasBoth, // Pode escolher se ambos estão conectados
        hasStore,
        hasGlobal,
      };
    }
    
    // Se escolheu usar loja e loja está conectada
    if (!useGlobal && storeConnected) {
      return {
        type: 'store',
        connected: true,
        phone: storeWhatsApp?.uazapi_phone_number,
        label: 'WhatsApp da Loja',
        canChoose: hasBoth, // Pode escolher se ambos estão conectados
        hasStore,
        hasGlobal,
      };
    }
    
    // Fallback: usar o que estiver disponível
    if (storeConnected) {
      return {
        type: 'store',
        connected: true,
        phone: storeWhatsApp?.uazapi_phone_number,
        label: 'WhatsApp da Loja',
        canChoose: hasBoth,
        hasStore,
        hasGlobal,
      };
    } else if (globalConnected) {
      return {
        type: 'global',
        connected: true,
        phone: globalWhatsApp?.uazapi_phone_number,
        label: 'WhatsApp Global (Elevea)',
        canChoose: false,
        hasStore: false,
        hasGlobal: true,
      };
    } else {
      return {
        type: 'none',
        connected: false,
        phone: null,
        label: 'Nenhum WhatsApp conectado',
        canChoose: false,
        hasStore: false,
        hasGlobal: false,
      };
    }
  }, [storeWhatsApp, globalWhatsApp, config.use_global_whatsapp]);

  // ✅ Otimização: memoizar resultado para evitar recálculos
  const whatsAppStatus = useMemo(() => getWhatsAppStatus(), [getWhatsAppStatus]);

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
          {/* Seção de Seleção de WhatsApp */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium mb-2 block">WhatsApp Remetente</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Escolha qual WhatsApp será usado para enviar as notificações de ponto
              </p>
            </div>

            {/* Opções de WhatsApp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Opção: WhatsApp da Loja (Personalizado) */}
              <div
                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  !config.use_global_whatsapp && whatsAppStatus.hasStore
                    ? 'border-primary bg-primary/5'
                    : whatsAppStatus.hasStore
                    ? 'border-muted hover:border-primary/50'
                    : 'border-muted opacity-50 cursor-not-allowed'
                }`}
                onClick={() => {
                  if (whatsAppStatus.hasStore) {
                    setConfig(prev => ({ ...prev, use_global_whatsapp: false }));
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${!config.use_global_whatsapp && whatsAppStatus.hasStore ? 'text-primary' : 'text-muted-foreground'}`}>
                    <Phone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">WhatsApp Personalizado</span>
                      {!config.use_global_whatsapp && whatsAppStatus.hasStore && (
                        <Badge className="bg-primary text-primary-foreground text-xs">Selecionado</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      WhatsApp específico da loja
                    </p>
                    {whatsAppStatus.hasStore ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-green-600 font-medium">Conectado</span>
                        </div>
                        {storeWhatsApp?.uazapi_phone_number && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{storeWhatsApp.uazapi_phone_number}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        <span>Não conectado</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opção: WhatsApp Global */}
              <div
                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  config.use_global_whatsapp && whatsAppStatus.hasGlobal
                    ? 'border-primary bg-primary/5'
                    : whatsAppStatus.hasGlobal
                    ? 'border-muted hover:border-primary/50'
                    : 'border-muted opacity-50 cursor-not-allowed'
                }`}
                onClick={() => {
                  if (whatsAppStatus.hasGlobal) {
                    setConfig(prev => ({ ...prev, use_global_whatsapp: true }));
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${config.use_global_whatsapp && whatsAppStatus.hasGlobal ? 'text-primary' : 'text-muted-foreground'}`}>
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">WhatsApp Global</span>
                      {config.use_global_whatsapp && whatsAppStatus.hasGlobal && (
                        <Badge className="bg-primary text-primary-foreground text-xs">Selecionado</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      WhatsApp compartilhado (Elevea)
                    </p>
                    {whatsAppStatus.hasGlobal ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-green-600 font-medium">Conectado</span>
                        </div>
                        {globalWhatsApp?.uazapi_phone_number && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{globalWhatsApp.uazapi_phone_number}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        <span>Não conectado</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo do WhatsApp Selecionado */}
            {whatsAppStatus.connected && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Usando:</span>
                  <Badge className="bg-green-500 text-white text-xs">
                    {whatsAppStatus.type === 'global' && <Globe className="h-3 w-3 mr-1" />}
                    {whatsAppStatus.type === 'store' && <Phone className="h-3 w-3 mr-1" />}
                    {whatsAppStatus.label}
                  </Badge>
                  {whatsAppStatus.phone && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{whatsAppStatus.phone}</span>
                    </>
                  )}
                </div>
              </div>
            )}
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
