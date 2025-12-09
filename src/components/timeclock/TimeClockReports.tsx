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
  lancamento_manual?: boolean;
  lancado_por?: string;
  assinatura_digital?: {
    id: string;
    assinado_em: string;
  } | null;
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
  entradaManual?: boolean;
  saidaIntervaloManual?: boolean;
  entradaIntervaloManual?: boolean;
  saidaManual?: boolean;
  entradaAssinada?: boolean;
  saidaIntervaloAssinada?: boolean;
  entradaIntervaloAssinada?: boolean;
  saidaAssinada?: boolean;
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
          .select(`
            *,
            assinaturas:time_clock_digital_signatures!time_clock_digital_signatures_time_clock_record_id_fkey(
              id,
              assinado_em
            )
          `)
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
      
      // Processar registros para incluir assinatura digital
      const processedRecords = (recordsRes.data || []).map((record: any) => ({
        ...record,
        assinatura_digital: Array.isArray(record.assinaturas) && record.assinaturas.length > 0 
          ? record.assinaturas[0] 
          : null
      }));
      
      setRecords(processedRecords);
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
      
      // Verificar se são lançamentos manuais
      const entradaManual = entrada?.lancamento_manual || false;
      const saidaIntervaloManual = saidaIntervalo?.lancamento_manual || false;
      const entradaIntervaloManual = entradaIntervalo?.lancamento_manual || false;
      const saidaManual = saida?.lancamento_manual || false;
      
      // Verificar se têm assinatura digital
      const entradaAssinada = entrada?.assinatura_digital !== null && entrada?.assinatura_digital !== undefined;
      const saidaIntervaloAssinada = saidaIntervalo?.assinatura_digital !== null && saidaIntervalo?.assinatura_digital !== undefined;
      const entradaIntervaloAssinada = entradaIntervalo?.assinatura_digital !== null && entradaIntervalo?.assinatura_digital !== undefined;
      const saidaAssinada = saida?.assinatura_digital !== null && saida?.assinatura_digital !== undefined;

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
        entradaManual,
        saidaIntervaloManual,
        entradaIntervaloManual,
        saidaManual,
        entradaAssinada,
        saidaIntervaloAssinada,
        entradaIntervaloAssinada,
        saidaAssinada,
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

  const formatTimeWithIndicators = (time: string | undefined, isManual: boolean, isSigned: boolean) => {
    if (!time) return '-';
    let result = time;
    const indicators: string[] = [];
    if (isManual) {
      indicators.push('(M)');
    }
    if (isSigned) {
      indicators.push('✓');
    }
    if (indicators.length > 0) {
      result += ' ' + indicators.join(' ');
    }
    return result;
  };

  const handleExportPDF = () => {
    if (dailyReports.length === 0) {
      toast.error('Nao ha dados para exportar');
      return;
    }

    const colaboradora = colaboradoras.find(c => c.id === selectedColaboradora);
    const { start, end } = getDateRange();
    
    // Formato RETRATO (portrait) para caber um mês inteiro
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    // Cabeçalho
    doc.setFontSize(16);
    doc.text('RELATORIO DE PONTO', 14, 15);
    doc.setFontSize(10);
    doc.text(`Colaboradora: ${colaboradora?.name || 'N/A'}`, 14, 22);
    doc.text(`Periodo: ${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`, 14, 28);
    
    // Legenda
    doc.setFontSize(8);
    doc.text('Legenda: (Manual) = Lançamento manual pelo admin | ✓ Assinado = Assinatura digital confirmada', 14, 34);

    // Preparar dados da tabela com indicadores
    const tableData = dailyReports.map(d => {
      const entradaStr = formatTimeWithIndicators(d.entrada, d.entradaManual || false, d.entradaAssinada || false);
      const saidaIntStr = formatTimeWithIndicators(d.saidaIntervalo, d.saidaIntervaloManual || false, d.saidaIntervaloAssinada || false);
      const entradaIntStr = formatTimeWithIndicators(d.entradaIntervalo, d.entradaIntervaloManual || false, d.entradaIntervaloAssinada || false);
      const saidaStr = formatTimeWithIndicators(d.saida, d.saidaManual || false, d.saidaAssinada || false);
      
      return [
        format(d.date, 'dd/MM'),
        d.dayOfWeek.substring(0, 3).toUpperCase(),
        entradaStr,
        saidaIntStr,
        entradaIntStr,
        saidaStr,
        formatMinutes(d.horasTrabalhadas),
        formatMinutes(d.horasEsperadas),
        formatMinutes(d.saldo),
        d.status.toUpperCase(),
      ];
    });

    // Configurar tabela compacta para caber um mês inteiro
    autoTable(doc, {
      head: [['Data', 'Dia', 'Entrada', 'S. Int.', 'R. Int.', 'Saida', 'Trab.', 'Esp.', 'Saldo', 'Status']],
      body: tableData,
      startY: 40,
      theme: 'striped',
      styles: { 
        fontSize: 7,
        cellPadding: 1.5,
        lineWidth: 0.1,
      },
      headStyles: { 
        fillColor: [100, 100, 100],
        fontSize: 7,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 18 }, // Data
        1: { cellWidth: 15 }, // Dia
        2: { cellWidth: 25 }, // Entrada
        3: { cellWidth: 20 }, // S. Int.
        4: { cellWidth: 20 }, // R. Int.
        5: { cellWidth: 25 }, // Saida
        6: { cellWidth: 20 }, // Trab.
        7: { cellWidth: 20 }, // Esp.
        8: { cellWidth: 20 }, // Saldo
        9: { cellWidth: 20 }, // Status
      },
      margin: { top: 40, left: 14, right: 14 },
      tableWidth: 'auto',
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.text(`Total Trabalhado: ${formatMinutes(totals.totalTrabalhado)}`, 14, finalY);
    doc.text(`Total Esperado: ${formatMinutes(totals.totalEsperado)}`, 14, finalY + 5);
    doc.text(`Saldo: ${formatMinutes(totals.saldo)}`, 14, finalY + 10);
    
    // Rodapé com informações de conformidade
    doc.setFontSize(7);
    const pageHeight = doc.internal.pageSize.height;
    doc.text('Conforme Portaria 671/2021 (REP-P) - Assinatura digital obrigatória para validade legal', 14, pageHeight - 10);

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
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {report.entrada || '-'}
                            {report.entradaManual && (
                              <span className="text-[10px] text-amber-600">(Manual)</span>
                            )}
                            {report.entradaAssinada && (
                              <span className="text-[10px] text-emerald-600">✓ Assinado</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col gap-0.5">
                            {report.saidaIntervalo || '-'}
                            {report.saidaIntervaloManual && (
                              <span className="text-[10px] text-amber-600">(Manual)</span>
                            )}
                            {report.saidaIntervaloAssinada && (
                              <span className="text-[10px] text-emerald-600">✓ Assinado</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col gap-0.5">
                            {report.entradaIntervalo || '-'}
                            {report.entradaIntervaloManual && (
                              <span className="text-[10px] text-amber-600">(Manual)</span>
                            )}
                            {report.entradaIntervaloAssinada && (
                              <span className="text-[10px] text-emerald-600">✓ Assinado</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {report.saida || '-'}
                            {report.saidaManual && (
                              <span className="text-[10px] text-amber-600">(Manual)</span>
                            )}
                            {report.saidaAssinada && (
                              <span className="text-[10px] text-emerald-600">✓ Assinado</span>
                            )}
                          </div>
                        </TableCell>
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
