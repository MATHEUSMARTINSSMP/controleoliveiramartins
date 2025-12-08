/**
 * Componente modular para gestao de banco de horas
 * Visual aprimorado com cards modernos, progress bars e quitacao parcial/total
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Clock, Plus, TrendingUp, TrendingDown, DollarSign, User, History, CheckCircle, AlertCircle, Wallet } from 'lucide-react';
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedColaboradora, setSelectedColaboradora] = useState<string>('');
  const [selectedColaboradoraName, setSelectedColaboradoraName] = useState<string>('');
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
    }
  };

  const handleOpenAdjustDialog = (colaboradoraId?: string) => {
    if (colaboradoraId) {
      setSelectedColaboradora(colaboradoraId);
    } else {
      setSelectedColaboradora('');
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

  const handleOpenHistory = (colaboradoraId: string, name: string) => {
    setSelectedColaboradora(colaboradoraId);
    setSelectedColaboradoraName(name);
    fetchAdjustments(colaboradoraId);
    setHistoryDialogOpen(true);
  };

  const handleQuitarSaldo = (colaboradoraId: string, saldoAtual: number, name: string) => {
    setSelectedColaboradora(colaboradoraId);
    setSelectedColaboradoraName(name);
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
    if (!selectedColaboradora || !profile) {
      toast.error('Dados incompletos');
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
          toast.error('O valor a quitar nao pode ser maior que o saldo atual');
          return;
        }
      }

      if (!quitarFormData.motivo.trim()) {
        toast.error('Informe o motivo da quitacao');
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
          motivo: `Quitacao ${quitarFormData.tipo === 'INTEGRAL' ? 'integral' : 'parcial'}: ${quitarFormData.motivo.trim()}`,
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

      toast.success(`Quitacao ${quitarFormData.tipo === 'INTEGRAL' ? 'integral' : 'parcial'} realizada`);
      setQuitarDialogOpen(false);
      fetchBalances();
    } catch (err: any) {
      console.error('[HoursBalanceManagement] Erro ao quitar:', err);
      toast.error('Erro ao processar quitacao');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!selectedColaboradora || !profile) {
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
        await supabase
          .schema('sistemaretiradas')
          .from('time_clock_hours_balance')
          .update({ saldo_minutos: novoSaldo })
          .eq('id', balance.id);
      } else {
        await supabase
          .schema('sistemaretiradas')
          .from('time_clock_hours_balance')
          .insert({
            colaboradora_id: selectedColaboradora,
            store_id: storeId,
            saldo_minutos: novoSaldo,
          });
      }

      toast.success(`Ajuste de ${formData.tipo === 'CREDITO' ? 'credito' : 'debito'} realizado`);
      setDialogOpen(false);
      fetchBalances();
    } catch (err: any) {
      console.error('[HoursBalanceManagement] Erro ao salvar ajuste:', err);
      toast.error('Erro ao salvar ajuste');
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

  const totalSaldoPositivo = balances.filter(b => b.saldo_minutos > 0).reduce((acc, b) => acc + b.saldo_minutos, 0);
  const totalSaldoNegativo = balances.filter(b => b.saldo_minutos < 0).reduce((acc, b) => acc + Math.abs(b.saldo_minutos), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credito Total</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatHoursBalance(totalSaldoPositivo)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <TrendingDown className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Debito Total</p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                  -{formatHoursBalance(totalSaldoNegativo).replace('+', '')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Colaboradoras</p>
                <p className="text-lg font-bold">{balances.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Banco de Horas
              </CardTitle>
              <CardDescription>
                Saldo de horas por colaboradora
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenAdjustDialog()} data-testid="button-novo-ajuste">
              <Plus className="mr-2 h-4 w-4" />
              Novo Ajuste
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && balances.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : balances.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhum saldo registrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map((balance) => {
                const name = balance.profiles?.name || getColaboradoraName(balance.colaboradora_id);
                const isPositive = balance.saldo_minutos >= 0;
                const maxHours = 40 * 60;
                const progressValue = Math.min(Math.abs(balance.saldo_minutos) / maxHours * 100, 100);
                
                return (
                  <div key={balance.id} className="border rounded-lg p-4 hover-elevate transition-all">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-semibold">{name}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant={isPositive ? 'default' : 'destructive'} className="font-mono">
                              {formatHoursBalance(balance.saldo_minutos)}
                            </Badge>
                            {balance.saldo_minutos === 0 && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Zerado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenHistory(balance.colaboradora_id, name)}
                          data-testid={`button-historico-${balance.colaboradora_id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAdjustDialog(balance.colaboradora_id)}
                          data-testid={`button-ajustar-${balance.colaboradora_id}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajustar
                        </Button>
                        {balance.saldo_minutos > 0 && (
                          <Button
                            size="sm"
                            onClick={() => handleQuitarSaldo(balance.colaboradora_id, balance.saldo_minutos, name)}
                            data-testid={`button-quitar-${balance.colaboradora_id}`}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Quitar
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Progress 
                        value={progressValue} 
                        className={`h-2 ${isPositive ? '[&>div]:bg-emerald-500' : '[&>div]:bg-rose-500'}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0h</span>
                        <span>40h</span>
                      </div>
                    </div>
                    
                    {balance.ultimo_calculo_em && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Atualizado em {format(new Date(balance.ultimo_calculo_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Ajuste de Banco de Horas
            </DialogTitle>
            <DialogDescription>
              Adicione credito ou debito ao banco de horas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Colaboradora *</Label>
              <Select
                value={selectedColaboradora}
                onValueChange={setSelectedColaboradora}
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

            <div className="space-y-2">
              <Label>Tipo de Ajuste *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: 'CREDITO' | 'DEBITO') => setFormData(prev => ({ ...prev, tipo: value }))}
              >
                <SelectTrigger data-testid="select-tipo-ajuste">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDITO">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Credito (Adicionar horas)
                    </div>
                  </SelectItem>
                  <SelectItem value="DEBITO">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-rose-500" />
                      Debito (Descontar horas)
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
                  data-testid="input-horas"
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
                  data-testid="input-minutos"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data do Ajuste *</Label>
              <Input
                type="date"
                value={formData.data_ajuste}
                onChange={(e) => setFormData(prev => ({ ...prev, data_ajuste: e.target.value }))}
                data-testid="input-data-ajuste"
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea
                value={formData.motivo}
                onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Ex: Compensacao de horas extras trabalhadas..."
                rows={3}
                data-testid="input-motivo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAdjustment} disabled={loading} data-testid="button-salvar-ajuste">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Ajuste'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historico de Ajustes - {selectedColaboradoraName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {adjustments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum ajuste encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adjustment) => (
                      <TableRow key={adjustment.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(adjustment.data_ajuste), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={adjustment.tipo === 'CREDITO' ? 'default' : 'destructive'}>
                            {adjustment.tipo === 'CREDITO' ? 'Credito' : 'Debito'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatHoursBalance(adjustment.minutos)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={adjustment.motivo}>
                          {adjustment.motivo}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {adjustment.profiles?.name || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quitarDialogOpen} onOpenChange={setQuitarDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Quitar Banco de Horas
            </DialogTitle>
            <DialogDescription>
              {selectedColaboradoraName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900">
                  <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Atual</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatHoursBalance(selectedBalance)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Quitacao *</Label>
              <Select
                value={quitarFormData.tipo}
                onValueChange={(value: 'INTEGRAL' | 'PARCIAL') => setQuitarFormData(prev => ({ ...prev, tipo: value }))}
              >
                <SelectTrigger data-testid="select-tipo-quitacao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTEGRAL">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Quitacao Integral (todo o saldo)
                    </div>
                  </SelectItem>
                  <SelectItem value="PARCIAL">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Quitacao Parcial
                    </div>
                  </SelectItem>
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
                    data-testid="input-horas-quitar"
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
                    data-testid="input-minutos-quitar"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo da Quitacao *</Label>
              <Textarea
                value={quitarFormData.motivo}
                onChange={(e) => setQuitarFormData(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Ex: Pagamento de horas extras, compensacao de folgas..."
                rows={3}
                data-testid="input-motivo-quitar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuitarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveQuitacao} disabled={loading} data-testid="button-confirmar-quitacao">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Quitacao
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
