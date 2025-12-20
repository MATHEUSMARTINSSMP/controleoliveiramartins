import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear, eachDayOfInterval } from "date-fns";

interface ColaboradoraMetaSemanal {
    id: string;
    name: string;
    metaSemanal: number;
    vendidoSemana: number;
    progress: number;
}

interface WeeklyMetaData {
    colaboradoras: ColaboradoraMetaSemanal[];
}

export function WeeklyMetaTracker() {
    const [weeklyMeta, setWeeklyMeta] = useState<WeeklyMetaData | null>(null);
    const [loading, setLoading] = useState(true);
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>("TODAS");

    useEffect(() => {
        fetchStores();
    }, []);

    const fetchStores = async () => {
        const { data } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("id, name")
            .eq("active", true)
            .order("name");

        if (data) setStores(data);
    };

    // Função para gerar semana_referencia no formato WWYYYY
    const getCurrentWeekRef = (): string => {
        const hoje = new Date();
        const monday = startOfWeek(hoje, { weekStartsOn: 1 });
        const year = getYear(monday);
        const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
        // Formato: WWYYYY (ex: 462025 para semana 46 de 2025)
        return `${String(week).padStart(2, '0')}${year}`;
    };

    // Função para calcular meta semanal a partir da meta mensal usando daily_weights
    const calculateWeeklyGoalFromMonthly = (monthlyGoal: number, dailyWeights: Record<string, number>, weekRange: { start: Date; end: Date }): number => {
        // Obter todos os dias da semana (segunda a domingo)
        const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
        
        let totalWeeklyGoal = 0;
        
        weekDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayWeight = dailyWeights[dayKey] || 0;
            
            // Calcular meta do dia: (meta_mensal * peso_do_dia) / 100
            const dayGoal = (monthlyGoal * dayWeight) / 100;
            totalWeeklyGoal += dayGoal;
        });
        
        // Se não houver daily_weights, dividir igualmente pelos dias do mês
        if (Object.keys(dailyWeights).length === 0) {
            const daysInMonth = new Date(weekRange.start.getFullYear(), weekRange.start.getMonth() + 1, 0).getDate();
            const dailyGoal = monthlyGoal / daysInMonth;
            totalWeeklyGoal = dailyGoal * 7; // 7 dias da semana
        }
        
        return totalWeeklyGoal;
    };

    const fetchWeeklyMeta = useCallback(async () => {
        try {
            const hoje = new Date();
            const mesAtual = format(hoje, "yyyyMM");
            const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 });
            const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 });
            const weekRange = { start: inicioSemana, end: fimSemana };

            console.log("[WeeklyMetaTracker] Buscando metas mensais INDIVIDUAIS para calcular meta semanal...");
            console.log("[WeeklyMetaTracker] Mês atual:", mesAtual);
            console.log("[WeeklyMetaTracker] Semana:", format(inicioSemana, "dd/MM/yyyy"), "até", format(fimSemana, "dd/MM/yyyy"));
            console.log("[WeeklyMetaTracker] Filtro de loja selecionado:", selectedStore);

            // Buscar todas as metas mensais INDIVIDUAIS (por colaboradora) - usar schema como no dashboard da loja
            const { data: metasData, error: metaError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor, colaboradora_id, daily_weights")
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .not("colaboradora_id", "is", null);

            if (metaError) {
                console.error("[WeeklyMetaTracker] Erro ao buscar metas:", metaError);
                throw metaError;
            }

            if (!metasData || metasData.length === 0) {
                console.warn("[WeeklyMetaTracker] Nenhuma meta mensal individual encontrada para calcular meta semanal");
                setWeeklyMeta(null);
                setLoading(false);
                return;
            }

            console.log("[WeeklyMetaTracker] Metas individuais encontradas:", metasData.length, metasData);

            const colaboradoraIds = metasData.map(m => m.colaboradora_id).filter(Boolean) as string[];

            console.log("[WeeklyMetaTracker] Colaboradoras com meta:", colaboradoraIds.length);

            // Buscar nomes de todas as colaboradoras (com filtro de loja se necessário)
            let profilesQuery = supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("id, name, store_id")
                .in("id", colaboradoraIds);

            if (selectedStore !== "TODAS") {
                profilesQuery = profilesQuery.eq("store_id", selectedStore);
                console.log("[WeeklyMetaTracker] Aplicando filtro de loja:", selectedStore);
            }

            const { data: profilesData } = await profilesQuery;

            console.log("[WeeklyMetaTracker] Profiles encontrados após filtro:", profilesData?.length || 0);

            const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p.name]));
            const filteredColabIds = (profilesData || []).map((p: any) => p.id).filter(Boolean) as string[];

            console.log("[WeeklyMetaTracker] IDs de colaboradoras filtradas:", filteredColabIds.length);

            if (filteredColabIds.length === 0) {
                console.log("[WeeklyMetaTracker] Nenhuma colaboradora encontrada após filtro");
                setWeeklyMeta({ colaboradoras: [] });
                setLoading(false);
                return;
            }

            // Buscar vendas da semana de todas as colaboradoras - usar schema como no dashboard da loja
            let query = supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor, colaboradora_id")
                .gte("data_venda", format(inicioSemana, "yyyy-MM-dd'T'00:00:00"))
                .lte("data_venda", format(fimSemana, "yyyy-MM-dd'T'23:59:59"));

            if (filteredColabIds.length > 0) {
                query = query.in("colaboradora_id", filteredColabIds);
            }

            const { data: salesData, error: salesError } = await query;

            if (salesError) {
                console.error("[WeeklyMetaTracker] Erro ao buscar vendas:", salesError);
                throw salesError;
            }

            console.log("[WeeklyMetaTracker] Vendas encontradas:", salesData?.length || 0);

            // Agrupar vendas por colaboradora
            const salesByColab: Record<string, number> = {};
            salesData?.forEach((sale: any) => {
                const colabId = sale.colaboradora_id;
                if (!salesByColab[colabId]) {
                    salesByColab[colabId] = 0;
                }
                salesByColab[colabId] += Number(sale.valor || 0);
            });

            // Criar lista de colaboradoras com suas metas semanais e vendas (apenas as filtradas)
            const colaboradoras: ColaboradoraMetaSemanal[] = metasData
                .filter((meta: any) => filteredColabIds.includes(meta.colaboradora_id))
                .map((meta: any) => {
                const colabId = meta.colaboradora_id;
                const monthlyGoal = Number(meta.meta_valor || 0);
                const dailyWeights = meta.daily_weights || {};
                const metaSemanal = calculateWeeklyGoalFromMonthly(monthlyGoal, dailyWeights, weekRange);
                const vendidoSemana = salesByColab[colabId] || 0;
                const progress = metaSemanal > 0 ? (vendidoSemana / metaSemanal) * 100 : 0;

                    return {
                        id: colabId,
                        name: profilesMap.get(colabId) || "Desconhecida",
                        metaSemanal,
                        vendidoSemana,
                        progress: Math.min(progress, 100),
                    };
                });

            // Ordenar por progresso (maior primeiro)
            colaboradoras.sort((a, b) => b.progress - a.progress);

            console.log("[WeeklyMetaTracker] Colaboradoras processadas:", colaboradoras.length);

            setWeeklyMeta({
                colaboradoras,
            });
        } catch (error) {
            console.error("[WeeklyMetaTracker] Error fetching weekly meta:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedStore]);

    useEffect(() => {
        fetchWeeklyMeta();
        const interval = setInterval(fetchWeeklyMeta, 30000);
        return () => clearInterval(interval);
    }, [fetchWeeklyMeta]);

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Meta Semanal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!weeklyMeta || weeklyMeta.colaboradoras.length === 0) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Meta Semanal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma meta semanal configurada
                    </p>
                </CardContent>
            </Card>
        );
    }

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return "bg-green-500";
        if (progress >= 80) return "bg-yellow-500";
        return "bg-blue-500";
    };

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5 text-primary" />
                        Meta Semanal
                    </CardTitle>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue placeholder="Todas as lojas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TODAS">Todas as lojas</SelectItem>
                            {stores.map((store) => (
                                <SelectItem key={store.id} value={store.id}>
                                    {store.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-2">
                    {weeklyMeta.colaboradoras.map((colab) => (
                        <div
                            key={colab.id}
                            className="p-3 rounded-lg bg-muted/50 border border-border/50"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium break-words">{colab.name}</span>
                                <Badge
                                    variant={colab.progress >= 100 ? "default" : "secondary"}
                                    className="ml-2"
                                >
                                    {colab.progress.toFixed(0)}%
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Vendido: R$ {colab.vendidoSemana.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Progress value={colab.progress} className={`h-2 ${getProgressColor(colab.progress)}`} />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
