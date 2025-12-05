import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Gift, CheckCircle2, XCircle, Calendar, AlertCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear, addWeeks, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { validateBonusPreRequisitos } from "@/lib/bonusValidation";

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
    preRequisitosValidosMeta?: boolean; // Se pré-requisitos do bônus meta foram cumpridos
    preRequisitosValidosSuperMeta?: boolean; // Se pré-requisitos do bônus super meta foram cumpridos
    preRequisitosReasonMeta?: string; // Motivo se pré-requisitos meta não válidos
    preRequisitosReasonSuperMeta?: string; // Motivo se pré-requisitos super meta não válidos
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

            // Buscar bônus semanais (tanto tipo_condicao quanto condicao_meta_tipo)
            const { data: bonusesData } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .select("id, tipo_condicao, condicao_meta_tipo, valor_bonus, periodo_semana, pre_requisitos")
                .eq("ativo", true)
                .or(`store_id.is.null,store_id.eq.${storeId}`);
            
            // Filtrar bônus semanais (tipo_condicao ou condicao_meta_tipo)
            const weeklyBonuses = bonusesData?.filter((b: any) => 
                (b.tipo_condicao === "META_SEMANAL" || b.tipo_condicao === "SUPER_META_SEMANAL") ||
                (b.condicao_meta_tipo === "GINCANA_SEMANAL" || b.condicao_meta_tipo === "SUPER_GINCANA_SEMANAL")
            ) || [];

            let metaBonus = null;
            let superMetaBonus = null;
            let metaBonusId: string | null = null;
            let superMetaBonusId: string | null = null;
            let metaBonusPreRequisitos: any = null;
            let superMetaBonusPreRequisitos: any = null;

            if (weeklyBonuses.length > 0) {
                // Buscar bônus de gincana semanal para a semana atual (prioridade)
                const gincanaMetaBonus = weeklyBonuses.find((b: any) => 
                    b.condicao_meta_tipo === 'GINCANA_SEMANAL' && b.periodo_semana === currentWeek
                );
                const gincanaSuperMetaBonus = weeklyBonuses.find((b: any) => 
                    b.condicao_meta_tipo === 'SUPER_GINCANA_SEMANAL' && b.periodo_semana === currentWeek
                );
                
                // Fallback para bônus antigos (tipo_condicao)
                const metaBonusData = gincanaMetaBonus || weeklyBonuses.find((b: any) => b.tipo_condicao === 'META_SEMANAL');
                const superMetaBonusData = gincanaSuperMetaBonus || weeklyBonuses.find((b: any) => b.tipo_condicao === 'SUPER_META_SEMANAL');
                
                metaBonus = metaBonusData?.valor_bonus ? parseFloat(metaBonusData.valor_bonus) : null;
                superMetaBonus = superMetaBonusData?.valor_bonus ? parseFloat(superMetaBonusData.valor_bonus) : null;
                metaBonusId = metaBonusData?.id || null;
                superMetaBonusId = superMetaBonusData?.id || null;
                metaBonusPreRequisitos = metaBonusData?.pre_requisitos || null;
                superMetaBonusPreRequisitos = superMetaBonusData?.pre_requisitos || null;
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

            // Processar progresso de cada colaboradora (com validação assíncrona de pré-requisitos)
            const progressPromises = colaboradoras.map(async (colab) => {
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
                let bateuMeta = metaValor > 0 && realizado >= metaValor;
                let bateuSuperMeta = superMetaValor > 0 && realizado >= superMetaValor;
                const faltaMeta = Math.max(0, metaValor - realizado);
                const faltaSuperMeta = Math.max(0, superMetaValor - realizado);

                // Validar pré-requisitos se bateu a meta
                let preRequisitosValidosMeta = true;
                let preRequisitosValidosSuperMeta = true;
                let preRequisitosReasonMeta = "";
                let preRequisitosReasonSuperMeta = "";

                if (bateuMeta && metaBonusId && metaBonusPreRequisitos) {
                    const validation = await validateBonusPreRequisitos(
                        metaBonusPreRequisitos,
                        metaBonusId,
                        colab.id,
                        storeId
                    );
                    preRequisitosValidosMeta = validation.isValid;
                    preRequisitosReasonMeta = validation.reason || "";
                    // Se não cumpriu pré-requisitos, não considera como tendo batido a meta
                    if (!preRequisitosValidosMeta) {
                        bateuMeta = false;
                    }
                }

                if (bateuSuperMeta && superMetaBonusId && superMetaBonusPreRequisitos) {
                    const validation = await validateBonusPreRequisitos(
                        superMetaBonusPreRequisitos,
                        superMetaBonusId,
                        colab.id,
                        storeId
                    );
                    preRequisitosValidosSuperMeta = validation.isValid;
                    preRequisitosReasonSuperMeta = validation.reason || "";
                    // Se não cumpriu pré-requisitos, não considera como tendo batido a super meta
                    if (!preRequisitosValidosSuperMeta) {
                        bateuSuperMeta = false;
                    }
                }

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
                    faltaSuperMeta,
                    preRequisitosValidosMeta,
                    preRequisitosValidosSuperMeta,
                    preRequisitosReasonMeta: preRequisitosReasonMeta || undefined,
                    preRequisitosReasonSuperMeta: preRequisitosReasonSuperMeta || undefined,
                };
            });

            const progress: CollaboratorProgress[] = await Promise.all(progressPromises);

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
            <CardContent className="pt-6 space-y-4">
                {/* Super Meta Semanal */}
                {superMetaAtingidas.length > 0 && weeklyBonuses.super_meta_bonus !== null && (
                    <div className="bg-status-ahead-bg border-2 border-status-ahead-border rounded-lg p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="h-5 w-5 text-primary" />
                            <span className="font-bold text-base sm:text-lg">Super Meta Semanal - Prêmio: R$ {weeklyBonuses.super_meta_bonus}</span>
                        </div>
                        <div className="space-y-2">
                            {superMetaAtingidas.map(colab => (
                                <div key={colab.colaboradoraId} className="space-y-1">
                                    <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
                                        <span className="text-sm sm:text-base font-semibold">{colab.colaboradoraName}</span>
                                        <Badge className="bg-primary text-primary-foreground">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            ATINGIDO
                                        </Badge>
                                    </div>
                                    {colab.preRequisitosReasonSuperMeta && (
                                        <div className="flex items-center gap-1 text-xs text-status-ontrack bg-status-ontrack-bg p-2 rounded">
                                            <AlertCircle className="h-3 w-3" />
                                            <span>{colab.preRequisitosReasonSuperMeta}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Meta Semanal */}
                {metaAtingidas.length > 0 && weeklyBonuses.meta_bonus !== null && (
                    <div className="bg-status-ontrack-bg border-2 border-status-ontrack-border rounded-lg p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="h-5 w-5 text-primary" />
                            <span className="font-bold text-base sm:text-lg">Meta Semanal - Prêmio: R$ {weeklyBonuses.meta_bonus}</span>
                        </div>
                        <div className="space-y-2">
                            {metaAtingidas.map(colab => (
                                <div key={colab.colaboradoraId} className="space-y-1">
                                    <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
                                        <span className="text-sm sm:text-base font-semibold">{colab.colaboradoraName}</span>
                                        <span className="text-sm sm:text-base font-bold text-status-ahead">
                                            Falta R$ {colab.faltaSuperMeta.toFixed(2)} para Super Meta Semanal
                                        </span>
                                    </div>
                                    {colab.preRequisitosReasonMeta && (
                                        <div className="flex items-center gap-1 text-xs text-status-ontrack bg-status-ontrack-bg p-2 rounded">
                                            <AlertCircle className="h-3 w-3" />
                                            <span>{colab.preRequisitosReasonMeta}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Nenhuma Meta Atingida */}
                {nenhumaAtingida.length > 0 && (
                    <div className="bg-muted/30 border-2 border-border rounded-lg p-4 sm:p-6">
                        <div className="space-y-2">
                            {nenhumaAtingida.map(colab => (
                                <div key={colab.colaboradoraId} className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
                                    <span className="text-sm sm:text-base font-semibold">{colab.colaboradoraName}</span>
                                    <span className="text-sm sm:text-base font-bold text-muted-foreground">
                                        Falta R$ {colab.faltaMeta.toFixed(2)} para atingir a Meta Semanal
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WeeklyBonusProgress;