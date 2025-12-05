import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import type { DailyHistoryItem } from "./types";

interface WeeklyHistoryChartProps {
  history: DailyHistoryItem[];
  className?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export function WeeklyHistoryChart({ history, className }: WeeklyHistoryChartProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Historico - Ultimos 7 Dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            Nenhum dado disponivel
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxSales = Math.max(...history.map(h => h.totalSales), 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Historico - Ultimos 7 Dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {history.map((day) => {
            const barWidth = (day.totalSales / maxSales) * 100;
            const isAboveGoal = day.percentAchieved >= 100;
            
            return (
              <motion.div
                key={day.date}
                variants={item}
                className="space-y-1"
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium w-12">{day.dayName}</span>
                    <span className="text-muted-foreground text-xs">{day.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(day.totalSales)}</span>
                    <Badge 
                      variant={isAboveGoal ? "default" : "secondary"}
                      className={`text-xs ${isAboveGoal ? "bg-green-500" : ""}`}
                    >
                      {isAboveGoal ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {day.percentAchieved.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute left-0 top-0 h-full rounded-full ${
                      isAboveGoal 
                        ? "bg-gradient-to-r from-green-500 to-emerald-500" 
                        : "bg-gradient-to-r from-primary to-violet-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
