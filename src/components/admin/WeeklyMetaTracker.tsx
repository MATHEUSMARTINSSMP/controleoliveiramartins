import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear, eachDayOfInterval } from "date-fns";

interface WeeklyMetaData {
    metaValor: number;
    vendidoSemana: number;
    progress: number;
    diasRestantes: number;
    mediaDiariaNecessaria: number;
    storeName: string;
}

export function WeeklyMetaTracker() {
    const [weeklyMeta, setWeeklyMeta] = useState<WeeklyMetaData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWeeklyMeta();
        const interval = setInterval(fetchWeeklyMeta, 30000);
        return () => clearInterval(interval);
    }, []);

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

    const fetchWeeklyMeta = async () => {
        try {
            const hoje = new Date();
            const mesAtual = format(hoje, "yyyyMM");
            const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 });
            const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 });
            const weekRange = { start: inicioSemana, end: fimSemana };

            console.log("[WeeklyMetaTracker] Buscando metas mensais INDIVIDUAIS para calcular meta semanal...");
            console.log("[WeeklyMetaTracker] Mês atual:", mesAtual);
            console.log("[WeeklyMetaTracker] Semana:", format(inicioSemana, "dd/MM/yyyy"), "até", format(fimSemana, "dd/MM/yyyy"));

            // Buscar todas as metas mensais INDIVIDUAIS (por colaboradora)
            const { data: metasData, error: metaError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor, colaboradora_id, daily_weights, profiles(name)")
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

            // Calcular meta semanal agregada de todas as colaboradoras
            let metaSemanalTotal = 0;
            const colaboradoraIds: string[] = [];
            
            metasData.forEach((meta: any) => {
                const monthlyGoal = Number(meta.meta_valor || 0);
                const dailyWeights = meta.daily_weights || {};
                const weeklyGoal = calculateWeeklyGoalFromMonthly(monthlyGoal, dailyWeights, weekRange);
                metaSemanalTotal += weeklyGoal;
                if (meta.colaboradora_id) colaboradoraIds.push(meta.colaboradora_id);
            });

            console.log("[WeeklyMetaTracker] Meta semanal calculada (total agregado):", metaSemanalTotal);

            // Buscar vendas da semana de todas as colaboradoras
            let query = supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .gte("data_venda", format(inicioSemana, "yyyy-MM-dd'T'00:00:00"))
                .lte("data_venda", format(fimSemana, "yyyy-MM-dd'T'23:59:59"));

            if (colaboradoraIds.length > 0) {
                query = query.in("colaboradora_id", colaboradoraIds);
            }

            const { data: salesData, error: salesError } = await query;

            if (salesError) {
                console.error("[WeeklyMetaTracker] Erro ao buscar vendas:", salesError);
                throw salesError;
            }

            const vendidoSemana = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
            const progress = metaSemanalTotal > 0 ? (vendidoSemana / metaSemanalTotal) * 100 : 0;

            // Calcular dias restantes
            const diasRestantes = Math.max(0, Math.ceil((fimSemana.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
            const faltaParaMeta = Math.max(0, metaSemanalTotal - vendidoSemana);
            const mediaDiariaNecessaria = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;

            console.log("[WeeklyMetaTracker] Vendas da semana:", vendidoSemana);
            console.log("[WeeklyMetaTracker] Progresso:", progress.toFixed(2) + "%");

            setWeeklyMeta({
                metaValor: metaSemanalTotal,
                vendidoSemana,
                progress: Math.min(progress, 100),
                diasRestantes,
                mediaDiariaNecessaria,
                storeName: `${metasData.length} Colaboradora${metasData.length > 1 ? 's' : ''}`,
            });
        } catch (error) {
            console.error("[WeeklyMetaTracker] Error fetching weekly meta:", error);
        } finally {
            setLoading(false);
        }
    };

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

    if (!weeklyMeta) {
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

    const getProgressColor = () => {
        if (weeklyMeta.progress >= 100) return "bg-green-500";
        if (weeklyMeta.progress >= 80) return "bg-yellow-500";
        return "bg-blue-500";
    };

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    Meta Semanal
                    <Badge
                        variant={weeklyMeta.progress >= 100 ? "default" : "secondary"}
                        className="ml-auto"
                    >
                        {weeklyMeta.progress.toFixed(0)}%
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Vendido</span>
                        <span className="font-semibold">
                            R$ {weeklyMeta.vendidoSemana.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Meta</span>
                        <span className="font-semibold">
                            R$ {weeklyMeta.metaValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <Progress value={weeklyMeta.progress} className={`h-3 ${getProgressColor()}`} />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Target className="h-3 w-3" />
                            <span>Faltam</span>
                        </div>
                        <p className="text-lg font-bold">
                            R$ {Math.max(0, weeklyMeta.metaValor - weeklyMeta.vendidoSemana).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            <span>Dias restantes</span>
                        </div>
                        <p className="text-lg font-bold">{weeklyMeta.diasRestantes}</p>
                    </div>
                </div>

                {weeklyMeta.diasRestantes > 0 && weeklyMeta.progress < 100 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Média diária necessária</p>
                        <p className="text-lg font-bold text-primary">
                            R$ {weeklyMeta.mediaDiariaNecessaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                )}

                {weeklyMeta.progress >= 100 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
                        <Trophy className="h-4 w-4" />
                        <span className="text-sm font-semibold">Meta batida! 🎉</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
