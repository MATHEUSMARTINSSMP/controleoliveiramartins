import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, AlertCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface Store {
  id: string;
  name: string;
  cashback_ativo: boolean;
  active: boolean;
}

export const CashbackStoreConfig = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [hasActiveCashback, setHasActiveCashback] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, cashback_ativo, active')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      const allStores = data || [];
      
      // Filtrar apenas lojas com cashback ativo
      const storesWithCashback = allStores.filter(store => store.cashback_ativo === true);
      
      setStores(storesWithCashback);
      setHasActiveCashback(storesWithCashback.length > 0);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setLoading(false);
    }
  };

  const toggleCashback = async (storeId: string, currentValue: boolean) => {
    try {
      setSaving(storeId);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .update({ cashback_ativo: !currentValue })
        .eq('id', storeId);

      if (error) throw error;

      // Atualizar estado local e remover da lista se foi desativado
      if (!currentValue) {
        // Foi ativado, adicionar à lista
        const { data: updatedStore } = await supabase
          .schema('sistemaretiradas')
          .from('stores')
          .select('id, name, cashback_ativo, active')
          .eq('id', storeId)
          .single();
        
        if (updatedStore) {
          setStores(prev => [...prev, updatedStore].sort((a, b) => a.name.localeCompare(b.name)));
          setHasActiveCashback(true);
        }
      } else {
        // Foi desativado, remover da lista
        setStores(prev => prev.filter(store => store.id !== storeId));
        setHasActiveCashback(stores.length > 1);
      }

      toast.success(
        `Cashback ${!currentValue ? 'ativado' : 'desativado'} para a loja com sucesso!`
      );
    } catch (error: any) {
      console.error('Erro ao atualizar cashback:', error);
      toast.error('Erro ao atualizar configuração de cashback');
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

  // Se não houver lojas com cashback ativo, mostrar mensagem orientativa
  if (!hasActiveCashback || stores.length === 0) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Gift className="h-4 w-4 sm:h-5 sm:w-5" />
            Configuração de Cashback por Loja
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Configure as opções de cashback para lojas com o módulo ativado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Módulo Cashback não está ativo</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">
                Nenhuma loja possui o módulo de cashback ativado no momento. Para configurar o sistema de cashback, é necessário ativar o módulo primeiro.
              </p>
              <Button
                onClick={() => {
                  // Navegar para a aba de configurações e focar nos módulos
                  navigate('/admin', { state: { tab: 'configuracoes', scrollTo: 'modules' } });
                }}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Ativar Módulo Cashback
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Gift className="h-4 w-4 sm:h-5 sm:w-5" />
          Configuração de Cashback por Loja
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Configure as opções de cashback para lojas com o módulo ativado. Apenas lojas com cashback ativo aparecem aqui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma loja com cashback ativo encontrada
            </p>
          ) : (
            stores.map((store) => (
              <div
                key={store.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <Label htmlFor={`cashback-${store.id}`} className="text-sm font-medium cursor-pointer">
                    {store.name}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {store.cashback_ativo
                      ? 'Módulo de cashback ativo para esta loja'
                      : 'Módulo de cashback desativado'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {saving === store.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      id={`cashback-${store.id}`}
                      checked={store.cashback_ativo || false}
                      onCheckedChange={() => toggleCashback(store.id, store.cashback_ativo || false)}
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

