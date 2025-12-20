import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AnalyticsMetrics } from "@/components/admin/whatsapp-campaigns";
import { useCampaignAnalyticsByCategory, useMostResponsiveCustomers, exportCampaignAnalyticsByCategory, exportToCSV } from "@/components/admin/whatsapp-campaigns/useAnalytics";
import { TrendingUp, Download, BarChart3, Users } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function WhatsAppAnalytics() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);

  // Buscar lojas do admin
  useEffect(() => {
    const fetchStores = async () => {
      if (!profile?.id) return;

      try {
        const { data, error } = await supabase
          .schema("sistemaretiradas")
          .from("stores")
          .select("id, name")
          .eq("admin_id", profile.id)
          .eq("active", true)
          .order("name");

        if (error) throw error;
        setStores(data || []);
      } catch (error: any) {
        console.error("Erro ao buscar lojas:", error);
      }
    };

    fetchStores();
  }, [profile?.id]);

  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  const { data: analyticsData, loading: loadingAnalytics } = useCampaignAnalyticsByCategory(
    selectedStoreId !== "all" ? selectedStoreId : undefined,
    selectedCategory !== "all" ? selectedCategory : undefined,
    startDateObj,
    endDateObj
  );

  const { data: responsiveCustomers, loading: loadingCustomers } = useMostResponsiveCustomers(
    selectedStoreId !== "all" ? selectedStoreId : undefined,
    selectedCategory !== "all" ? selectedCategory : undefined,
    50
  );

  const handleExportAnalytics = () => {
    if (analyticsData && analyticsData.length > 0) {
      exportCampaignAnalyticsByCategory(analyticsData, 'analytics_por_categoria');
    }
  };

  if (authLoading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Analytics de Campanhas WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Análise profunda do desempenho das campanhas e comportamento dos clientes
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Configure os filtros para visualizar as métricas desejadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="store">Loja</Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger id="store">
                  <SelectValue placeholder="Todas as lojas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  <SelectItem value="DESCONTO">Desconto</SelectItem>
                  <SelectItem value="PROMOCAO">Promoção</SelectItem>
                  <SelectItem value="CASHBACK">Cashback</SelectItem>
                  <SelectItem value="SAUDACAO">Saudação</SelectItem>
                  <SelectItem value="REATIVACAO">Reativação</SelectItem>
                  <SelectItem value="NOVIDADES">Novidades</SelectItem>
                  <SelectItem value="DATAS_COMEMORATIVAS">Datas Comemorativas</SelectItem>
                  <SelectItem value="ANIVERSARIO">Aniversário</SelectItem>
                  <SelectItem value="ABANDONO_CARRINHO">Abandono de Carrinho</SelectItem>
                  <SelectItem value="FIDELIDADE">Fidelidade</SelectItem>
                  <SelectItem value="PESQUISA">Pesquisa</SelectItem>
                  <SelectItem value="LEMBRETE">Lembrete</SelectItem>
                  <SelectItem value="EDUCACIONAL">Educacional</SelectItem>
                  <SelectItem value="SURVEY">Survey</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="SEGMENTACAO">Segmentação</SelectItem>
                  <SelectItem value="SAZONAL">Sazonal</SelectItem>
                  <SelectItem value="LANCAMENTO">Lançamento</SelectItem>
                  <SelectItem value="ESGOTANDO">Esgotando</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="customers">
            <Users className="h-4 w-4 mr-2" />
            Clientes Responsivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Métricas Agregadas</h2>
              {analyticsData && analyticsData.length > 0 && (
                <Button onClick={handleExportAnalytics} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              )}
            </div>
            <AnalyticsMetrics
              storeId={selectedStoreId !== "all" ? selectedStoreId : undefined}
              category={selectedCategory !== "all" ? selectedCategory : undefined}
              startDate={startDateObj}
              endDate={endDateObj}
            />
          </div>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Clientes Mais Responsivos</CardTitle>
                  <CardDescription>
                    Clientes que mais respondem às campanhas por categoria
                  </CardDescription>
                </div>
                {responsiveCustomers && responsiveCustomers.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Função de exportação para clientes responsivos
                      const headers = {
                        contact_id: 'ID do Contato',
                        contact_name: 'Nome',
                        contact_phone: 'Telefone',
                        category: 'Categoria',
                        campaigns_received: 'Campanhas Recebidas',
                        times_returned: 'Vezes que Retornou',
                        total_revenue_generated: 'Receita Total Gerada (R$)',
                        avg_days_to_return: 'Tempo Médio até Retorno (dias)',
                        responsiveness_score: 'Score de Responsividade (%)',
                      };
                      exportToCSV(responsiveCustomers, 'clientes_mais_responsivos', headers);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingCustomers ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : responsiveCustomers && responsiveCustomers.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {responsiveCustomers.map((customer) => (
                    <div
                      key={`${customer.contact_id}-${customer.category}`}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{customer.contact_name}</div>
                        <div className="text-sm text-muted-foreground">{customer.contact_phone}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{customer.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {customer.campaigns_received} campanha(s) recebida(s)
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-green-600">
                          {customer.responsiveness_score.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {customer.times_returned} retorno(s)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          R$ {Number(customer.total_revenue_generated).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {customer.avg_days_to_return.toFixed(1)} dias médios
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum cliente responsivo encontrado para os filtros selecionados
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

