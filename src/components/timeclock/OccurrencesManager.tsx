import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, Check, X, Clock, AlertCircle, Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Occurrence {
  id: string;
  colaboradora_id: string;
  data: string;
  tipo: string;
  motivo: string | null;
  observacao: string | null;
  status: string;
  solicitado_por: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  desconta_banco_horas: boolean;
  minutos_abonados: number;
  profiles?: { name: string };
}

interface OccurrencesManagerProps {
  storeId: string;
  adminId?: string;
}

const TIPOS_OCORRENCIA = [
  { value: 'FOLGA', label: 'Folga', color: 'bg-blue-500' },
  { value: 'FALTA', label: 'Falta', color: 'bg-rose-500' },
  { value: 'ABONO', label: 'Abono', color: 'bg-emerald-500' },
  { value: 'ATESTADO', label: 'Atestado Médico', color: 'bg-amber-500' },
  { value: 'FERIAS', label: 'Férias', color: 'bg-purple-500' },
  { value: 'FERIADO', label: 'Feriado', color: 'bg-indigo-500' },
];

export function OccurrencesManager({ storeId, adminId }: OccurrencesManagerProps) {
  const [loading, setLoading] = useState(true);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [pendingOccurrences, setPendingOccurrences] = useState<Occurrence[]>([]);
  const [colaboradoras, setColaboradoras] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('lancamentos');

  const [formData, setFormData] = useState({
    colaboradora_id: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    tipo: 'FOLGA',
    motivo: '',
    observacao: '',
    desconta_banco_horas: false,
  });

  useEffect(() => {
    fetchColaboradoras();
    fetchOccurrences();
    fetchPendingOccurrences();
  }, [storeId]);

  const fetchColaboradoras = async () => {
    const { data, error } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, name')
      .eq('store_id', storeId)
      .eq('role', 'COLABORADORA')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setColaboradoras(data);
    } else {
      console.error('[OccurrencesManager] Erro ao buscar colaboradoras:', error);
    }
  };

  const fetchOccurrences = async () => {
    setLoading(true);
    const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
    const endOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .schema('sistemaretiradas')
      .from('timeclock_occurrences')
      .select('*, profiles:colaboradora_id(name)')
      .eq('store_id', storeId)
      .gte('data', startOfMonth)
      .lte('data', endOfMonth)
      .neq('status', 'pendente')
      .order('data', { ascending: false });

    if (!error && data) {
      setOccurrences(data as Occurrence[]);
    }
    setLoading(false);
  };

  const fetchPendingOccurrences = async () => {
    const { data, error } = await supabase
      .schema('sistemaretiradas')
      .from('timeclock_occurrences')
      .select('*, profiles:colaboradora_id(name)')
      .eq('store_id', storeId)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPendingOccurrences(data as Occurrence[]);
    }
  };

  const handleSave = async () => {
    if (!formData.colaboradora_id) {
      toast.error('Selecione uma colaboradora');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('timeclock_occurrences')
        .insert({
          colaboradora_id: formData.colaboradora_id,
          store_id: storeId,
          data: formData.data,
          tipo: formData.tipo,
          motivo: formData.motivo || null,
          observacao: formData.observacao || null,
          desconta_banco_horas: formData.desconta_banco_horas,
          status: 'aprovado',
          created_by: adminId,
        });

      if (error) throw error;

      toast.success('Ocorrência lançada com sucesso');
      setDialogOpen(false);
      setFormData({
        colaboradora_id: '',
        data: format(new Date(), 'yyyy-MM-dd'),
        tipo: 'FOLGA',
        motivo: '',
        observacao: '',
        desconta_banco_horas: false,
      });
      fetchOccurrences();
    } catch (err: any) {
      console.error('[OccurrencesManager] Erro:', err);
      toast.error('Erro ao lançar ocorrência: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('timeclock_occurrences')
        .update({
          status: 'aprovado',
          aprovado_por: adminId,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Solicitação aprovada');
      fetchPendingOccurrences();
      fetchOccurrences();
    } catch (err: any) {
      toast.error('Erro ao aprovar: ' + err.message);
    }
  };

  const handleReject = async (id: string, motivo: string) => {
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('timeclock_occurrences')
        .update({
          status: 'rejeitado',
          aprovado_por: adminId,
          aprovado_em: new Date().toISOString(),
          motivo_rejeicao: motivo || 'Solicitação rejeitada pelo administrador',
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Solicitação rejeitada');
      fetchPendingOccurrences();
      fetchOccurrences();
    } catch (err: any) {
      toast.error('Erro ao rejeitar: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ocorrência?')) return;

    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('timeclock_occurrences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Ocorrência excluída');
      fetchOccurrences();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const getTipoConfig = (tipo: string) => {
    return TIPOS_OCORRENCIA.find(t => t.value === tipo) || { label: tipo, color: 'bg-gray-500' };
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="lancamentos" className="flex items-center gap-2" data-testid="tab-lancamentos">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Lançamentos</span>
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="flex items-center gap-2" data-testid="tab-solicitacoes">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Solicitações</span>
            {pendingOccurrences.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingOccurrences.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Ocorrências do Mês
                  </CardTitle>
                  <CardDescription>
                    Lance faltas, abonos, folgas e outras ocorrências
                  </CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-nova-ocorrencia">
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Ocorrência
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Lançar Ocorrência</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Colaboradora *</Label>
                        <Select
                          value={formData.colaboradora_id}
                          onValueChange={(v) => setFormData(prev => ({ ...prev, colaboradora_id: v }))}
                        >
                          <SelectTrigger data-testid="select-colaboradora-ocorrencia">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {colaboradoras.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Data *</Label>
                          <Input
                            type="date"
                            value={formData.data}
                            onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                            data-testid="input-data-ocorrencia"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo *</Label>
                          <Select
                            value={formData.tipo}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}
                          >
                            <SelectTrigger data-testid="select-tipo-ocorrencia">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPOS_OCORRENCIA.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Motivo</Label>
                        <Input
                          value={formData.motivo}
                          onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                          placeholder="Motivo da ocorrência..."
                          data-testid="input-motivo-ocorrencia"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Observação</Label>
                        <Textarea
                          value={formData.observacao}
                          onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                          placeholder="Observações adicionais..."
                          data-testid="input-observacao-ocorrencia"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                        <div>
                          <Label>Desconta do Banco de Horas?</Label>
                          <p className="text-xs text-muted-foreground">Se ativo, desconta as horas do banco</p>
                        </div>
                        <Switch
                          checked={formData.desconta_banco_horas}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, desconta_banco_horas: v }))}
                          data-testid="switch-desconta-banco"
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSave} disabled={loading} data-testid="button-salvar-ocorrencia">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : occurrences.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma ocorrência lançada neste mês
                </div>
              ) : (
                <div className="space-y-2">
                  {occurrences.map((occ) => {
                    const tipoConfig = getTipoConfig(occ.tipo);
                    return (
                      <div
                        key={occ.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        data-testid={`row-ocorrencia-${occ.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={tipoConfig.color}>{tipoConfig.label}</Badge>
                          <div>
                            <div className="font-medium text-sm">{occ.profiles?.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(occ.data + 'T12:00:00'), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {occ.motivo && (
                            <span className="text-xs text-muted-foreground max-w-[150px] truncate">
                              {occ.motivo}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(occ.id)}
                            data-testid={`button-excluir-ocorrencia-${occ.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Solicitações Pendentes
              </CardTitle>
              <CardDescription>
                Aprove ou rejeite solicitações de folga das colaboradoras
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOccurrences.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação pendente
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOccurrences.map((occ) => {
                    const tipoConfig = getTipoConfig(occ.tipo);
                    return (
                      <div
                        key={occ.id}
                        className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                        data-testid={`row-solicitacao-${occ.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={tipoConfig.color}>{tipoConfig.label}</Badge>
                              <Badge variant="outline">Pendente</Badge>
                            </div>
                            <div className="font-medium">{occ.profiles?.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(occ.data + 'T12:00:00'), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                            </div>
                            {occ.motivo && (
                              <p className="text-sm mt-2">{occ.motivo}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                const motivo = prompt('Motivo da rejeição:');
                                if (motivo !== null) handleReject(occ.id, motivo);
                              }}
                              data-testid={`button-rejeitar-${occ.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(occ.id)}
                              data-testid={`button-aprovar-${occ.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
