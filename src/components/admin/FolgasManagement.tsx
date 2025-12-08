/**
 * Componente modular para gestão de folgas de colaboradoras
 * Permite marcar/desmarcar folgas e redistribuir metas automaticamente
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStoreData } from '@/hooks/useStoreData';
import { useFolgas } from '@/hooks/useFolgas';
import { useGoalRedistribution } from '@/hooks/useGoalRedistribution';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Calendar, Users, RefreshCw } from 'lucide-react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Colaboradora {
  id: string;
  name: string;
}

interface FolgasManagementProps {
  storeId?: string | null;
}

export function FolgasManagement({ storeId: propStoreId }: FolgasManagementProps) {
  const { storeId: contextStoreId } = useStoreData();
  const storeId = propStoreId || contextStoreId;

  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [loadingColaboradoras, setLoadingColaboradoras] = useState(false);

  const { offDays, loading: loadingFolgas, fetchFolgas, toggleFolga, isOnLeave, refetch } = useFolgas({
    storeId,
    date: selectedDate,
  });

  const { redistributeGoalsForDate } = useGoalRedistribution({ storeId });

  useEffect(() => {
    if (storeId) {
      fetchColaboradoras();
      fetchFolgas(selectedDate);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId && selectedDate) {
      fetchFolgas(selectedDate);
    }
  }, [selectedDate, storeId, fetchFolgas]);

  const fetchColaboradoras = async () => {
    if (!storeId) return;

    try {
      setLoadingColaboradoras(true);
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
      console.error('[FolgasManagement] Erro ao buscar colaboradoras:', err);
      toast.error('Erro ao carregar colaboradoras');
    } finally {
      setLoadingColaboradoras(false);
    }
  };

  const handleToggleFolga = async (colaboradoraId: string, dataFolga: string) => {
    if (!storeId) {
      toast.error('Loja não identificada');
      return;
    }

    try {
      setLoading(true);

      const success = await toggleFolga(colaboradoraId, dataFolga);
      
      if (success) {
        await redistributeGoalsForDate(dataFolga);
        await refetch();
      }
    } catch (error: any) {
      console.error('[FolgasManagement] Erro ao alterar folga:', error);
      toast.error('Erro ao alterar folga: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const date = new Date(selectedDate);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getFolgasCountForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return offDays.filter(f => f.off_date === dayStr).length;
  };

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma loja para gerenciar folgas
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gestão de Folgas
          </CardTitle>
          <CardDescription>
            Marque ou desmarque folgas de colaboradoras e redistribua metas automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data-folga">Data</Label>
              <Input
                id="data-folga"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="max-w-xs"
              />
            </div>

            {loadingColaboradoras ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : colaboradoras.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma colaboradora encontrada
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaboradora</TableHead>
                        <TableHead className="text-center">Folga</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {colaboradoras.map((colab) => {
                        const isFolga = isOnLeave(colab.id, selectedDate);
                        return (
                          <TableRow key={colab.id}>
                            <TableCell className="font-medium">{colab.name}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isFolga}
                                onCheckedChange={() => handleToggleFolga(colab.id, selectedDate)}
                                disabled={loading || loadingFolgas}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant={isFolga ? 'destructive' : 'default'}>
                                {isFolga ? 'De Folga' : 'Trabalhando'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {offDays.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">
                        {offDays.length} colaboradora(s) de folga em {format(new Date(selectedDate), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold mb-1">Redistribuição Automática</p>
                      <p className="text-xs text-muted-foreground">
                        Ao marcar ou desmarcar uma folga, as metas do dia são automaticamente redistribuídas entre as colaboradoras que não estão de folga.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calendário do mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendário do Mês</CardTitle>
          <CardDescription>
            Visualize as folgas do mês selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {getDaysInMonth().map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isToday = isSameDay(day, new Date());
              const isSelected = dayStr === selectedDate;
              const folgasCount = getFolgasCountForDay(day);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <div
                  key={dayStr}
                  className={`
                    aspect-square p-2 rounded-lg border text-center cursor-pointer transition-colors
                    ${isSelected ? 'bg-primary text-primary-foreground border-primary' : ''}
                    ${isToday && !isSelected ? 'border-primary/50 bg-primary/5' : ''}
                    ${!isSelected && !isToday ? 'hover:bg-muted' : ''}
                    ${isWeekend ? 'opacity-60' : ''}
                  `}
                  onClick={() => setSelectedDate(dayStr)}
                >
                  <div className="text-xs font-medium">{format(day, 'd')}</div>
                  {folgasCount > 0 && (
                    <div className="mt-1">
                      <Badge variant="destructive" className="text-xs h-4 px-1">
                        {folgasCount}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

