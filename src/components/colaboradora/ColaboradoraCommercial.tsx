import { useState, useEffect, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useGoalCalculation } from "@/hooks/useGoalCalculation";
import { useAuth } from "@/contexts/AuthContext";
import { Target, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Zap, Calendar, Gift, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

const WeeklyGoalProgress = lazy(() => import("@/components/WeeklyGoalProgress"));

const getSupabaseClient = async () => {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
};

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
        const supabase = await getSupabaseClient();
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
            .gte("data_venda", format(weekRange.start, "yyyy-MM-dd'T'00:00:00"))
            .lte("data_venda", format(weekRange.end, "yyyy-MM-dd'T'23:59:59"));

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
        return 'text-status-ahead bg-status-ahead-bg border-status-ahead-border';
      case 'behind':
        return 'text-status-behind bg-status-behind-bg border-status-behind-border';
      default:
        return 'text-status-ontrack bg-status-ontrack-bg border-status-ontrack-border';
    }
  };

  const getStatusIcon = () => {
    switch (calculation.status) {
      case 'ahead':
        return <TrendingUp className="h-5 w-5 text-status-ahead" />;
      case 'behind':
        return <TrendingDown className="h-5 w-5 text-status-behind" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-status-ontrack" />;
    }
  };

  const getProgressColor = (percentual: number) => {
    if (percentual >= 100) return 'bg-primary';
    if (percentual >= 70) return 'bg-primary/70';
    return 'bg-primary/50';
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Meta do Dia</span>
                <Badge variant="outline" className="font-semibold">
                  {formatCurrency(calculation.metaDiariaAjustada)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Vendido Hoje</span>
                <span className="text-lg font-bold text-status-ahead">
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
      <Card className="border-2 border-primary/30 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Zap className="h-6 w-6" />
            Super Meta Diária
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Super Meta do Dia</span>
                <Badge variant="outline" className="font-semibold border-primary/50 text-primary">
                  {formatCurrency(calculation.superMetaDiariaAjustada)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Vendido Hoje</span>
                <span className="text-lg font-bold text-status-ahead">
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
                className="h-3 bg-primary/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Gincana Semanal - Mostrar apenas se houver */}
      {!loadingGincana && gincanaSemanal && (
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Gift className="h-6 w-6" />
              Gincana Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Meta da Gincana</span>
                  <Badge variant="outline" className="font-semibold border-primary/50 text-primary">
                    {formatCurrency(gincanaSemanal.meta_valor)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vendido na Semana</span>
                  <span className="text-lg font-bold text-status-ahead">
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
                  className="h-3 bg-primary/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Super Gincana Semanal - Mostrar apenas se houver */}
      {!loadingGincana && gincanaSemanal && gincanaSemanal.super_meta_valor > 0 && (
        <Card className="border-2 border-primary/30 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Zap className="h-6 w-6" />
              Super Gincana Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Super Meta da Gincana</span>
                  <Badge variant="outline" className="font-semibold border-primary/50 text-primary">
                    {formatCurrency(gincanaSemanal.super_meta_valor)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vendido na Semana</span>
                  <span className="text-lg font-bold text-status-ahead">
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
                  className="h-3 bg-primary/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Meta Semanal */}
      <div className="mt-6">
        <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <WeeklyGoalProgress 
            colaboradoraId={profile?.id} 
            storeId={profile?.store_id} 
            showDetails={true} 
          />
        </Suspense>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Meta Mensal</div>
              <div className="text-2xl font-bold">{formatCurrency(calculation.metaMensal)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Realizado</div>
              <div className="text-2xl font-bold text-status-ahead">
                {formatCurrency(calculation.realizadoMensal)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Progresso</div>
              <div className={`text-2xl font-bold ${
                calculation.percentualMensal >= 100 ? 'text-status-ahead' :
                calculation.percentualMensal >= 80 ? 'text-status-ontrack' :
                'text-status-behind'
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
                calculation.projecaoMensal >= calculation.metaMensal ? 'text-status-ahead' : 'text-status-behind'
              }`}>
                {formatCurrency(calculation.projecaoMensal)}
              </span>
            </div>
          </div>

          {/* Duas Colunas: Ritmo Necessário | Dias Restantes e Déficit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Coluna 1: Ritmo Necessário */}
            <div className="flex flex-col h-full p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-primary">Ritmo Necessário</h3>
              </div>
              
              {/* Para bater a meta - Destaque */}
              <div className="p-4 bg-primary rounded-lg border-2 border-primary/70 shadow-md">
                <div className="text-xs text-primary-foreground/80 mb-2 font-medium">Para bater a meta</div>
                <div className="text-3xl font-bold text-primary-foreground">
                  {formatCurrency(calculation.ritmoNecessario)}/dia
                </div>
              </div>
            </div>

            {/* Coluna 2: Dias Restantes e Déficit */}
            <div className="flex flex-col h-full gap-4">
              {/* Dias restantes */}
              <div className="p-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-bold text-foreground">Dias Restantes</h3>
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {calculation.diasRestantes} dias
                </div>
              </div>

              {/* Déficit - Se houver */}
              {calculation.deficit > 0 ? (
                <div className="p-4 bg-status-behind-bg rounded-lg border-2 border-status-behind-border shadow-sm flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-status-behind" />
                    <div className="text-sm font-semibold text-status-behind uppercase tracking-wide">Déficit</div>
                  </div>
                  <div className="text-2xl font-bold text-status-behind mb-2">
                    {formatCurrency(calculation.deficit)}
                  </div>
                  <div className="text-xs text-status-behind">
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
      <Card className="shadow-md border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Zap className="h-5 w-5" />
            Super Meta Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Super Meta */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-primary">Super Meta</h3>
              </div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(calculation.superMetaMensal)}
              </div>
            </div>

            {/* Falta para Super Meta */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <div className="text-xs text-muted-foreground mb-2">Falta para Super Meta</div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(Math.max(0, calculation.superMetaMensal - calculation.realizadoMensal))}
              </div>
            </div>

            {/* Progresso */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
              <div className="text-xs text-muted-foreground mb-2">Progresso</div>
              <div className="text-xl font-bold text-primary mb-2">
                {((calculation.realizadoMensal / calculation.superMetaMensal) * 100).toFixed(1)}%
              </div>
              <Progress 
                value={Math.min((calculation.realizadoMensal / calculation.superMetaMensal) * 100, 100)} 
                className="h-2 bg-primary/20"
              />
            </div>

            {/* Necessário por dia - Destaque */}
            <div className="p-4 bg-primary rounded-lg border-2 border-primary/70 shadow-md">
              <div className="text-xs text-primary-foreground/80 mb-2 font-medium">Necessário por dia</div>
              <div className="text-2xl font-bold text-primary-foreground">
                {formatCurrency(calculation.ritmoSuperMeta)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
