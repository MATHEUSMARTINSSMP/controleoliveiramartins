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
  Settings,
  Send,
  Sparkles
} from "lucide-react";
import { WhatsAppStoreConfig } from "./WhatsAppStoreConfig";
import { WhatsAppNotificationConfig } from "./WhatsAppNotificationConfig";
import { StoreTaskAlertsManager } from "./StoreTaskAlertsManager";
import { WhatsAppCampaigns } from "./whatsapp-campaigns";

interface WhatsAppManagementProps {
  defaultTab?: string;
}

export function WhatsAppManagement({ defaultTab = "conexoes" }: WhatsAppManagementProps) {
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
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
          <TabsTrigger 
            value="conexoes" 
            className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] flex items-center justify-center gap-1"
            data-testid="tab-conexoes"
          >
            <Wifi className="h-3 w-3" />
            <span className="hidden sm:inline">Conexões</span>
            <span className="sm:hidden">Conexão</span>
          </TabsTrigger>
          <TabsTrigger 
            value="destinatarios" 
            className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] flex items-center justify-center gap-1"
            data-testid="tab-destinatarios"
          >
            <Users className="h-3 w-3" />
            <span className="hidden sm:inline">Destinatários</span>
            <span className="sm:hidden">Destino</span>
          </TabsTrigger>
          <TabsTrigger 
            value="alertas" 
            className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] flex items-center justify-center gap-1"
            data-testid="tab-alertas"
          >
            <Bell className="h-3 w-3" />
            Alertas
          </TabsTrigger>
{/* MÓDULO CAMPANHAS EM MASSA - TEMPORARIAMENTE DESABILITADO
          <TabsTrigger 
            value="campanhas" 
            className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[80px] flex items-center justify-center gap-1"
            data-testid="tab-campanhas"
          >
            <Send className="h-3 w-3" />
            <span className="hidden sm:inline">Campanhas</span>
            <span className="sm:hidden">Camp.</span>
            <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 hidden sm:inline">
              <Sparkles className="h-2 w-2 mr-0.5 inline" />
              IA
            </Badge>
          </TabsTrigger>
          */}
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

{/* MÓDULO CAMPANHAS EM MASSA - TEMPORARIAMENTE DESABILITADO
          <TabsContent value="campanhas" className="mt-0">
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <CardTitle className="text-lg sm:text-xl">Campanhas em Massa</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    IA
                  </Badge>
                </div>
                <CardDescription className="text-sm">
                  Crie campanhas inteligentes com filtros CRM, variações de mensagens geradas por IA, 
                  rotação de números e monitoramento de risco. Importe lista personalizada ou use filtros do CRM.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <WhatsAppCampaigns />
              </CardContent>
            </Card>
          </TabsContent>
          */}
        </div>
      </Tabs>
    </div>
  );
};

