import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Gift, CheckCircle2, XCircle, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear, addWeeks, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface WeeklyBonusProgressProps {
    storeId: string;
    colaboradoras: Array<{ id: string; name: string }>;
}

interface CollaboratorProgress {
    colaboradoraId: string;
    colaboradoraName: string;
    metaValor: number; // Meta semanal de bônus
    superMetaValor: number;
    realizado: number;
    metaDiaria: number; // Meta do dia
    realizadoHoje: number; // Vendas de hoje
    progressMeta: number; // % da meta semanal de bônus
    progressSuperMeta: number; // % da super meta semanal de bônus
    bateuMeta: boolean;
    bateuSuperMeta: boolean;
    faltaMeta: number; // Quanto falta para a meta
    faltaSuperMeta: number; // Quanto falta para a super meta
    progressDiario: number; // % da meta do dia
}

interface WeeklyBonus {
    meta_bonus: number | null;
    super_meta_bonus: number | null;
}

const WeeklyBonusProgress: React.FC<WeeklyBonusProgressProps> = ({ storeId, colaboradoras }) => {
    const [collaboratorProgress, setCollaboratorProgress] = useState<CollaboratorProgress[]>([]);
    const [weeklyBonuses, setWeeklyBonuses] = useState<WeeklyBonus>({ meta_bonus: null, super_meta_bonus: null });
    const [loading, setLoading] = useState(true);
    const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null);

    useEffect(() => {
        if (storeId && colaboradoras.length > 0) {
            fetchBonusProgress();
        }
    }, [storeId, colaboradoras]);

    function getCurrentWeekRef(): string {
        const hoje = new Date();
        const monday = startOfWeek(hoje, { weekStartsOn: 1 });
        const year = getYear(monday);
        const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
        return `${String(week).padStart(2, '0')}${year}`;
    }

    function getWeekRangeFromRef(weekRef: string): { start: Date; end: Date } {
        let week: number, year: number;
        
        if (!weekRef || weekRef.length !== 6) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef}`);
        }
        
        const firstTwo = parseInt(weekRef.substring(0, 2));
        const firstFour = parseInt(weekRef.substring(0, 4));
        
        if (firstTwo === 20 && firstFour >= 2000 && firstFour <= 2099) {
            year = firstFour;
            week = parseInt(weekRef.substring(4, 6));
        } else if (firstTwo >= 1 && firstTwo <= 53) {
            week = firstTwo;
            year = parseInt(weekRef.substring(2, 6));
        } else {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef}`);
        }
        
        const jan1 = new Date(year, 0, 1);
        const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
        const weekStart = addWeeks(firstMonday, week - 1);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        return { start: weekStart, end: weekEnd };
    }

    const calculateWeeklyGoalFromMonthly = (
        monthlyGoal: number,
        dailyWeights: Record<string, number>,
        weekRange: { start: Date; end: Date }
    ): number => {
        const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
        let totalWeeklyGoal = 0;
        
        weekDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayWeight = dailyWeights[dayKey] || 0;
            const dayGoal = (monthlyGoal * dayWeight) / 100;
            totalWeeklyGoal += dayGoal;
        });
        
        if (Object.keys(dailyWeights).length === 0) {
            const daysInMonth = new Date(weekRange.start.getFullYear(), weekRange.start.getMonth() + 1, 0).getDate();
            const dailyGoal = monthlyGoal / daysInMonth;
            totalWeeklyGoal = dailyGoal * 7;
        }
        
        return totalWeeklyGoal;
    };

    const fetchBonusProgress = async () => {
        setLoading(true);
        try {
            const currentWeek = getCurrentWeekRef();
            const range = getWeekRangeFromRef(currentWeek);
            setWeekRange(range);
            const hoje = new Date();
            const today = format(hoje, 'yyyy-MM-dd');
            const mesAtual = format(hoje, 'yyyyMM');
            const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

            // Buscar bônus semanais
            const { data: bonusesData } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .select("tipo_condicao, valor_bonus")
                .eq("ativo", true)
                .or(`store_id.is.null,store_id.eq.${storeId}`)
                .in("tipo_condicao", ["META_SEMANAL", "SUPER_META_SEMANAL"]);

            let metaBonus = null;
            let superMetaBonus = null;

            if (bonusesData) {
                const metaBonusData = bonusesData.find((b: any) => b.tipo_condicao === 'META_SEMANAL');
                const superMetaBonusData = bonusesData.find((b: any) => b.tipo_condicao === 'SUPER_META_SEMANAL');
                
                metaBonus = metaBonusData?.valor_bonus ? parseFloat(metaBonusData.valor_bonus) : null;
                superMetaBonus = superMetaBonusData?.valor_bonus ? parseFloat(superMetaBonusData.valor_bonus) : null;
            }

            setWeeklyBonuses({ meta_bonus: metaBonus, super_meta_bonus: superMetaBonus });

            // Buscar metas semanais de bônus (individuais) para todas as colaboradoras
            const { data: weeklyGoalsData } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("colaboradora_id, meta_valor, super_meta_valor")
                .eq("store_id", storeId)
                .eq("semana_referencia", currentWeek)
                .eq("tipo", "SEMANAL")
                .not("colaboradora_id", "is", null);

            const weeklyGoalsMap = new Map((weeklyGoalsData || []).map((g: any) => [g.colaboradora_id, g]));

            // Buscar metas mensais individuais (para calcular meta semanal obrigatória e meta diária)
            const { data: monthlyGoalsData } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("colaboradora_id, meta_valor, super_meta_valor, daily_weights")
                .eq("store_id", storeId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .not("colaboradora_id", "is", null);

            const monthlyGoalsMap = new Map((monthlyGoalsData || []).map((g: any) => [g.colaboradora_id, g]));

            // Buscar vendas da semana para cada colaboradora
            const { data: salesData } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("colaboradora_id, valor, data_venda")
                .eq("store_id", storeId)
                .gte("data_venda", format(range.start, "yyyy-MM-dd"))
                .lte("data_venda", format(range.end, "yyyy-MM-dd"));

            // Buscar vendas de hoje
            const { data: salesTodayData } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("colaboradora_id, valor")
                .eq("store_id", storeId)
                .gte("data_venda", `${today}T00:00:00`)
                .lte("data_venda", `${today}T23:59:59`);

            const salesByCollaborator = new Map<string, number>();
            salesData?.forEach((sale: any) => {
                const current = salesByCollaborator.get(sale.colaboradora_id) || 0;
                salesByCollaborator.set(sale.colaboradora_id, current + parseFloat(sale.valor || 0));
            });

            const salesTodayByCollaborator = new Map<string, number>();
            salesTodayData?.forEach((sale: any) => {
                const current = salesTodayByCollaborator.get(sale.colaboradora_id) || 0;
                salesTodayByCollaborator.set(sale.colaboradora_id, current + parseFloat(sale.valor || 0));
            });

            // Processar progresso de cada colaboradora
            const progress: CollaboratorProgress[] = colaboradoras.map(colab => {
                const weeklyGoal = weeklyGoalsMap.get(colab.id);
                const monthlyGoal = monthlyGoalsMap.get(colab.id);
                const realizado = salesByCollaborator.get(colab.id) || 0;
                const realizadoHoje = salesTodayByCollaborator.get(colab.id) || 0;

                let metaValor = 0;
                let superMetaValor = 0;
                let metaDiaria = 0;

                // Se tiver meta semanal de bônus, usar ela. Senão, calcular da mensal
                if (weeklyGoal) {
                    metaValor = parseFloat(weeklyGoal.meta_valor || 0);
                    superMetaValor = parseFloat(weeklyGoal.super_meta_valor || 0);
                } else if (monthlyGoal) {
                    const dailyWeights = monthlyGoal.daily_weights || {};
                    metaValor = calculateWeeklyGoalFromMonthly(
                        parseFloat(monthlyGoal.meta_valor || 0),
                        dailyWeights,
                        range
                    );
                    superMetaValor = calculateWeeklyGoalFromMonthly(
                        parseFloat(monthlyGoal.super_meta_valor || 0),
                        dailyWeights,
                        range
                    );
                }

                // Calcular meta diária
                if (monthlyGoal) {
                    const dailyWeights = monthlyGoal.daily_weights || {};
                    if (Object.keys(dailyWeights).length > 0) {
                        const dayWeight = dailyWeights[today] || 0;
                        metaDiaria = (parseFloat(monthlyGoal.meta_valor || 0) * dayWeight) / 100;
                    } else {
                        metaDiaria = parseFloat(monthlyGoal.meta_valor || 0) / daysInMonth;
                    }
                }

                const progressMeta = metaValor > 0 ? (realizado / metaValor) * 100 : 0;
                const progressSuperMeta = superMetaValor > 0 ? (realizado / superMetaValor) * 100 : 0;
                const progressDiario = metaDiaria > 0 ? (realizadoHoje / metaDiaria) * 100 : 0;
                const bateuMeta = metaValor > 0 && realizado >= metaValor;
                const bateuSuperMeta = superMetaValor > 0 && realizado >= superMetaValor;
                const faltaMeta = Math.max(0, metaValor - realizado);
                const faltaSuperMeta = Math.max(0, superMetaValor - realizado);

                return {
                    colaboradoraId: colab.id,
                    colaboradoraName: colab.name,
                    metaValor,
                    superMetaValor,
                    realizado,
                    metaDiaria,
                    realizadoHoje,
                    progressMeta,
                    progressSuperMeta,
                    progressDiario,
                    bateuMeta,
                    bateuSuperMeta,
                    faltaMeta,
                    faltaSuperMeta
                };
            });

            // Filtrar apenas colaboradoras com metas semanais (bônus ou calculadas)
            const progressFiltered = progress.filter(p => p.metaValor > 0 || p.superMetaValor > 0);
            setCollaboratorProgress(progressFiltered);
        } catch (err) {
            console.error("Error fetching bonus progress:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">Carregando bônus semanais...</div>
                </CardContent>
            </Card>
        );
    }

    if (!weeklyBonuses.meta_bonus && !weeklyBonuses.super_meta_bonus) {
        return null; // Não mostrar se não houver bônus configurados
    }

    if (collaboratorProgress.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                        Nenhuma meta semanal de bônus encontrada para as colaboradoras desta loja.
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Separar colaboradoras por status
    const superMetaAtingidas = collaboratorProgress.filter(p => p.bateuSuperMeta);
    const metaAtingidas = collaboratorProgress.filter(p => p.bateuMeta && !p.bateuSuperMeta);
    const nenhumaAtingida = collaboratorProgress.filter(p => !p.bateuMeta && !p.bateuSuperMeta);

    return (
        <Card className="border-2 shadow-lg">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-primary" />
                        <span>Bônus Semanal</span>
                    </CardTitle>
                    {weekRange && (
                        <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(weekRange.start, "dd/MM", { locale: ptBR })} a {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {/* Cards Individuais por Colaboradora */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {collaboratorProgress
                        .sort((a, b) => {
                            // Ordenar: Super Meta primeiro, Meta segundo, Nenhuma terceiro
                            if (a.bateuSuperMeta && !b.bateuSuperMeta) return -1;
                            if (!a.bateuSuperMeta && b.bateuSuperMeta) return 1;
                            if (a.bateuMeta && !b.bateuMeta) return -1;
                            if (!a.bateuMeta && b.bateuMeta) return 1;
                            return b.realizado - a.realizado;
                        })
                        .map((colab) => {
                            // Determinar cor baseado no status
                            let borderColor = 'border-gray-200 dark:border-gray-800';
                            let bgColor = 'bg-white dark:bg-gray-900';
                            let statusBadge = null;
                            
                            if (colab.bateuSuperMeta) {
                                borderColor = 'border-purple-400 dark:border-purple-800';
                                bgColor = 'bg-purple-50/50 dark:bg-purple-950/20';
                                statusBadge = (
                                    <Badge className="bg-purple-500 text-white text-xs">
                                        <Trophy className="h-3 w-3 mr-1" />
                                        Super Meta
                                    </Badge>
                                );
                            } else if (colab.bateuMeta) {
                                borderColor = 'border-green-400 dark:border-green-800';
                                bgColor = 'bg-green-50/50 dark:bg-green-950/20';
                                statusBadge = (
                                    <Badge className="bg-green-500 text-white text-xs">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Meta
                                    </Badge>
                                );
                            }

                            // Calcular quanto falta para o próximo checkpoint
                            let proximoCheckpoint = null;
                            let faltaProximoCheckpoint = null;
                            
                            if (!colab.bateuMeta && colab.metaValor > 0) {
                                proximoCheckpoint = `Meta Semanal (R$ ${weeklyBonuses.meta_bonus})`;
                                faltaProximoCheckpoint = colab.faltaMeta;
                            } else if (colab.bateuMeta && !colab.bateuSuperMeta && colab.superMetaValor > 0) {
                                proximoCheckpoint = `Super Meta (R$ ${weeklyBonuses.super_meta_bonus})`;
                                faltaProximoCheckpoint = colab.faltaSuperMeta;
                            }

                            return (
                                <Card 
                                    key={colab.colaboradoraId} 
                                    className={`${borderColor} ${bgColor} border-2`}
                                >
                                    <CardHeader className="pb-2 p-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-semibold truncate flex-1">
                                                {colab.colaboradoraName}
                                            </CardTitle>
                                            {statusBadge}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0 space-y-3">
                                        {/* Meta do Dia */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>Meta do Dia</span>
                                                <span className="font-medium">R$ {colab.metaDiaria.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Progress 
                                                    value={Math.min(colab.progressDiario, 100)} 
                                                    className="h-2 flex-1"
                                                />
                                                <span className="text-xs font-semibold whitespace-nowrap">
                                                    {colab.progressDiario.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Vendido hoje: R$ {colab.realizadoHoje.toFixed(2)}
                                            </div>
                                        </div>

                                        {/* Progresso Semanal */}
                                        <div className="space-y-2 pt-2 border-t">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Progresso Semanal</span>
                                                <span className="font-semibold">
                                                    R$ {colab.realizado.toFixed(2)} / R$ {colab.metaValor.toFixed(2)}
                                                </span>
                                            </div>
                                            
                                            {/* Barra de Progresso com Checkpoints */}
                                            <div className="relative">
                                                <Progress 
                                                    value={Math.min(colab.progressMeta, 100)} 
                                                    className={`h-3 ${
                                                        colab.bateuSuperMeta 
                                                            ? 'bg-purple-200 dark:bg-purple-900' 
                                                            : colab.bateuMeta 
                                                                ? 'bg-green-200 dark:bg-green-900' 
                                                                : ''
                                                    }`}
                                                />
                                                {/* Checkpoint 1: Meta Semanal */}
                                                {colab.metaValor > 0 && colab.superMetaValor > 0 && (
                                                    <div 
                                                        className="absolute top-0 h-3 w-0.5 bg-green-500 z-10"
                                                        style={{ left: `${(colab.metaValor / colab.superMetaValor) * 100}%` }}
                                                        title={`Meta Semanal: R$ ${colab.metaValor.toFixed(2)}`}
                                                    />
                                                )}
                                                {/* Checkpoint 2: Super Meta */}
                                                {colab.superMetaValor > 0 && (
                                                    <div 
                                                        className="absolute top-0 right-0 h-3 w-0.5 bg-purple-500 z-10"
                                                        title={`Super Meta: R$ ${colab.superMetaValor.toFixed(2)}`}
                                                    />
                                                )}
                                            </div>

                                            {/* Informação do próximo checkpoint */}
                                            {proximoCheckpoint && faltaProximoCheckpoint !== null && (
                                                <div className="text-xs bg-muted/50 p-2 rounded">
                                                    <div className="text-muted-foreground mb-0.5">Próximo Checkpoint:</div>
                                                    <div className="font-semibold">{proximoCheckpoint}</div>
                                                    <div className="text-muted-foreground mt-1">
                                                        Faltam: <span className="font-bold text-primary">R$ {faltaProximoCheckpoint.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Mensagem de parabéns */}
                                            {(colab.bateuMeta || colab.bateuSuperMeta) && (
                                                <div className={`text-xs p-2 rounded text-center font-medium ${
                                                    colab.bateuSuperMeta 
                                                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100' 
                                                        : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100'
                                                }`}>
                                                    🎉 Parabéns! Você atingiu a {colab.bateuSuperMeta ? 'Super Meta' : 'Meta Semanal'}!
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                </div>

                {/* Resumo por Status */}
                {(superMetaAtingidas.length > 0 || metaAtingidas.length > 0 || nenhumaAtingida.length > 0) && (
                    <div className="space-y-3 pt-4 border-t">
                        {/* Super Meta Atingida */}
                        {superMetaAtingidas.length > 0 && weeklyBonuses.super_meta_bonus !== null && (
                            <div className="bg-purple-50 dark:bg-purple-950/20 border-2 border-purple-300 dark:border-purple-800 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Trophy className="h-5 w-5 text-purple-600" />
                                    <span className="font-bold text-base">Super Meta Semanal - Prêmio: R$ {weeklyBonuses.super_meta_bonus}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {superMetaAtingidas.map(colab => (
                                        <Badge key={colab.colaboradoraId} className="bg-purple-500 text-white">
                                            {colab.colaboradoraName} 🎉
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Meta Atingida */}
                        {metaAtingidas.length > 0 && weeklyBonuses.meta_bonus !== null && (
                            <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-300 dark:border-green-800 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Target className="h-5 w-5 text-green-600" />
                                    <span className="font-bold text-base">Meta Semanal - Prêmio: R$ {weeklyBonuses.meta_bonus}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {metaAtingidas.map(colab => (
                                        <Badge key={colab.colaboradoraId} className="bg-green-500 text-white">
                                            {colab.colaboradoraName} 🎉
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Nenhuma Meta Atingida */}
                        {nenhumaAtingida.length > 0 && (
                            <div className="bg-gray-50 dark:bg-gray-950/20 border-2 border-gray-300 dark:border-gray-800 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Target className="h-5 w-5 text-gray-600" />
                                    <span className="font-bold text-base">Em Progresso</span>
                                </div>
                                <div className="space-y-2">
                                    {nenhumaAtingida.map(colab => (
                                        <div key={colab.colaboradoraId} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded">
                                            <span className="text-sm font-medium">{colab.colaboradoraName}</span>
                                            <span className="text-sm font-bold text-muted-foreground">
                                                Faltam R$ {colab.faltaMeta.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WeeklyBonusProgress;