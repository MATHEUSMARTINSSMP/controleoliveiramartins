import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, Users, ArrowLeft, BarChart, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageLoader } from "@/components/ui/page-loader";
import WhatsAppBulkSend from "@/pages/admin/WhatsAppBulkSend";
import WhatsAppCampaigns from "@/pages/admin/WhatsAppCampaigns";
import WhatsAppAnalytics from "@/pages/admin/WhatsAppAnalytics";

export default function Campanhas() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return <PageLoader />;
  }

  if (!profile || profile.role !== "ADMIN") {
    navigate("/");
    return null;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Campanhas WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Sistema completo de campanhas de envio em massa com filtros avançados, analytics e controle total
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="create">Criar Campanha</TabsTrigger>
          <TabsTrigger value="manage">Gerenciar Campanhas</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Campanhas WhatsApp
              </CardTitle>
              <CardDescription>
                Sistema completo de campanhas de envio em massa com filtros avançados, analytics e controle total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Filtros Avançados
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Clientes que compraram há X dias</li>
                    <li>Clientes que não compram desde data</li>
                    <li>Maior faturamento (top N ou todos)</li>
                    <li>Maior ticket médio</li>
                    <li>Maior número de visitas</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Recursos
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Múltiplas variações de mensagem</li>
                    <li>Placeholders automáticos</li>
                    <li>Agendamento de envios</li>
                    <li>Controle de horários</li>
                    <li>Rotação de números WhatsApp</li>
                    <li>Limites por contato e total</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <WhatsAppBulkSend />
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <WhatsAppCampaigns />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <WhatsAppAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
