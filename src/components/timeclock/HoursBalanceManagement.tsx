/**
 * Componente modular para gestão de banco de horas
 * Permite visualizar saldo e fazer ajustes manuais (créditos/débitos)
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface HoursBalance {
  id: string;
  colaboradora_id: string;
  store_id: string;
  saldo_minutos: number;
  ultimo_calculo_em?: string | null;
}

interface HoursAdjustment {
  id: string;
  colaboradora_id: string;
  store_id: string;
  tipo: 'CREDITO' | 'DEBITO';
  minutos: number;
  motivo: string;
  autorizado_por: string;
  data_ajuste: string;
  created_at: string;
  profiles?: { name: string };
}

interface Colaboradora {
  id: string;
  name: string;
}

interface HoursBalanceManagementProps {
  storeId: string;
}

export function HoursBalanceManagement({ storeId }: HoursBalanceManagementProps) {
  const { profile } = useAuth();
  const [balances, setBalances] = useState<(HoursBalance & { profiles?: { name: string } })[]>([]);
  const [adjustments, setAdjustments] = useState<HoursAdjustment[]>([]);
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quitarDialogOpen, setQuitarDialogOpen] = useState(false);
  const [selectedColaboradora, setSelectedColaboradora] = useState<string>('');
  const [selectedBalance, setSelectedBalance] = useState<number>(0);
  const [quitarFormData, setQuitarFormData] = useState({
    tipo: 'INTEGRAL' as 'INTEGRAL' | 'PARCIAL',
    horas: '',
    minutos: '',
    motivo: '',
  });

  const [formData, setFormData] = useState({
    tipo: 'CREDITO' as 'CREDITO' | 'DEBITO',
    horas: '',
    minutos: '',
    motivo: '',
    data_ajuste: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (storeId) {
      fetchBalances();
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
      console.error('[HoursBalanceManagement] Erro ao buscar colaboradoras:', err);
      toast.error('Erro ao carregar colaboradoras');
    }
  };

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_hours_balance')
        .select(`
          *,
          profiles:colaboradora_id (id, name)
        `)
        .eq('store_id', storeId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setBalances(data || []);
    } catch (err: any) {
      console.error('[HoursBalanceManagement] Erro ao buscar saldos:', err);
      toast.error('Erro ao carregar saldos');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdjustments = async (colaboradoraId: string) => {
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_hours_adjustments')
        .select(`
          *,
          profiles:autorizado_por (name)
        `)
        .eq('store_id', storeId)
        .eq('colaboradora_id', colaboradoraId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAdjustments(data || []);
    } catch (err: any) {
      console.error('[HoursBalanceManagement] Erro ao buscar ajustes:', err);
      toast.error('Erro ao carregar ajustes');
    }
  };

  const handleOpenDialog = (colaboradoraId?: string) => {
    if (colaboradoraId) {
      setSelectedColaboradora(colaboradoraId);
      fetchAdjustments(colaboradoraId);
    } else {
      setSelectedColaboradora('');
      setAdjustments([]);
    }
    setFormData({
      tipo: 'CREDITO',
      horas: '',
      minutos: '',
      motivo: '',
      data_ajuste: format(new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const handleQuitarSaldo = (colaboradoraId: string, saldoAtual: number) => {
    setSelectedColaboradora(colaboradoraId);
    setSelectedBalance(saldoAtual);
    setQuitarFormData({
      tipo: 'INTEGRAL',
      horas: '',
      minutos: '',
      motivo: '',
    });
    setQuitarDialogOpen(true);
  };

  const handleSaveQuitacao = async () => {
    if (!selectedColaboradora) {
      toast.error('Colaboradora não selecionada');
      return;
    }

    if (!profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      setLoading(true);

      let minutosQuitar = 0;

      if (quitarFormData.tipo === 'INTEGRAL') {
        minutosQuitar = selectedBalance;
      } else {
        const horas = parseInt(quitarFormData.horas) || 0;
        const minutos = parseInt(quitarFormData.minutos) || 0;
        minutosQuitar = (horas * 60) + minutos;

        if (minutosQuitar <= 0) {
          toast.error('O valor deve ser maior que zero');
          return;
        }

        if (minutosQuitar > selectedBalance) {
          toast.error('O valor a quitar não pode ser maior que o saldo atual');
          return;
        }
      }

      if (!quitarFormData.motivo.trim()) {
        toast.error('Informe o motivo da quitação');
        return;
      }

      const { error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_hours_adjustments')
        .insert({
          colaboradora_id: selectedColaboradora,
          store_id: storeId,
          tipo: 'DEBITO',
          minutos: minutosQuitar,
          motivo: `Quitação ${quitarFormData.tipo === 'INTEGRAL' ? 'integral' : 'parcial'}: ${quitarFormData.motivo.trim()}`,
          autorizado_por: profile.id,
          data_ajuste: format(new Date(), 'yyyy-MM-dd'),
        });

      if (insertError) throw insertError;

      const balance = balances.find(b => b.colaboradora_id === selectedColaboradora);
      const novoSaldo = (balance?.saldo_minutos || 0) - minutosQuitar;

      if (balance) {
        const { error: updateError } = await supabase
          .schema('sistemaretiradas')
          .from('time_clock_hours_balance')
          .update({ saldo_minutos: novoSaldo })
          .eq('id', balance.id);

        if (updateError) throw updateError;
      }

      toast.success(`Quitação ${quitarFormData.tipo === 'INTEGRAL' ? 'integral' : 'parcial'} realizada com sucesso`);
      setQuitarDialogOpen(false);
      fetchBalances();
      if (selectedColaboradora) {
        fetchAdjustments(selectedColaboradora);
      }
    } catch (err: any) {
      console.error('[HoursBalanceManagement] Erro ao quitar saldo:', err);
      toast.error('Erro ao quitar saldo: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!selectedColaboradora) {
      toast.error('Selecione uma colaboradora');
      return;
    }

    if (!formData.horas && !formData.minutos) {
      toast.error('Informe horas ou minutos');
      return;
    }

    if (!formData.motivo.trim()) {
      toast.error('Informe o motivo do ajuste');
      return;
    }

    if (!profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      setLoading(true);

      const horas = parseInt(formData.horas) || 0;
      const minutos = parseInt(formData.minutos) || 0;
      const totalMinutos = (horas * 60) + minutos;

      if (totalMinutos <= 0) {
        toast.error('O valor deve ser maior que zero');
        return;
      }

      const { error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_hours_adjustments')
        .insert({
          colaboradora_id: selectedColaboradora,
          store_id: storeId,
          tipo: formData.tipo,
          minutos: totalMinutos,
          motivo: formData.motivo.trim(),
          autorizado_por: profile.id,
          data_ajuste: formData.data_ajuste,
        });

      if (insertError) throw insertError;

      const balance = balances.find(b => b.colaboradora_id === selectedColaboradora);
      const saldoAtual = balance?.saldo_minutos || 0;
      const novoSaldo = formData.tipo === 'CREDITO'
        ? saldoAtual + totalMinutos
        : saldoAtual - totalMinutos;

      if (balance) {
        const { error: updateError } = await supabase
          .schema('sistemaretiradas')
          .from('time_clock_hours_balance')
          .update({ saldo_minutos: novoSaldo })
          .eq('id', balance.id);

        if (updateError) throw updateError;
      } else {
        const { error: createError } = await supabase
          .schema('sistemaretiradas')
          .from('time_clock_hours_balance')
          .insert({
            colaboradora_id: selectedColaboradora,
            store_id: storeId,
            saldo_minutos: novoSaldo,
          });

        if (createError) throw createError;
      }

      toast.success(`Ajuste de ${formData.tipo === 'CREDITO' ? 'crédito' : 'débito'} realizado com sucesso`);
      setDialogOpen(false);
      fetchBalances();
      if (selectedColaboradora) {
        fetchAdjustments(selectedColaboradora);
      }
    } catch (err: any) {
      console.error('[HoursBalanceManagement] Erro ao salvar ajuste:', err);
      toast.error('Erro ao salvar ajuste: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const formatHoursBalance = (minutos: number) => {
    const horas = Math.floor(Math.abs(minutos) / 60);
    const mins = Math.abs(minutos) % 60;
    const sinal = minutos >= 0 ? '+' : '-';
    return `${sinal}${horas}h ${mins}min`;
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
                Banco de Horas
              </CardTitle>
              <CardDescription>
                Visualize e gerencie o saldo de horas de cada colaboradora
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Ajuste
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Novo Ajuste de Banco de Horas</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Colaboradora *</Label>
                    <Select
                      value={selectedColaboradora}
                      onValueChange={(value) => {
                        setSelectedColaboradora(value);
                        fetchAdjustments(value);
                      }}
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

                  <div className="space-y-2">
                    <Label>Tipo de Ajuste *</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value: 'CREDITO' | 'DEBITO') => setFormData(prev => ({ ...prev, tipo: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CREDITO">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-success" />
                            Crédito (Adicionar horas)
                          </div>
                        </SelectItem>
                        <SelectItem value="DEBITO">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-destructive" />
                            Débito (Descontar horas)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Horas</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.horas}
                        onChange={(e) => setFormData(prev => ({ ...prev, horas: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Minutos</Label>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={formData.minutos}
                        onChange={(e) => setFormData(prev => ({ ...prev, minutos: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Data do Ajuste *</Label>
                    <Input
                      type="date"
                      value={formData.data_ajuste}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_ajuste: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Motivo *</Label>
                    <Textarea
                      value={formData.motivo}
                      onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                      placeholder="Ex: Compensação de horas extras trabalhadas..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveAdjustment} disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Ajuste'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading && balances.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : balances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum saldo encontrado
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map((balance) => (
                <div key={balance.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">
                          {balance.profiles?.name || getColaboradoraName(balance.colaboradora_id)}
                        </h4>
                        <Badge variant={balance.saldo_minutos >= 0 ? 'default' : 'destructive'}>
                          {formatHoursBalance(balance.saldo_minutos)}
                        </Badge>
                      </div>
                      {balance.ultimo_calculo_em && (
                        <div className="text-sm text-muted-foreground">
                          Último cálculo: {format(new Date(balance.ultimo_calculo_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(balance.colaboradora_id)}
                      >
                        Ver Ajustes
                      </Button>
                      {balance.saldo_minutos > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleQuitarSaldo(balance.colaboradora_id, balance.saldo_minutos)}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedColaboradora && adjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Histórico de Ajustes - {getColaboradoraName(selectedColaboradora)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Autorizado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell>
                        {format(new Date(adjustment.data_ajuste), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={adjustment.tipo === 'CREDITO' ? 'default' : 'destructive'}>
                          {adjustment.tipo === 'CREDITO' ? 'Crédito' : 'Débito'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatHoursBalance(adjustment.minutos)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {adjustment.motivo}
                      </TableCell>
                      <TableCell>
                        {adjustment.profiles?.name || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={quitarDialogOpen} onOpenChange={setQuitarDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Quitar Banco de Horas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Saldo Atual:</div>
              <div className="text-2xl font-bold">
                {formatHoursBalance(selectedBalance)}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Quitação *</Label>
              <Select
                value={quitarFormData.tipo}
                onValueChange={(value: 'INTEGRAL' | 'PARCIAL') => setQuitarFormData(prev => ({ ...prev, tipo: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTEGRAL">Quitação Integral (todo o saldo)</SelectItem>
                  <SelectItem value="PARCIAL">Quitação Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {quitarFormData.tipo === 'PARCIAL' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horas</Label>
                  <Input
                    type="number"
                    min="0"
                    value={quitarFormData.horas}
                    onChange={(e) => setQuitarFormData(prev => ({ ...prev, horas: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minutos</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={quitarFormData.minutos}
                    onChange={(e) => setQuitarFormData(prev => ({ ...prev, minutos: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo da Quitação *</Label>
              <Textarea
                value={quitarFormData.motivo}
                onChange={(e) => setQuitarFormData(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Ex: Pagamento de horas extras, compensação de folgas..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setQuitarDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveQuitacao} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Confirmar Quitação
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

