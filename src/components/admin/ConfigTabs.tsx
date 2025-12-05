import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, MessageSquare, Settings, Bell } from "lucide-react";
import { ModulesStoreConfig } from "./ModulesStoreConfig";
import { WhatsAppStoreConfig } from "./WhatsAppStoreConfig";
import { WhatsAppNotificationConfig } from "./WhatsAppNotificationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

export const ConfigTabs = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie módulos, WhatsApp e integrações do sistema de forma organizada e intuitiva.
        </p>
      </div>

      <Tabs defaultValue="modulos" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 h-auto p-1 bg-muted/50">
          <TabsTrigger 
            value="modulos" 
            className="flex items-center gap-2 justify-center py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <Package className="h-4 w-4" />
            <span>Módulos</span>
          </TabsTrigger>
          <TabsTrigger 
            value="whatsapp" 
            className="flex items-center gap-2 justify-center py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger 
            value="integracao" 
            className="flex items-center gap-2 justify-center py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
          >
            <Settings className="h-4 w-4" />
            <span>Integrações</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Módulos */}
        <TabsContent value="modulos" className="space-y-6 mt-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                Módulos do Sistema
              </CardTitle>
              <CardDescription>
                Ative ou desative os módulos disponíveis para cada loja. Cada módulo oferece funcionalidades específicas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModulesStoreConfig />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: WhatsApp */}
        <TabsContent value="whatsapp" className="space-y-6 mt-6">
          {/* Seção: Conexão WhatsApp */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                Conexão WhatsApp
              </CardTitle>
              <CardDescription>
                Configure o WhatsApp para cada loja através do QR Code. Cada loja pode ter seu próprio número WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WhatsAppStoreConfig />
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Seção: Notificações WhatsApp */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Notificações WhatsApp
              </CardTitle>
              <CardDescription>
                Configure destinatários e tipos de notificações que serão enviadas via WhatsApp (Vendas, Adiantamentos, Parabéns).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WhatsAppNotificationConfig />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Integrações */}
        <TabsContent value="integracao" className="space-y-6 mt-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Integrações ERP
              </CardTitle>
              <CardDescription>
                Configure integrações ERP por loja (Tiny, Bling, Microvix, Conta Azul, etc). As vendas são sincronizadas automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
                <p className="text-sm text-muted-foreground mb-4">
                  Acesse a página dedicada de integrações para configurar e gerenciar todas as conexões ERP de suas lojas de forma completa.
                </p>
                <Button
                  onClick={() => navigate("/admin/erp-integrations")}
                  className="gap-2"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Página de Integrações ERP
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

