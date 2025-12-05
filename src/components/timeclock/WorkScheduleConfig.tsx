/**
 * Componente modular para configuração de jornada de trabalho
 * Permite definir horários e dias da semana por colaboradora
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkSchedule {
  id: string;
  colaboradora_id: string;
  store_id: string;
  hora_entrada: string;
  hora_intervalo_saida: string;
  hora_intervalo_retorno: string;
  hora_saida: string;
  dias_semana: number[];
  ativo: boolean;
  data_inicio?: string | null;
  data_fim?: string | null;
}

interface Colaboradora {
  id: string;
  name: string;
}

interface WorkScheduleConfigProps {
  storeId: string;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export function WorkScheduleConfig({ storeId }: WorkScheduleConfigProps) {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [selectedColaboradora, setSelectedColaboradora] = useState<string>('');
  const [formData, setFormData] = useState({
    hora_entrada: '08:00',
    hora_intervalo_saida: '12:00',
    hora_intervalo_retorno: '13:00',
    hora_saida: '18:00',
    dias_semana: [1, 2, 3, 4, 5] as number[],
    ativo: true,
    data_inicio: '',
    data_fim: '',
  });

  useEffect(() => {
    if (storeId) {
      fetchSchedules();
      fetchColaboradoras();
    }
  }, [storeId]);

  const fetchColaboradoras = async () => {
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name')
        .eq('store_id', storeId)
        .eq('role', 'COLABORADORA')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setColaboradoras(data || []);
    } catch (err: any) {
      console.error('[WorkScheduleConfig] Erro ao buscar colaboradoras:', err);
      toast.error('Erro ao carregar colaboradoras');
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('colaboradora_work_schedules')
        .select(`
          *,
          profiles:colaboradora_id (id, name)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (err: any) {
      console.error('[WorkScheduleConfig] Erro ao buscar jornadas:', err);
      toast.error('Erro ao carregar jornadas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (schedule?: WorkSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setSelectedColaboradora(schedule.colaboradora_id);
      setFormData({
        hora_entrada: schedule.hora_entrada.substring(0, 5),
        hora_intervalo_saida: schedule.hora_intervalo_saida.substring(0, 5),
        hora_intervalo_retorno: schedule.hora_intervalo_retorno.substring(0, 5),
        hora_saida: schedule.hora_saida.substring(0, 5),
        dias_semana: schedule.dias_semana,
        ativo: schedule.ativo,
        data_inicio: schedule.data_inicio || '',
        data_fim: schedule.data_fim || '',
      });
    } else {
      setEditingSchedule(null);
      setSelectedColaboradora('');
      setFormData({
        hora_entrada: '08:00',
        hora_intervalo_saida: '12:00',
        hora_intervalo_retorno: '13:00',
        hora_saida: '18:00',
        dias_semana: [1, 2, 3, 4, 5],
        ativo: true,
        data_inicio: '',
        data_fim: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedColaboradora) {
      toast.error('Selecione uma colaboradora');
      return;
    }

    try {
      setLoading(true);
      // Converter horários para formato TIME (HH:mm:ss)
      const hora_entrada = `${formData.hora_entrada}:00`;
      const hora_intervalo_saida = `${formData.hora_intervalo_saida}:00`;
      const hora_intervalo_retorno = `${formData.hora_intervalo_retorno}:00`;
      const hora_saida = `${formData.hora_saida}:00`;

      if (editingSchedule) {
        // Atualizar jornada existente
        // Se está ativando, desativar outras jornadas ativas da mesma colaboradora
        if (formData.ativo && !editingSchedule.ativo) {
          await supabase
            .schema('sistemaretiradas')
            .from('colaboradora_work_schedules')
            .update({ ativo: false })
            .eq('colaboradora_id', selectedColaboradora)
            .eq('store_id', storeId)
            .eq('ativo', true);
        }

        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('colaboradora_work_schedules')
          .update({
            hora_entrada,
            hora_intervalo_saida,
            hora_intervalo_retorno,
            hora_saida,
            dias_semana: formData.dias_semana,
            ativo: formData.ativo,
            data_inicio: formData.data_inicio || null,
            data_fim: formData.data_fim || null,
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;
        toast.success('Jornada atualizada com sucesso');
      } else {
        // Criar nova jornada
        // Desativar outras jornadas ativas se esta estiver ativa
        if (formData.ativo) {
          await supabase
            .schema('sistemaretiradas')
            .from('colaboradora_work_schedules')
            .update({ ativo: false })
            .eq('colaboradora_id', selectedColaboradora)
            .eq('store_id', storeId)
            .eq('ativo', true);
        }

        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('colaboradora_work_schedules')
          .insert({
            colaboradora_id: selectedColaboradora,
            store_id: storeId,
            hora_entrada,
            hora_intervalo_saida,
            hora_intervalo_retorno,
            hora_saida,
            dias_semana: formData.dias_semana,
            ativo: formData.ativo,
            data_inicio: formData.data_inicio || null,
            data_fim: formData.data_fim || null,
          });

        if (error) throw error;
        toast.success('Jornada criada com sucesso');
      }

      setDialogOpen(false);
      fetchSchedules();
    } catch (err: any) {
      console.error('[WorkScheduleConfig] Erro ao salvar jornada:', err);
      toast.error('Erro ao salvar jornada: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta jornada?')) return;

    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('colaboradora_work_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Jornada excluída com sucesso');
      fetchSchedules();
    } catch (err: any) {
      console.error('[WorkScheduleConfig] Erro ao excluir jornada:', err);
      toast.error('Erro ao excluir jornada');
    }
  };

  const toggleDiaSemana = (dia: number) => {
    setFormData(prev => {
      if (prev.dias_semana.includes(dia)) {
        return { ...prev, dias_semana: prev.dias_semana.filter(d => d !== dia) };
      } else {
        return { ...prev, dias_semana: [...prev.dias_semana, dia].sort() };
      }
    });
  };

  const getColaboradoraName = (colaboradoraId: string) => {
    const colaboradora = colaboradoras.find(c => c.id === colaboradoraId);
    return colaboradora?.name || 'Desconhecida';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Configuração de Jornada
              </CardTitle>
              <CardDescription>
                Defina os horários de trabalho para cada colaboradora
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Jornada
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingSchedule ? 'Editar Jornada' : 'Nova Jornada'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Seleção de colaboradora */}
                  <div className="space-y-2">
                    <Label>Colaboradora *</Label>
                    <Select
                      value={selectedColaboradora}
                      onValueChange={setSelectedColaboradora}
                      disabled={!!editingSchedule}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma colaboradora" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradoras.map((colab) => (
                          <SelectItem key={colab.id} value={colab.id}>
                            {colab.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Horários */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Entrada *</Label>
                      <Input
                        type="time"
                        value={formData.hora_entrada}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_entrada: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Saída - Intervalo *</Label>
                      <Input
                        type="time"
                        value={formData.hora_intervalo_saida}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_intervalo_saida: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Retorno - Intervalo *</Label>
                      <Input
                        type="time"
                        value={formData.hora_intervalo_retorno}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_intervalo_retorno: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Saída *</Label>
                      <Input
                        type="time"
                        value={formData.hora_saida}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_saida: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Dias da semana */}
                  <div className="space-y-2">
                    <Label>Dias da Semana *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {DIAS_SEMANA.map((dia) => (
                        <div key={dia.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`dia-${dia.value}`}
                            checked={formData.dias_semana.includes(dia.value)}
                            onCheckedChange={() => toggleDiaSemana(dia.value)}
                          />
                          <Label htmlFor={`dia-${dia.value}`} className="cursor-pointer">
                            {dia.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Datas de validade (opcional) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Início (opcional)</Label>
                      <Input
                        type="date"
                        value={formData.data_inicio}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Fim (opcional)</Label>
                      <Input
                        type="date"
                        value={formData.data_fim}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Ativo */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ativo">Jornada Ativa</Label>
                    <Switch
                      id="ativo"
                      checked={formData.ativo}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                    />
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading && schedules.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma jornada configurada
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">
                          {getColaboradoraName(schedule.colaboradora_id)}
                        </h4>
                        <Badge variant={schedule.ativo ? 'default' : 'secondary'}>
                          {schedule.ativo ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Entrada:</span>
                          <div className="font-mono">{schedule.hora_entrada.substring(0, 5)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Saída Intervalo:</span>
                          <div className="font-mono">{schedule.hora_intervalo_saida.substring(0, 5)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Retorno Intervalo:</span>
                          <div className="font-mono">{schedule.hora_intervalo_retorno.substring(0, 5)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Saída:</span>
                          <div className="font-mono">{schedule.hora_saida.substring(0, 5)}</div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-sm text-muted-foreground">Dias: </span>
                        <div className="inline-flex gap-1 flex-wrap">
                          {schedule.dias_semana.map((dia) => (
                            <Badge key={dia} variant="outline" className="text-xs">
                              {DIAS_SEMANA.find(d => d.value === dia)?.label.substring(0, 3)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(schedule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

