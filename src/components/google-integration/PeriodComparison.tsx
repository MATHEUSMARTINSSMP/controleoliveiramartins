import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PeriodComparisonProps {
  currentStats: {
    totalReviews: number;
    averageRating: number;
    responseRate: number;
    repliedReviews: number;
  };
  previousStats: {
    totalReviews: number;
    averageRating: number;
    responseRate: number;
    repliedReviews: number;
  } | null;
  currentPeriod: string;
  previousPeriod: string;
}

export function PeriodComparison({
  currentStats,
  previousStats,
  currentPeriod,
  previousPeriod,
}: PeriodComparisonProps) {
  if (!previousStats) {
    return null;
  }

  const calculateChange = (current: number, previous: number): { value: number; percentage: number; isPositive: boolean | null } => {
    if (previous === 0) {
      return { value: current, percentage: current > 0 ? 100 : 0, isPositive: current > 0 };
    }
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return {
      value: change,
      percentage: Math.abs(percentage),
      isPositive: change > 0 ? true : change < 0 ? false : null,
    };
  };

  const reviewsChange = calculateChange(currentStats.totalReviews, previousStats.totalReviews);
  const ratingChange = calculateChange(currentStats.averageRating, previousStats.averageRating);
  const responseRateChange = calculateChange(currentStats.responseRate, previousStats.responseRate);
  const repliedChange = calculateChange(currentStats.repliedReviews, previousStats.repliedReviews);

  const renderChange = (
    change: { value: number; percentage: number; isPositive: boolean | null },
    label: string
  ) => {
    if (change.isPositive === null) {
      return (
        <div className="flex items-center gap-2">
          <Minus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sem mudança</span>
        </div>
      );
    }

    const Icon = change.isPositive ? TrendingUp : TrendingDown;
    const colorClass = change.isPositive ? "text-green-600" : "text-red-600";
    const bgClass = change.isPositive ? "bg-green-50" : "bg-red-50";

    return (
      <div className={`flex items-center gap-2 p-2 rounded-md ${bgClass}`}>
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <div>
          <span className={`text-sm font-medium ${colorClass}`}>
            {change.isPositive ? "+" : ""}
            {change.value.toFixed(1)}
          </span>
          <span className={`text-xs ml-2 ${colorClass}`}>
            ({change.percentage.toFixed(1)}%)
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="md:col-span-2 lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Comparação de Períodos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total de Reviews</span>
              <Badge variant="outline">{currentPeriod}</Badge>
            </div>
            <div className="text-2xl font-bold">{currentStats.totalReviews}</div>
            {renderChange(reviewsChange, "Reviews")}
            <p className="text-xs text-muted-foreground">vs. {previousPeriod}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avaliação Média</span>
              <Badge variant="outline">{currentPeriod}</Badge>
            </div>
            <div className="text-2xl font-bold">{currentStats.averageRating.toFixed(1)}</div>
            {renderChange(ratingChange, "Rating")}
            <p className="text-xs text-muted-foreground">vs. {previousPeriod}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Taxa de Resposta</span>
              <Badge variant="outline">{currentPeriod}</Badge>
            </div>
            <div className="text-2xl font-bold">{currentStats.responseRate.toFixed(1)}%</div>
            {renderChange(responseRateChange, "Response Rate")}
            <p className="text-xs text-muted-foreground">vs. {previousPeriod}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reviews Respondidas</span>
              <Badge variant="outline">{currentPeriod}</Badge>
            </div>
            <div className="text-2xl font-bold">{currentStats.repliedReviews}</div>
            {renderChange(repliedChange, "Replied")}
            <p className="text-xs text-muted-foreground">vs. {previousPeriod}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


