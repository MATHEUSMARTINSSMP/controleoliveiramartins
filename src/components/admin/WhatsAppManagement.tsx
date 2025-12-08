import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Wifi, 
  Users, 
  Bell,
  Phone,
  Settings
} from "lucide-react";
import { WhatsAppStoreConfig } from "./WhatsAppStoreConfig";
import { WhatsAppNotificationConfig } from "./WhatsAppNotificationConfig";
import { StoreTaskAlertsManager } from "./StoreTaskAlertsManager";

interface WhatsAppManagementProps {
  defaultTab?: string;
}

export const WhatsAppManagement = ({ defaultTab = "conexoes" }: WhatsAppManagementProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
          Central WhatsApp
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Gerencie conexões, destinatários e alertas de tarefas via WhatsApp
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto">
          <TabsTrigger 
            value="conexoes" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            data-testid="tab-conexoes"
          >
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Conexões</span>
            <span className="sm:hidden">Conexão</span>
          </TabsTrigger>
          <TabsTrigger 
            value="destinatarios" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            data-testid="tab-destinatarios"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Destinatários</span>
            <span className="sm:hidden">Destino</span>
          </TabsTrigger>
          <TabsTrigger 
            value="alertas" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            data-testid="tab-alertas"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
            <span className="sm:hidden">Alertas</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="conexoes" className="mt-0">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <div className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-lg sm:text-xl">Conexões WhatsApp</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  Gerencie a conexão WhatsApp de cada loja. Lojas podem usar número próprio (planos Business/Enterprise) ou o número global da Elevea.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <WhatsAppStoreConfig />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="destinatarios" className="mt-0">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <CardTitle className="text-lg sm:text-xl">Destinatários de Notificações</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  Configure quais números recebem notificações de vendas, adiantamentos e parabéns para cada loja.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <WhatsAppNotificationConfig />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alertas" className="mt-0">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <CardTitle className="text-lg sm:text-xl">Alertas de Tarefas</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  Crie tarefas programadas para lembrar a equipe de atividades importantes (ex: espirrar aromatizador, varrer provador).
                  Limite de 10 mensagens por dia por loja.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <StoreTaskAlertsManager />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default WhatsAppManagement;
