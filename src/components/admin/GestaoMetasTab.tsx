import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Target, TrendingUp, TrendingDown, Info, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Store {
  id: string;
  name: string;
  meta_compensar_deficit: boolean;
  meta_bonus_frente: boolean;
}

export default function GestaoMetasTab() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compensarDeficit, setCompensarDeficit] = useState(true);
  const [bonusFrente, setBonusFrente] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      const store = stores.find(s => s.id === selectedStoreId);
      if (store) {
        setCompensarDeficit(store.meta_compensar_deficit ?? true);
        setBonusFrente(store.meta_bonus_frente ?? false);
      }
    }
  }, [selectedStoreId, stores]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, meta_compensar_deficit, meta_bonus_frente')
        .order('name');

      if (error) throw error;
      setStores(data || []);
      if (data && data.length > 0 && !selectedStoreId) {
        setSelectedStoreId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStoreId) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .update({
          meta_compensar_deficit: compensarDeficit,
          meta_bonus_frente: bonusFrente,
        })
        .eq('id', selectedStoreId);

      if (error) throw error;

      setStores(prev => prev.map(s => 
        s.id === selectedStoreId 
          ? { ...s, meta_compensar_deficit: compensarDeficit, meta_bonus_frente: bonusFrente }
          : s
      ));

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Configuracao de Calculo de Metas
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure como as metas diarias sao calculadas dinamicamente
          </p>
        </div>

        <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
          <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-store-metas">
            <SelectValue placeholder="Selecione uma loja" />
          </SelectTrigger>
          <SelectContent>
            {stores.map(store => (
              <SelectItem key={store.id} value={store.id} data-testid={`store-option-${store.id}`}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona o calculo de metas dinamicas?</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-sm">
            O sistema pode ajustar automaticamente a meta diaria das colaboradoras com base no desempenho acumulado do mes.
            Voce pode ativar uma ou ambas as opcoes abaixo, ou desativar todas para usar apenas a meta fixa baseada nos pesos diarios.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className={compensarDeficit ? 'ring-2 ring-primary/20' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-destructive/10">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-base">Compensar Deficit</CardTitle>
                  <CardDescription>Quando esta atras da meta</CardDescription>
                </div>
              </div>
              <Switch
                checked={compensarDeficit}
                onCheckedChange={setCompensarDeficit}
                data-testid="switch-compensar-deficit"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>O que faz:</strong> Quando uma colaboradora vendeu menos do que deveria ate ontem, 
                o sistema distribui esse deficit pelos dias restantes do mes.
              </p>
              <div className="bg-muted/50 p-3 rounded-md space-y-1">
                <p className="font-medium">Exemplo:</p>
                <p>Meta mensal: R$ 40.000 | Dia 17 de 31 dias</p>
                <p>Deveria ter vendido: R$ 20.645 (ate ontem)</p>
                <p>Vendeu ate ontem: R$ 15.000</p>
                <p className="text-destructive">Deficit: R$ 5.645</p>
                <p>Dias restantes: 15 dias</p>
                <p className="font-semibold">Meta de hoje = R$ 1.290 + (R$ 5.645 / 15) = R$ 1.666</p>
              </div>
              <p className="text-xs italic">
                Beneficio: Ajuda a colaboradora a recuperar o atraso gradualmente, sem sobrecarregar um unico dia.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={bonusFrente ? 'ring-2 ring-primary/20' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Bonus a Frente</CardTitle>
                  <CardDescription>Quando esta acima da meta</CardDescription>
                </div>
              </div>
              <Switch
                checked={bonusFrente}
                onCheckedChange={setBonusFrente}
                data-testid="switch-bonus-frente"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>O que faz:</strong> Quando uma colaboradora ja vendeu mais do que deveria ate ontem, 
                o sistema aumenta sua meta diaria proporcionalmente ao quanto ela esta a frente.
              </p>
              <div className="bg-muted/50 p-3 rounded-md space-y-1">
                <p className="font-medium">Exemplo:</p>
                <p>Meta mensal: R$ 40.000 | Dia 17 de 31 dias</p>
                <p>Deveria ter vendido: R$ 20.645 (ate ontem)</p>
                <p>Vendeu ate ontem: R$ 30.000</p>
                <p className="text-green-600">A frente em: 45%</p>
                <p>Meta base de hoje: R$ 1.290</p>
                <p className="font-semibold">Meta de hoje = R$ 1.290 x (1 + 0.45) = R$ 1.871</p>
              </div>
              <p className="text-xs italic">
                Beneficio: Incentiva colaboradoras de alto desempenho a manter o ritmo e buscar resultados ainda maiores.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Resumo da Configuracao Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            {!compensarDeficit && !bonusFrente && (
              <p className="text-muted-foreground">
                Calculo <strong>estatico</strong>: A meta diaria sera calculada apenas com base nos pesos diarios configurados, 
                sem ajustes dinamicos baseados no desempenho.
              </p>
            )}
            {compensarDeficit && !bonusFrente && (
              <p className="text-muted-foreground">
                Calculo <strong>defensivo</strong>: Colaboradoras atrasadas terao metas ajustadas para recuperar o deficit. 
                Colaboradoras a frente mantem a meta normal.
              </p>
            )}
            {!compensarDeficit && bonusFrente && (
              <p className="text-muted-foreground">
                Calculo <strong>agressivo</strong>: Colaboradoras a frente terao metas aumentadas. 
                Colaboradoras atrasadas mantem a meta normal (sem compensacao de deficit).
              </p>
            )}
            {compensarDeficit && bonusFrente && (
              <p className="text-muted-foreground">
                Calculo <strong>dinamico completo</strong>: Colaboradoras atrasadas terao metas ajustadas para recuperar, 
                e colaboradoras a frente terao metas aumentadas para maximizar resultados.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving || !selectedStoreId}
          data-testid="button-save-metas-config"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuracoes
            </>
          )}
        </Button>
      </div>

      {/* Analytics */}
      <div className="space-y-6 mt-8">
        <SalesPerformanceAnalytics />
        <ListaDaVezAnalytics />
      </div>
    </div>
  );
}
