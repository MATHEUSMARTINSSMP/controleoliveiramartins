/**
 * Componente de Configuração de Regras de Cashback
 * 
 * Permite configurar todas as regras do sistema de cashback:
 * - Prazo para liberação
 * - Prazo para expiração
 * - Percentual de cashback
 * - Percentual máximo de uso
 * - Renovação de cashback
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Settings, Clock, Percent, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

interface CashbackSettings {
  id: string;
  store_id: string | null;
  prazo_liberacao_dias: number;
  prazo_expiracao_dias: number;
  percentual_cashback: number;
  percentual_uso_maximo: number;
  renovacao_habilitada: boolean;
  renovacao_dias: number;
  observacoes: string | null;
}

interface CashbackSettingsProps {
  storeId?: string; // Se fornecido, configura para loja específica, senão configuração global
}

export default function CashbackSettings({ storeId }: CashbackSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CashbackSettings | null>(null);
  const [formData, setFormData] = useState({
    prazo_liberacao_dias: 2,
    prazo_expiracao_dias: 30,
    percentual_cashback: 15.00,
    percentual_uso_maximo: 30.00,
    renovacao_habilitada: true,
    renovacao_dias: 3,
    observacoes: '',
  });

  useEffect(() => {
    fetchSettings();
  }, [storeId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('*');

      if (storeId) {
        query = query.eq('store_id', storeId);
      } else {
        query = query.is('store_id', null); // Configuração global
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      if (data) {
        setSettings(data);
        setFormData({
          prazo_liberacao_dias: data.prazo_liberacao_dias,
          prazo_expiracao_dias: data.prazo_expiracao_dias,
          percentual_cashback: Number(data.percentual_cashback),
          percentual_uso_maximo: Number(data.percentual_uso_maximo),
          renovacao_habilitada: data.renovacao_habilitada,
          renovacao_dias: data.renovacao_dias,
          observacoes: data.observacoes || '',
        });
      }
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      toast.error('Erro ao carregar configurações de cashback');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const settingsData = {
        store_id: storeId || null,
        prazo_liberacao_dias: formData.prazo_liberacao_dias,
        prazo_expiracao_dias: formData.prazo_expiracao_dias,
        percentual_cashback: formData.percentual_cashback,
        percentual_uso_maximo: formData.percentual_uso_maximo,
        renovacao_habilitada: formData.renovacao_habilitada,
        renovacao_dias: formData.renovacao_dias,
        observacoes: formData.observacoes || null,
      };

      if (settings) {
        // Atualizar existente
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('cashback_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
        toast.success('Configurações de cashback atualizadas com sucesso!');
      } else {
        // Criar novo
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('cashback_settings')
          .insert(settingsData)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        toast.success('Configurações de cashback criadas com sucesso!');
      }

      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações de cashback');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configurações de Cashback
        </CardTitle>
        <CardDescription>
          {storeId ? 'Configurações específicas da loja' : 'Configuração global do sistema'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Configure as regras de cashback que serão aplicadas automaticamente no sistema.
            As configurações são aplicadas imediatamente após salvar.
          </AlertDescription>
        </Alert>

        {/* Prazo para Liberação */}
        <div className="space-y-2">
          <Label htmlFor="prazo_liberacao" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Prazo para Liberação do Cashback (dias)
          </Label>
          <Input
            id="prazo_liberacao"
            type="number"
            min="0"
            value={formData.prazo_liberacao_dias}
            onChange={(e) => setFormData({ ...formData, prazo_liberacao_dias: parseInt(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">
            Quantos dias após a compra o cashback fica disponível para uso. Padrão: 2 dias
          </p>
        </div>

        {/* Prazo para Expiração */}
        <div className="space-y-2">
          <Label htmlFor="prazo_expiracao" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Prazo para Expiração do Cashback (dias)
          </Label>
          <Input
            id="prazo_expiracao"
            type="number"
            min="1"
            value={formData.prazo_expiracao_dias}
            onChange={(e) => setFormData({ ...formData, prazo_expiracao_dias: parseInt(e.target.value) || 1 })}
          />
          <p className="text-xs text-muted-foreground">
            Quantos dias após a liberação o cashback expira. Padrão: 30 dias
          </p>
        </div>

        {/* Percentual de Cashback */}
        <div className="space-y-2">
          <Label htmlFor="percentual_cashback" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Percentual de Cashback Gerado (%)
          </Label>
          <Input
            id="percentual_cashback"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.percentual_cashback}
            onChange={(e) => setFormData({ ...formData, percentual_cashback: parseFloat(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">
            Percentual de cashback gerado em cada compra. Padrão: 15%
          </p>
        </div>

        {/* Percentual Máximo de Uso */}
        <div className="space-y-2">
          <Label htmlFor="percentual_uso_maximo" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Percentual Máximo de Uso na Compra (%)
          </Label>
          <Input
            id="percentual_uso_maximo"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.percentual_uso_maximo}
            onChange={(e) => setFormData({ ...formData, percentual_uso_maximo: parseFloat(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground">
            Percentual máximo da próxima compra que pode ser pago com cashback. Padrão: 30%
          </p>
        </div>

        {/* Renovação de Cashback */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="renovacao_habilitada" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Habilitar Renovação de Cashback
              </Label>
              <p className="text-xs text-muted-foreground">
                Permite renovar o prazo de expiração do cashback
              </p>
            </div>
            <Switch
              id="renovacao_habilitada"
              checked={formData.renovacao_habilitada}
              onCheckedChange={(checked) => setFormData({ ...formData, renovacao_habilitada: checked })}
            />
          </div>

          {formData.renovacao_habilitada && (
            <div className="space-y-2">
              <Label htmlFor="renovacao_dias">Dias de Renovação</Label>
              <Input
                id="renovacao_dias"
                type="number"
                min="0"
                value={formData.renovacao_dias}
                onChange={(e) => setFormData({ ...formData, renovacao_dias: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Quantos dias adicionar ao prazo quando renovar o cashback. Padrão: 3 dias
              </p>
            </div>
          )}
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            placeholder="Observações sobre as configurações de cashback..."
            rows={3}
          />
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

