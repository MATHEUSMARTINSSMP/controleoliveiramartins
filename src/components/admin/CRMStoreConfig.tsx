import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Store {
  id: string;
  name: string;
  crm_ativo: boolean;
  active: boolean;
}

export const CRMStoreConfig = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, crm_ativo, active')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      setStores(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setLoading(false);
    }
  };

  const toggleCRM = async (storeId: string, currentValue: boolean) => {
    try {
      setSaving(storeId);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .update({ crm_ativo: !currentValue })
        .eq('id', storeId);

      if (error) throw error;

      setStores(prev =>
        prev.map(store =>
          store.id === storeId ? { ...store, crm_ativo: !currentValue } : store
        )
      );

      toast.success(
        `CRM ${!currentValue ? 'ativado' : 'desativado'} para a loja com sucesso!`
      );
    } catch (error: any) {
      console.error('Erro ao atualizar CRM:', error);
      toast.error('Erro ao atualizar configuração de CRM');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
          Configuração de CRM por Loja
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Ative ou desative o módulo de CRM para cada loja. Apenas lojas com CRM ativo terão acesso ao módulo na aba de Metas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma loja ativa encontrada
            </p>
          ) : (
            stores.map((store) => (
              <div
                key={store.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <Label htmlFor={`crm-${store.id}`} className="text-sm font-medium cursor-pointer">
                    {store.name}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {store.crm_ativo
                      ? 'Módulo de CRM ativo para esta loja'
                      : 'Módulo de CRM desativado'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saving === store.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      id={`crm-${store.id}`}
                      checked={store.crm_ativo || false}
                      onCheckedChange={() => toggleCRM(store.id, store.crm_ativo || false)}
                      disabled={saving !== null}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
