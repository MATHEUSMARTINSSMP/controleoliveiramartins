import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { GoogleReview } from "@/hooks/use-google-reviews";

interface ReviewsTimeSeriesChartProps {
  reviews: GoogleReview[];
  period: "7d" | "30d" | "90d" | "1y";
}

export function ReviewsTimeSeriesChart({
  reviews,
  period,
}: ReviewsTimeSeriesChartProps) {
  // Calcular dados por período
  const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
  const startDate = subDays(new Date(), daysBack);

  // Agrupar reviews por data
  const reviewsByDate: Record<string, { total: number; average: number; date: Date }> = {};
  
  // Inicializar todas as datas do período
  for (let i = 0; i < daysBack; i++) {
    const date = subDays(new Date(), i);
    const dateKey = format(date, "yyyy-MM-dd");
    reviewsByDate[dateKey] = {
      total: 0,
      average: 0,
      date,
    };
  }

  // Processar reviews
  reviews.forEach((review) => {
    if (!review.review_date) return;
    const reviewDate = new Date(review.review_date);
    if (reviewDate < startDate) return;

    const dateKey = format(reviewDate, "yyyy-MM-dd");
    if (reviewsByDate[dateKey]) {
      reviewsByDate[dateKey].total += 1;
    }
  });

  // Calcular médias acumuladas
  let cumulativeSum = 0;
  let cumulativeCount = 0;
  const chartData = Object.values(reviewsByDate)
    .reverse()
    .map((item) => {
      cumulativeSum += item.total;
      cumulativeCount += 1;
      const average = cumulativeCount > 0 ? cumulativeSum / cumulativeCount : 0;

      return {
        date: format(item.date, "dd/MM", { locale: ptBR }),
        dateFull: format(item.date, "dd/MM/yyyy", { locale: ptBR }),
        total: item.total,
        average: parseFloat(average.toFixed(2)),
      };
    });

  return (
    <Card className="md:col-span-2 lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Evolução Temporal de Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "total") return [`${value} reviews`, "Total no dia"];
                if (name === "average") return [`${value.toFixed(2)}`, "Média acumulada"];
                return value;
              }}
              labelFormatter={(label) => `Data: ${label}`}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="total"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Reviews por dia"
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="average"
              stroke="#10b981"
              strokeWidth={2}
              name="Média acumulada"
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}


