import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, MessageSquare, Package, Info, Heart, Clock, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Store {
  id: string;
  name: string;
  cashback_ativo: boolean;
  crm_ativo: boolean;
  wishlist_ativo: boolean;
  ponto_ativo: boolean;
  active: boolean;
}

interface ModuleInfo {
  id: 'cashback' | 'crm' | 'erp' | 'wishlist' | 'ponto';
  name: string;
  description: string;
  icon: React.ReactNode;
  field: 'cashback_ativo' | 'crm_ativo' | 'wishlist_ativo' | 'ponto_ativo';
  color: string;
}

const modules: ModuleInfo[] = [
  {
    id: 'cashback',
    name: 'Cashback',
    description: 'Sistema de recompensas que gera créditos automáticos para clientes baseado em suas compras. Os clientes recebem cashback que pode ser usado em compras futuras.',
    icon: <Gift className="h-5 w-5" />,
    field: 'cashback_ativo',
    color: 'text-pink-600 dark:text-pink-400'
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Sistema de gestão de relacionamento com clientes. Permite gerenciar tarefas, compromissos, pós-vendas, aniversariantes e contatos para melhorar o atendimento.',
    icon: <MessageSquare className="h-5 w-5" />,
    field: 'crm_ativo',
    color: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'wishlist',
    name: 'Wishlist',
    description: 'Sistema de lista de desejos que permite registrar produtos ou itens que clientes desejam comprar no futuro. Facilita o acompanhamento e comunicação com clientes.',
    icon: <Heart className="h-5 w-5" />,
    field: 'wishlist_ativo',
    color: 'text-red-600 dark:text-red-400'
  },
  {
    id: 'ponto',
    name: 'Controle de Ponto',
    description: 'Sistema de controle de ponto e jornada de trabalho. Permite registrar entrada, saída e intervalos das colaboradoras, além de gerenciar banco de horas.',
    icon: <Clock className="h-5 w-5" />,
    field: 'ponto_ativo',
    color: 'text-orange-600 dark:text-orange-400'
  },
  {
    id: 'erp',
    name: 'ERP',
    description: 'Integração com Tiny ERP para sincronização automática de pedidos, produtos, clientes e colaboradoras. As vendas são importadas automaticamente e convertidas em metas.',
    icon: <Package className="h-5 w-5" />,
    field: 'crm_ativo', // ERP não tem campo específico, mas vamos usar crm_ativo como placeholder
    color: 'text-green-600 dark:text-green-400'
  }
];

export const ModulesStoreConfig = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ storeId: string; module: string } | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, cashback_ativo, crm_ativo, wishlist_ativo, ponto_ativo, active')
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

  const toggleModule = async (storeId: string, module: ModuleInfo, currentValue: boolean) => {
    // ERP não tem campo específico, então não fazemos nada
    if (module.id === 'erp') {
      toast.info('O módulo ERP está sempre ativo para todas as lojas');
      return;
    }

    try {
      setSaving({ storeId, module: module.id });
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .update({ [module.field]: !currentValue })
        .eq('id', storeId);

      if (error) throw error;

      setStores(prev =>
        prev.map(store =>
          store.id === storeId
            ? { ...store, [module.field]: !currentValue }
            : store
        )
      );

      toast.success(`${module.name} ${!currentValue ? 'ativado' : 'desativado'} para ${stores.find(s => s.id === storeId)?.name}`);
    } catch (error: any) {
      console.error(`Erro ao ${currentValue ? 'desativar' : 'ativar'} ${module.name}:`, error);
      toast.error(`Erro ao ${currentValue ? 'desativar' : 'ativar'} ${module.name}`);
    } finally {
      setSaving(null);
    }
  };

  const getModuleStatus = (store: Store, module: ModuleInfo): boolean => {
    if (module.id === 'erp') {
      // ERP está sempre ativo (assumindo que todas as lojas têm acesso)
      return true;
    }
    return store[module.field] || false;
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Módulos por Loja
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Ative ou desative módulos específicos para cada loja. Os módulos ativos aparecerão no Dashboard da Loja.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Lista de Lojas */}
        <div className="space-y-4">
          {stores.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhuma loja encontrada
            </p>
          ) : (
            stores.map(store => (
              <Card key={store.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{store.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                      className="h-7 px-3 text-xs"
                    >
                      {expandedStore === store.id ? (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-3 w-3 mr-1" />
                          Configurar
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {expandedStore === store.id ? (
                    <div className="space-y-3 pt-2">
                      {modules.map(module => {
                        const isActive = getModuleStatus(store, module);
                        const isSaving = saving?.storeId === store.id && saving?.module === module.id;

                        return (
                          <div
                            key={module.id}
                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                              isActive 
                                ? 'bg-primary/5 border-primary/20' 
                                : 'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`${module.color} mt-0.5`}>
                                {module.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Label 
                                    htmlFor={`${store.id}-${module.id}`} 
                                    className="font-semibold text-sm cursor-pointer"
                                  >
                                    {module.name}
                                  </Label>
                                  {module.id === 'erp' && (
                                    <Badge variant="secondary" className="text-xs">Sempre Ativo</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {module.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  <Badge
                                    variant={isActive ? 'default' : 'secondary'}
                                    className="text-xs min-w-[60px] text-center"
                                  >
                                    {isActive ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                  <Switch
                                    id={`${store.id}-${module.id}`}
                                    checked={isActive}
                                    onCheckedChange={() => toggleModule(store.id, module, isActive)}
                                    disabled={module.id === 'erp'}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.cashback_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <Gift className="h-3.5 w-3.5" />
                        <span className="font-medium">Cashback</span>
                        {store.cashback_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.crm_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span className="font-medium">CRM</span>
                        {store.crm_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.wishlist_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <Heart className="h-3.5 w-3.5" />
                        <span className="font-medium">Wishlist</span>
                        {store.wishlist_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.ponto_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">Ponto</span>
                        {store.ponto_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 text-success">
                        <Package className="h-3.5 w-3.5" />
                        <span className="font-medium">ERP</span>
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

      </CardContent>
    </Card>
  );
};

