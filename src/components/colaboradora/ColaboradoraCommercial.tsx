import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useGoalCalculation } from "@/hooks/useGoalCalculation";
import { useAuth } from "@/contexts/AuthContext";
import { Target, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Zap, Calendar, Gift } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import WeeklyGoalProgress from "@/components/WeeklyGoalProgress";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

export const ColaboradoraCommercial = () => {
  const { profile } = useAuth();
  const calculation = useGoalCalculation(profile?.id, profile?.store_id);
  const [gincanaSemanal, setGincanaSemanal] = useState<{meta_valor: number; super_meta_valor: number; realizado: number} | null>(null);
  const [loadingGincana, setLoadingGincana] = useState(true);

  // Helper para buscar semana atual
  const getCurrentWeekRef = () => {
    const hoje = new Date();
    const monday = startOfWeek(hoje, { weekStartsOn: 1 });
    const year = getYear(monday);
    const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
    return `${String(week).padStart(2, '0')}${year}`;
  };

  // Buscar gincana semanal
  useEffect(() => {
    const fetchGincana = async () => {
      if (!profile?.id || !profile?.store_id) {
        setLoadingGincana(false);
        return;
      }

      try {
        const currentWeek = getCurrentWeekRef();
        const { data: goalData } = await supabase
          .from("goals")
          .select("*")
          .eq("store_id", profile.store_id)
          .eq("colaboradora_id", profile.id)
          .eq("semana_referencia", currentWeek)
          .eq("tipo", "SEMANAL")
          .single();

        if (goalData && goalData.meta_valor) {
          // Buscar vendas da semana
          const weekRange = {
            start: startOfWeek(new Date(), { weekStartsOn: 1 }),
            end: endOfWeek(new Date(), { weekStartsOn: 1 })
          };
          const { data: sales } = await supabase
            .from("sales")
            .select("valor")
            .eq("colaboradora_id", profile.id)
            .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
            .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

          const realizado = sales?.reduce((sum, s) => sum + Number(s.valor || 0), 0) || 0;

          setGincanaSemanal({
            meta_valor: parseFloat(goalData.meta_valor || 0),
            super_meta_valor: parseFloat(goalData.super_meta_valor || 0),
            realizado
          });
        } else {
          setGincanaSemanal(null);
        }
      } catch (error) {
        console.error("Erro ao buscar gincana semanal:", error);
        setGincanaSemanal(null);
      } finally {
        setLoadingGincana(false);
      }
    };

    fetchGincana();
  }, [profile?.id, profile?.store_id]);

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

  const getProgressColor = (percentual: number) => {
    if (percentual >= 100) return 'bg-green-500';
    if (percentual >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* 1. Meta Diária */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Meta Diária
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
                <span className={`text-lg font-bold text-${getProgressColor(calculation.percentualHoje).replace('bg-', '')}`}>
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

      {/* 2. Super Meta Diária */}
      <Card className="border-2 border-purple-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <Zap className="h-6 w-6" />
            Super Meta Diária
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Super Meta do Dia</span>
                <Badge variant="outline" className="font-semibold border-purple-300 text-purple-700">
                  {formatCurrency(calculation.superMetaDiariaAjustada)}
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
                <span className="text-sm text-muted-foreground">Progresso Super Meta</span>
                <span className={`text-lg font-bold text-${getProgressColor(calculation.percentualSuperMetaHoje).replace('bg-', '')}`}>
                  {calculation.percentualSuperMetaHoje.toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={calculation.percentualSuperMetaHoje} 
                className="h-3 bg-purple-100"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Gincana Semanal - Mostrar apenas se houver */}
      {!loadingGincana && gincanaSemanal && (
        <Card className="border-2 border-blue-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Gift className="h-6 w-6" />
              Gincana Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Meta da Gincana</span>
                  <Badge variant="outline" className="font-semibold border-blue-300 text-blue-700">
                    {formatCurrency(gincanaSemanal.meta_valor)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vendido na Semana</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(gincanaSemanal.realizado)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Progresso</span>
                  <span className={`text-lg font-bold ${getProgressColor((gincanaSemanal.realizado / gincanaSemanal.meta_valor) * 100).replace('bg-', '')}`}>
                    {((gincanaSemanal.realizado / gincanaSemanal.meta_valor) * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress 
                  value={(gincanaSemanal.realizado / gincanaSemanal.meta_valor) * 100} 
                  className="h-3 bg-blue-100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Super Gincana Semanal - Mostrar apenas se houver */}
      {!loadingGincana && gincanaSemanal && gincanaSemanal.super_meta_valor > 0 && (
        <Card className="border-2 border-orange-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Zap className="h-6 w-6" />
              Super Gincana Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Super Meta da Gincana</span>
                  <Badge variant="outline" className="font-semibold border-orange-300 text-orange-700">
                    {formatCurrency(gincanaSemanal.super_meta_valor)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vendido na Semana</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(gincanaSemanal.realizado)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Progresso</span>
                  <span className={`text-lg font-bold ${getProgressColor((gincanaSemanal.realizado / gincanaSemanal.super_meta_valor) * 100).replace('bg-', '')}`}>
                    {((gincanaSemanal.realizado / gincanaSemanal.super_meta_valor) * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress 
                  value={(gincanaSemanal.realizado / gincanaSemanal.super_meta_valor) * 100} 
                  className="h-3 bg-orange-100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Meta Semanal */}
      <div className="mt-6">
        <WeeklyGoalProgress 
          colaboradoraId={profile?.id} 
          storeId={profile?.store_id} 
          showDetails={true} 
        />
      </div>

      {/* 6. Meta Mensal */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Meta Mensal
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

          {/* Duas Colunas: Ritmo Necessário | Dias Restantes e Déficit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Coluna 1: Ritmo Necessário */}
            <div className="flex flex-col h-full p-4 bg-gradient-to-br from-orange-50 to-orange-100/30 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <h3 className="text-base font-bold text-orange-700">Ritmo Necessário</h3>
              </div>
              
              {/* Para bater a meta - Destaque */}
              <div className="p-4 bg-orange-600 rounded-lg border-2 border-orange-700 shadow-md">
                <div className="text-xs text-orange-100 mb-2 font-medium">Para bater a meta</div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(calculation.ritmoNecessario)}/dia
                </div>
              </div>
            </div>

            {/* Coluna 2: Dias Restantes e Déficit */}
            <div className="flex flex-col h-full gap-4">
              {/* Dias restantes */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/30 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-bold text-blue-700">Dias Restantes</h3>
                </div>
                <div className="text-3xl font-bold text-blue-700">
                  {calculation.diasRestantes} dias
                </div>
              </div>

              {/* Déficit - Se houver */}
              {calculation.deficit > 0 ? (
                <div className="p-4 bg-red-100 rounded-lg border-2 border-red-300 shadow-sm flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div className="text-sm font-semibold text-red-700 uppercase tracking-wide">Déficit</div>
                  </div>
                  <div className="text-2xl font-bold text-red-700 mb-2">
                    {formatCurrency(calculation.deficit)}
                  </div>
                  <div className="text-xs text-red-600">
                    Valor necessário para recuperar o atraso
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted/30 rounded-lg border border-muted-foreground/10">
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Sem déficit
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. Super Meta Mensal - Modo Paisagem */}
      <Card className="shadow-md border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <Zap className="h-5 w-5" />
            Super Meta Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Super Meta */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/30 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-purple-700">Super Meta</h3>
              </div>
              <div className="text-xl font-bold text-purple-600">
                {formatCurrency(calculation.superMetaMensal)}
              </div>
            </div>

            {/* Falta para Super Meta */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/30 rounded-lg border border-purple-200">
              <div className="text-xs text-muted-foreground mb-2">Falta para Super Meta</div>
              <div className="text-xl font-bold text-purple-700">
                {formatCurrency(Math.max(0, calculation.superMetaMensal - calculation.realizadoMensal))}
              </div>
            </div>

            {/* Progresso */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/30 rounded-lg border border-purple-200">
              <div className="text-xs text-muted-foreground mb-2">Progresso</div>
              <div className="text-xl font-bold text-purple-700 mb-2">
                {((calculation.realizadoMensal / calculation.superMetaMensal) * 100).toFixed(1)}%
              </div>
              <Progress 
                value={Math.min((calculation.realizadoMensal / calculation.superMetaMensal) * 100, 100)} 
                className="h-2 bg-purple-100"
              />
            </div>

            {/* Necessário por dia - Destaque */}
            <div className="p-4 bg-purple-600 rounded-lg border-2 border-purple-700 shadow-md">
              <div className="text-xs text-purple-100 mb-2 font-medium">Necessário por dia</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(calculation.ritmoSuperMeta)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
