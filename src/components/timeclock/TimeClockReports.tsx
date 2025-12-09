/**
 * Componente de relatorios avancados de ponto
 * Relatorios por mes, semana, periodo customizado com calculo de horas extras
 * Conformidade com CLT e Portaria 671/2021
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Loader2, Calendar, Clock, TrendingUp, TrendingDown, Download, FileSpreadsheet, FileText, Users, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, differenceInMinutes, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TimeClockRecord {
  id: string;
  store_id: string;
  colaboradora_id: string;
  tipo_registro: string;
  horario: string;
  observacao?: string;
}

interface WorkSchedule {
  id: string;
  colaboradora_id: string;
  hora_entrada: string | null;
  hora_intervalo_saida: string | null;
  hora_intervalo_retorno: string | null;
  hora_saida: string | null;
  dias_semana: number[] | null;
  carga_horaria_diaria: number | null;
  tempo_intervalo_minutos: number | null;
  ativo: boolean;
}

interface Colaboradora {
  id: string;
  name: string;
}

interface DailyReport {
  date: Date;
  dayOfWeek: string;
  entrada?: string;
  saidaIntervalo?: string;
  entradaIntervalo?: string;
  saida?: string;
  horasTrabalhadas: number;
  horasEsperadas: number;
  saldo: number;
  status: 'completo' | 'incompleto' | 'falta' | 'folga';
}

interface TimeClockReportsProps {
  storeId: string;
  colaboradoraId?: string;
  showColaboradoraSelector?: boolean;
}

export function TimeClockReports({ storeId, colaboradoraId: propColaboradoraId, showColaboradoraSelector = true }: TimeClockReportsProps) {
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [selectedColaboradora, setSelectedColaboradora] = useState<string>(propColaboradoraId || '');
  const [records, setRecords] = useState<TimeClockRecord[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'mensal' | 'semanal' | 'customizado'>('mensal');
  
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [weekStart, setWeekStart] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [customStart, setCustomStart] = useState<string>(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (storeId && showColaboradoraSelector) {
      fetchColaboradoras();
    }
  }, [storeId, showColaboradoraSelector]);

  useEffect(() => {
    if (propColaboradoraId) {
      setSelectedColaboradora(propColaboradoraId);
    }
  }, [propColaboradoraId]);

  useEffect(() => {
    if (storeId && selectedColaboradora) {
      fetchData();
    }
  }, [storeId, selectedColaboradora, reportType, selectedMonth, weekStart, customStart, customEnd]);

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
      console.error('[TimeClockReports] Erro ao buscar colaboradoras:', err);
    }
  };

  const getDateRange = () => {
    if (reportType === 'mensal') {
      const monthDate = parseISO(`${selectedMonth}-01`);
      return { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };
    } else if (reportType === 'semanal') {
      const weekDate = parseISO(weekStart);
      return { start: weekDate, end: endOfWeek(weekDate, { weekStartsOn: 1 }) };
    } else {
      return { start: parseISO(customStart), end: parseISO(customEnd) };
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const [recordsRes, scheduleRes] = await Promise.all([
        supabase
          .schema('sistemaretiradas')
          .from('time_clock_records')
          .select('*')
          .eq('store_id', storeId)
          .eq('colaboradora_id', selectedColaboradora)
          .gte('horario', start.toISOString())
          .lte('horario', end.toISOString())
          .order('horario', { ascending: true }),
        supabase
          .schema('sistemaretiradas')
          .from('colaboradora_work_schedules')
          .select('*')
          .eq('store_id', storeId)
          .eq('colaboradora_id', selectedColaboradora)
          .eq('ativo', true)
          .single()
      ]);

      if (recordsRes.error) throw recordsRes.error;
      
      setRecords(recordsRes.data || []);
      setSchedule(scheduleRes.data || null);
    } catch (err: any) {
      console.error('[TimeClockReports] Erro ao buscar dados:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const dailyReports = useMemo(() => {
    if (!schedule) return [];
    
    const { start, end } = getDateRange();
    const days = eachDayOfInterval({ start, end });
    
    const workDays = schedule.dias_semana || [1, 2, 3, 4, 5, 6];
    
    return days.map(day => {
      const dayOfWeek = day.getDay();
      const isWorkDay = workDays.includes(dayOfWeek);
      
      const dayRecords = records.filter(r => 
        format(new Date(r.horario), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );

      const entrada = dayRecords.find(r => r.tipo_registro === 'ENTRADA');
      const saidaIntervalo = dayRecords.find(r => r.tipo_registro === 'SAIDA_INTERVALO');
      const entradaIntervalo = dayRecords.find(r => r.tipo_registro === 'ENTRADA_INTERVALO');
      const saida = dayRecords.find(r => r.tipo_registro === 'SAIDA');

      let horasTrabalhadas = 0;
      let horasEsperadas = 0;

      if (isWorkDay) {
        if (schedule.carga_horaria_diaria) {
          // carga_horaria_diaria está em HORAS, converter para MINUTOS
          horasEsperadas = schedule.carga_horaria_diaria * 60;
        } else if (schedule.hora_entrada && schedule.hora_saida) {
          const [entradaH, entradaM] = schedule.hora_entrada.split(':').map(Number);
          const [saidaH, saidaM] = schedule.hora_saida.split(':').map(Number);
          horasEsperadas = (saidaH * 60 + saidaM) - (entradaH * 60 + entradaM);
          
          if (schedule.hora_intervalo_saida && schedule.hora_intervalo_retorno) {
            const [intervSaidaH, intervSaidaM] = schedule.hora_intervalo_saida.split(':').map(Number);
            const [intervRetornoH, intervRetornoM] = schedule.hora_intervalo_retorno.split(':').map(Number);
            horasEsperadas -= ((intervRetornoH * 60 + intervRetornoM) - (intervSaidaH * 60 + intervSaidaM));
          } else if (schedule.tempo_intervalo_minutos) {
            horasEsperadas -= schedule.tempo_intervalo_minutos;
          }
        }
      }

      if (entrada && saida) {
        const entradaTime = new Date(entrada.horario);
        const saidaTime = new Date(saida.horario);
        horasTrabalhadas = differenceInMinutes(saidaTime, entradaTime);

        if (saidaIntervalo && entradaIntervalo) {
          const intervSaidaTime = new Date(saidaIntervalo.horario);
          const intervRetornoTime = new Date(entradaIntervalo.horario);
          horasTrabalhadas -= differenceInMinutes(intervRetornoTime, intervSaidaTime);
        }
      }

      let status: 'completo' | 'incompleto' | 'falta' | 'folga' = 'folga';
      if (isWorkDay) {
        if (entrada && saida) {
          status = 'completo';
        } else if (entrada || saida) {
          status = 'incompleto';
        } else {
          status = day <= new Date() ? 'falta' : 'folga';
        }
      }

      return {
        date: day,
        dayOfWeek: format(day, 'EEEE', { locale: ptBR }),
        entrada: entrada ? format(new Date(entrada.horario), 'HH:mm') : undefined,
        saidaIntervalo: saidaIntervalo ? format(new Date(saidaIntervalo.horario), 'HH:mm') : undefined,
        entradaIntervalo: entradaIntervalo ? format(new Date(entradaIntervalo.horario), 'HH:mm') : undefined,
        saida: saida ? format(new Date(saida.horario), 'HH:mm') : undefined,
        horasTrabalhadas,
        horasEsperadas,
        saldo: horasTrabalhadas - horasEsperadas,
        status,
      } as DailyReport;
    });
  }, [records, schedule, reportType, selectedMonth, weekStart, customStart, customEnd]);

  const totals = useMemo(() => {
    const totalTrabalhado = dailyReports.reduce((acc, d) => acc + d.horasTrabalhadas, 0);
    const totalEsperado = dailyReports.reduce((acc, d) => acc + d.horasEsperadas, 0);
    const diasTrabalhados = dailyReports.filter(d => d.status === 'completo').length;
    const diasFalta = dailyReports.filter(d => d.status === 'falta').length;
    const diasIncompletos = dailyReports.filter(d => d.status === 'incompleto').length;

    return {
      totalTrabalhado,
      totalEsperado,
      saldo: totalTrabalhado - totalEsperado,
      diasTrabalhados,
      diasFalta,
      diasIncompletos,
    };
  }, [dailyReports]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes >= 0 ? '' : '-';
    return `${sign}${hours}h ${mins}min`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completo':
        return <Badge variant="default" className="bg-emerald-600">Completo</Badge>;
      case 'incompleto':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Incompleto</Badge>;
      case 'falta':
        return <Badge variant="destructive">Falta</Badge>;
      case 'folga':
        return <Badge variant="secondary">Folga</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportXLS = () => {
    if (dailyReports.length === 0) {
      toast.error('Nao ha dados para exportar');
      return;
    }

    const colaboradora = colaboradoras.find(c => c.id === selectedColaboradora);
    const headers = ['Data', 'Dia', 'Entrada', 'Saida Interv.', 'Retorno Interv.', 'Saida', 'Trabalhadas', 'Esperadas', 'Saldo', 'Status'];
    const rows = dailyReports.map(d => [
      format(d.date, 'dd/MM/yyyy'),
      d.dayOfWeek,
      d.entrada || '-',
      d.saidaIntervalo || '-',
      d.entradaIntervalo || '-',
      d.saida || '-',
      formatMinutes(d.horasTrabalhadas),
      formatMinutes(d.horasEsperadas),
      formatMinutes(d.saldo),
      d.status.toUpperCase(),
    ]);

    rows.push(['', '', '', '', '', '', '', '', '', '']);
    rows.push(['TOTAIS', '', '', '', '', '', formatMinutes(totals.totalTrabalhado), formatMinutes(totals.totalEsperado), formatMinutes(totals.saldo), '']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
    XLSX.writeFile(wb, `ponto_${colaboradora?.name || 'colaboradora'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatorio exportado com sucesso');
  };

  const handleExportPDF = () => {
    if (dailyReports.length === 0) {
      toast.error('Nao ha dados para exportar');
      return;
    }

    const colaboradora = colaboradoras.find(c => c.id === selectedColaboradora);
    const { start, end } = getDateRange();
    
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text('RELATORIO DE PONTO', 14, 20);
    doc.setFontSize(10);
    doc.text(`Colaboradora: ${colaboradora?.name || 'N/A'}`, 14, 28);
    doc.text(`Periodo: ${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`, 14, 34);

    const tableData = dailyReports.map(d => [
      format(d.date, 'dd/MM/yyyy'),
      d.dayOfWeek.substring(0, 3),
      d.entrada || '-',
      d.saidaIntervalo || '-',
      d.entradaIntervalo || '-',
      d.saida || '-',
      formatMinutes(d.horasTrabalhadas),
      formatMinutes(d.horasEsperadas),
      formatMinutes(d.saldo),
      d.status.toUpperCase(),
    ]);

    autoTable(doc, {
      head: [['Data', 'Dia', 'Entrada', 'S. Int.', 'R. Int.', 'Saida', 'Trab.', 'Esp.', 'Saldo', 'Status']],
      body: tableData,
      startY: 40,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [100, 100, 100] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total Trabalhado: ${formatMinutes(totals.totalTrabalhado)}`, 14, finalY);
    doc.text(`Total Esperado: ${formatMinutes(totals.totalEsperado)}`, 14, finalY + 6);
    doc.text(`Saldo: ${formatMinutes(totals.saldo)}`, 14, finalY + 12);

    doc.save(`ponto_${colaboradora?.name || 'colaboradora'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exportado com sucesso');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle className="text-lg">Relatorios de Ponto</CardTitle>
        </div>
        <CardDescription>
          Visualize e exporte relatorios detalhados por periodo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {showColaboradoraSelector && (
            <div>
              <Label>Colaboradora</Label>
              <Select value={selectedColaboradora} onValueChange={setSelectedColaboradora}>
                <SelectTrigger data-testid="select-colaboradora-report">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {colaboradoras.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Tipo de Relatorio</Label>
            <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
              <SelectTrigger data-testid="select-report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="customizado">Periodo Customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportType === 'mensal' && (
            <div>
              <Label>Mes</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                data-testid="input-month"
              />
            </div>
          )}

          {reportType === 'semanal' && (
            <div>
              <Label>Semana de</Label>
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                data-testid="input-week-start"
              />
            </div>
          )}

          {reportType === 'customizado' && (
            <>
              <div>
                <Label>Data Inicio</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  data-testid="input-custom-start"
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  data-testid="input-custom-end"
                />
              </div>
            </>
          )}
        </div>

        {selectedColaboradora && !loading && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Horas Trabalhadas</span>
                  </div>
                  <p className="text-2xl font-bold">{formatMinutes(totals.totalTrabalhado)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Horas Esperadas</span>
                  </div>
                  <p className="text-2xl font-bold">{formatMinutes(totals.totalEsperado)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    {totals.saldo >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm text-muted-foreground">Saldo</span>
                  </div>
                  <p className={`text-2xl font-bold ${totals.saldo >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {formatMinutes(totals.saldo)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Dias Trabalhados</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{totals.diasTrabalhados}</p>
                    {(totals.diasFalta > 0 || totals.diasIncompletos > 0) && (
                      <span className="text-xs text-destructive">
                        {totals.diasFalta > 0 && `${totals.diasFalta} faltas`}
                        {totals.diasFalta > 0 && totals.diasIncompletos > 0 && ', '}
                        {totals.diasIncompletos > 0 && `${totals.diasIncompletos} incompletos`}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleExportXLS} data-testid="button-export-xls">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar XLS
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead className="hidden sm:table-cell">S. Int.</TableHead>
                      <TableHead className="hidden sm:table-cell">R. Int.</TableHead>
                      <TableHead>Saida</TableHead>
                      <TableHead>Trabalhadas</TableHead>
                      <TableHead className="hidden md:table-cell">Esperadas</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyReports.map((report) => (
                      <TableRow key={format(report.date, 'yyyy-MM-dd')}>
                        <TableCell className="font-medium">
                          {format(report.date, 'dd/MM')}
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          {report.dayOfWeek.substring(0, 3)}
                        </TableCell>
                        <TableCell>{report.entrada || '-'}</TableCell>
                        <TableCell className="hidden sm:table-cell">{report.saidaIntervalo || '-'}</TableCell>
                        <TableCell className="hidden sm:table-cell">{report.entradaIntervalo || '-'}</TableCell>
                        <TableCell>{report.saida || '-'}</TableCell>
                        <TableCell>{formatMinutes(report.horasTrabalhadas)}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatMinutes(report.horasEsperadas)}</TableCell>
                        <TableCell className={report.saldo >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                          {formatMinutes(report.saldo)}
                        </TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {!selectedColaboradora && (
          <div className="text-center py-8 text-muted-foreground">
            Selecione uma colaboradora para visualizar os relatorios
          </div>
        )}
      </CardContent>
    </Card>
  );
}
