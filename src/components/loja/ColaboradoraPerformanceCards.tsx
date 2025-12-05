import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { ColaboradoraPerformance } from "./types";

interface ColaboradoraPerformanceCardsProps {
  colaboradoras: ColaboradoraPerformance[];
  className?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export function ColaboradoraPerformanceCards({ 
  colaboradoras,
  className 
}: ColaboradoraPerformanceCardsProps) {
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
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  if (colaboradoras.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Nenhuma colaboradora encontrada
      </div>
    );
  }

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className={`flex flex-wrap justify-center gap-4 ${className}`}
    >
      {colaboradoras.map((perf) => (
        <motion.div key={perf.id} variants={item}>
          <Card className="flex flex-col w-full max-w-[380px] h-[280px] hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4 p-5 sm:p-6 text-center border-b">
              <CardTitle className="text-lg font-semibold leading-snug min-h-[3.5rem] flex items-center justify-center">
                {perf.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 pt-5 sm:pt-6 flex-1 flex flex-col justify-center space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Meta Mensal:</span>
                  <span className="font-medium">{formatCurrency(perf.metaMensal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Realizado:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(perf.monthlySales)}
                  </span>
                </div>
                <Progress 
                  value={Math.min(perf.progressPercent, 100)} 
                  className="h-2.5" 
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Progresso</span>
                  <Badge 
                    variant={perf.progressPercent >= 100 ? "default" : "secondary"}
                    className={perf.progressPercent >= 100 ? "bg-green-500" : ""}
                  >
                    {perf.progressPercent.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Meta Hoje:</span>
                  <span>{formatCurrency(perf.metaDiaria)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Vendido Hoje:</span>
                  <span className="font-medium">{formatCurrency(perf.dailySales)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Progresso Diario:</span>
                  <Badge variant="outline" className="text-xs">
                    {perf.progressDiario.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
