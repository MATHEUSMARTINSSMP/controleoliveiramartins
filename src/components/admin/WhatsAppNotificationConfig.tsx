import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Store {
  id: string;
  name: string;
}

interface NotificationRecipient {
  id?: string;
  phone: string;
  store_ids: string[]; // Array de IDs de lojas selecionadas
  active: boolean;
}

interface NotificationConfig {
  type: 'VENDA' | 'ADIANTAMENTO' | 'PARABENS';
  label: string;
  description: string;
  recipients: NotificationRecipient[];
}

export const WhatsAppNotificationConfig = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [configs, setConfigs] = useState<NotificationConfig[]>([
    {
      type: 'VENDA',
      label: 'Notificações de Vendas',
      description: 'Receba notificações quando uma nova venda for lançada',
      recipients: []
    },
    {
      type: 'ADIANTAMENTO',
      label: 'Notificações de Adiantamento',
      description: 'Receba notificações quando uma colaboradora solicitar adiantamento',
      recipients: []
    },
    {
      type: 'PARABENS',
      label: 'Notificações de Parabéns',
      description: 'Envie mensagens de parabéns para a loja após cada venda',
      recipients: []
    }
  ]);

  useEffect(() => {
    if (profile && profile.role === 'ADMIN') {
      fetchStores();
      fetchConfigs();
    }
  }, [profile]);

  const fetchStores = async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name')
        .eq('admin_id', profile.id)
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    }
  };

  const fetchConfigs = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_notification_config')
        .select('*')
        .eq('admin_id', profile.id)
        .eq('active', true)
        .order('notification_type', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Agrupar por tipo de notificação e telefone
      // Agrupar registros com mesmo telefone e tipo, coletando todas as lojas
      const groupedByPhone = (data || []).reduce((acc, item) => {
        const type = item.notification_type as 'VENDA' | 'ADIANTAMENTO' | 'PARABENS';
        const normalizedPhone = normalizePhone(item.phone);
        const key = `${type}-${normalizedPhone}`;
        
        if (!acc[key]) {
          acc[key] = {
            phone: normalizedPhone,
            store_ids: [] as string[],
            ids: [] as string[],
            active: item.active
          };
        }
        
        if (item.store_id && !acc[key].store_ids.includes(item.store_id)) {
          acc[key].store_ids.push(item.store_id);
        }
        if (!acc[key].ids.includes(item.id)) {
          acc[key].ids.push(item.id);
        }
        
        return acc;
      }, {} as Record<string, { phone: string; store_ids: string[]; ids: string[]; active: boolean }>);

      // Converter para formato de recipients
      const grouped = Object.entries(groupedByPhone).reduce((acc, [key, value]) => {
        const type = key.split('-')[0] as 'VENDA' | 'ADIANTAMENTO' | 'PARABENS';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push({
          phone: value.phone,
          store_ids: value.store_ids,
          active: value.active
        });
        return acc;
      }, {} as Record<string, NotificationRecipient[]>);

      // Atualizar configs com dados do banco
      setConfigs(prev => prev.map(config => ({
        ...config,
        recipients: grouped[config.type] || []
      })));

    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      toast.error('Erro ao carregar configurações de notificação');
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = (type: 'VENDA' | 'ADIANTAMENTO' | 'PARABENS') => {
    setConfigs(prev => prev.map(config => {
      if (config.type === type) {
        return {
          ...config,
          recipients: [...config.recipients, { phone: '', store_ids: [], active: true }]
        };
      }
      return config;
    }));
  };

  const removeRecipient = (type: 'VENDA' | 'ADIANTAMENTO' | 'PARABENS', index: number) => {
    setConfigs(prev => prev.map(config => {
      if (config.type === type) {
        const newRecipients = [...config.recipients];
        newRecipients.splice(index, 1);
        return { ...config, recipients: newRecipients };
      }
      return config;
    }));
  };

  const updateRecipientPhone = (
    type: 'VENDA' | 'ADIANTAMENTO' | 'PARABENS',
    index: number,
    value: string
  ) => {
    setConfigs(prev => prev.map(config => {
      if (config.type === type) {
        const newRecipients = [...config.recipients];
        newRecipients[index] = { ...newRecipients[index], phone: value };
        return { ...config, recipients: newRecipients };
      }
      return config;
    }));
  };

  const toggleStoreSelection = (
    type: 'VENDA' | 'ADIANTAMENTO' | 'PARABENS',
    index: number,
    storeId: string
  ) => {
    setConfigs(prev => prev.map(config => {
      if (config.type === type) {
        const newRecipients = [...config.recipients];
        const currentStoreIds = newRecipients[index].store_ids || [];
        const newStoreIds = currentStoreIds.includes(storeId)
          ? currentStoreIds.filter(id => id !== storeId)
          : [...currentStoreIds, storeId];
        newRecipients[index] = { ...newRecipients[index], store_ids: newStoreIds };
        return { ...config, recipients: newRecipients };
      }
      return config;
    }));
  };

  const normalizePhone = (phone: string): string => {
    // Remove tudo que não é número
    let cleaned = phone.replace(/\D/g, '');
    
    // Se começar com 55 (DDI do Brasil), remover
    if (cleaned.startsWith('55')) {
      cleaned = cleaned.substring(2);
    }
    
    // Se começar com 0, remover
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  };

  const validatePhone = (phone: string): boolean => {
    const normalized = normalizePhone(phone);
    // Deve ter entre 10 e 11 dígitos (sem DDI, sem 0 inicial)
    // Aceita: 96981032928 (11 dígitos) ou 6981032928 (10 dígitos)
    return normalized.length >= 10 && normalized.length <= 11;
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      // Validar todos os números e lojas
      for (const config of configs) {
        for (const recipient of config.recipients) {
          if (!recipient.phone.trim()) {
            toast.error(`Preencha o número de telefone em "${config.label}"`);
            setSaving(false);
            return;
          }
          const normalizedPhone = normalizePhone(recipient.phone);
          if (!validatePhone(recipient.phone)) {
            toast.error(
              `Número de telefone inválido em "${config.label}". ` +
              `Digite apenas números (10-11 dígitos). ` +
              `Você digitou: ${normalizedPhone.length} dígito(s). ` +
              `Exemplos: 96981113307 ou 5596981113307`
            );
            setSaving(false);
            return;
          }
          // Validar que pelo menos uma loja foi selecionada
          if (!recipient.store_ids || recipient.store_ids.length === 0) {
            toast.error(`Selecione pelo menos uma loja em "${config.label}"`);
            setSaving(false);
            return;
          }
        }
      }

      // Buscar configurações existentes
      const { data: existingConfigs, error: fetchError } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_notification_config')
        .select('*')
        .eq('admin_id', profile.id);

      if (fetchError) {
        console.error('Erro ao buscar configurações existentes:', fetchError);
        throw fetchError;
      }

      // Criar mapa de registros existentes por tipo, telefone e loja
      const existingMap = new Map(
        (existingConfigs || []).map(item => {
          const normalized = normalizePhone(item.phone);
          return [
            `${item.notification_type}-${normalized}-${item.store_id || 'NULL'}`,
            { ...item, normalizedPhone: normalized }
          ];
        })
      );

      // Preparar operações: INSERT, UPDATE, DELETE
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      const toDelete: string[] = [];
      const currentKeys = new Set<string>();

      // Processar cada tipo de notificação
      for (const config of configs) {
        for (const recipient of config.recipients) {
          const normalizedPhone = normalizePhone(recipient.phone);
          
          // Para cada loja selecionada, criar/atualizar um registro
          for (const storeId of recipient.store_ids) {
            const key = `${config.type}-${normalizedPhone}-${storeId}`;
            currentKeys.add(key);

            if (existingMap.has(key)) {
              // UPDATE - manter registro existente
              const existing = existingMap.get(key)!;
              toUpdate.push({
                id: existing.id,
                phone: normalizedPhone,
                store_id: storeId,
                active: true
              });
            } else {
              // INSERT - novo registro para esta combinação telefone+loja
              toInsert.push({
                admin_id: profile.id,
                notification_type: config.type,
                phone: normalizedPhone,
                store_id: storeId,
                active: true
              });
            }
          }
        }

        // Identificar registros a deletar (existem no banco mas não estão na lista atual)
        for (const existing of existingConfigs || []) {
          if (existing.notification_type === config.type) {
            const normalizedExisting = normalizePhone(existing.phone);
            const existingKey = `${existing.notification_type}-${normalizedExisting}-${existing.store_id || 'NULL'}`;
            if (!currentKeys.has(existingKey)) {
              toDelete.push(existing.id);
            }
          }
        }
      }

      // Executar operações
      if (toDelete.length > 0) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_notification_config')
          .delete()
          .in('id', toDelete);

        if (error) throw error;
      }

      if (toUpdate.length > 0) {
        for (const item of toUpdate) {
          const { error } = await supabase
            .schema('sistemaretiradas')
            .from('whatsapp_notification_config')
            .update({
              phone: item.phone,
              store_id: item.store_id,
              active: item.active
            })
            .eq('id', item.id);

          if (error) throw error;
        }
      }

      if (toInsert.length > 0) {
        // Inserir um por um para melhor tratamento de erros de duplicata
        for (const item of toInsert) {
          const { error } = await supabase
            .schema('sistemaretiradas')
            .from('whatsapp_notification_config')
            .insert(item);

          if (error) {
            // Se for erro de duplicata, ignorar (já existe)
            if (error.code === '23505') {
              console.warn('⚠️ Registro já existe, ignorando:', item);
              // Não fazer nada, o registro já existe
            } else {
              console.error('❌ Erro ao inserir registro:', item, error);
              throw error;
            }
          }
        }
      }

      toast.success('Configurações salvas com sucesso!');
      await fetchConfigs(); // Recarregar para pegar IDs dos novos registros
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Carregando configurações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Configuração de Notificações WhatsApp
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure quais números recebem cada tipo de notificação
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>

      {configs.map((config) => (
        <Card key={config.type}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {config.label}
            </CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.recipients.map((recipient, index) => (
              <div key={index} className="space-y-4 p-4 border rounded-lg">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`${config.type}-phone-${index}`}>
                      Número WhatsApp *
                    </Label>
                    <Input
                      id={`${config.type}-phone-${index}`}
                      type="tel"
                      placeholder="96981113307"
                      value={recipient.phone}
                      onChange={(e) => updateRecipientPhone(config.type, index, e.target.value)}
                      className="placeholder:text-muted-foreground/50"
                    />
                    <p className="text-xs text-muted-foreground/70">
                      Formato: apenas números (10-11 dígitos). Ex: 96981113307 ou 5596981113307
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeRecipient(config.type, index)}
                    className="mt-8"
                    title="Remover número"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>
                    Lojas * (selecione uma ou mais)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 border rounded-md bg-muted/30">
                    {stores.map((store) => (
                      <div key={store.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${config.type}-store-${index}-${store.id}`}
                          checked={recipient.store_ids?.includes(store.id) || false}
                          onCheckedChange={() => toggleStoreSelection(config.type, index, store.id)}
                        />
                        <Label
                          htmlFor={`${config.type}-store-${index}-${store.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {store.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {(!recipient.store_ids || recipient.store_ids.length === 0) && (
                    <p className="text-xs text-destructive">
                      Selecione pelo menos uma loja
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/70">
                    {config.type === 'PARABENS' 
                      ? 'Selecione as lojas que receberão os parabéns após cada venda'
                      : 'Selecione as lojas que receberão notificações deste tipo'}
                  </p>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={() => addRecipient(config.type)}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar Número
            </Button>

            {config.recipients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum número configurado. Clique em "Adicionar Número" para começar.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

