import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Users, DollarSign, Clock, BarChart3, Target } from "lucide-react";
import { useCampaignAnalyticsByCategory, exportCampaignAnalyticsByCategory } from "./useAnalytics";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignCharts } from "./CampaignCharts";

interface AnalyticsMetricsProps {
  storeId?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}

export function AnalyticsMetrics({
  storeId,
  category,
  startDate,
  endDate,
}: AnalyticsMetricsProps) {
  const { data, loading, error, refetch } = useCampaignAnalyticsByCategory(
    storeId,
    category,
    startDate,
    endDate
  );

  const handleExport = () => {
    if (data && data.length > 0) {
      exportCampaignAnalyticsByCategory(data, 'analytics_por_categoria');
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Erro ao carregar métricas: {error}</p>
          <Button onClick={refetch} variant="outline" className="mt-4">
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Calcular totais agregados
  const totals = data.reduce((acc, item) => ({
    total_campaigns: acc.total_campaigns + item.total_campaigns,
    total_messages_sent: acc.total_messages_sent + item.total_messages_sent,
    total_recipients: acc.total_recipients + item.total_recipients,
    successful_messages: acc.successful_messages + item.successful_messages,
    failed_messages: acc.failed_messages + item.failed_messages,
    total_revenue: acc.total_revenue + Number(item.total_revenue_generated || 0),
    total_sales: acc.total_sales + item.total_sales_count,
  }), {
    total_campaigns: 0,
    total_messages_sent: 0,
    total_recipients: 0,
    successful_messages: 0,
    failed_messages: 0,
    total_revenue: 0,
    total_sales: 0,
  });

  const avgConversionRate = totals.total_recipients > 0
    ? ((totals.total_sales / totals.total_recipients) * 100).toFixed(2)
    : '0.00';

  const avgDaysToReturn = data.length > 0
    ? (data.reduce((sum, item) => sum + Number(item.avg_days_to_return || 0), 0) / data.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-4">
      {/* Métricas Agregadas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão Média</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {totals.total_sales} retornos de {totals.total_recipients} destinatários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio até Retorno</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDaysToReturn} dias</div>
            <p className="text-xs text-muted-foreground">
              Média entre todas as categorias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total Gerada</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totals.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.total_sales} vendas geradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.total_campaigns}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total_messages_sent} mensagens enviadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes por Categoria */}
      {data && data.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Métricas por Categoria</CardTitle>
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.map((item) => (
                <div
                  key={item.category}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {item.category || 'OUTROS'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {item.total_campaigns} campanha(s)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Target className="h-3 w-3" />
                        Conversão
                      </div>
                      <div className="text-lg font-semibold">
                        {(item.conversion_rate ?? 0).toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.total_sales_count} de {item.total_recipients}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        Tempo Médio
                      </div>
                      <div className="text-lg font-semibold">
                        {item.avg_days_to_return.toFixed(1)} dias
                      </div>
                      <div className="text-xs text-muted-foreground">
                        até retorno
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <DollarSign className="h-3 w-3" />
                        Receita
                      </div>
                      <div className="text-lg font-semibold">
                        R$ {Number(item.total_revenue_generated).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ticket médio: R$ {Number(item.avg_ticket_post_campaign).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <TrendingUp className="h-3 w-3" />
                        ROI
                      </div>
                      <div className="text-lg font-semibold">
                        {item.roi_percentage.toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.total_messages_sent} mensagens
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhum dado de analytics disponível para os filtros selecionados</p>
          </CardContent>
        </Card>
      )}

      {/* Gráficos de Performance */}
      {data && data.length > 0 && (
        <div className="mt-6">
          <CampaignCharts
            storeId={storeId}
            category={category}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      )}
    </div>
  );
}

