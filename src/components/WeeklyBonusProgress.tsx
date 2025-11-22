import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Gift, CheckCircle2, XCircle } from "lucide-react";
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
    progressMeta: number; // % da meta semanal de bônus
    progressSuperMeta: number; // % da super meta semanal de bônus
    bateuMeta: boolean;
    bateuSuperMeta: boolean;
    faltaMeta: number; // Quanto falta para a meta
    faltaSuperMeta: number; // Quanto falta para a super meta
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
            const mesAtual = format(hoje, 'yyyyMM');

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

            // Buscar metas mensais individuais (para calcular meta semanal obrigatória)
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
                .select("colaboradora_id, valor")
                .eq("store_id", storeId)
                .gte("data_venda", format(range.start, "yyyy-MM-dd"))
                .lte("data_venda", format(range.end, "yyyy-MM-dd"));

            const salesByCollaborator = new Map<string, number>();
            salesData?.forEach((sale: any) => {
                const current = salesByCollaborator.get(sale.colaboradora_id) || 0;
                salesByCollaborator.set(sale.colaboradora_id, current + parseFloat(sale.valor || 0));
            });

            // Processar progresso de cada colaboradora
            const progress: CollaboratorProgress[] = colaboradoras.map(colab => {
                const weeklyGoal = weeklyGoalsMap.get(colab.id);
                const monthlyGoal = monthlyGoalsMap.get(colab.id);
                const realizado = salesByCollaborator.get(colab.id) || 0;

                let metaValor = 0;
                let superMetaValor = 0;

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

                const progressMeta = metaValor > 0 ? (realizado / metaValor) * 100 : 0;
                const progressSuperMeta = superMetaValor > 0 ? (realizado / superMetaValor) * 100 : 0;
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
                    progressMeta,
                    progressSuperMeta,
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

    const metaAtingidas = collaboratorProgress.filter(p => p.bateuMeta && !p.bateuSuperMeta);
    const metaFaltam = collaboratorProgress.filter(p => !p.bateuMeta);
    const superMetaAtingidas = collaboratorProgress.filter(p => p.bateuSuperMeta);
    const superMetaFaltam = collaboratorProgress.filter(p => p.bateuMeta && !p.bateuSuperMeta);

    return (
        <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-primary" />
                        <span>Bônus Semanal</span>
                    </CardTitle>
                    {weekRange && (
                        <Badge variant="outline" className="text-xs">
                            {format(weekRange.start, "dd/MM", { locale: ptBR })} a {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {/* Meta Semanal */}
                {weeklyBonuses.meta_bonus !== null && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                            <Target className="h-5 w-5 text-green-600" />
                            <h3 className="font-bold text-lg">Meta Semanal</h3>
                            <Badge className="bg-green-500 text-white ml-auto">
                                Prêmio: R$ {weeklyBonuses.meta_bonus}
                            </Badge>
                        </div>

                        {metaAtingidas.length > 0 && (
                            <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-300 dark:border-green-800 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <span className="font-semibold text-green-900 dark:text-green-100">Atingido:</span>
                                </div>
                                {metaAtingidas.map(colab => (
                                    <div key={colab.colaboradoraId} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded">
                                        <span className="font-medium text-sm">{colab.colaboradoraName}</span>
                                        <Badge className="bg-green-500 text-white">
                                            <Trophy className="h-3 w-3 mr-1" />
                                            R$ {weeklyBonuses.meta_bonus}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}

                        {metaFaltam.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-950/20 border-2 border-yellow-300 dark:border-yellow-800 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <XCircle className="h-5 w-5 text-yellow-600" />
                                    <span className="font-semibold text-yellow-900 dark:text-yellow-100">Falta:</span>
                                </div>
                                {metaFaltam.map(colab => (
                                    <div key={colab.colaboradoraId} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded">
                                        <span className="font-medium text-sm">{colab.colaboradoraName}</span>
                                        <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                                            R$ {colab.faltaMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Super Meta Semanal */}
                {weeklyBonuses.super_meta_bonus !== null && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                            <Trophy className="h-5 w-5 text-purple-600" />
                            <h3 className="font-bold text-lg">Super Meta Semanal</h3>
                            <Badge className="bg-purple-500 text-white ml-auto">
                                Prêmio: R$ {weeklyBonuses.super_meta_bonus}
                            </Badge>
                        </div>

                        {superMetaAtingidas.length > 0 && (
                            <div className="bg-purple-50 dark:bg-purple-950/20 border-2 border-purple-300 dark:border-purple-800 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                                    <span className="font-semibold text-purple-900 dark:text-purple-100">Atingido:</span>
                                </div>
                                {superMetaAtingidas.map(colab => (
                                    <div key={colab.colaboradoraId} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded">
                                        <span className="font-medium text-sm">{colab.colaboradoraName}</span>
                                        <Badge className="bg-purple-500 text-white">
                                            <Trophy className="h-3 w-3 mr-1" />
                                            R$ {weeklyBonuses.super_meta_bonus}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}

                        {superMetaFaltam.length > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-300 dark:border-orange-800 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <XCircle className="h-5 w-5 text-orange-600" />
                                    <span className="font-semibold text-orange-900 dark:text-orange-100">Falta:</span>
                                </div>
                                {superMetaFaltam.map(colab => (
                                    <div key={colab.colaboradoraId} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded">
                                        <span className="font-medium text-sm">{colab.colaboradoraName}</span>
                                        <span className="text-sm font-bold text-orange-700 dark:text-orange-300">
                                            R$ {colab.faltaSuperMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WeeklyBonusProgress;
