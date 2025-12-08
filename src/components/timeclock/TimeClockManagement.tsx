/**
 * Componente modular para gestao completa de controle de ponto no Dash Loja/Admin
 * Aba em Gestao de Pessoas
 * Conformidade com CLT e Portaria 671/2021 (REP-P)
 */

import { useState, useEffect } from 'react';
import { useStoreData } from '@/hooks/useStoreData';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WorkScheduleConfig } from './WorkScheduleConfig';
import { HoursBalanceManagement } from './HoursBalanceManagement';
import { TimeClockChangeRequests } from './TimeClockChangeRequests';
import { TimeClockReports } from './TimeClockReports';
import { TimeClockNotifications } from './TimeClockNotifications';
import { Clock, Calendar, TrendingUp, FileEdit, BarChart3, AlertCircle, Bell } from 'lucide-react';

interface TimeClockManagementProps {
  storeId?: string | null;
  stores?: { id: string; name: string }[];
  showStoreSelector?: boolean;
}

export function TimeClockManagement({ storeId: propStoreId, stores, showStoreSelector = false }: TimeClockManagementProps) {
  const { storeId: contextStoreId } = useStoreData();
  const [selectedStoreId, setSelectedStoreId] = useState<string>(propStoreId || contextStoreId || '');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const storeId = selectedStoreId || propStoreId || contextStoreId;

  useEffect(() => {
    if (storeId) {
      fetchPendingRequestsCount();
    }
  }, [storeId]);

  const fetchPendingRequestsCount = async () => {
    if (!storeId) return;
    try {
      const { count, error } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_change_requests')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('status', 'PENDENTE');

      if (!error && count !== null) {
        setPendingRequestsCount(count);
      }
    } catch (err) {
      console.error('[TimeClockManagement] Erro ao buscar contagem:', err);
    }
  };

  if (!storeId && !showStoreSelector) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Selecione uma loja para gerenciar o controle de ponto
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showStoreSelector && stores && stores.length > 0 && (
        <div className="max-w-xs">
          <Label className="text-sm">Selecione a Loja</Label>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger data-testid="select-store-timeclock">
              <SelectValue placeholder="Selecione uma loja..." />
            </SelectTrigger>
            <SelectContent>
              {stores.map(store => (
                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {storeId ? (
        <Tabs defaultValue="jornada" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
            <TabsTrigger value="jornada" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] flex items-center justify-center gap-1" data-testid="tab-jornada">
              <Calendar className="h-3 w-3" />
              <span className="hidden sm:inline">Jornada</span>
            </TabsTrigger>
            <TabsTrigger value="banco-horas" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] flex items-center justify-center gap-1" data-testid="tab-banco-horas">
              <TrendingUp className="h-3 w-3" />
              <span className="hidden sm:inline">Banco</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] flex items-center justify-center gap-1" data-testid="tab-relatorios">
              <BarChart3 className="h-3 w-3" />
              <span className="hidden sm:inline">Relatorios</span>
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] flex items-center justify-center gap-1 relative" data-testid="tab-solicitacoes">
              <FileEdit className="h-3 w-3" />
              <span className="hidden sm:inline">Solicitacoes</span>
              {pendingRequestsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] animate-pulse"
                >
                  {pendingRequestsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] flex items-center justify-center gap-1" data-testid="tab-notificacoes">
              <Bell className="h-3 w-3" />
              <span className="hidden sm:inline">Notificacoes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jornada">
            <WorkScheduleConfig storeId={storeId} />
          </TabsContent>

          <TabsContent value="banco-horas">
            <HoursBalanceManagement storeId={storeId} />
          </TabsContent>

          <TabsContent value="relatorios">
            <TimeClockReports storeId={storeId} />
          </TabsContent>

          <TabsContent value="solicitacoes">
            <TimeClockChangeRequests 
              storeId={storeId} 
              isAdmin 
              onCountChange={fetchPendingRequestsCount}
            />
          </TabsContent>

          <TabsContent value="notificacoes">
            <TimeClockNotifications storeId={storeId} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Selecione uma loja para gerenciar o controle de ponto
        </div>
      )}
    </div>
  );
}
