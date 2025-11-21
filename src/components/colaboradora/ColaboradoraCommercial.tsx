import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useGoalCalculation } from "@/hooks/useGoalCalculation";
import { useAuth } from "@/contexts/AuthContext";
import { Target, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import WeeklyGoalProgress from "@/components/WeeklyGoalProgress";

export const ColaboradoraCommercial = () => {
  const { profile } = useAuth();
  const calculation = useGoalCalculation(profile?.id, profile?.store_id);

  if (!calculation) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Nenhuma meta definida para este mês.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (calculation.status) {
      case 'ahead':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'behind':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getStatusIcon = () => {
    switch (calculation.status) {
      case 'ahead':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'behind':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-blue-600" />;
    }
  };

  const getProgressColor = () => {
    if (calculation.percentualHoje >= 100) return 'bg-green-500';
    if (calculation.percentualHoje >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Card "Meu Dia" */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Meu Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Meta do Dia</span>
                <Badge variant="outline" className="font-semibold">
                  {formatCurrency(calculation.metaDiariaAjustada)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Vendido Hoje</span>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(calculation.vendidoHoje)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Progresso</span>
                <span className={`text-lg font-bold ${getProgressColor().replace('bg-', 'text-')}`}>
                  {calculation.percentualHoje.toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={calculation.percentualHoje} 
                className="h-3"
              />
            </div>
          </div>

          {/* Status Card */}
          <div className={`p-4 rounded-lg border-2 ${getStatusColor()}`}>
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <p className="font-semibold mb-1">
                  {calculation.status === 'ahead' ? 'À Frente!' : 
                   calculation.status === 'behind' ? 'Atenção!' : 'No Ritmo!'}
                </p>
                <p className="text-sm">{calculation.mensagem}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progresso Mensal */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Progresso Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Meta Mensal</div>
              <div className="text-2xl font-bold">{formatCurrency(calculation.metaMensal)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Realizado</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(calculation.realizadoMensal)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Progresso</div>
              <div className={`text-2xl font-bold ${
                calculation.percentualMensal >= 100 ? 'text-green-600' :
                calculation.percentualMensal >= 80 ? 'text-blue-600' :
                'text-orange-600'
              }`}>
                {calculation.percentualMensal.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso da Meta</span>
              <span className="font-semibold">{calculation.percentualMensal.toFixed(1)}%</span>
            </div>
            <Progress 
              value={Math.min(calculation.percentualMensal, 100)} 
              className="h-4"
            />
          </div>

          {/* Projeção */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Projeção Mensal</span>
              <span className={`font-bold ${
                calculation.projecaoMensal >= calculation.metaMensal ? 'text-green-600' : 'text-orange-600'
              }`}>
                {formatCurrency(calculation.projecaoMensal)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Super Meta & Ritmo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md border-purple-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100/50">
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Zap className="h-5 w-5" />
              Super Meta
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Meta Super</span>
                <span className="text-xl font-bold text-purple-600">
                  {formatCurrency(calculation.superMetaMensal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Falta</span>
                <span className="text-lg font-semibold">
                  {formatCurrency(calculation.superMetaMensal - calculation.realizadoMensal)}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="text-sm text-muted-foreground mb-2">Necessário por dia</div>
              <div className="text-xl font-bold text-purple-600">
                {formatCurrency(calculation.ritmoSuperMeta)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Ritmo Necessário</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Para bater a meta</div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(calculation.ritmoNecessario)}/dia
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground mb-1">
                  Dias úteis restantes
                </div>
                <div className="text-xl font-semibold">
                  {calculation.diasUteisRestantes} dias
                </div>
              </div>
              {calculation.deficit > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-xs text-red-600 font-medium mb-1">Déficit</div>
                  <div className="text-lg font-bold text-red-700">
                    {formatCurrency(calculation.deficit)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Meta Semanal Gamificada */}
        <WeeklyGoalProgress 
          colaboradoraId={profile?.id} 
          storeId={profile?.store_id} 
          showDetails={true} 
        />
      </div>
    </div>
  );
};

