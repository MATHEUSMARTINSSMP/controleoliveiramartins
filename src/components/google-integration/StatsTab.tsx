import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, BarChart3 } from "lucide-react";
import { StatsCards } from "./StatsCards";
import { RatingDistributionChart } from "./RatingDistributionChart";
import { ReviewsTimeSeriesChart } from "./ReviewsTimeSeriesChart";
import { RatingEvolutionChart } from "./RatingEvolutionChart";
import { StatsExportButton } from "./StatsExportButton";
import type { GoogleReview } from "@/hooks/use-google-reviews";

interface StatsTabProps {
  stats: {
    totalReviews: number;
    averageRating: number;
    ratingDistribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    responseRate: number;
    repliedReviews: number;
    period: string;
  } | null;
  statsPeriod: string;
  setStatsPeriod: (period: string) => void;
  loading: boolean;
  reviews: GoogleReview[];
  onRefresh: () => void;
  onPeriodChange: (period: string) => void;
}

export function StatsTab({
  stats,
  statsPeriod,
  setStatsPeriod,
  loading,
  reviews,
  onRefresh,
  onPeriodChange,
}: StatsTabProps) {
  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {loading ? "Carregando estatísticas..." : "Nenhuma estatística disponível"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Estatísticas de Reviews</h3>
          <p className="text-sm text-muted-foreground">
            Análise de performance das suas avaliações
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statsPeriod}
            onChange={(e) => {
              const period = e.target.value;
              setStatsPeriod(period);
              onPeriodChange(period);
            }}
            className="px-3 py-1.5 text-sm border rounded-md"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="1y">Último ano</option>
          </select>
          <StatsExportButton stats={stats} reviews={reviews} period={statsPeriod} />
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <StatsCards
        totalReviews={stats.totalReviews}
        averageRating={stats.averageRating}
        responseRate={stats.responseRate}
        repliedReviews={stats.repliedReviews}
        period={stats.period}
      />

      <RatingDistributionChart
        ratingDistribution={stats.ratingDistribution}
        totalReviews={stats.totalReviews}
      />

      <ReviewsTimeSeriesChart
        reviews={reviews}
        period={statsPeriod as "7d" | "30d" | "90d" | "1y"}
      />

      <RatingEvolutionChart
        reviews={reviews}
        period={statsPeriod as "7d" | "30d" | "90d" | "1y"}
      />
    </div>
  );
}

