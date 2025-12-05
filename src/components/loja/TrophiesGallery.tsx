import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Calendar, Sparkles, Users } from "lucide-react";
import { format, startOfWeek, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { checkAndCreateWeeklyTrophiesForAllColaboradoras } from "@/lib/trophies";

interface TrophyData {
  id: string;
  colaboradora_id: string;
  colaboradora_name: string;
  tipo: 'META_MENSAL' | 'SUPER_META_MENSAL' | 'META_SEMANAL' | 'SUPER_META_SEMANAL';
  mes_referencia?: string;
  semana_referencia?: string;
  meta_valor: number;
  realizado: number;
  percentual: number;
  data_conquista: string;
}

interface TrophiesGalleryProps {
  storeId: string;
  limit?: number;
}

export const TrophiesGallery: React.FC<TrophiesGalleryProps> = ({ storeId, limit = 200 }) => {
  const [trophies, setTrophies] = useState<TrophyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeId) {
      fetchTrophies();
    }
  }, [storeId]);

  const fetchTrophies = async () => {
    setLoading(true);
    try {
      // Primeiro: verificar e criar troféus para todas as colaboradoras da loja
      // Isso garante que todos os troféus sejam criados, não apenas quando uma venda é lançada
      const hoje = new Date();
      const monday = startOfWeek(hoje, { weekStartsOn: 1 });
      const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
      const year = getYear(monday);
      const semanaRef = `${String(week).padStart(2, '0')}${year}`;

      console.log(`🏆 [TrophiesGallery] Verificando troféus para semana ${semanaRef}...`);
      await checkAndCreateWeeklyTrophiesForAllColaboradoras(storeId, semanaRef);

      // Buscar troféus da loja com informações da colaboradora
      const { data: trophiesData, error } = await supabase
        .schema("sistemaretiradas")
        .from("trophies")
        .select(`
          *,
          colaboradora:profiles!colaboradora_id(name)
        `)
        .eq("store_id", storeId)
        .order("data_conquista", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Erro ao buscar troféus:", error);
        setTrophies([]);
        return;
      }

      console.log(`🏆 [TrophiesGallery] Total de troféus retornados do banco: ${trophiesData?.length || 0}`);
      console.log(`🏆 [TrophiesGallery] Troféus por tipo:`,
        trophiesData?.reduce((acc: any, t: any) => {
          acc[t.tipo] = (acc[t.tipo] || 0) + 1;
          return acc;
        }, {}) || {}
      );

      // Converter dados para o formato TrophyData
      const trophiesList: TrophyData[] = (trophiesData || []).map((trophy: any) => ({
        id: trophy.id,
        colaboradora_id: trophy.colaboradora_id,
        colaboradora_name: trophy.colaboradora?.name || 'Desconhecida',
        tipo: trophy.tipo,
        mes_referencia: trophy.mes_referencia || undefined,
        semana_referencia: trophy.semana_referencia || undefined,
        meta_valor: Number(trophy.meta_valor),
        realizado: Number(trophy.realizado),
        percentual: Number(trophy.percentual),
        data_conquista: trophy.data_conquista
      }));

      console.log(`🏆 [TrophiesGallery] Troféus convertidos: ${trophiesList.length}`);
      console.log(`🏆 [TrophiesGallery] Colaboradoras únicas:`,
        new Set(trophiesList.map(t => t.colaboradora_id)).size
      );

      // Filtrar: se há troféu de super meta, remover troféu de meta normal da mesma colaboradora e referência
      const filteredTrophies = trophiesList.filter(trophy => {
        // Se é uma super meta, sempre mostrar
        if (trophy.tipo.includes('SUPER')) {
          return true;
        }

        // Se é uma meta normal, verificar se existe super meta para a mesma colaboradora e referência
        const hasSuperMeta = trophiesList.some(t => {
          // Verificar se é super meta do mesmo tipo (mensal ou semanal)
          const isSameType =
            (trophy.tipo === 'META_MENSAL' && t.tipo === 'SUPER_META_MENSAL') ||
            (trophy.tipo === 'META_SEMANAL' && t.tipo === 'SUPER_META_SEMANAL');

          // Verificar se é da mesma colaboradora
          const isSameColaboradora = t.colaboradora_id === trophy.colaboradora_id;

          // Verificar se é da mesma referência
          const isSameReference =
            (trophy.mes_referencia && t.mes_referencia === trophy.mes_referencia) ||
            (trophy.semana_referencia && t.semana_referencia === trophy.semana_referencia);

          return isSameType && isSameColaboradora && isSameReference;
        });

        // Se existe super meta, não mostrar a meta normal
        return !hasSuperMeta;
      });

      console.log(`🏆 [TrophiesGallery] Troféus após filtro: ${filteredTrophies.length}`);
      console.log(`🏆 [TrophiesGallery] Colaboradoras únicas após filtro:`,
        new Set(filteredTrophies.map(t => t.colaboradora_id)).size
      );
      console.log(`🏆 [TrophiesGallery] Detalhes dos troféus filtrados:`,
        filteredTrophies.map(t => ({
          colaboradora: t.colaboradora_name,
          tipo: t.tipo,
          semana: t.semana_referencia,
          mes: t.mes_referencia
        }))
      );

      setTrophies(filteredTrophies);
    } catch (error) {
      console.error("Erro ao buscar troféus:", error);
      setTrophies([]);
    } finally {
      setLoading(false);
    }
  };

  const getTrophyLabel = (trophy: TrophyData): string => {
    switch (trophy.tipo) {
      case 'META_MENSAL':
        return `Meta Mensal ${trophy.mes_referencia?.slice(4, 6)}/${trophy.mes_referencia?.slice(0, 4)}`;
      case 'SUPER_META_MENSAL':
        return `Super Meta Mensal ${trophy.mes_referencia?.slice(4, 6)}/${trophy.mes_referencia?.slice(0, 4)}`;
      case 'META_SEMANAL':
        return `Gincana Semanal ${trophy.semana_referencia}`;
      case 'SUPER_META_SEMANAL':
        return `Super Gincana Semanal ${trophy.semana_referencia}`;
      default:
        return 'Conquista';
    }
  };

  const getTrophyIcon = (tipo: TrophyData['tipo']) => {
    switch (tipo) {
      case 'META_MENSAL':
        return <Award className="h-8 w-8 text-green-600" />;
      case 'SUPER_META_MENSAL':
        return <Trophy className="h-8 w-8 text-purple-600" />;
      case 'META_SEMANAL':
        return <Award className="h-8 w-8 text-blue-600" />;
      case 'SUPER_META_SEMANAL':
        return <Trophy className="h-8 w-8 text-orange-600" />;
    }
  };

  const getTrophyColor = (tipo: TrophyData['tipo']): string => {
    switch (tipo) {
      case 'META_MENSAL':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'SUPER_META_MENSAL':
        return 'border-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'META_SEMANAL':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'SUPER_META_SEMANAL':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Galeria de Troféus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Carregando troféus...</p>
        </CardContent>
      </Card>
    );
  }

  if (trophies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Galeria de Troféus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg">
              Ainda não há troféus conquistados.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Continue trabalhando para alcançar as metas e aparecer aqui!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Agrupar por colaboradora para estatísticas
  const colaboradorasCount = new Set(trophies.map(t => t.colaboradora_id)).size;
  const superTrophiesCount = trophies.filter(t => t.tipo.includes('SUPER')).length;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Trophy className="h-6 w-6 text-primary" />
            Galeria de Troféus
          </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {trophies.length} {trophies.length === 1 ? 'troféu' : 'troféus'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">{colaboradorasCount}</strong> colaboradoras premiadas
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">{superTrophiesCount}</strong> super metas alcançadas
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {trophies.map((trophy) => (
            <Card
              key={trophy.id}
              className={`relative overflow-hidden border-2 transition-all hover:shadow-lg hover:scale-105 ${getTrophyColor(trophy.tipo)}`}
            >
              {/* Decoração de fundo */}
              <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
                {getTrophyIcon(trophy.tipo)}
              </div>

              <CardContent className="pt-6 relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {getTrophyIcon(trophy.tipo)}
                  </div>
                  <Badge
                    variant={trophy.tipo.includes('SUPER') ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {format(new Date(trophy.data_conquista), "MMM/yyyy", { locale: ptBR })}
                  </Badge>
                </div>

                <h3 className="font-bold text-base mb-1">
                  {getTrophyLabel(trophy)}
                </h3>

                <p className="text-sm font-semibold text-primary mb-4">
                  {trophy.colaboradora_name}
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meta:</span>
                    <span className="font-medium">{formatCurrency(trophy.meta_valor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Realizado:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(trophy.realizado)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">Desempenho:</span>
                    <span className="font-bold text-primary text-sm">
                      {trophy.percentual.toFixed(1)}%
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

