/**
 * Componente para visualização do Banco de Horas da colaboradora
 * Mostra saldo atual, histórico de ajustes e cálculo baseado em jornada
 */

import { useState, useEffect } from 'react';
import { useTimeClock, type WorkSchedule } from '@/hooks/useTimeClock';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimeClockHoursBalanceProps {
  storeId: string;
  colaboradoraId: string;
}

interface HoursAdjustment {
  id: string;
  tipo: 'CREDITO' | 'DEBITO';
  minutos: number;
  motivo: string;
  data_ajuste: string;
  autorizado_por: string;
  created_at: string;
}

function TimeClockHoursBalance({ storeId, colaboradoraId }: TimeClockHoursBalanceProps) {
  const { hoursBalance, workSchedule, fetchHoursBalance, fetchWorkSchedule } = useTimeClock({
    storeId,
    colaboradoraId,
    autoFetch: false,
  });

  const [adjustments, setAdjustments] = useState<HoursAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculationDetails, setCalculationDetails] = useState<{
    jornadaEsperada: number;
    jornadaRealizada: number;
    diferenca: number;
  } | null>(null);

  useEffect(() => {
    if (storeId && colaboradoraId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, colaboradoraId]); // Removidas dependências para evitar loops

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchHoursBalance(),
        fetchWorkSchedule(),
        fetchAdjustments(),
      ]);
      await calculateBalance();
    } catch (error) {
      console.error('Erro ao carregar dados do banco de horas:', error);
      toast.error('Erro ao carregar dados do banco de horas');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdjustments = async () => {
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_hours_adjustments')
        .select('*')
        .eq('store_id', storeId)
        .eq('colaboradora_id', colaboradoraId)
        .order('data_ajuste', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAdjustments(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar ajustes:', error);
    }
  };

  const calculateBalance = async () => {
    if (!workSchedule) return;

    try {
      const hoje = new Date();
      const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const endOfMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

      const { data: records, error } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_records')
        .select('*')
        .eq('store_id', storeId)
        .eq('colaboradora_id', colaboradoraId)
        .gte('horario', startOfMonth.toISOString())
        .lte('horario', endOfMonth.toISOString())
        .order('horario', { ascending: true });

      if (error) throw error;

      const jornadaEsperada = calculateExpectedHours(workSchedule, startOfMonth, endOfMonth);
      const jornadaRealizada = calculateActualHours(records || []);

      setCalculationDetails({
        jornadaEsperada,
        jornadaRealizada,
        diferenca: jornadaRealizada - jornadaEsperada,
      });
    } catch (error: any) {
      console.error('Erro ao calcular banco de horas:', error);
    }
  };

  const calculateExpectedHours = (schedule: WorkSchedule, start: Date, end: Date): number => {
    // Se tem carga horária diária configurada, usar ela
    if (schedule.carga_horaria_diaria) {
      const minutosPorDia = Math.round(schedule.carga_horaria_diaria * 60);
      const diasSemanaConfigurados = schedule.dias_semana || [1, 2, 3, 4, 5];
      
      let diasTrabalhados = 0;
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (diasSemanaConfigurados.includes(dayOfWeek)) {
          diasTrabalhados++;
        }
        current.setDate(current.getDate() + 1);
      }

      return minutosPorDia * diasTrabalhados;
    }

    // Se não tem horários específicos, retornar 0
    if (!schedule.hora_entrada || !schedule.hora_saida) {
      return 0;
    }

    const entrada = parseTimeToMinutes(schedule.hora_entrada);
    const saida = parseTimeToMinutes(schedule.hora_saida);
    let minutosPorDia = saida - entrada;

    if (schedule.hora_intervalo_saida && schedule.hora_intervalo_retorno) {
      const intervaloInicio = parseTimeToMinutes(schedule.hora_intervalo_saida);
      const intervaloFim = parseTimeToMinutes(schedule.hora_intervalo_retorno);
      minutosPorDia -= (intervaloFim - intervaloInicio);
    }

    const diasSemanaConfigurados = schedule.dias_semana || [1, 2, 3, 4, 5];
    
    let diasTrabalhados = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (diasSemanaConfigurados.includes(dayOfWeek)) {
        diasTrabalhados++;
      }
      current.setDate(current.getDate() + 1);
    }

    return minutosPorDia * diasTrabalhados;
  };

  const calculateActualHours = (records: any[]): number => {
    const recordsByDay = new Map<string, any[]>();
    records.forEach(record => {
      const day = format(new Date(record.horario), 'yyyy-MM-dd');
      if (!recordsByDay.has(day)) {
        recordsByDay.set(day, []);
      }
      recordsByDay.get(day)!.push(record);
    });

    let totalMinutos = 0;

    recordsByDay.forEach((dayRecords) => {
      const sorted = dayRecords.sort((a, b) => 
        new Date(a.horario).getTime() - new Date(b.horario).getTime()
      );

      let entrada: Date | null = null;
      let saida: Date | null = null;
      let intervaloInicio: Date | null = null;
      let intervaloFim: Date | null = null;

      sorted.forEach(record => {
        const horario = new Date(record.horario);
        switch (record.tipo_registro) {
          case 'ENTRADA':
            entrada = horario;
            break;
          case 'SAIDA_INTERVALO':
            intervaloInicio = horario;
            break;
          case 'ENTRADA_INTERVALO':
            intervaloFim = horario;
            break;
          case 'SAIDA':
            saida = horario;
            break;
        }
      });

      if (entrada && saida) {
        const minutosDia = (saida.getTime() - entrada.getTime()) / (1000 * 60);
        if (intervaloInicio && intervaloFim) {
          const minutosIntervalo = (intervaloFim.getTime() - intervaloInicio.getTime()) / (1000 * 60);
          totalMinutos += minutosDia - minutosIntervalo;
        } else {
          totalMinutos += minutosDia;
        }
      }
    });

    return Math.round(totalMinutos);
  };

  const parseTimeToMinutes = (timeStr: string | null | undefined): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
  };

  const formatHoursBalance = (minutos: number) => {
    const horas = Math.floor(Math.abs(minutos) / 60);
    const mins = Math.abs(minutos) % 60;
    const sinal = minutos >= 0 ? '+' : '-';
    return `${sinal}${horas}h ${mins}min`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Saldo do Banco de Horas
          </CardTitle>
          <CardDescription>
            Seu saldo atual de banco de horas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hoursBalance ? (
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${hoursBalance.saldo_minutos >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatHoursBalance(hoursBalance.saldo_minutos)}
              </div>
              <p className="text-sm text-muted-foreground">
                {hoursBalance.saldo_minutos >= 0 ? 'Crédito' : 'Débito'}
              </p>
              {hoursBalance.ultimo_calculo_em && (
                <p className="text-xs text-muted-foreground mt-2">
                  Último cálculo: {format(new Date(hoursBalance.ultimo_calculo_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Nenhum saldo encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {calculationDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cálculo do Mês Atual</CardTitle>
            <CardDescription>
              Comparação entre jornada esperada e realizada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Jornada Esperada:</span>
                <span className="font-semibold">{formatHoursBalance(calculationDetails.jornadaEsperada)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Jornada Realizada:</span>
                <span className="font-semibold">{formatHoursBalance(calculationDetails.jornadaRealizada)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-semibold">Diferença:</span>
                <div className="flex items-center gap-2">
                  {calculationDetails.diferenca >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className={`font-bold ${calculationDetails.diferenca >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatHoursBalance(calculationDetails.diferenca)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Ajustes</CardTitle>
          <CardDescription>
            Ajustes manuais realizados pelo administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TimeClockHoursBalance;

