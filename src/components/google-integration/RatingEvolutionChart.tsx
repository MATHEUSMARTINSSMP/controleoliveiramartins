import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { GoogleReview } from "@/hooks/use-google-reviews";

interface RatingEvolutionChartProps {
  reviews: GoogleReview[];
  period: "7d" | "30d" | "90d" | "1y";
}

export function RatingEvolutionChart({
  reviews,
  period,
}: RatingEvolutionChartProps) {
  const daysBack = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
  const startDate = subDays(new Date(), daysBack);

  // Agrupar por data e calcular média de rating
  const ratingsByDate: Record<string, { sum: number; count: number; date: Date }> = {};
  
  // Inicializar todas as datas
  for (let i = 0; i < daysBack; i++) {
    const date = subDays(new Date(), i);
    const dateKey = format(date, "yyyy-MM-dd");
    ratingsByDate[dateKey] = {
      sum: 0,
      count: 0,
      date,
    };
  }

  // Processar reviews
  reviews.forEach((review) => {
    if (!review.review_date) return;
    const reviewDate = new Date(review.review_date);
    if (reviewDate < startDate) return;

    const dateKey = format(reviewDate, "yyyy-MM-dd");
    if (ratingsByDate[dateKey]) {
      ratingsByDate[dateKey].sum += review.rating;
      ratingsByDate[dateKey].count += 1;
    }
  });

  // Calcular médias
  const chartData = Object.values(ratingsByDate)
    .reverse()
    .map((item) => {
      const average = item.count > 0 ? item.sum / item.count : 0;
      return {
        date: format(item.date, "dd/MM", { locale: ptBR }),
        dateFull: format(item.date, "dd/MM/yyyy", { locale: ptBR }),
        average: parseFloat(average.toFixed(2)),
        count: item.count,
      };
    });

  return (
    <Card className="md:col-span-2 lg:col-span-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Evolução da Média de Ratings</CardTitle>
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
            <YAxis domain={[0, 5]} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "average") return [`${value.toFixed(2)}`, "Média de rating"];
                if (name === "count") return [`${value} reviews`, "Quantidade"];
                return value;
              }}
              labelFormatter={(label) => `Data: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="average"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Média de rating"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}


