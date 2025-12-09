/**
 * Componente modular para configuração de jornada de trabalho
 * Permite definir horários e dias da semana por colaboradora
 * Suporta templates globais de jornada que podem ser reutilizados
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Loader2, Clock, Plus, Edit, Trash2, Globe, UserCheck, Copy } from 'lucide-react';
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
  template_id?: string | null;
  is_custom?: boolean;
  profiles?: { id: string; name: string };
}

interface WorkScheduleTemplate {
  id: string;
  admin_id: string;
  nome: string;
  descricao?: string | null;
  carga_horaria_diaria: number;
  tempo_intervalo_minutos: number;
  is_global: boolean;
  ativo: boolean;
}

interface Colaboradora {
  id: string;
  name: string;
}

interface WorkScheduleConfigProps {
  storeId: string;
  adminId?: string;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sab' },
];

export function WorkScheduleConfig({ storeId, adminId }: WorkScheduleConfigProps) {
  const [activeTab, setActiveTab] = useState('schedules');
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [templates, setTemplates] = useState<WorkScheduleTemplate[]>([]);
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WorkScheduleTemplate | null>(null);
  const [selectedColaboradora, setSelectedColaboradora] = useState<string>('');
  const [scheduleMode, setScheduleMode] = useState<'template' | 'custom'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
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

  const [templateFormData, setTemplateFormData] = useState({
    nome: '',
    descricao: '',
    carga_horaria_diaria: 6,
    tempo_intervalo_minutos: 60,
    ativo: true,
  });

  useEffect(() => {
    if (storeId) {
      fetchSchedules();
      fetchColaboradoras();
      fetchTemplates();
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

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('work_schedule_templates')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.error('[WorkScheduleConfig] Erro ao buscar templates:', error);
      }
      setTemplates(data || []);
    } catch (err: any) {
      console.error('[WorkScheduleConfig] Erro ao buscar templates:', err);
    }
  };

  const handleOpenDialog = (schedule?: WorkSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setSelectedColaboradora(schedule.colaboradora_id);
      setScheduleMode(schedule.template_id ? 'template' : 'custom');
      setSelectedTemplateId(schedule.template_id || '');
      setFormData({
        hora_entrada: schedule.hora_entrada?.substring(0, 5) || '08:00',
        hora_intervalo_saida: schedule.hora_intervalo_saida?.substring(0, 5) || '12:00',
        hora_intervalo_retorno: schedule.hora_intervalo_retorno?.substring(0, 5) || '13:00',
        hora_saida: schedule.hora_saida?.substring(0, 5) || '18:00',
        dias_semana: schedule.dias_semana || [1, 2, 3, 4, 5],
        ativo: schedule.ativo ?? true,
        data_inicio: schedule.data_inicio || '',
        data_fim: schedule.data_fim || '',
      });
    } else {
      setEditingSchedule(null);
      setSelectedColaboradora('');
      setScheduleMode('template');
      setSelectedTemplateId('');
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

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const getSelectedTemplateInfo = () => {
    if (!selectedTemplateId) return null;
    return templates.find(t => t.id === selectedTemplateId);
  };

  const handleModeChange = (mode: 'template' | 'custom') => {
    setScheduleMode(mode);
    if (mode === 'custom') {
      setSelectedTemplateId('');
    } else if (mode === 'template' && templates.length === 0) {
      toast.error('Nenhum template disponível. Crie um template primeiro.');
      setScheduleMode('custom');
    }
  };

  const handleSave = async () => {
    if (!selectedColaboradora) {
      toast.error('Selecione uma colaboradora');
      return;
    }

    if (scheduleMode === 'template' && !selectedTemplateId) {
      toast.error('Selecione um template de jornada');
      return;
    }

    try {
      setLoading(true);
      const hora_entrada = `${formData.hora_entrada}:00`;
      const hora_intervalo_saida = `${formData.hora_intervalo_saida}:00`;
      const hora_intervalo_retorno = `${formData.hora_intervalo_retorno}:00`;
      const hora_saida = `${formData.hora_saida}:00`;

      if (editingSchedule) {
        if (formData.ativo && !editingSchedule.ativo) {
          await supabase
            .schema('sistemaretiradas')
            .from('colaboradora_work_schedules')
            .update({ ativo: false })
            .eq('colaboradora_id', selectedColaboradora)
            .eq('store_id', storeId)
            .neq('id', editingSchedule.id);
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
            template_id: scheduleMode === 'template' ? selectedTemplateId : null,
            is_custom: scheduleMode === 'custom',
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;
        toast.success('Jornada atualizada com sucesso');
      } else {
        if (formData.ativo) {
          await supabase
            .schema('sistemaretiradas')
            .from('colaboradora_work_schedules')
            .update({ ativo: false })
            .eq('colaboradora_id', selectedColaboradora)
            .eq('store_id', storeId);
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
            template_id: scheduleMode === 'template' ? selectedTemplateId : null,
            is_custom: scheduleMode === 'custom',
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

  const getTemplateName = (templateId: string | null | undefined) => {
    if (!templateId) return null;
    const template = templates.find(t => t.id === templateId);
    return template?.nome || null;
  };

  const handleOpenTemplateDialog = (template?: WorkScheduleTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateFormData({
        nome: template.nome || '',
        descricao: template.descricao || '',
        carga_horaria_diaria: template.carga_horaria_diaria || 6,
        tempo_intervalo_minutos: template.tempo_intervalo_minutos || 60,
        ativo: template.ativo ?? true,
      });
    } else {
      setEditingTemplate(null);
      setTemplateFormData({
        nome: '',
        descricao: '',
        carga_horaria_diaria: 6,
        tempo_intervalo_minutos: 60,
        ativo: true,
      });
    }
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateFormData.nome.trim()) {
      toast.error('Informe o nome do template');
      return;
    }

    if (templateFormData.carga_horaria_diaria <= 0 || templateFormData.carga_horaria_diaria > 12) {
      toast.error('Carga horária deve estar entre 1 e 12 horas');
      return;
    }

    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Usuário não autenticado');
        return;
      }

      if (editingTemplate) {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('work_schedule_templates')
          .update({
            nome: templateFormData.nome.trim(),
            descricao: templateFormData.descricao.trim() || null,
            carga_horaria_diaria: templateFormData.carga_horaria_diaria,
            tempo_intervalo_minutos: templateFormData.tempo_intervalo_minutos,
            ativo: templateFormData.ativo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template atualizado com sucesso');
      } else {
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('work_schedule_templates')
          .insert({
            admin_id: adminId || userData.user.id,
            nome: templateFormData.nome.trim(),
            descricao: templateFormData.descricao.trim() || null,
            carga_horaria_diaria: templateFormData.carga_horaria_diaria,
            tempo_intervalo_minutos: templateFormData.tempo_intervalo_minutos,
            is_global: true,
            ativo: templateFormData.ativo,
          });

        if (error) throw error;
        toast.success('Template criado com sucesso');
      }

      setTemplateDialogOpen(false);
      fetchTemplates();
    } catch (err: any) {
      console.error('[WorkScheduleConfig] Erro ao salvar template:', err);
      toast.error('Erro ao salvar template: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template? As jornadas já atribuídas não serão afetadas.')) return;

    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('work_schedule_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Template excluído com sucesso');
      fetchTemplates();
    } catch (err: any) {
      console.error('[WorkScheduleConfig] Erro ao excluir template:', err);
      toast.error('Erro ao excluir template');
    }
  };

  const calculateHours = (entrada: string, saidaInt: string, retornoInt: string, saida: string) => {
    try {
      const [h1, m1] = entrada.split(':').map(Number);
      const [h2, m2] = saidaInt.split(':').map(Number);
      const [h3, m3] = retornoInt.split(':').map(Number);
      const [h4, m4] = saida.split(':').map(Number);
      
      const morning = (h2 * 60 + m2) - (h1 * 60 + m1);
      const afternoon = (h4 * 60 + m4) - (h3 * 60 + m3);
      const total = (morning + afternoon) / 60;
      
      return total.toFixed(1);
    } catch {
      return '0';
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="schedules" className="flex items-center gap-2" data-testid="tab-schedules">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Jornadas</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Templates Globais</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    <Button onClick={() => handleOpenDialog()} data-testid="button-nova-jornada">
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
                      <div className="space-y-2">
                        <Label>Colaboradora *</Label>
                        <Select
                          value={selectedColaboradora}
                          onValueChange={setSelectedColaboradora}
                          disabled={!!editingSchedule}
                        >
                          <SelectTrigger data-testid="select-colaboradora">
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

                      <Separator />

                      <div className="space-y-2">
                        <Label>Tipo de Jornada</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={scheduleMode === 'template' ? 'default' : 'outline'}
                            onClick={() => handleModeChange('template')}
                            className="justify-start"
                            data-testid="button-mode-template"
                          >
                            <Globe className="mr-2 h-4 w-4" />
                            Template Global
                          </Button>
                          <Button
                            type="button"
                            variant={scheduleMode === 'custom' ? 'default' : 'outline'}
                            onClick={() => handleModeChange('custom')}
                            className="justify-start"
                            data-testid="button-mode-custom"
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Jornada Específica
                          </Button>
                        </div>
                      </div>

                      {scheduleMode === 'template' && (
                        <div className="space-y-2">
                          <Label>Selecionar Template *</Label>
                          {templates.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                              Nenhum template disponível. Crie um template na aba "Templates Globais".
                            </div>
                          ) : (
                            <Select
                              value={selectedTemplateId}
                              onValueChange={handleTemplateSelect}
                            >
                              <SelectTrigger data-testid="select-template">
                                <SelectValue placeholder="Selecione um template" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    <div className="flex items-center gap-2">
                                      <span>{template.nome}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ({template.carga_horaria_diaria || 6}h/dia, {template.tempo_intervalo_minutos || 60}min intervalo)
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {(scheduleMode === 'custom' || selectedTemplateId) && (
                        <>
                          {scheduleMode === 'template' && getSelectedTemplateInfo() && (
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                              <div className="text-sm font-medium mb-1">Template selecionado: {getSelectedTemplateInfo()?.nome}</div>
                              <div className="text-sm text-muted-foreground">
                                Carga esperada: <strong>{getSelectedTemplateInfo()?.carga_horaria_diaria || 6}h/dia</strong> | 
                                Intervalo: <strong>{getSelectedTemplateInfo()?.tempo_intervalo_minutos || 60} minutos</strong>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Defina os horários específicos abaixo. Você pode rotacionar os horários desde que a carga horária seja respeitada.
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Entrada *</Label>
                              <Input
                                type="time"
                                value={formData.hora_entrada}
                                onChange={(e) => setFormData(prev => ({ ...prev, hora_entrada: e.target.value }))}
                                data-testid="input-hora-entrada"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Saída - Intervalo *</Label>
                              <Input
                                type="time"
                                value={formData.hora_intervalo_saida}
                                onChange={(e) => setFormData(prev => ({ ...prev, hora_intervalo_saida: e.target.value }))}
                                data-testid="input-hora-intervalo-saida"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Retorno - Intervalo *</Label>
                              <Input
                                type="time"
                                value={formData.hora_intervalo_retorno}
                                onChange={(e) => setFormData(prev => ({ ...prev, hora_intervalo_retorno: e.target.value }))}
                                data-testid="input-hora-intervalo-retorno"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Saída *</Label>
                              <Input
                                type="time"
                                value={formData.hora_saida}
                                onChange={(e) => setFormData(prev => ({ ...prev, hora_saida: e.target.value }))}
                                data-testid="input-hora-saida"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Dias da Semana *</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {DIAS_SEMANA.map((dia) => (
                                <div key={dia.value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`dia-${dia.value}`}
                                    checked={formData.dias_semana.includes(dia.value)}
                                    onCheckedChange={() => toggleDiaSemana(dia.value)}
                                  />
                                  <Label htmlFor={`dia-${dia.value}`} className="cursor-pointer text-sm">
                                    {dia.short}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm text-muted-foreground">Carga horária configurada</div>
                            <div className="text-lg font-semibold">
                              {calculateHours(
                                formData.hora_entrada,
                                formData.hora_intervalo_saida,
                                formData.hora_intervalo_retorno,
                                formData.hora_saida
                              )}h
                            </div>
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Data Início (opcional)</Label>
                          <Input
                            type="date"
                            value={formData.data_inicio}
                            onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))}
                            data-testid="input-data-inicio"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Data Fim (opcional)</Label>
                          <Input
                            type="date"
                            value={formData.data_fim}
                            onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value }))}
                            data-testid="input-data-fim"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="ativo">Jornada Ativa</Label>
                        <Switch
                          id="ativo"
                          checked={formData.ativo}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                          data-testid="switch-ativo"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={loading} data-testid="button-salvar-jornada">
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
                    <div key={schedule.id} className="border rounded-lg p-4" data-testid={`card-jornada-${schedule.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold">
                              {schedule.profiles?.name || getColaboradoraName(schedule.colaboradora_id)}
                            </h4>
                            <Badge variant={schedule.ativo ? 'default' : 'secondary'}>
                              {schedule.ativo ? 'Ativa' : 'Inativa'}
                            </Badge>
                            {schedule.template_id ? (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {getTemplateName(schedule.template_id) || 'Template'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                Específica
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Entrada:</span>
                              <div className="font-mono">{schedule.hora_entrada.substring(0, 5)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Saída Int.:</span>
                              <div className="font-mono">{schedule.hora_intervalo_saida.substring(0, 5)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Retorno Int.:</span>
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
                                  {DIAS_SEMANA.find(d => d.value === dia)?.short}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenDialog(schedule)}
                            data-testid={`button-editar-jornada-${schedule.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(schedule.id)}
                            data-testid={`button-excluir-jornada-${schedule.id}`}
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
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Templates de Jornada Global
                  </CardTitle>
                  <CardDescription>
                    Crie templates reutilizáveis para atribuir a múltiplas colaboradoras
                  </CardDescription>
                </div>
                <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenTemplateDialog()} data-testid="button-novo-template">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTemplate ? 'Editar Template' : 'Novo Template de Jornada'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome do Template *</Label>
                          <Input
                            placeholder="Ex: 6x1 - 6 horas"
                            value={templateFormData.nome}
                            onChange={(e) => setTemplateFormData(prev => ({ ...prev, nome: e.target.value }))}
                            data-testid="input-template-nome"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição (opcional)</Label>
                          <Input
                            placeholder="Ex: Jornada padrão de 6 horas"
                            value={templateFormData.descricao}
                            onChange={(e) => setTemplateFormData(prev => ({ ...prev, descricao: e.target.value }))}
                            data-testid="input-template-descricao"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Carga Horária Diária (horas) *</Label>
                          <Input
                            type="number"
                            min="1"
                            max="12"
                            step="0.5"
                            value={templateFormData.carga_horaria_diaria}
                            onChange={(e) => setTemplateFormData(prev => ({ ...prev, carga_horaria_diaria: parseFloat(e.target.value) || 6 }))}
                            data-testid="input-template-carga-horaria"
                          />
                          <p className="text-xs text-muted-foreground">
                            Quantidade de horas de trabalho efetivo por dia (sem contar intervalo)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Tempo de Intervalo (minutos) *</Label>
                          <Select
                            value={String(templateFormData.tempo_intervalo_minutos)}
                            onValueChange={(v) => setTemplateFormData(prev => ({ ...prev, tempo_intervalo_minutos: parseInt(v) }))}
                          >
                            <SelectTrigger data-testid="select-template-intervalo">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 minutos</SelectItem>
                              <SelectItem value="30">30 minutos</SelectItem>
                              <SelectItem value="45">45 minutos</SelectItem>
                              <SelectItem value="60">1 hora</SelectItem>
                              <SelectItem value="90">1h30min</SelectItem>
                              <SelectItem value="120">2 horas</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Conforme CLT: 15min (4-6h), 1h+ (6h+)
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground">Carga horária diária</div>
                            <div className="text-lg font-semibold">{templateFormData.carga_horaria_diaria}h</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Tempo total na empresa</div>
                            <div className="text-lg font-semibold">
                              {(templateFormData.carga_horaria_diaria + templateFormData.tempo_intervalo_minutos / 60).toFixed(1)}h
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="template-ativo">Template Ativo</Label>
                        <Switch
                          id="template-ativo"
                          checked={templateFormData.ativo}
                          onCheckedChange={(checked) => setTemplateFormData(prev => ({ ...prev, ativo: checked }))}
                          data-testid="switch-template-ativo"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveTemplate} disabled={loading} data-testid="button-salvar-template">
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            'Salvar Template'
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum template de jornada global cadastrado</p>
                  <p className="text-sm mt-1">Crie templates para facilitar a atribuição de jornadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4" data-testid={`card-template-${template.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold">{template.nome}</h4>
                            <Badge variant={template.ativo ? 'default' : 'secondary'}>
                              {template.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                            <Badge variant="outline">
                              {template.carga_horaria_diaria || 6}h/dia
                            </Badge>
                            <Badge variant="outline">
                              {template.tempo_intervalo_minutos || 60}min intervalo
                            </Badge>
                          </div>
                          {template.descricao && (
                            <p className="text-sm text-muted-foreground mb-2">{template.descricao}</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Carga horária:</span>
                              <div className="font-semibold">{template.carga_horaria_diaria || 6} horas/dia</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tempo de intervalo:</span>
                              <div className="font-semibold">{template.tempo_intervalo_minutos || 60} minutos</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenTemplateDialog(template)}
                            data-testid={`button-editar-template-${template.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteTemplate(template.id)}
                            data-testid={`button-excluir-template-${template.id}`}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
