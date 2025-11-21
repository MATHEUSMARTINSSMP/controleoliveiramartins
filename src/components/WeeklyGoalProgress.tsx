import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Zap, TrendingUp, Calendar, Gift } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface WeeklyGoalProgressProps {
    storeId?: string;
    colaboradoraId?: string;
    showDetails?: boolean;
}

interface WeeklyProgress {
    semana_referencia: string;
    meta_valor: number;
    super_meta_valor: number;
    realizado: number;
    progress: number;
    superProgress: number;
    daysElapsed: number;
    daysRemaining: number;
    projected: number;
    status: 'on-track' | 'ahead' | 'behind';
}

interface WeeklyBonus {
    meta_bonus: number | null;
    super_meta_bonus: number | null;
}

const WeeklyGoalProgress: React.FC<WeeklyGoalProgressProps> = ({ 
    storeId, 
    colaboradoraId,
    showDetails = true 
}) => {
    const [progress, setProgress] = useState<WeeklyProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [storeName, setStoreName] = useState<string>("");
    const [weeklyBonuses, setWeeklyBonuses] = useState<WeeklyBonus>({ meta_bonus: null, super_meta_bonus: null });

    useEffect(() => {
        fetchWeeklyProgress();
    }, [storeId, colaboradoraId]);

    function getCurrentWeekRef(): string {
        const hoje = new Date();
        const monday = startOfWeek(hoje, { weekStartsOn: 1 });
        const year = getYear(monday);
        const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
        // Formato: WWYYYY (ex: 462025 para semana 46 de 2025)
        return `${String(week).padStart(2, '0')}${year}`;
    }

    function getWeekRange(weekRef: string): { start: Date; end: Date } {
        // Suporta ambos os formatos: WWYYYY (novo) e YYYYWW (antigo - para migração)
        let week: number, year: number;
        
        if (!weekRef || weekRef.length !== 6) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (deve ter 6 caracteres)`);
        }
        
        // Verificar se é formato antigo (YYYYWW) ou novo (WWYYYY)
        const firstTwo = parseInt(weekRef.substring(0, 2));
        const firstFour = parseInt(weekRef.substring(0, 4));
        
        // Se começa com 20xx (2000-2099), é formato antigo YYYYWW
        if (firstTwo === 20 && firstFour >= 2000 && firstFour <= 2099) {
            // Formato antigo YYYYWW
            year = firstFour;
            week = parseInt(weekRef.substring(4, 6));
        } else if (firstTwo >= 1 && firstTwo <= 53) {
            // Formato novo WWYYYY (semana entre 1-53)
            week = firstTwo;
            year = parseInt(weekRef.substring(2, 6));
        } else {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (não é YYYYWW nem WWYYYY)`);
        }
        
        // Validar valores
        if (isNaN(week) || isNaN(year)) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (valores não numéricos)`);
        }
        
        if (week < 1 || week > 53) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (semana ${week} fora do range 1-53)`);
        }
        
        if (year < 2000 || year > 2100) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (ano ${year} fora do range 2000-2100)`);
        }
        
        // Get first Monday of the year
        const jan1 = new Date(year, 0, 1);
        const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
        const weekStart = addWeeks(firstMonday, week - 1);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        return { start: weekStart, end: weekEnd };
    }

    const fetchWeeklyProgress = async () => {
        setLoading(true);
        try {
            const currentWeek = getCurrentWeekRef();
            const weekRange = getWeekRange(currentWeek);
            const hoje = new Date();
            const monday = weekRange.start;
            const daysElapsed = Math.floor((hoje.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const daysRemaining = 7 - daysElapsed;

            // Fetch weekly bonuses for the store
            const { data: bonusesData } = await supabase
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

            // Fetch weekly goal
            let weeklyGoal;
            
            if (colaboradoraId) {
                // Individual weekly goal for collaborator
                const { data: goalData } = await supabase
                    .from("goals")
                    .select("*, stores (name)")
                    .eq("store_id", storeId)
                    .eq("colaboradora_id", colaboradoraId)
                    .eq("semana_referencia", currentWeek)
                    .eq("tipo", "SEMANAL")
                    .single();

                weeklyGoal = goalData;
                if (goalData?.stores?.name) {
                    setStoreName(goalData.stores.name);
                }

                // Fetch individual sales for the week
                const { data: salesData } = await supabase
                    .from("sales")
                    .select("valor")
                    .eq("colaboradora_id", colaboradoraId)
                    .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                    .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

                const realizado = salesData?.reduce((sum, sale) => sum + parseFloat(sale.valor || '0'), 0) || 0;

                if (weeklyGoal) {
                    const progressPercent = (realizado / weeklyGoal.meta_valor) * 100;
                    const superProgressPercent = (realizado / weeklyGoal.super_meta_valor) * 100;
                    const dailyAverage = daysElapsed > 0 ? realizado / daysElapsed : 0;
                    const projected = dailyAverage * 7;

                    let status: 'on-track' | 'ahead' | 'behind' = 'on-track';
                    const expectedByNow = (weeklyGoal.meta_valor / 7) * daysElapsed;
                    if (realizado >= expectedByNow * 1.1) {
                        status = 'ahead';
                    } else if (realizado < expectedByNow * 0.9) {
                        status = 'behind';
                    }

                    setProgress({
                        semana_referencia: currentWeek,
                        meta_valor: weeklyGoal.meta_valor,
                        super_meta_valor: weeklyGoal.super_meta_valor,
                        realizado,
                        progress: progressPercent,
                        superProgress: superProgressPercent,
                        daysElapsed,
                        daysRemaining,
                        projected,
                        status
                    });
                }
            } else if (storeId) {
                // Store weekly goal - aggregate all individual goals
                const { data: goalsData } = await supabase
                    .from("goals")
                    .select("*, stores (name)")
                    .eq("store_id", storeId)
                    .eq("semana_referencia", currentWeek)
                    .eq("tipo", "SEMANAL")
                    .not("colaboradora_id", "is", null);

                if (goalsData && goalsData.length > 0) {
                    // Get store name
                    if (goalsData[0]?.stores?.name) {
                        setStoreName(goalsData[0].stores.name);
                    }

                    // Aggregate goals
                    const totalMeta = goalsData.reduce((sum, g) => sum + (g.meta_valor || 0), 0);
                    const totalSuper = goalsData.reduce((sum, g) => sum + (g.super_meta_valor || 0), 0);

                    // Fetch store sales for the week
                    const { data: salesData } = await supabase
                        .from("sales")
                        .select("valor")
                        .eq("store_id", storeId)
                        .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                        .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

                    const realizado = salesData?.reduce((sum, sale) => sum + parseFloat(sale.valor || '0'), 0) || 0;

                    if (totalMeta > 0) {
                        const progressPercent = (realizado / totalMeta) * 100;
                        const superProgressPercent = totalSuper > 0 ? (realizado / totalSuper) * 100 : 0;
                        const dailyAverage = daysElapsed > 0 ? realizado / daysElapsed : 0;
                        const projected = dailyAverage * 7;

                        let status: 'on-track' | 'ahead' | 'behind' = 'on-track';
                        const expectedByNow = (totalMeta / 7) * daysElapsed;
                        if (realizado >= expectedByNow * 1.1) {
                            status = 'ahead';
                        } else if (realizado < expectedByNow * 0.9) {
                            status = 'behind';
                        }

                        setProgress({
                            semana_referencia: currentWeek,
                            meta_valor: totalMeta,
                            super_meta_valor: totalSuper,
                            realizado,
                            progress: progressPercent,
                            superProgress: superProgressPercent,
                            daysElapsed,
                            daysRemaining,
                            projected,
                            status
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching weekly progress:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">Carregando progresso semanal...</div>
                </CardContent>
            </Card>
        );
    }

    if (!progress) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">Meta semanal não encontrada para esta semana.</div>
                </CardContent>
            </Card>
        );
    }

    const weekRange = getWeekRange(progress.semana_referencia);
    const deficit = Math.max(0, progress.meta_valor - progress.realizado);
    const ahead = Math.max(0, progress.realizado - progress.meta_valor);
    const needsDaily = progress.daysRemaining > 0 ? deficit / progress.daysRemaining : 0;

    // Gamification colors and icons
    const getStatusColor = () => {
        if (progress.status === 'ahead') return 'text-green-600';
        if (progress.status === 'behind') return 'text-red-600';
        return 'text-yellow-600';
    };

    const getStatusBadge = () => {
        if (progress.progress >= 100) return { text: 'Meta Batida! 🎉', color: 'bg-green-500', icon: Trophy };
        if (progress.superProgress >= 100) return { text: 'Super Meta! 🚀', color: 'bg-purple-500', icon: Zap };
        if (progress.status === 'ahead') return { text: 'À Frente', color: 'bg-green-500', icon: TrendingUp };
        if (progress.status === 'behind') return { text: 'Atrasado', color: 'bg-red-500', icon: Target };
        return { text: 'No Ritmo', color: 'bg-yellow-500', icon: Target };
    };

    const statusBadge = getStatusBadge();
    const StatusIcon = statusBadge.icon;

    return (
        <Card className={`border-2 shadow-lg overflow-hidden ${
            progress.progress >= 100 ? 'border-green-500' : 
            progress.status === 'ahead' ? 'border-green-300' :
            progress.status === 'behind' ? 'border-red-300' :
            'border-yellow-300'
        }`}>
            <CardHeader className={`bg-gradient-to-r ${statusBadge.color} bg-opacity-10 pb-3`}>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span>Meta Semanal</span>
                        {storeName && <span className="text-sm font-normal text-muted-foreground">({storeName})</span>}
                    </CardTitle>
                    <Badge className={`${statusBadge.color} text-white`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusBadge.text}
                    </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                    {format(weekRange.start, "dd/MM", { locale: ptBR })} a {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                {/* Progress Bars with Bonus Checkpoints */}
                <div className="space-y-4">
                    {/* Unified Progress Bar with Checkpoints */}
                    <div className="relative">
                        {/* Progress Bar Background */}
                        <div className="relative h-12 bg-muted rounded-full overflow-hidden border-2 border-muted-foreground/20">
                            {/* Progress Fill - até meta */}
                            <div 
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 transition-all duration-500"
                                style={{ width: `${Math.min((progress.realizado / progress.super_meta_valor) * 100, (progress.meta_valor / progress.super_meta_valor) * 100)}%` }}
                            />
                            
                            {/* Progress Fill - entre meta e super meta (verde) */}
                            {progress.progress >= 100 && (
                                <div 
                                    className="absolute top-0 h-full bg-gradient-to-r from-green-500 via-green-500/90 to-green-500/80 transition-all duration-500"
                                    style={{ 
                                        left: `${(progress.meta_valor / progress.super_meta_valor) * 100}%`,
                                        width: `${Math.min(((progress.realizado - progress.meta_valor) / (progress.super_meta_valor - progress.meta_valor)) * 100, 100) * ((progress.super_meta_valor - progress.meta_valor) / progress.super_meta_valor) * 100}%` 
                                    }}
                                />
                            )}

                            {/* Checkpoint 1: Meta Semanal Marker */}
                            {weeklyBonuses.meta_bonus !== null && (
                                <>
                                    <div 
                                        className="absolute top-0 h-full w-1 bg-green-500 z-20 shadow-lg"
                                        style={{ left: `${(progress.meta_valor / progress.super_meta_valor) * 100}%`, transform: 'translateX(-50%)' }}
                                    />
                                    {/* Checkpoint Label above */}
                                    <div 
                                        className={`absolute -top-10 left-1/2 transform -translate-x-1/2 text-[10px] sm:text-xs font-bold whitespace-nowrap px-2 py-1 rounded shadow-md z-30 ${
                                            progress.progress >= 100 
                                                ? progress.superProgress >= 100 
                                                    ? 'bg-purple-500 text-white border-2 border-purple-700' 
                                                    : 'bg-green-500 text-white border-2 border-green-700' 
                                                : 'bg-green-200 text-green-800 border border-green-400'
                                        }`}
                                        style={{ left: `${(progress.meta_valor / progress.super_meta_valor) * 100}%` }}
                                    >
                                        🎯 Checkpoint 1
                                        <div className="text-[9px] font-normal mt-0.5">Meta: {formatCurrency(progress.meta_valor, { showSymbol: false })}</div>
                                        {progress.progress >= 100 && !(progress.superProgress >= 100) && (
                                            <div className="text-[9px] font-bold mt-0.5 bg-white/20 px-1 rounded">Bônus: R$ {weeklyBonuses.meta_bonus}</div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Checkpoint 2: Super Meta Semanal Marker */}
                            {weeklyBonuses.super_meta_bonus !== null && (
                                <>
                                    <div 
                                        className="absolute top-0 right-0 h-full w-1 bg-purple-500 z-20 shadow-lg"
                                    />
                                    {/* Checkpoint Label above */}
                                    <div 
                                        className={`absolute -top-10 right-0 text-[10px] sm:text-xs font-bold whitespace-nowrap px-2 py-1 rounded shadow-md z-30 ${
                                            progress.superProgress >= 100 
                                                ? 'bg-purple-500 text-white border-2 border-purple-700' 
                                                : 'bg-purple-200 text-purple-800 border border-purple-400'
                                        }`}
                                    >
                                        🏆 Checkpoint Final
                                        <div className="text-[9px] font-normal mt-0.5">Super: {formatCurrency(progress.super_meta_valor, { showSymbol: false })}</div>
                                        {progress.superProgress >= 100 && (
                                            <div className="text-[9px] font-bold mt-0.5 bg-white/20 px-1 rounded">Bônus: R$ {weeklyBonuses.super_meta_bonus}</div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Current Position Indicator (vertical line) */}
                            <div 
                                className="absolute top-0 h-full w-0.5 bg-foreground z-30 shadow-lg"
                                style={{ left: `${Math.min((progress.realizado / progress.super_meta_valor) * 100, 100)}%` }}
                            >
                                {/* Current value label */}
                                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-[9px] sm:text-xs font-bold bg-background border-2 px-2 py-1 rounded shadow-md whitespace-nowrap">
                                    {formatCurrency(progress.realizado)}
                                    <div className="text-[8px] font-normal text-muted-foreground mt-0.5">
                                        {progress.progress.toFixed(1)}% da Meta
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Scale markers below */}
                        <div className="flex justify-between text-[9px] sm:text-xs text-muted-foreground mt-10">
                            <span>R$ 0</span>
                            {weeklyBonuses.meta_bonus !== null && (
                                <span className="font-medium">{formatCurrency(progress.meta_valor, { showSymbol: false })}</span>
                            )}
                            {weeklyBonuses.super_meta_bonus !== null && (
                                <span className="font-medium">{formatCurrency(progress.super_meta_valor, { showSymbol: false })}</span>
                            )}
                        </div>
                    </div>

                    {/* Bonus Summary */}
                    {(weeklyBonuses.meta_bonus !== null || weeklyBonuses.super_meta_bonus !== null) && (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                <span className="text-xs sm:text-sm font-semibold">Bônus Semanais Disponíveis</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                                {weeklyBonuses.meta_bonus !== null && (
                                    <div className={`p-2 rounded ${progress.progress >= 100 && !(progress.superProgress >= 100) ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500' : 'bg-muted'}`}>
                                        <div className="font-medium">Checkpoint 1: Meta Semanal</div>
                                        <div className={`text-lg font-bold ${progress.progress >= 100 && !(progress.superProgress >= 100) ? 'text-green-700' : 'text-muted-foreground'}`}>
                                            {progress.progress >= 100 && !(progress.superProgress >= 100) ? '✓ ' : ''}R$ {weeklyBonuses.meta_bonus}
                                        </div>
                                        {progress.progress >= 100 && !(progress.superProgress >= 100) && (
                                            <div className="text-[10px] text-green-700 mt-1">✅ Você ganhou este bônus!</div>
                                        )}
                                    </div>
                                )}
                                {weeklyBonuses.super_meta_bonus !== null && (
                                    <div className={`p-2 rounded ${progress.superProgress >= 100 ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500' : 'bg-muted'}`}>
                                        <div className="font-medium">Checkpoint Final: Super Meta</div>
                                        <div className={`text-lg font-bold ${progress.superProgress >= 100 ? 'text-purple-700' : 'text-muted-foreground'}`}>
                                            {progress.superProgress >= 100 ? '✓ ' : ''}R$ {weeklyBonuses.super_meta_bonus}
                                        </div>
                                        {progress.superProgress >= 100 ? (
                                            <div className="text-[10px] text-purple-700 mt-1">✅ Você ganhou este bônus! (Substitui o bônus da meta)</div>
                                        ) : (
                                            <div className="text-[10px] text-muted-foreground mt-1">Não cumulativo: substitui bônus da meta</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {progress.superProgress >= 100 && weeklyBonuses.super_meta_bonus !== null && (
                                <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-xs sm:text-sm text-purple-900 dark:text-purple-100">
                                    🎉 <strong>Parabéns!</strong> Você atingiu a Super Meta e ganhou <strong>R$ {weeklyBonuses.super_meta_bonus}</strong> (bônus não cumulativo)
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {showDetails && (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                            <div className="bg-muted/30 p-3 rounded-lg text-center">
                                <div className="text-xs text-muted-foreground mb-1">Dias Decorridos</div>
                                <div className="text-xl font-bold">{progress.daysElapsed}/7</div>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-lg text-center">
                                <div className="text-xs text-muted-foreground mb-1">Dias Restantes</div>
                                <div className="text-xl font-bold">{progress.daysRemaining}</div>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-lg text-center">
                                <div className="text-xs text-muted-foreground mb-1">Projeção Semanal</div>
                                <div className={`text-lg font-bold ${progress.projected >= progress.meta_valor ? 'text-green-600' : 'text-yellow-600'}`}>
                                    {formatCurrency(progress.projected)}
                                </div>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-lg text-center">
                                <div className="text-xs text-muted-foreground mb-1">Média Diária</div>
                                <div className="text-lg font-bold">
                                    {formatCurrency(progress.realizado / Math.max(progress.daysElapsed, 1))}
                                </div>
                            </div>
                        </div>

                        {/* Status Message */}
                        {progress.progress < 100 && progress.daysRemaining > 0 && (
                            <div className={`p-4 rounded-lg border-2 ${
                                progress.status === 'behind' ? 'bg-red-50 border-red-200' :
                                progress.status === 'ahead' ? 'bg-green-50 border-green-200' :
                                'bg-yellow-50 border-yellow-200'
                            }`}>
                                {progress.status === 'behind' ? (
                                    <div className="flex items-start gap-2">
                                        <Target className="h-5 w-5 text-red-600 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-red-900">Você está atrasado</p>
                                            <p className="text-sm text-red-700 mt-1">
                                                Faltam <strong>{formatCurrency(deficit)}</strong> para bater a meta semanal.
                                                Você precisa vender <strong>{formatCurrency(needsDaily)}</strong> por dia nos próximos {progress.daysRemaining} dias.
                                            </p>
                                        </div>
                                    </div>
                                ) : progress.status === 'ahead' ? (
                                    <div className="flex items-start gap-2">
                                        <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-green-900">Parabéns! Você está à frente</p>
                                            <p className="text-sm text-green-700 mt-1">
                                                Você já superou a meta em <strong>{formatCurrency(ahead)}</strong>! 
                                                Continue assim para bater a super meta!
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <Target className="h-5 w-5 text-yellow-600 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-yellow-900">Você está no ritmo</p>
                                            <p className="text-sm text-yellow-700 mt-1">
                                                Mantenha o ritmo atual para bater a meta semanal!
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {progress.progress >= 100 && (
                            <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300">
                                <div className="flex items-center gap-2">
                                    <Trophy className="h-6 w-6 text-green-600" />
                                    <div>
                                        <p className="font-bold text-green-900 text-lg">🎉 Meta Semanal Batida!</p>
                                        <p className="text-sm text-green-700 mt-1">
                                            Parabéns! Você alcançou a meta semanal. {progress.superProgress < 100 && 'Continue para bater a super meta!'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default WeeklyGoalProgress;

