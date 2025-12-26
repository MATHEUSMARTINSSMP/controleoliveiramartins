import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageSquare, Globe, Instagram, ArrowLeft, BarChart3 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLoader } from "@/components/ui/page-loader";
import WhatsAppBulkSend from "@/pages/admin/WhatsAppBulkSend";
import WhatsAppCampaigns from "@/pages/admin/WhatsAppCampaigns";
import WhatsAppAnalytics from "@/pages/admin/WhatsAppAnalytics";
import SiteBuilder from "@/pages/admin/SiteBuilder";
import SocialMediaMarketing from "@/pages/admin/SocialMediaMarketing";
import GoogleIntegration from "@/pages/admin/GoogleIntegration";

export default function GestaoMarketing() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Determinar aba padrão baseado no parâmetro da URL (ex: ?gmb=ok abre aba google)
  const defaultTab = searchParams.get("gmb") ? "google" : "whatsapp";
  const [activeTab, setActiveTab] = useState(defaultTab);

  if (authLoading) {
    return <PageLoader />;
  }

  if (!profile || profile.role !== "ADMIN") {
    navigate("/");
    return null;
  }

  // Atualizar aba ativa quando o parâmetro gmb estiver presente
  useEffect(() => {
    if (searchParams.get("gmb")) {
      setActiveTab("google");
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Gestão de Marketing</h1>
          <p className="text-muted-foreground">
            Gerencie campanhas WhatsApp, seu site e conteúdos para redes sociais
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Campanhas WhatsApp
          </TabsTrigger>
          <TabsTrigger value="site" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Gestão de Site
          </TabsTrigger>
          <TabsTrigger value="redes-sociais" className="flex items-center gap-2">
            <Instagram className="h-4 w-4" />
            Gestão de Redes Sociais
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Google
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Campanhas WhatsApp */}
        <TabsContent value="whatsapp" className="space-y-4">
          <CampanhasWhatsAppContent />
        </TabsContent>

        {/* Tab 2: Gestão de Site */}
        <TabsContent value="site" className="space-y-4">
          <SiteBuilder embedded />
        </TabsContent>

        {/* Tab 3: Gestão de Redes Sociais */}
        <TabsContent value="redes-sociais" className="space-y-4">
          <SocialMediaMarketing embedded />
        </TabsContent>

        {/* Tab 4: Google My Business */}
        <TabsContent value="google" className="space-y-4">
          <GoogleIntegration embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Componente interno com as tabs de Campanhas WhatsApp (conteúdo original)
 */
function CampanhasWhatsAppContent() {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "create" | "manage" | "analytics">("overview");

  const handleCampaignCreated = () => {
    // Quando uma campanha é criada, mudar para aba de gerenciar
    setActiveSubTab("manage");
  };

  const handleNavigateToCreate = () => {
    // Quando o usuário quer criar uma campanha, mudar para aba de criar
    setActiveSubTab("create");
  };

  return (
    <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        <TabsTrigger value="create">Criar Campanha</TabsTrigger>
        <TabsTrigger value="manage">Gerenciar Campanhas</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Campanhas WhatsApp</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Sistema completo de campanhas de envio em massa com filtros avançados, analytics e controle total
            </p>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold">Filtros Avançados</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Clientes que compraram há X dias</li>
                  <li>Clientes que não compram desde data</li>
                  <li>Maior faturamento (top N ou todos)</li>
                  <li>Maior ticket médio</li>
                  <li>Maior número de visitas</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Recursos</h4>
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
          </div>
        </div>
      </TabsContent>

      <TabsContent value="create" className="space-y-4">
        <WhatsAppBulkSend embedded onCampaignCreated={handleCampaignCreated} />
      </TabsContent>

      <TabsContent value="manage" className="space-y-4">
        <WhatsAppCampaigns 
          embedded 
          onNavigateToCreate={handleNavigateToCreate}
        />
      </TabsContent>

      <TabsContent value="analytics" className="space-y-4">
        <WhatsAppAnalytics embedded />
      </TabsContent>
    </Tabs>
  );
}