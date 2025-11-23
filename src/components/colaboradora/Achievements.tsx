import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Calendar, Sparkles } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface Achievement {
  id: string;
  type: 'META_MENSAL' | 'SUPER_META_MENSAL' | 'META_SEMANAL' | 'SUPER_META_SEMANAL';
  mes_referencia?: string;
  semana_referencia?: string;
  data_conquista: string;
  meta_valor: number;
  realizado: number;
  percentual: number;
}

interface AchievementsProps {
  colaboradoraId: string;
  storeId: string;
}

export const Achievements: React.FC<AchievementsProps> = ({ colaboradoraId, storeId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (colaboradoraId && storeId) {
      fetchAchievements();
    }
  }, [colaboradoraId, storeId]);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      // Buscar troféus diretamente da tabela trophies
      const { data: trophiesData, error } = await supabase
        .schema("sistemaretiradas")
        .from("trophies")
        .select("*")
        .eq("colaboradora_id", colaboradoraId)
        .eq("store_id", storeId)
        .order("data_conquista", { ascending: false })
        .limit(100); // Limitar a 100 troféus mais recentes

      if (error) {
        console.error("Erro ao buscar troféus:", error);
        setAchievements([]);
        return;
      }

      // Converter dados da tabela para o formato Achievement
      const allAchievements: Achievement[] = (trophiesData || []).map((trophy: any) => ({
        id: trophy.id,
        type: trophy.tipo,
        mes_referencia: trophy.mes_referencia || undefined,
        semana_referencia: trophy.semana_referencia || undefined,
        data_conquista: trophy.data_conquista,
        meta_valor: Number(trophy.meta_valor),
        realizado: Number(trophy.realizado),
        percentual: Number(trophy.percentual)
      }));

      // Filtrar: se tiver META e SUPER_META na mesma semana/mês, mostrar apenas SUPER_META
      const filteredAchievements: Achievement[] = [];
      const groupedByPeriod = new Map<string, Achievement[]>();

      // Agrupar por período (semana ou mês)
      allAchievements.forEach((achievement) => {
        const periodKey = achievement.semana_referencia 
          ? `SEMANA_${achievement.semana_referencia}`
          : `MES_${achievement.mes_referencia}`;
        
        if (!groupedByPeriod.has(periodKey)) {
          groupedByPeriod.set(periodKey, []);
        }
        groupedByPeriod.get(periodKey)!.push(achievement);
      });

      // Para cada período, escolher apenas a maior conquista
      groupedByPeriod.forEach((achievementsInPeriod) => {
        // Ordenar por prioridade: SUPER_META > META
        const priorityOrder = {
          'SUPER_META_SEMANAL': 1,
          'META_SEMANAL': 2,
          'SUPER_META_MENSAL': 3,
          'META_MENSAL': 4
        };

        achievementsInPeriod.sort((a, b) => {
          const priorityA = priorityOrder[a.type] || 999;
          const priorityB = priorityOrder[b.type] || 999;
          return priorityA - priorityB;
        });

        // Adicionar apenas o primeiro (maior conquista)
        filteredAchievements.push(achievementsInPeriod[0]);
      });

      // Ordenar por data de conquista (mais recente primeiro)
      filteredAchievements.sort((a, b) => 
        new Date(b.data_conquista).getTime() - new Date(a.data_conquista).getTime()
      );

      setAchievements(filteredAchievements);
    } catch (error) {
      console.error("Erro ao buscar conquistas:", error);
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  };


  const getAchievementLabel = (achievement: Achievement): string => {
    switch (achievement.type) {
      case 'META_MENSAL':
        return `Meta Mensal ${achievement.mes_referencia?.slice(4, 6)}/${achievement.mes_referencia?.slice(0, 4)}`;
      case 'SUPER_META_MENSAL':
        return `Super Meta Mensal ${achievement.mes_referencia?.slice(4, 6)}/${achievement.mes_referencia?.slice(0, 4)}`;
      case 'META_SEMANAL':
        return `Meta Semanal ${achievement.semana_referencia}`;
      case 'SUPER_META_SEMANAL':
        return `Super Meta Semanal ${achievement.semana_referencia}`;
      default:
        return 'Conquista';
    }
  };

  const getAchievementIcon = (type: Achievement['type']) => {
    switch (type) {
      case 'META_MENSAL':
        return <Award className="h-6 w-6 text-green-600" />;
      case 'SUPER_META_MENSAL':
        return <Trophy className="h-6 w-6 text-purple-600" />;
      case 'META_SEMANAL':
        return <Award className="h-6 w-6 text-blue-600" />;
      case 'SUPER_META_SEMANAL':
        return <Trophy className="h-6 w-6 text-orange-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Meus Prêmios e Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">Carregando conquistas...</p>
        </CardContent>
      </Card>
    );
  }

  if (achievements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Meus Prêmios e Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Ainda não há conquistas registradas. Continue trabalhando para alcançar suas metas!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Meus Prêmios e Conquistas
          <Badge variant="secondary" className="ml-auto">
            {achievements.length} {achievements.length === 1 ? 'conquista' : 'conquistas'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((achievement) => (
            <Card key={achievement.id} className="relative overflow-hidden border-2">
              <div className={`absolute top-0 right-0 w-16 h-16 opacity-20 ${
                achievement.type === 'META_MENSAL' || achievement.type === 'META_SEMANAL' 
                  ? 'bg-green-500' 
                  : 'bg-purple-500'
              } rounded-bl-full`} />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {getAchievementIcon(achievement.type)}
                  </div>
                  <Badge variant={
                    achievement.type === 'SUPER_META_MENSAL' || achievement.type === 'SUPER_META_SEMANAL'
                      ? 'default'
                      : 'secondary'
                  }>
                    {format(new Date(achievement.data_conquista), "MMM/yyyy", { locale: ptBR })}
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  {getAchievementLabel(achievement)}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meta:</span>
                    <span className="font-medium">{formatCurrency(achievement.meta_valor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Realizado:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(achievement.realizado)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Desempenho:</span>
                    <span className="font-bold text-primary">
                      {achievement.percentual.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

