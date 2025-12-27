/**
 * Componente de Configuração de Tarefas do Dia no Admin Dashboard
 * Inclui tabs para Configuração (tarefas recorrentes) e Histórico (execuções)
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, History } from "lucide-react";
import { AdminTasksCalendarView } from "./AdminTasksCalendarView";
import { AdminTasksHistoryView } from "./AdminTasksHistoryView";

export function AdminDailyTasksConfig() {
    const [activeTab, setActiveTab] = useState("config");

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="config" className="flex items-center gap-2" data-testid="tab-tasks-config">
                        <Settings className="h-4 w-4" />
                        Configuração
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-tasks-history">
                        <History className="h-4 w-4" />
                        Histórico
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="mt-4">
                    <AdminTasksCalendarView />
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <AdminTasksHistoryView />
                </TabsContent>
            </Tabs>
        </div>
    );
}
