import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface RatingDistributionChartProps {
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  totalReviews: number;
}

const COLORS = {
  5: "#10b981",
  4: "#3b82f6",
  3: "#f59e0b",
  2: "#ef4444",
  1: "#dc2626",
};

export function RatingDistributionChart({
  ratingDistribution,
  totalReviews,
}: RatingDistributionChartProps) {
  const pieData = [
    { name: "5 estrelas", value: ratingDistribution[5], color: COLORS[5] },
    { name: "4 estrelas", value: ratingDistribution[4], color: COLORS[4] },
    { name: "3 estrelas", value: ratingDistribution[3], color: COLORS[3] },
    { name: "2 estrelas", value: ratingDistribution[2], color: COLORS[2] },
    { name: "1 estrela", value: ratingDistribution[1], color: COLORS[1] },
  ];

  const barData = [
    { rating: "5 ⭐", count: ratingDistribution[5], color: COLORS[5] },
    { rating: "4 ⭐", count: ratingDistribution[4], color: COLORS[4] },
    { rating: "3 ⭐", count: ratingDistribution[3], color: COLORS[3] },
    { rating: "2 ⭐", count: ratingDistribution[2], color: COLORS[2] },
    { rating: "1 ⭐", count: ratingDistribution[1], color: COLORS[1] },
  ];

  return (
    <>
      {/* Distribuição de Ratings - Barra Visual */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição de Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingDistribution[rating as keyof typeof ratingDistribution];
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-16">
                    <span className="text-sm font-medium">{rating}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Pizza */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição de Ratings (Gráfico de Pizza)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Barras */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição de Ratings (Gráfico de Barras)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={barData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6">
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}


