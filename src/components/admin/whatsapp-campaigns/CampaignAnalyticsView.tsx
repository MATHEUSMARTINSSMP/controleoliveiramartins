import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsMetrics } from "./AnalyticsMetrics";
import { CampaignRecommendations } from "./CampaignRecommendations";
import { useCampaignDetailedAnalytics, useCustomerReturnTracking, exportCustomerReturnTracking } from "./useAnalytics";
import { Download, Calendar, Filter, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignAnalyticsViewProps {
  campaignId: string | null;
  storeId?: string;
}

export function CampaignAnalyticsView({ campaignId, storeId }: CampaignAnalyticsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: campaignAnalytics, loading: loadingCampaign } = useCampaignDetailedAnalytics(campaignId);
  const { data: returnTracking, loading: loadingReturns } = useCustomerReturnTracking(campaignId);

  const handleExportReturns = () => {
    if (returnTracking && returnTracking.length > 0) {
      exportCustomerReturnTracking(returnTracking, `retorno_campanha_${campaignId}`);
    }
  };

  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle>Filtros de Analytics</CardTitle>
          </div>
          <CardDescription>
            Configure os filtros para visualizar as métricas desejadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
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

      {/* Analytics Gerais */}
      <AnalyticsMetrics
        storeId={storeId}
        category={selectedCategory !== 'all' ? selectedCategory : undefined}
        startDate={startDateObj}
        endDate={endDateObj}
      />

      {/* Analytics da Campanha Específica */}
      {campaignId && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="returns">Retorno de Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {loadingCampaign ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">Carregando...</div>
                </CardContent>
              </Card>
            ) : campaignAnalytics ? (
              <Card>
                <CardHeader>
                  <CardTitle>Analytics Detalhados da Campanha</CardTitle>
                  <CardDescription>{campaignAnalytics.campaign_name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Métricas Principais */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Taxa de Conversão</div>
                      <div className="text-2xl font-bold">{(campaignAnalytics.conversion_rate ?? 0).toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {campaignAnalytics.customers_who_returned} de {campaignAnalytics.unique_customers_reached}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Tempo Médio</div>
                      <div className="text-2xl font-bold">{campaignAnalytics.avg_days_to_return.toFixed(1)} dias</div>
                      <div className="text-xs text-muted-foreground mt-1">até retorno</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">ROI (30 dias)</div>
                      <div className="text-2xl font-bold">{campaignAnalytics.roi_30_days.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        R$ {Number(campaignAnalytics.total_revenue_30_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">ROI (90 dias)</div>
                      <div className="text-2xl font-bold">{campaignAnalytics.roi_90_days.toFixed(2)}%</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        R$ {Number(campaignAnalytics.total_revenue_90_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Receita por Período */}
                  <div>
                    <h3 className="font-semibold mb-3">Receita Gerada por Período</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 border rounded">
                        <div className="text-xs text-muted-foreground">30 dias</div>
                        <div className="text-lg font-semibold">
                          R$ {Number(campaignAnalytics.total_revenue_30_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {campaignAnalytics.total_sales_30_days} vendas • Ticket: R$ {Number(campaignAnalytics.avg_ticket_30_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="text-xs text-muted-foreground">60 dias</div>
                        <div className="text-lg font-semibold">
                          R$ {Number(campaignAnalytics.total_revenue_60_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {campaignAnalytics.total_sales_60_days} vendas • Ticket: R$ {Number(campaignAnalytics.avg_ticket_60_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="p-3 border rounded">
                        <div className="text-xs text-muted-foreground">90 dias</div>
                        <div className="text-lg font-semibold">
                          R$ {Number(campaignAnalytics.total_revenue_90_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {campaignAnalytics.total_sales_90_days} vendas • Ticket: R$ {Number(campaignAnalytics.avg_ticket_90_days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum dado disponível para esta campanha
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="returns">
            {loadingReturns ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">Carregando...</div>
                </CardContent>
              </Card>
            ) : returnTracking && returnTracking.length > 0 ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Retorno de Clientes</CardTitle>
                      <CardDescription>
                        {returnTracking.filter(r => r.returned).length} de {returnTracking.length} clientes retornaram
                      </CardDescription>
                    </div>
                    <Button onClick={handleExportReturns} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {returnTracking.map((tracking) => (
                      <div
                        key={tracking.contact_id}
                        className="p-3 border rounded-lg flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{tracking.contact_name}</div>
                          <div className="text-sm text-muted-foreground">{tracking.contact_phone}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Mensagem enviada: {format(new Date(tracking.message_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                        <div className="text-right">
                          {tracking.returned ? (
                            <>
                              <div className="text-sm font-semibold text-green-600">
                                Retornou em {tracking.days_to_return} dias
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {tracking.total_sales_count} venda(s) • R$ {Number(tracking.total_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                              {tracking.first_sale_after_message && (
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(tracking.first_sale_after_message), "dd/MM/yyyy", { locale: ptBR })}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">Ainda não retornou</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum dado de retorno disponível
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            <CampaignRecommendations
              storeId={storeId}
              showBulkMode={true}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

