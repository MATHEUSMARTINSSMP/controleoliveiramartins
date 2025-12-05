/**
 * Componente modular para histórico completo de registros de ponto
 * Visualização de todos os registros da colaboradora
 */

import { useState, useEffect } from 'react';
import { useTimeClock } from '@/hooks/useTimeClock';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Clock, Calendar, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TimeClockHistoryProps {
  storeId: string;
  colaboradoraId: string;
  showOnlyToday?: boolean;
}

export function TimeClockHistory({ storeId, colaboradoraId, showOnlyToday = false }: TimeClockHistoryProps) {
  const { records, loading, fetchRecords, hoursBalance, fetchHoursBalance } = useTimeClock({
    storeId,
    colaboradoraId,
    autoFetch: false,
  });

  const [startDate, setStartDate] = useState<string>(
    showOnlyToday ? format(new Date(), 'yyyy-MM-dd') : format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  useEffect(() => {
    if (storeId && colaboradoraId) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      fetchRecords(start, end);
      fetchHoursBalance();
    }
  }, [storeId, colaboradoraId, startDate, endDate, fetchRecords, fetchHoursBalance]);

  const getRecordTypeLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      ENTRADA: 'Entrada',
      SAIDA_INTERVALO: 'Saída - Intervalo',
      ENTRADA_INTERVALO: 'Retorno - Intervalo',
      SAIDA: 'Saída',
    };
    return labels[tipo] || tipo;
  };

  const getRecordTypeBadge = (tipo: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ENTRADA: 'default',
      SAIDA_INTERVALO: 'secondary',
      ENTRADA_INTERVALO: 'secondary',
      SAIDA: 'destructive',
    };
    return variants[tipo] || 'outline';
  };

  const formatHoursBalance = (minutos: number) => {
    const horas = Math.floor(Math.abs(minutos) / 60);
    const mins = Math.abs(minutos) % 60;
    const sinal = minutos >= 0 ? '+' : '-';
    return `${sinal}${horas}h ${mins}min`;
  };

  const handleExportXLS = () => {
    try {
      if (records.length === 0) {
        toast.error('Não há registros para exportar');
        return;
      }

      // Preparar dados
      const headers = ['Data', 'Horário', 'Tipo', 'Observação'];
      const rows = records.map(record => [
        format(new Date(record.horario), 'dd/MM/yyyy', { locale: ptBR }),
        format(new Date(record.horario), 'HH:mm:ss', { locale: ptBR }),
        getRecordTypeLabel(record.tipo_registro),
        record.observacao || '-'
      ]);

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Definir larguras das colunas
      ws['!cols'] = [
        { wch: 12 }, // Data
        { wch: 10 }, // Horário
        { wch: 20 }, // Tipo
        { wch: 40 }  // Observação
      ];

      // Estilizar cabeçalho
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[cellAddress]) {
          ws[cellAddress] = { t: 's', v: '' };
        }
        if (!ws[cellAddress].s) {
          ws[cellAddress].s = {};
        }
        ws[cellAddress].s.font = { bold: true };
        ws[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
        ws[cellAddress].s.fill = { fgColor: { rgb: 'E0E0E0' } };
        ws[cellAddress].s.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Ponto');

      // Nome do arquivo
      const nomeArquivo = `Historico_Ponto_${format(new Date(startDate), 'yyyy-MM-dd')}_${format(new Date(endDate), 'yyyy-MM-dd')}.xlsx`;

      // Salvar arquivo
      XLSX.writeFile(wb, nomeArquivo);

      toast.success('Exportação XLS realizada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar XLS:', error);
      toast.error('Erro ao exportar arquivo XLS');
    }
  };

  const handleExportPDF = () => {
    try {
      if (records.length === 0) {
        toast.error('Não há registros para exportar');
        return;
      }

      const doc = new jsPDF('portrait', 'mm', 'a4');

      // Título
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Registros de Ponto', 14, 15);

      // Subtítulo
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const periodo = `${format(new Date(startDate), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(endDate), 'dd/MM/yyyy', { locale: ptBR })}`;
      doc.text(`Período: ${periodo}`, 14, 22);

      // Banco de Horas (se disponível)
      if (hoursBalance) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const saldo = formatHoursBalance(hoursBalance.saldo_minutos);
        doc.text(`Saldo do Banco de Horas: ${saldo}`, 14, 28);
      }

      // Preparar dados para autoTable
      const tableData = records.map(record => [
        format(new Date(record.horario), 'dd/MM/yyyy', { locale: ptBR }),
        format(new Date(record.horario), 'HH:mm:ss', { locale: ptBR }),
        getRecordTypeLabel(record.tipo_registro),
        record.observacao || '-'
      ]);

      // Criar tabela
      autoTable(doc, {
        head: [['Data', 'Horário', 'Tipo', 'Observação']],
        body: tableData,
        startY: hoursBalance ? 35 : 28,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 30 }, // Data
          1: { halign: 'center', cellWidth: 25 }, // Horário
          2: { halign: 'center', cellWidth: 40 }, // Tipo
          3: { halign: 'left', cellWidth: 90 } // Observação
        },
        theme: 'grid',
        margin: { top: hoursBalance ? 35 : 28, left: 14, right: 14 },
      });

      // Salvar arquivo
      const nomeArquivo = `Historico_Ponto_${format(new Date(startDate), 'yyyy-MM-dd')}_${format(new Date(endDate), 'yyyy-MM-dd')}.pdf`;
      doc.save(nomeArquivo);

      toast.success('Exportação PDF realizada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar arquivo PDF');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros - ocultar se for apenas hoje */}
      {!showOnlyToday && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Histórico de Ponto
            </CardTitle>
            <CardDescription>
              Visualize todos os seus registros de ponto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Banco de Horas */}
            {hoursBalance && (
              <div className="mb-4 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Saldo Atual do Banco de Horas</div>
                    <div className={`text-2xl font-bold ${hoursBalance.saldo_minutos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatHoursBalance(hoursBalance.saldo_minutos)}
                    </div>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleExportXLS} variant="outline" size="sm">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar XLS
              </Button>
              <Button onClick={handleExportPDF} variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de registros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro encontrado no período selecionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.horario), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono">
                        {format(new Date(record.horario), "HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRecordTypeBadge(record.tipo_registro)}>
                          {getRecordTypeLabel(record.tipo_registro)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {record.observacao || '-'}
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


