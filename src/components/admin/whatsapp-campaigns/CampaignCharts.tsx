/**
 * @fileoverview Componente de gráficos para analytics de campanhas WhatsApp
 * @module whatsapp-campaigns/CampaignCharts
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { useCampaignAnalyticsByCategory } from "./useAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface CampaignChartsProps {
  storeId?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff', '#00ffff', '#ff0080'];

/**
 * Componente para exibir gráficos de performance de campanhas por categoria
 * Inclui: Taxa de conversão, Tempo médio de retorno, Receita gerada, ROI e Distribuição
 */
export function CampaignCharts({
  storeId,
  category,
  startDate,
  endDate,
}: CampaignChartsProps) {
  const { data, loading, error } = useCampaignAnalyticsByCategory(
    storeId,
    category,
    startDate,
    endDate
  );

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return null;
  }

  // Preparar dados para gráficos
  const conversionRateData = data.map(item => ({
    category: item.category || 'OUTROS',
    conversion: Number(item.conversion_rate || 0),
    recipients: item.total_recipients,
  }));

  const returnTimeData = data.map(item => ({
    category: item.category || 'OUTROS',
    avgDays: Number(item.avg_days_to_return || 0),
    campaigns: item.total_campaigns,
  }));

  const revenueData = data.map(item => ({
    category: item.category || 'OUTROS',
    revenue: Number(item.total_revenue_generated || 0),
    roi: Number(item.roi_percentage || 0),
  }));

  const roiComparisonData = data.map(item => ({
    category: item.category || 'OUTROS',
    roi: Number(item.roi_percentage || 0),
    revenue: Number(item.total_revenue_generated || 0),
  }));

  // Configurações de gráficos
  const conversionConfig: ChartConfig = {
    category: {
      label: "Categoria",
    },
    conversion: {
      label: "Taxa de Conversão (%)",
      color: "hsl(var(--chart-1))",
    },
  };

  const returnTimeConfig: ChartConfig = {
    category: {
      label: "Categoria",
    },
    avgDays: {
      label: "Dias até Retorno",
      color: "hsl(var(--chart-2))",
    },
  };

  const revenueConfig: ChartConfig = {
    category: {
      label: "Categoria",
    },
    revenue: {
      label: "Receita (R$)",
      color: "hsl(var(--chart-3))",
    },
  };

  const roiConfig: ChartConfig = {
    category: {
      label: "Categoria",
    },
    roi: {
      label: "ROI (%)",
      color: "hsl(var(--chart-4))",
    },
  };

  return (
    <div className="space-y-6">
      {/* Taxa de Conversão por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Conversão por Categoria</CardTitle>
          <CardDescription>
            Comparação da taxa de conversão entre diferentes categorias de campanha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={conversionConfig} className="h-[350px]">
            <BarChart data={conversionRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'Taxa de Conversão (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                labelFormatter={(label) => `Categoria: ${label}`}
              />
              <Legend />
              <Bar dataKey="conversion" fill="hsl(var(--chart-1))" name="Taxa de Conversão (%)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Tempo Médio até Retorno */}
      <Card>
        <CardHeader>
          <CardTitle>Tempo Médio até Retorno por Categoria</CardTitle>
          <CardDescription>
            Quantos dias em média os clientes demoram para retornar após receberem mensagens de cada categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={returnTimeConfig} className="h-[350px]">
            <BarChart data={returnTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'Dias', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: any) => `${Number(value).toFixed(1)} dias`}
                labelFormatter={(label) => `Categoria: ${label}`}
              />
              <Legend />
              <Bar dataKey="avgDays" fill="hsl(var(--chart-2))" name="Dias até Retorno" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Receita Gerada por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Receita Gerada por Categoria</CardTitle>
          <CardDescription>
            Total de receita gerada por cada categoria de campanha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={revenueConfig} className="h-[350px]">
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'Receita (R$)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: any) => formatCurrency(Number(value))}
                labelFormatter={(label) => `Categoria: ${label}`}
              />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--chart-3))" name="Receita (R$)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Comparação de ROI por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>ROI por Categoria</CardTitle>
          <CardDescription>
            Comparação do retorno sobre investimento (ROI) entre diferentes categorias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={roiConfig} className="h-[350px]">
            <BarChart data={roiComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'ROI (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                labelFormatter={(label) => `Categoria: ${label}`}
              />
              <Legend />
              <Bar dataKey="roi" fill="hsl(var(--chart-4))" name="ROI (%)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Distribuição de Campanhas por Categoria (Pizza) */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Campanhas por Categoria</CardTitle>
          <CardDescription>
            Proporção de campanhas criadas em cada categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={conversionConfig} className="h-[350px]">
            <PieChart>
              <Pie
                data={data.map(item => ({
                  name: item.category || 'OUTROS',
                  value: item.total_campaigns,
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
