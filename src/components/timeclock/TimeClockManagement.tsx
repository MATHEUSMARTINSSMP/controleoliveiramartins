/**
 * Componente modular para gestão completa de controle de ponto no Dash Loja/Admin
 * Aba em Gestão de Pessoas
 */

import { useState } from 'react';
import { useStoreData } from '@/hooks/useStoreData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkScheduleConfig } from './WorkScheduleConfig';
import { HoursBalanceManagement } from './HoursBalanceManagement';
import { Clock, Calendar, TrendingUp } from 'lucide-react';

interface TimeClockManagementProps {
  storeId?: string | null;
}

export function TimeClockManagement({ storeId: propStoreId }: TimeClockManagementProps) {
  const { storeId: contextStoreId } = useStoreData();
  const storeId = propStoreId || contextStoreId;

  if (!storeId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Selecione uma loja para gerenciar o controle de ponto
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="jornada" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="jornada" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Configurar Jornada</span>
            <span className="sm:hidden">Jornada</span>
          </TabsTrigger>
          <TabsTrigger value="banco-horas" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Banco de Horas</span>
            <span className="sm:hidden">Horas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jornada">
          <WorkScheduleConfig storeId={storeId} />
        </TabsContent>

        <TabsContent value="banco-horas">
          <HoursBalanceManagement storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

