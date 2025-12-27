import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Gift, MessageSquare, Package, Info, Heart, Clock, ChevronDown, ChevronRight, Check, X, Target, Settings, Scissors, Banknote, Users, CheckSquare2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatBRL } from '@/lib/utils';

interface Store {
  id: string;
  name: string;
  cashback_ativo: boolean;
  crm_ativo: boolean;
  wishlist_ativo: boolean;
  ponto_ativo: boolean;
  ajustes_condicionais_ativo: boolean;
  caixa_ativo: boolean;
  lista_da_vez_ativo: boolean;
  tasks_ativo: boolean;
  whatsapp_notificacoes_ajustes_condicionais: string | null;
  whatsapp_caixa_numeros: string[] | null;
  whatsapp_caixa_usar_global: boolean;
  daily_goal_check_ativo: boolean;
  daily_goal_check_valor_bonus: number | null;
  daily_goal_check_horario_limite: string | null;
  active: boolean;
}

interface ModuleInfo {
  id: 'cashback' | 'crm' | 'erp' | 'wishlist' | 'ponto' | 'ajustes_condicionais' | 'daily_goal_check' | 'caixa' | 'lista_da_vez' | 'tasks';
  name: string;
  description: string;
  icon: React.ReactNode;
  field: 'cashback_ativo' | 'crm_ativo' | 'wishlist_ativo' | 'ponto_ativo' | 'ajustes_condicionais_ativo' | 'daily_goal_check_ativo' | 'caixa_ativo' | 'lista_da_vez_ativo' | 'tasks_ativo';
  color: string;
  hasConfig?: boolean;
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
    id: 'ajustes_condicionais',
    name: 'Ajustes & Condicionais',
    description: 'Sistema para controlar peças que estão fora da loja. Condicionais: malas com produtos que clientes recebem para experimentar. Ajustes: peças para conserto ou ajustes.',
    icon: <Scissors className="h-5 w-5" />,
    field: 'ajustes_condicionais_ativo',
    color: 'text-indigo-600 dark:text-indigo-400'
  },
  {
    id: 'erp',
    name: 'ERP',
    description: 'Integração com Tiny ERP para sincronização automática de pedidos, produtos, clientes e colaboradoras. As vendas são importadas automaticamente e convertidas em metas.',
    icon: <Package className="h-5 w-5" />,
    field: 'crm_ativo', // ERP não tem campo específico, mas vamos usar crm_ativo como placeholder
    color: 'text-green-600 dark:text-green-400'
  },
  {
    id: 'daily_goal_check',
    name: 'Check de Meta Diária',
    description: 'Gamificação que incentiva colaboradoras a conferir suas metas diariamente. Ao confirmar a visualização da meta, ganham um bônus configurável. Aumenta o engajamento e responsabilidade.',
    icon: <Target className="h-5 w-5" />,
    field: 'daily_goal_check_ativo',
    color: 'text-purple-600 dark:text-purple-400',
    hasConfig: true
  },
  {
    id: 'caixa',
    name: 'Abertura/Fechamento de Caixa',
    description: 'Sistema de controle de abertura e fechamento de caixa com envio de notificações WhatsApp. Registra dinheiro em caixa, metas diárias e resumo de vendas.',
    icon: <Banknote className="h-5 w-5" />,
    field: 'caixa_ativo',
    color: 'text-emerald-600 dark:text-emerald-400',
    hasConfig: false
  },
  {
    id: 'lista_da_vez',
    name: 'Lista da Vez',
    description: 'Sistema de fila de atendimento para o salão de vendas. Organiza vendedores por disponibilidade, gerencia atendimentos em tempo real e registra métricas de conversão.',
    icon: <Users className="h-5 w-5" />,
    field: 'lista_da_vez_ativo',
    color: 'text-cyan-600 dark:text-cyan-400',
    hasConfig: false
  },
  {
    id: 'tasks',
    name: 'Tarefas do Dia',
    description: 'Sistema de gerenciamento de tarefas diárias por turno. Permite configurar tarefas organizadas por horário/turno e acompanhar a execução pelas colaboradoras com relatórios de desempenho.',
    icon: <CheckSquare2 className="h-5 w-5" />,
    field: 'tasks_module_enabled',
    color: 'text-violet-600 dark:text-violet-400',
    hasConfig: false
  }
];

