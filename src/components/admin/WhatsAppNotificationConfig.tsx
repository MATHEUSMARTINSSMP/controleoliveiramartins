import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationRecipient {
  id?: string;
  phone: string;
  name?: string;
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
      fetchConfigs();
    }
  }, [profile]);

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

      // Agrupar por tipo de notificação
      const grouped = (data || []).reduce((acc, item) => {
        const type = item.notification_type as 'VENDA' | 'ADIANTAMENTO' | 'PARABENS';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push({
          id: item.id,
          phone: item.phone,
          name: item.name || '',
          active: item.active
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
          recipients: [...config.recipients, { phone: '', name: '', active: true }]
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

  const updateRecipient = (
    type: 'VENDA' | 'ADIANTAMENTO' | 'PARABENS',
    index: number,
    field: 'phone' | 'name',
    value: string
  ) => {
    setConfigs(prev => prev.map(config => {
      if (config.type === type) {
        const newRecipients = [...config.recipients];
        newRecipients[index] = { ...newRecipients[index], [field]: value };
        return { ...config, recipients: newRecipients };
      }
      return config;
    }));
  };

  const normalizePhone = (phone: string): string => {
    // Remove tudo que não é número
    return phone.replace(/\D/g, '');
  };

  const validatePhone = (phone: string): boolean => {
    const normalized = normalizePhone(phone);
    // Deve ter entre 10 e 11 dígitos (sem DDI)
    return normalized.length >= 10 && normalized.length <= 11;
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      // Validar todos os números
      for (const config of configs) {
        for (const recipient of config.recipients) {
          if (!recipient.phone.trim()) {
            toast.error(`Preencha o número de telefone em "${config.label}"`);
            setSaving(false);
            return;
          }
          if (!validatePhone(recipient.phone)) {
            toast.error(`Número de telefone inválido em "${config.label}". Use apenas números (10-11 dígitos).`);
            setSaving(false);
            return;
          }
        }
      }

      // Buscar configurações existentes
      const { data: existingConfigs } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_notification_config')
        .select('*')
        .eq('admin_id', profile.id);

      const existingMap = new Map(
        (existingConfigs || []).map(item => [
          `${item.notification_type}-${item.phone}`,
          item
        ])
      );

      // Preparar operações: INSERT, UPDATE, DELETE
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      const toDelete: string[] = [];

      // Processar cada tipo de notificação
      for (const config of configs) {
        const currentPhones = new Set<string>();

        for (const recipient of config.recipients) {
          const normalizedPhone = normalizePhone(recipient.phone);
          const key = `${config.type}-${normalizedPhone}`;
          currentPhones.add(normalizedPhone);

          if (existingMap.has(key)) {
            // UPDATE
            const existing = existingMap.get(key)!;
            toUpdate.push({
              id: existing.id,
              phone: normalizedPhone,
              name: recipient.name?.trim() || null,
              active: true
            });
          } else {
            // INSERT
            toInsert.push({
              admin_id: profile.id,
              notification_type: config.type,
              phone: normalizedPhone,
              name: recipient.name?.trim() || null,
              active: true
            });
          }
        }

        // Identificar números a deletar (existem no banco mas não estão na lista atual)
        for (const existing of existingConfigs || []) {
          if (existing.notification_type === config.type) {
            const normalizedExisting = normalizePhone(existing.phone);
            if (!currentPhones.has(normalizedExisting)) {
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
              name: item.name,
              active: item.active
            })
            .eq('id', item.id);

          if (error) throw error;
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_notification_config')
          .insert(toInsert);

        if (error) throw error;
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
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`${config.type}-phone-${index}`}>
                    Número WhatsApp *
                  </Label>
                  <Input
                    id={`${config.type}-phone-${index}`}
                    type="tel"
                    placeholder="96981113307 (apenas números)"
                    value={recipient.phone}
                    onChange={(e) => updateRecipient(config.type, index, 'phone', e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`${config.type}-name-${index}`}>
                    Nome (opcional)
                  </Label>
                  <Input
                    id={`${config.type}-name-${index}`}
                    type="text"
                    placeholder="Ex: Admin Principal"
                    value={recipient.name || ''}
                    onChange={(e) => updateRecipient(config.type, index, 'name', e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeRecipient(config.type, index)}
                  className="mb-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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

