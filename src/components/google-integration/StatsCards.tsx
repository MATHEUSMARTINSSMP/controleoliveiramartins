import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

interface StatsCardsProps {
  totalReviews: number;
  averageRating: number;
  responseRate: number;
  repliedReviews: number;
  period: string;
}

export function StatsCards({
  totalReviews,
  averageRating,
  responseRate,
  repliedReviews,
  period,
}: StatsCardsProps) {
  const periodLabel =
    period === "7d"
      ? "7 dias"
      : period === "30d"
      ? "30 dias"
      : period === "90d"
      ? "90 dias"
      : "1 ano";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total de Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalReviews}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{responseRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {repliedReviews} de {totalReviews} respondidos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm font-medium">{periodLabel}</div>
        </CardContent>
      </Card>
    </div>
  );
}


