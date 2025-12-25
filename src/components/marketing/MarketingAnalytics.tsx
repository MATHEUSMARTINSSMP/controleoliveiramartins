import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, DollarSign, Image as ImageIcon, Video, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getStoreIdFromProfile } from "@/lib/storeLogo";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UsageData {
  period: string;
  image_count: number;
  video_count: number;
  total_count: number;
  image_cost: number;
  video_cost: number;
  total_cost: number;
}

interface QuotaInfo {
  daily_limit: number;
  monthly_limit: number;
  daily_used: number;
  monthly_used: number;
  daily_remaining: number;
  monthly_remaining: number;
}

/**
 * Componente de Analytics para o módulo de marketing
 */
export function MarketingAnalytics() {
  const { profile } = useAuth();
  const storeId = profile ? getStoreIdFromProfile(profile) : null;
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeId) {
      loadAnalytics();
    }
  }, [storeId, period]);

  const loadAnalytics = async () => {
    if (!storeId) return;

    try {
      setLoading(true);

      // Calcular período
      let startDate: Date;
      let endDate = new Date();

      switch (period) {
        case "daily":
          startDate = startOfDay(subDays(endDate, 0));
          endDate = endOfDay(endDate);
          break;
        case "weekly":
          startDate = startOfDay(subDays(endDate, 7));
          break;
        case "monthly":
          startDate = startOfMonth(endDate);
          endDate = endOfMonth(endDate);
          break;
      }

      // Buscar dados de uso
      const { data: usageRecords, error: usageError } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_usage")
        .select("*")
        .eq("store_id", storeId)
        .gte("period_start", startDate.toISOString())
        .lte("period_start", endDate.toISOString())
        .order("period_start", { ascending: true });

      if (usageError) throw usageError;

      // Processar dados
      const processed: UsageData[] = [];
      const periodMap = new Map<string, UsageData>();

      usageRecords?.forEach((record) => {
        const key = format(new Date(record.period_start), "yyyy-MM-dd");
        if (!periodMap.has(key)) {
          periodMap.set(key, {
            period: key,
            image_count: 0,
            video_count: 0,
            total_count: 0,
            image_cost: 0,
            video_cost: 0,
            total_cost: 0,
          });
        }

        const data = periodMap.get(key)!;
        if (record.type === "image") {
          data.image_count += record.count || 0;
          data.image_cost += parseFloat(record.cost_estimate?.toString() || "0");
        } else if (record.type === "video") {
          data.video_count += record.count || 0;
          data.video_cost += parseFloat(record.cost_estimate?.toString() || "0");
        }
        data.total_count = data.image_count + data.video_count;
        data.total_cost = data.image_cost + data.video_cost;
      });

      setUsageData(Array.from(periodMap.values()));

      // Buscar quota atual
      const today = startOfDay(new Date());
      const monthStart = startOfMonth(new Date());

      const { data: dailyUsage } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_usage")
        .select("count, cost_estimate, type")
        .eq("store_id", profile.store_id)
        .eq("period_type", "daily")
        .gte("period_start", today.toISOString())
        .lte("period_start", endOfDay(today).toISOString());

      const { data: monthlyUsage } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_usage")
        .select("count, cost_estimate, type")
        .eq("store_id", profile.store_id)
        .eq("period_type", "monthly")
        .gte("period_start", monthStart.toISOString())
        .lte("period_start", endOfMonth(monthStart).toISOString());

      const dailyUsed = dailyUsage?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;
      const monthlyUsed = monthlyUsage?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;

      // Valores padrão de quota (pode vir de configuração da loja)
      const dailyLimit = 100;
      const monthlyLimit = 2000;

      setQuotaInfo({
        daily_limit: dailyLimit,
        monthly_limit: monthlyLimit,
        daily_used: dailyUsed,
        monthly_used: monthlyUsed,
        daily_remaining: Math.max(0, dailyLimit - dailyUsed),
        monthly_remaining: Math.max(0, monthlyLimit - monthlyUsed),
      });
    } catch (error: any) {
      console.error("Erro ao carregar analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular totais
  const totals = usageData.reduce(
    (acc, data) => ({
      images: acc.images + data.image_count,
      videos: acc.videos + data.video_count,
      total: acc.total + data.total_count,
      cost: acc.cost + data.total_cost,
    }),
    { images: 0, videos: 0, total: 0, cost: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header com seletor de período */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics de Uso
              </CardTitle>
              <CardDescription>
                Acompanhe seu uso de IA e custos estimados
              </CardDescription>
            </div>
            <Select value={period} onValueChange={(value: "daily" | "weekly" | "monthly") => setPeriod(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Hoje</SelectItem>
                <SelectItem value="weekly">Últimos 7 dias</SelectItem>
                <SelectItem value="monthly">Este mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>Carregando analytics...</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total de Imagens */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Imagens Geradas</p>
                      <p className="text-2xl font-bold">{totals.images}</p>
                    </div>
                    <ImageIcon className="h-8 w-8 text-blue-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              {/* Total de Vídeos */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Vídeos Gerados</p>
                      <p className="text-2xl font-bold">{totals.videos}</p>
                    </div>
                    <Video className="h-8 w-8 text-purple-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              {/* Total Geral */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Gerado</p>
                      <p className="text-2xl font-bold">{totals.total}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              {/* Custo Total */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Custo Estimado</p>
                      <p className="text-2xl font-bold">${totals.cost.toFixed(2)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-yellow-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotas */}
      {quotaInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Quotas e Limites</CardTitle>
            <CardDescription>Seu uso atual e limites disponíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Quota Diária */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Quota Diária</span>
                  <span className="font-medium">
                    {quotaInfo.daily_used} / {quotaInfo.daily_limit}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (quotaInfo.daily_used / quotaInfo.daily_limit) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {quotaInfo.daily_remaining} restantes hoje
                </p>
              </div>

              {/* Quota Mensal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Quota Mensal</span>
                  <span className="font-medium">
                    {quotaInfo.monthly_used} / {quotaInfo.monthly_limit}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (quotaInfo.monthly_used / quotaInfo.monthly_limit) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {quotaInfo.monthly_remaining} restantes este mês
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Uso ao Longo do Tempo */}
      {usageData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uso ao Longo do Tempo</CardTitle>
            <CardDescription>
              Visualização do uso de IA por período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usageData.map((data) => (
                <div key={data.period} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {format(new Date(data.period), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-muted-foreground">
                      {data.total_count} itens • ${data.total_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {data.image_count > 0 && (
                      <div
                        className="h-4 bg-blue-500 rounded"
                        style={{
                          width: `${(data.image_count / data.total_count) * 100}%`,
                        }}
                        title={`${data.image_count} imagens`}
                      />
                    )}
                    {data.video_count > 0 && (
                      <div
                        className="h-4 bg-purple-500 rounded"
                        style={{
                          width: `${(data.video_count / data.total_count) * 100}%`,
                        }}
                        title={`${data.video_count} vídeos`}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && usageData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dado de uso encontrado para este período</p>
            <p className="text-sm mt-2">Comece gerando conteúdo para ver suas estatísticas</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

