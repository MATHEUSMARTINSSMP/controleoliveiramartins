import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DailyBalance {
  id: string;
  data: string;
  minutos_trabalhados: number;
  minutos_esperados: number;
  saldo_minutos: number;
  status: string;
}

interface HoursBalanceViewProps {
  storeId: string;
  colaboradoraId?: string;
  isAdmin?: boolean;
}

export function HoursBalanceView({ storeId, colaboradoraId, isAdmin = false }: HoursBalanceViewProps) {
  const [loading, setLoading] = useState(true);
  const [dailyBalances, setDailyBalances] = useState<DailyBalance[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [colaboradoras, setColaboradoras] = useState<{ id: string; name: string }[]>([]);
  const [selectedColaboradora, setSelectedColaboradora] = useState(colaboradoraId || '');

  useEffect(() => {
    if (isAdmin) {
      fetchColaboradoras();
    }
  }, [isAdmin, storeId]);

  useEffect(() => {
    if (selectedColaboradora || colaboradoraId) {
      fetchDailyBalances();
    }
  }, [currentMonth, selectedColaboradora, colaboradoraId]);

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
      if (data.length > 0 && !selectedColaboradora) {
        setSelectedColaboradora(data[0].id);
      }
    }
  };

  const fetchDailyBalances = async () => {
    setLoading(true);
    const colabId = colaboradoraId || selectedColaboradora;
    if (!colabId) {
      setLoading(false);
      return;
    }

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .schema('sistemaretiradas')
      .from('hours_daily_balances')
      .select('*')
      .eq('colaboradora_id', colabId)
      .eq('store_id', storeId)
      .gte('data', start)
      .lte('data', end)
      .order('data', { ascending: true });

    if (!error && data) {
      setDailyBalances(data as DailyBalance[]);
    }
    setLoading(false);
  };

  const formatMinutos = (minutos: number): string => {
    const abs = Math.abs(minutos);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const sinal = minutos >= 0 ? '+' : '-';
    return `${sinal}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatHorasMinutos = (minutos: number): string => {
    const abs = Math.abs(minutos);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const totalSaldo = dailyBalances.reduce((sum, d) => sum + d.saldo_minutos, 0);
  const totalTrabalhado = dailyBalances.reduce((sum, d) => sum + d.minutos_trabalhados, 0);
  const totalEsperado = dailyBalances.reduce((sum, d) => sum + d.minutos_esperados, 0);
  const diasTrabalhados = dailyBalances.filter(d => d.minutos_trabalhados > 0).length;

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Banco de Horas
              </CardTitle>
              <CardDescription>
                Acompanhamento de horas extras e devidas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth} data-testid="button-mes-anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[80px] sm:min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-proximo-mes">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && colaboradoras.length > 0 && (
            <Select value={selectedColaboradora} onValueChange={setSelectedColaboradora}>
              <SelectTrigger data-testid="select-colaboradora-banco-horas">
                <SelectValue placeholder="Selecione a colaboradora" />
              </SelectTrigger>
              <SelectContent>
                {colaboradoras.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Saldo do Mês</div>
              <div className={`text-lg font-bold ${totalSaldo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatMinutos(totalSaldo)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Dias Trabalhados</div>
              <div className="text-lg font-bold">{diasTrabalhados}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Horas Trabalhadas</div>
              <div className="text-lg font-bold">{formatHorasMinutos(totalTrabalhado)}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <div className="text-xs text-muted-foreground">Horas Esperadas</div>
              <div className="text-lg font-bold">{formatHorasMinutos(totalEsperado)}</div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dailyBalances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro de banco de horas neste mês
            </div>
          ) : (
            <div className="space-y-2">
              {dailyBalances.map((balance) => (
                <div 
                  key={balance.id} 
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`row-saldo-${balance.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">
                        {format(new Date(balance.data + 'T12:00:00'), 'EEEE, dd/MM', { locale: ptBR })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Trabalhou: {formatHorasMinutos(balance.minutos_trabalhados)} | 
                        Esperado: {formatHorasMinutos(balance.minutos_esperados)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {balance.saldo_minutos >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-600" />
                    )}
                    <Badge 
                      variant={balance.saldo_minutos >= 0 ? 'default' : 'destructive'}
                      className="font-mono"
                    >
                      {formatMinutos(balance.saldo_minutos)}
                    </Badge>
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
