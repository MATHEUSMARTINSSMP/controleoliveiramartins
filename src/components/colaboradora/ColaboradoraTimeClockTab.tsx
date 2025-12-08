/**
 * Componente modularizado para aba de Ponto no Dashboard da Colaboradora
 * Exibe historico, relatorios e banco de horas
 */

import { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, TrendingUp, Loader2 } from 'lucide-react';

const TimeClockHistory = lazy(() => 
  import('@/components/timeclock/TimeClockHistory').then(m => ({ default: m.TimeClockHistory }))
);
const TimeClockHoursBalance = lazy(() => 
  import('@/components/timeclock/TimeClockHoursBalance').then(m => ({ default: m.TimeClockHoursBalance }))
);
const TimeClockReports = lazy(() => 
  import('@/components/timeclock/TimeClockReports').then(m => ({ default: m.TimeClockReports }))
);

interface ColaboradoraTimeClockTabProps {
  storeId: string;
  colaboradoraId: string;
}

export function ColaboradoraTimeClockTab({ storeId, colaboradoraId }: ColaboradoraTimeClockTabProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <Tabs defaultValue="historico" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="historico" className="text-xs" data-testid="tab-ponto-historico">
            <Clock className="h-3 w-3 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Historico</span>
            <span className="sm:hidden">Hist.</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="text-xs" data-testid="tab-ponto-relatorios">
            <Calendar className="h-3 w-3 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Relatorios</span>
            <span className="sm:hidden">Rel.</span>
          </TabsTrigger>
          <TabsTrigger value="banco-horas" className="text-xs" data-testid="tab-ponto-banco">
            <TrendingUp className="h-3 w-3 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Banco de Horas</span>
            <span className="sm:hidden">Banco</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historico">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historico de Ponto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <TimeClockHistory 
                storeId={storeId} 
                colaboradoraId={colaboradoraId} 
                showOnlyToday={false} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios">
          <TimeClockReports 
            storeId={storeId} 
            colaboradoraId={colaboradoraId} 
            showColaboradoraSelector={false} 
          />
        </TabsContent>

        <TabsContent value="banco-horas">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Meu Banco de Horas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <TimeClockHoursBalance 
                storeId={storeId} 
                colaboradoraId={colaboradoraId} 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Suspense>
  );
}