export const ModulesStoreConfig = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ storeId: string; module: string } | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configStore, setConfigStore] = useState<Store | null>(null);
  const [configForm, setConfigForm] = useState({
    valor_bonus: '',
    horario_limite: '18:00'
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      // Query defensiva: buscar colunas que podem não existir ainda
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, cashback_ativo, crm_ativo, wishlist_ativo, ponto_ativo, ajustes_condicionais_ativo, caixa_ativo, lista_da_vez_ativo, tasks_module_enabled, daily_goal_check_ativo, daily_goal_check_valor_bonus, daily_goal_check_horario_limite, whatsapp_caixa_numeros, whatsapp_caixa_usar_global, active')
        .eq('active', true)
        .order('name');
      
      // Se tasks_module_enabled não existir, adicionar como true para todas as lojas (padrão)
      if (data) {
        data.forEach(store => {
          if (!('tasks_module_enabled' in store) || store.tasks_module_enabled === null) {
            (store as any).tasks_module_enabled = true; // Default: habilitado
          }
        });
      }

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

    const newValue = !currentValue;
    console.log('[ModulesStoreConfig] Toggle módulo:', {
      storeId,
      module: module.id,
      moduleField: module.field,
      currentValue,
      newValue
    });

    try {
      setSaving({ storeId, module: module.id });
      
      const updateData: any = { [module.field]: newValue };
      console.log('[ModulesStoreConfig] Atualizando com:', updateData);
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .update(updateData)
        .eq('id', storeId)
        .select('id, name, cashback_ativo, crm_ativo, wishlist_ativo, ponto_ativo, ajustes_condicionais_ativo, caixa_ativo, lista_da_vez_ativo, daily_goal_check_ativo');

      if (error) {
        console.error('[ModulesStoreConfig] Erro na atualização:', error);
        throw error;
      }

      console.log('[ModulesStoreConfig] Atualização bem-sucedida:', data);

      setStores(prev =>
        prev.map(store => {
          const updated = store.id === storeId
            ? { ...store, [module.field]: newValue }
            : store;
          // Garantir que tasks_ativo existe mesmo se não veio do banco
          if (!('tasks_ativo' in updated)) {
            (updated as any).tasks_ativo = false;
          }
          return updated;
        })
      );

      toast.success(`${module.name} ${newValue ? 'ativado' : 'desativado'} para ${stores.find(s => s.id === storeId)?.name}`);
    } catch (error: any) {
      console.error(`[ModulesStoreConfig] Erro ao ${currentValue ? 'desativar' : 'ativar'} ${module.name}:`, error);
      toast.error(`Erro ao ${currentValue ? 'desativar' : 'ativar'} ${module.name}: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(null);
    }
  };

  const getModuleStatus = (store: Store, module: ModuleInfo): boolean => {
    if (module.id === 'erp') {
      return true;
    }
    const value = (store as any)[module.field];
    const result = Boolean(value);
    console.log('[ModulesStoreConfig] getModuleStatus:', {
      module: module.id,
      field: module.field,
      rawValue: value,
      booleanValue: result,
      storeId: store.id
    });
    return result;
  };

  const openConfigDialog = (store: Store) => {
    setConfigStore(store);
    setConfigForm({
      valor_bonus: store.daily_goal_check_valor_bonus?.toString() || '5',
      horario_limite: store.daily_goal_check_horario_limite?.substring(0, 5) || '18:00'
    });
    setConfigDialogOpen(true);
  };

  const saveConfig = async () => {
    if (!configStore) return;

    const valorBonus = parseFloat(configForm.valor_bonus.replace(',', '.'));
    if (isNaN(valorBonus) || valorBonus < 0) {
      toast.error('Valor do bônus inválido');
      return;
    }

    try {
      setSavingConfig(true);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .update({
          daily_goal_check_valor_bonus: valorBonus,
          daily_goal_check_horario_limite: configForm.horario_limite + ':00'
        })
        .eq('id', configStore.id);

      if (error) throw error;

      setStores(prev =>
        prev.map(store =>
          store.id === configStore.id
            ? {
                ...store,
                daily_goal_check_valor_bonus: valorBonus,
                daily_goal_check_horario_limite: configForm.horario_limite + ':00'
              }
            : store
        )
      );

      toast.success(`Configuração do Check de Meta atualizada para ${configStore.name}`);
      setConfigDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
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
                            <div className="flex items-center gap-2 ml-4">
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  {module.hasConfig && isActive && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openConfigDialog(store)}
                                      title="Configurar"
                                      data-testid={`button-config-${module.id}-${store.id}`}
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  )}
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
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.ajustes_condicionais_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <Scissors className="h-3.5 w-3.5" />
                        <span className="font-medium">Ajustes</span>
                        {store.ajustes_condicionais_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.caixa_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <Banknote className="h-3.5 w-3.5" />
                        <span className="font-medium">Caixa</span>
                        {store.caixa_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 text-success">
                        <Package className="h-3.5 w-3.5" />
                        <span className="font-medium">ERP</span>
                        <Check className="h-3 w-3" />
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.daily_goal_check_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <Target className="h-3.5 w-3.5" />
                        <span className="font-medium">Check Meta</span>
                        {store.daily_goal_check_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.lista_da_vez_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-medium">Lista da Vez</span>
                        {store.lista_da_vez_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${store.tasks_ativo ? 'bg-success/10 text-success' : 'text-muted-foreground'}`}>
                        <CheckSquare2 className="h-3.5 w-3.5" />
                        <span className="font-medium">Tarefas</span>
                        {store.tasks_ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

      </CardContent>

      {/* Dialog de Configuração do Check de Meta Diária */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Configurar Check de Meta Diária
            </DialogTitle>
            <DialogDescription>
              {configStore?.name} - Configure o valor do bônus e horário limite para o check diário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="valor_bonus">Valor do Bônus (R$)</Label>
              <Input
                id="valor_bonus"
                type="text"
                value={configForm.valor_bonus}
                onChange={(e) => setConfigForm({ ...configForm, valor_bonus: e.target.value })}
                placeholder="Ex: 5,00"
                data-testid="input-valor-bonus"
              />
              <p className="text-xs text-muted-foreground">
                Valor que a colaboradora ganha ao confirmar que viu a meta do dia.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="horario_limite">Horário Limite</Label>
              <Input
                id="horario_limite"
                type="time"
                value={configForm.horario_limite}
                onChange={(e) => setConfigForm({ ...configForm, horario_limite: e.target.value })}
                data-testid="input-horario-limite"
              />
              <p className="text-xs text-muted-foreground">
                Após este horário, a colaboradora não poderá mais fazer o check do dia.
              </p>
            </div>

            {configStore?.daily_goal_check_valor_bonus != null && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Configuração atual: Bônus de <span className="font-semibold">{formatBRL(configStore.daily_goal_check_valor_bonus)}</span> até às <span className="font-semibold">{configStore.daily_goal_check_horario_limite?.substring(0, 5) || '18:00'}</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)} disabled={savingConfig}>
              Cancelar
            </Button>
            <Button onClick={saveConfig} disabled={savingConfig} data-testid="button-save-config">
              {savingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

