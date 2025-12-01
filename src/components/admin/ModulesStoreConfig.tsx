import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, MessageSquare, Package, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Store {
  id: string;
  name: string;
  cashback_ativo: boolean;
  crm_ativo: boolean;
  active: boolean;
}

interface ModuleInfo {
  id: 'cashback' | 'crm' | 'erp';
  name: string;
  description: string;
  icon: React.ReactNode;
  field: 'cashback_ativo' | 'crm_ativo';
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
        .select('id, name, cashback_ativo, crm_ativo, active')
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
          Configuração de Módulos por Loja
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Ative ou desative módulos específicos para cada loja. Cada módulo oferece funcionalidades diferentes para melhorar a gestão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Informações dos Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {modules.map(module => (
            <div
              key={module.id}
              className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={module.color}>
                  {module.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{module.name}</h4>
                    {module.id === 'erp' && (
                      <Badge variant="secondary" className="text-xs">Sempre Ativo</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {module.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Lista de Lojas */}
        <div className="space-y-3">
          {stores.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhuma loja encontrada
            </p>
          ) : (
            stores.map(store => (
              <div
                key={store.id}
                className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm sm:text-base">{store.name}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                      className="h-6 px-2 text-xs"
                    >
                      {expandedStore === store.id ? 'Ocultar' : 'Mostrar'} Módulos
                    </Button>
                  </div>
                </div>

                {expandedStore === store.id && (
                  <div className="space-y-3 pt-3 border-t">
                    {modules.map(module => {
                      const isActive = getModuleStatus(store, module);
                      const isSaving = saving?.storeId === store.id && saving?.module === module.id;

                      return (
                        <div
                          key={module.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={module.color}>
                              {module.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label htmlFor={`${store.id}-${module.id}`} className="font-medium text-sm cursor-pointer">
                                {module.name}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {module.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Badge
                                  variant={isActive ? 'default' : 'secondary'}
                                  className="text-xs"
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
                )}

                {/* Resumo Rápido (quando colapsado) */}
                {expandedStore !== store.id && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Gift className="h-3 w-3" />
                      <span className={store.cashback_ativo ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                        Cashback {store.cashback_ativo ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span className={store.crm_ativo ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                        CRM {store.crm_ativo ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span className="text-green-600 dark:text-green-400">
                        ERP ✓
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Informação Adicional */}
        <div className="mt-6 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">Sobre os Módulos:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li><strong>Cashback:</strong> Gera créditos automaticamente quando clientes fazem compras. Configure valores e percentuais em "Gestão de Sistemas → Cashback".</li>
                <li><strong>CRM:</strong> Gerencia relacionamento com clientes. Acesse tarefas, compromissos e pós-vendas no Dashboard da Loja quando ativo.</li>
                <li><strong>ERP:</strong> Integração automática com Tiny ERP. Sempre ativo para sincronizar pedidos, produtos e colaboradoras.</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

