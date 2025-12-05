import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, DollarSign, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

interface StoreMetricsCardsProps {
  metaMensal: number;
  monthlyRealizado: number;
  monthlyProgress: number;
  dailyGoal: number;
  dailyProgress: number;
  todaySales: number;
  ticketMedio?: number;
  pecasAtendimento?: number;
  precoMedioPeca?: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export function StoreMetricsCards({
  metaMensal,
  monthlyRealizado,
  monthlyProgress,
  dailyGoal,
  dailyProgress,
  todaySales,
  ticketMedio = 0,
  pecasAtendimento = 0,
  precoMedioPeca = 0,
}: StoreMetricsCardsProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-4 sm:space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={item}>
          <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
              <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground flex items-center justify-center gap-2">
                <Target className="w-5 h-5" />
                Meta Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-2xl sm:text-4xl font-bold mb-4">
                {formatCurrency(metaMensal)}
              </div>
              <div className="w-full space-y-3">
                <Progress value={monthlyProgress} className="h-3 sm:h-4" />
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Realizado:</span>
                  <span className="font-semibold">{formatCurrency(monthlyRealizado)}</span>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-primary">
                  {monthlyProgress.toFixed(1)}%
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
              <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground flex items-center justify-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Meta Diaria (Hoje)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-2xl sm:text-4xl font-bold mb-4">
                {formatCurrency(dailyGoal)}
              </div>
              <div className="w-full space-y-3">
                <Progress 
                  value={Math.min(dailyProgress, 100)} 
                  className="h-3 sm:h-4" 
                />
                <div className="text-lg sm:text-2xl font-bold text-primary">
                  {dailyProgress.toFixed(1)}%
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
              <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground flex items-center justify-center gap-2">
                <DollarSign className="w-5 h-5" />
                Faturamento Hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-2xl sm:text-4xl font-bold text-status-ahead">
                {formatCurrency(todaySales)}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {dailyProgress >= 100 ? "Meta atingida!" : `Falta ${formatCurrency(Math.max(0, dailyGoal - todaySales))}`}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <motion.div variants={item}>
          <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">
                Ticket Medio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-xl sm:text-2xl font-bold">
                {formatCurrency(ticketMedio)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">
                PA (Pecas/Venda)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-xl sm:text-2xl font-bold">
                {pecasAtendimento.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">
                Preco Medio/Peca
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-xl sm:text-2xl font-bold">
                {formatCurrency(precoMedioPeca)}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
