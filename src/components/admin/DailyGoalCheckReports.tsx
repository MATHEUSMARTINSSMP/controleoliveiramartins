import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from '@/lib/utils';
import { 
  Target, 
  Users, 
  TrendingUp, 
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  Search
} from 'lucide-react';

interface DailyCheck {
  id: string;
  colaboradora_id: string;
  colaboradora_nome: string;
  store_id: string;
  store_name: string;
  data_referencia: string;
  meta_do_dia: number;
  valor_atrasado: number;
  valor_total_confirmado: number;
  valor_bonus: number;
  horario_check: string;
}

interface Store {
  id: string;
  name: string;
}

interface Collaborator {
  id: string;
  name: string;
  store_id: string;
}

interface SummaryData {
  totalChecks: number;
  totalBonus: number;
  uniqueCollaborators: number;
  complianceRate: number;
  avgCheckTime: string;
}

export const DailyGoalCheckReports = () => {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [checks, setChecks] = useState<DailyCheck[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activeCollaboratorsCount, setActiveCollaboratorsCount] = useState(0);
  
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('detalhes');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchChecks();
  }, [selectedStore, selectedCollaborator, dateFrom, dateTo]);

  const fetchData = async () => {
    try {
      const [storesRes, collaboratorsRes] = await Promise.all([
        supabase
          .schema('sistemaretiradas')
          .from('stores')
          .select('id, name')
          .eq('active', true)
          .eq('daily_goal_check_ativo', true)
          .order('name'),
        supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .select('id, name, store_id')
          .eq('is_active', true)
          .eq('role', 'COLABORADORA')
          .order('name')
      ]);

      if (storesRes.error) throw storesRes.error;
      if (collaboratorsRes.error) throw collaboratorsRes.error;

      setStores(storesRes.data || []);
      setCollaborators(collaboratorsRes.data || []);
      setActiveCollaboratorsCount(collaboratorsRes.data?.length || 0);
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const fetchChecks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .schema('sistemaretiradas')
        .from('daily_goal_checks')
        .select(`
          id,
          colaboradora_id,
          store_id,
          data_referencia,
          meta_do_dia,
          valor_atrasado,
          valor_total_confirmado,
          valor_bonus,
          horario_check
        `)
        .gte('data_referencia', dateFrom)
        .lte('data_referencia', dateTo)
        .order('data_referencia', { ascending: false })
        .order('horario_check', { ascending: false });

      if (selectedStore !== 'all') {
        query = query.eq('store_id', selectedStore);
      }

      if (selectedCollaborator !== 'all') {
        query = query.eq('colaboradora_id', selectedCollaborator);
      }

      const { data: checksData, error: checksError } = await query;

      if (checksError) throw checksError;

      const collaboradorIds = [...new Set(checksData?.map(c => c.colaboradora_id) || [])];
      const storeIds = [...new Set(checksData?.map(c => c.store_id) || [])];

      const [profilesRes, storesRes] = await Promise.all([
        collaboradorIds.length > 0 
          ? supabase
              .schema('sistemaretiradas')
              .from('profiles')
              .select('id, name')
              .in('id', collaboradorIds)
          : Promise.resolve({ data: [], error: null }),
        storeIds.length > 0
          ? supabase
              .schema('sistemaretiradas')
              .from('stores')
              .select('id, name')
              .in('id', storeIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p.name]));
      const storesMap = new Map((storesRes.data || []).map(s => [s.id, s.name]));

      const enrichedChecks: DailyCheck[] = (checksData || []).map(check => ({
        ...check,
        colaboradora_nome: profilesMap.get(check.colaboradora_id) || 'Desconhecido',
        store_name: storesMap.get(check.store_id) || 'Loja Desconhecida'
      }));

      setChecks(enrichedChecks);
    } catch (error: any) {
      console.error('Erro ao buscar checks:', error);
      toast.error('Erro ao carregar checks');
    } finally {
      setLoading(false);
    }
  };

  const filteredChecks = useMemo(() => {
    if (!searchTerm) return checks;
    const term = searchTerm.toLowerCase();
    return checks.filter(check =>
      check.colaboradora_nome.toLowerCase().includes(term) ||
      check.store_name.toLowerCase().includes(term)
    );
  }, [checks, searchTerm]);

  const filteredCollaboratorsCount = useMemo(() => {
    if (selectedStore === 'all' && selectedCollaborator === 'all') {
      return activeCollaboratorsCount;
    }
    if (selectedCollaborator !== 'all') {
      return 1;
    }
    return collaborators.filter(c => c.store_id === selectedStore).length;
  }, [selectedStore, selectedCollaborator, activeCollaboratorsCount, collaborators]);

  const summary: SummaryData = useMemo(() => {
    const totalChecks = filteredChecks.length;
    const totalBonus = filteredChecks.reduce((sum, c) => sum + Number(c.valor_bonus), 0);
    const uniqueCollaborators = new Set(filteredChecks.map(c => c.colaboradora_id)).size;
    
    const workingDays = Math.max(1, Math.ceil(
      (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1);
    const expectedChecks = filteredCollaboratorsCount * workingDays;
    const complianceRate = expectedChecks > 0 ? Math.min(100, (totalChecks / expectedChecks) * 100) : 0;

    let avgCheckTime = '--:--';
    if (filteredChecks.length > 0) {
      const times = filteredChecks.map(c => {
        try {
          const dateStr = c.horario_check;
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.getHours() * 60 + date.getMinutes();
          }
          const timeMatch = dateStr.match(/(\d{2}):(\d{2})/);
          if (timeMatch) {
            return parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
          }
          return 0;
        } catch {
          return 0;
        }
      }).filter(t => t > 0);
      
      if (times.length > 0) {
        const avgMinutes = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        avgCheckTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      }
    }

    return { totalChecks, totalBonus, uniqueCollaborators, complianceRate, avgCheckTime };
  }, [filteredChecks, dateFrom, dateTo, filteredCollaboratorsCount]);

  const collaboratorSummary = useMemo(() => {
    const map = new Map<string, { name: string; store: string; checks: number; bonus: number }>();
    
    filteredChecks.forEach(check => {
      const existing = map.get(check.colaboradora_id);
      if (existing) {
        existing.checks += 1;
        existing.bonus += Number(check.valor_bonus);
      } else {
        map.set(check.colaboradora_id, {
          name: check.colaboradora_nome,
          store: check.store_name,
          checks: 1,
          bonus: Number(check.valor_bonus)
        });
      }
    });

    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.bonus - a.bonus);
  }, [filteredChecks]);

  const dailySummary = useMemo(() => {
    const map = new Map<string, { date: string; checks: number; bonus: number; collaborators: Set<string> }>();
    
    filteredChecks.forEach(check => {
      const existing = map.get(check.data_referencia);
      if (existing) {
        existing.checks += 1;
        existing.bonus += Number(check.valor_bonus);
        existing.collaborators.add(check.colaboradora_id);
      } else {
        map.set(check.data_referencia, {
          date: check.data_referencia,
          checks: 1,
          bonus: Number(check.valor_bonus),
          collaborators: new Set([check.colaboradora_id])
        });
      }
    });

    return Array.from(map.values())
      .map(d => ({ ...d, uniqueCollaborators: d.collaborators.size }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredChecks]);

  const handleExportXLSX = async () => {
    setExporting('xlsx');
    try {
      const xlsxModule = await import('xlsx');
      
      const data = filteredChecks.map(check => ({
        'Colaboradora': check.colaboradora_nome,
        'Loja': check.store_name,
        'Data': format(parseISO(check.data_referencia), 'dd/MM/yyyy'),
        'Horario Check': format(new Date(check.horario_check), 'HH:mm'),
        'Meta do Dia': Number(check.meta_do_dia).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        'Valor Atrasado': Number(check.valor_atrasado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        'Total Confirmado': Number(check.valor_total_confirmado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        'Bonus': Number(check.valor_bonus).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      }));

      const ws = xlsxModule.utils.json_to_sheet(data);
      const wb = xlsxModule.utils.book_new();
      xlsxModule.utils.book_append_sheet(wb, ws, 'Checks');
      
      const summaryData = collaboratorSummary.map(c => ({
        'Colaboradora': c.name,
        'Loja': c.store,
        'Total Checks': c.checks,
        'Bonus Acumulado': c.bonus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      }));
      const wsSummary = xlsxModule.utils.json_to_sheet(summaryData);
      xlsxModule.utils.book_append_sheet(wb, wsSummary, 'Resumo por Colaboradora');

      xlsxModule.writeFile(wb, `checks-meta-diaria-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Relatorio exportado com sucesso');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar relatorio');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text('Relatorio de Check de Meta Diaria', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Periodo: ${format(parseISO(dateFrom), 'dd/MM/yyyy')} a ${format(parseISO(dateTo), 'dd/MM/yyyy')}`, 14, 30);
      doc.text(`Total de Checks: ${summary.totalChecks}`, 14, 36);
      doc.text(`Bonus Acumulado: ${formatBRL(summary.totalBonus)}`, 14, 42);
      doc.text(`Taxa de Adesao: ${summary.complianceRate.toFixed(1)}%`, 14, 48);

      const tableData = filteredChecks.slice(0, 100).map(check => [
        check.colaboradora_nome,
        check.store_name,
        format(parseISO(check.data_referencia), 'dd/MM/yyyy'),
        format(new Date(check.horario_check), 'HH:mm'),
        formatBRL(check.valor_bonus)
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['Colaboradora', 'Loja', 'Data', 'Horario', 'Bonus']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] }
      });

      doc.save(`checks-meta-diaria-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exportado com sucesso');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(null);
    }
  };

  const setQuickPeriod = (period: 'today' | 'week' | 'month' | 'lastMonth') => {
    const today = new Date();
    switch (period) {
      case 'today':
        setDateFrom(format(today, 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        setDateFrom(format(weekStart, 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'month':
        setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
        setDateTo(format(today, 'yyyy-MM-dd'));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        setDateFrom(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        setDateTo(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
    }
  };

  const filteredCollaborators = selectedStore === 'all' 
    ? collaborators 
    : collaborators.filter(c => c.store_id === selectedStore);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Relatorio de Check de Meta Diaria
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe quem fez o check, quando e quanto acumulou de bonus
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportXLSX}
            disabled={exporting !== null || filteredChecks.length === 0}
            data-testid="button-export-xlsx"
          >
            {exporting === 'xlsx' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Excel
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={exporting !== null || filteredChecks.length === 0}
            data-testid="button-export-pdf"
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger data-testid="select-store-filter">
                  <SelectValue placeholder="Todas as lojas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Colaboradora</Label>
              <Select value={selectedCollaborator} onValueChange={setSelectedCollaborator}>
                <SelectTrigger data-testid="select-collaborator-filter">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {filteredCollaborators.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>

            <div className="space-y-2">
              <Label>Periodo Rapido</Label>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setQuickPeriod('today')} data-testid="button-period-today">Hoje</Button>
                <Button size="sm" variant="ghost" onClick={() => setQuickPeriod('week')} data-testid="button-period-week">7 dias</Button>
                <Button size="sm" variant="ghost" onClick={() => setQuickPeriod('month')} data-testid="button-period-month">Mes</Button>
                <Button size="sm" variant="ghost" onClick={() => setQuickPeriod('lastMonth')} data-testid="button-period-last-month">Mes Ant.</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Checks</p>
                <p className="text-2xl font-bold" data-testid="text-total-checks">{summary.totalChecks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bonus Acumulado</p>
                <p className="text-2xl font-bold" data-testid="text-total-bonus">{formatBRL(summary.totalBonus)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Colaboradoras</p>
                <p className="text-2xl font-bold" data-testid="text-unique-collaborators">{summary.uniqueCollaborators}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900/30">
                <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Adesao</p>
                <p className="text-2xl font-bold" data-testid="text-compliance-rate">{summary.complianceRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-pink-100 dark:bg-pink-900/30">
                <Clock className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horario Medio</p>
                <p className="text-2xl font-bold" data-testid="text-avg-time">{summary.avgCheckTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="detalhes" data-testid="tab-details">Detalhes</TabsTrigger>
                <TabsTrigger value="colaboradoras" data-testid="tab-collaborators">Por Colaboradora</TabsTrigger>
                <TabsTrigger value="diario" data-testid="tab-daily">Por Dia</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'detalhes' && (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaboradora</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Horario</TableHead>
                        <TableHead className="text-right">Meta</TableHead>
                        <TableHead className="text-right">Bonus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChecks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhum check encontrado no periodo selecionado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredChecks.map(check => (
                          <TableRow key={check.id} data-testid={`row-check-${check.id}`}>
                            <TableCell className="font-medium">{check.colaboradora_nome}</TableCell>
                            <TableCell>{check.store_name}</TableCell>
                            <TableCell>{format(parseISO(check.data_referencia), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{format(new Date(check.horario_check), 'HH:mm')}</TableCell>
                            <TableCell className="text-right">{formatBRL(check.meta_do_dia)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{formatBRL(check.valor_bonus)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {activeTab === 'colaboradoras' && (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaboradora</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Total Checks</TableHead>
                        <TableHead className="text-right">Bonus Acumulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collaboratorSummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhum dado encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        collaboratorSummary.map(c => (
                          <TableRow key={c.id} data-testid={`row-collaborator-${c.id}`}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell>{c.store}</TableCell>
                            <TableCell className="text-right">{c.checks}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{formatBRL(c.bonus)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {activeTab === 'diario' && (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Checks</TableHead>
                        <TableHead className="text-right">Colaboradoras</TableHead>
                        <TableHead className="text-right">Bonus Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailySummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhum dado encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        dailySummary.map(d => (
                          <TableRow key={d.date} data-testid={`row-daily-${d.date}`}>
                            <TableCell className="font-medium">
                              {format(parseISO(d.date), "EEEE, dd/MM", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">{d.checks}</TableCell>
                            <TableCell className="text-right">{d.uniqueCollaborators}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{formatBRL(d.bonus)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyGoalCheckReports;
