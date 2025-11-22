import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Zap, TrendingUp, Calendar, Gift } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear, addWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface WeeklyGoalProgressProps {
    storeId?: string;
    colaboradoraId?: string;
    showDetails?: boolean;
}

interface WeeklyProgress {
    semana_referencia: string;
    meta_valor: number; // Meta semanal obrigatória (soma das metas diárias da meta mensal)
    super_meta_valor: number;
    meta_bonus_valor: number | null; // Meta semanal de bônus (opcional)
    super_meta_bonus_valor: number | null;
    realizado: number;
    progress: number; // Progresso em relação à meta obrigatória
    progressBonus: number; // Progresso em relação à meta de bônus
    superProgress: number;
    daysElapsed: number;
    daysRemaining: number;
    projected: number; // Projeção para o final da semana
    projectedByToday: number; // O que deveria ter vendido até hoje (baseado nas metas diárias)
    status: 'on-track' | 'ahead' | 'behind';
    statusByToday: 'on-track' | 'ahead' | 'behind'; // Status baseado no que deveria ter vendido até hoje
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

    // Helper function to calculate weekly goal from monthly goal using daily_weights
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

    const fetchWeeklyProgress = async () => {
        setLoading(true);
        try {
            const currentWeek = getCurrentWeekRef();
            const weekRange = getWeekRange(currentWeek);
            const hoje = new Date();
            const monday = weekRange.start;
            const daysElapsed = Math.floor((hoje.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const daysRemaining = 7 - daysElapsed;
            const mesAtual = format(hoje, 'yyyyMM');

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

            // Fetch monthly goal (MENSAL) - esta é a meta obrigatória
            let monthlyGoalData: any = null;
            
            if (colaboradoraId) {
                // Buscar meta individual mensal
                const { data: goalData } = await supabase
                    .from("goals")
                    .select("*, stores (name)")
                    .eq("store_id", storeId)
                    .eq("colaboradora_id", colaboradoraId)
                    .eq("mes_referencia", mesAtual)
                    .eq("tipo", "INDIVIDUAL")
                    .single();
                
                monthlyGoalData = goalData;
                if (goalData?.stores?.name) {
                    setStoreName(goalData.stores.name);
                }
            } else if (storeId) {
                // Buscar meta mensal da loja
                const { data: goalData } = await supabase
                    .from("goals")
                    .select("*, stores (name)")
                    .eq("store_id", storeId)
                    .eq("mes_referencia", mesAtual)
                    .eq("tipo", "MENSAL")
                    .is("colaboradora_id", null)
                    .single();
                
                monthlyGoalData = goalData;
                if (goalData?.stores?.name) {
                    setStoreName(goalData.stores.name);
                }
            }

            // Calcular meta semanal obrigatória baseada na meta mensal (soma das metas diárias)
            let metaSemanalObrigatoria = 0;
            let superMetaSemanalObrigatoria = 0;
            
            if (monthlyGoalData) {
                const dailyWeights = monthlyGoalData.daily_weights || {};
                metaSemanalObrigatoria = calculateWeeklyGoalFromMonthly(
                    parseFloat(monthlyGoalData.meta_valor || 0),
                    dailyWeights,
                    weekRange
                );
                superMetaSemanalObrigatoria = calculateWeeklyGoalFromMonthly(
                    parseFloat(monthlyGoalData.super_meta_valor || 0),
                    dailyWeights,
                    weekRange
                );
            }

            // Fetch weekly bonus goal (SEMANAL) - meta extra de bônus, se existir
            let weeklyBonusGoal: any = null;
            if (colaboradoraId) {
                const { data: goalData } = await supabase
                    .from("goals")
                    .select("*")
                    .eq("store_id", storeId)
                    .eq("colaboradora_id", colaboradoraId)
                    .eq("semana_referencia", currentWeek)
                    .eq("tipo", "SEMANAL")
                    .single();
                
                weeklyBonusGoal = goalData;
            } else if (storeId) {
                // Para loja, buscar a primeira meta semanal de bônus (se existir)
                const { data: goalsData } = await supabase
                    .from("goals")
                    .select("*")
                    .eq("store_id", storeId)
                    .eq("semana_referencia", currentWeek)
                    .eq("tipo", "SEMANAL")
                    .not("colaboradora_id", "is", null)
                    .limit(1);
                
                if (goalsData && goalsData.length > 0) {
                    weeklyBonusGoal = goalsData[0];
                }
            }

            // Fetch sales for the week (incluindo colaboradoras desativadas até a data de desativação)
            const salesQuery = colaboradoraId
                ? supabase
                    .from("sales")
                    .select("valor, data_venda, colaboradora_id")
                    .eq("colaboradora_id", colaboradoraId)
                : supabase
                    .from("sales")
                    .select("valor, data_venda, colaboradora_id")
                    .eq("store_id", storeId);

            const { data: salesData } = await salesQuery
                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

            // Buscar informações de desativação das colaboradoras (se for loja)
            let deactivationMap = new Map<string, string | null>();
            if (!colaboradoraId && storeId) {
                const { data: colaboradorasInfo } = await supabase
                    .from("profiles")
                    .select("id, active, updated_at")
                    .eq("role", "COLABORADORA")
                    .eq("store_id", storeId);
                
                colaboradorasInfo?.forEach((colab: any) => {
                    if (!colab.active && colab.updated_at) {
                        deactivationMap.set(colab.id, format(new Date(colab.updated_at), "yyyy-MM-dd"));
                    }
                });
            }

            // Filtrar vendas: incluir apenas vendas até a data de desativação (se desativada)
            let filteredSales = salesData || [];
            if (deactivationMap.size > 0) {
                filteredSales = salesData?.filter((sale: any) => {
                    const colabId = sale.colaboradora_id;
                    const saleDate = sale.data_venda ? sale.data_venda.split("T")[0] : null;
                    const deactivationDate = deactivationMap.get(colabId);
                    
                    // Se colaboradora foi desativada e venda é depois do dia da desativação, não incluir
                    // (incluir vendas do próprio dia da desativação, pois ela pode ter vendido nesse dia)
                    if (deactivationDate && saleDate) {
                        const saleDay = new Date(saleDate).setHours(0, 0, 0, 0);
                        const deactivationDay = new Date(deactivationDate).setHours(0, 0, 0, 0);
                        if (saleDay > deactivationDay) {
                            return false;
                        }
                    }
                    return true;
                }) || [];
            }

            const realizado = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.valor || '0'), 0);

            // Calcular o que deveria ter vendido até hoje (baseado nas metas diárias até hoje)
            let projectedByToday = 0;
            if (monthlyGoalData) {
                const dailyWeights = monthlyGoalData.daily_weights || {};
                const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
                const daysUpToToday = weekDays.filter(day => day <= hoje);
                
                daysUpToToday.forEach(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayWeight = dailyWeights[dayKey] || 0;
                    const dayGoal = (parseFloat(monthlyGoalData.meta_valor || 0) * dayWeight) / 100;
                    projectedByToday += dayGoal;
                });
                
                // Se não houver daily_weights, calcular proporcionalmente
                if (Object.keys(dailyWeights).length === 0) {
                    const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                    const dailyGoal = parseFloat(monthlyGoalData.meta_valor || 0) / daysInMonth;
                    projectedByToday = dailyGoal * daysElapsed;
                }
            }

            // Projeção para o final da semana (baseada na média diária até agora)
            const dailyAverage = daysElapsed > 0 ? realizado / daysElapsed : 0;
            const projected = dailyAverage * 7;

            // Status baseado no que deveria ter vendido até hoje
            let statusByToday: 'on-track' | 'ahead' | 'behind' = 'on-track';
            if (projectedByToday > 0) {
                if (realizado >= projectedByToday * 1.1) {
                    statusByToday = 'ahead';
                } else if (realizado < projectedByToday * 0.9) {
                    statusByToday = 'behind';
                }
            }

            // Status baseado na projeção da semana
            let status: 'on-track' | 'ahead' | 'behind' = 'on-track';
            if (metaSemanalObrigatoria > 0) {
                const expectedByWeekEnd = projected;
                if (expectedByWeekEnd >= metaSemanalObrigatoria * 1.1) {
                    status = 'ahead';
                } else if (expectedByWeekEnd < metaSemanalObrigatoria * 0.9) {
                    status = 'behind';
                }
            }

            // Progress calculations
            const progressPercent = metaSemanalObrigatoria > 0 ? (realizado / metaSemanalObrigatoria) * 100 : 0;
            const superProgressPercent = superMetaSemanalObrigatoria > 0 ? (realizado / superMetaSemanalObrigatoria) * 100 : 0;
            const progressBonus = weeklyBonusGoal && weeklyBonusGoal.meta_valor > 0 
                ? (realizado / parseFloat(weeklyBonusGoal.meta_valor)) * 100 
                : 0;

            // Usar meta semanal obrigatória OU meta de bônus (a maior)
            const metaToUse = weeklyBonusGoal && parseFloat(weeklyBonusGoal.meta_valor) > metaSemanalObrigatoria
                ? parseFloat(weeklyBonusGoal.meta_valor)
                : metaSemanalObrigatoria;
            
            const superMetaToUse = weeklyBonusGoal && parseFloat(weeklyBonusGoal.super_meta_valor || 0) > superMetaSemanalObrigatoria
                ? parseFloat(weeklyBonusGoal.super_meta_valor || 0)
                : superMetaSemanalObrigatoria;

            if (metaSemanalObrigatoria > 0 || metaToUse > 0) {
                setProgress({
                    semana_referencia: currentWeek,
                    meta_valor: metaSemanalObrigatoria,
                    super_meta_valor: superMetaSemanalObrigatoria,
                    meta_bonus_valor: weeklyBonusGoal ? parseFloat(weeklyBonusGoal.meta_valor || 0) : null,
                    super_meta_bonus_valor: weeklyBonusGoal ? parseFloat(weeklyBonusGoal.super_meta_valor || 0) : null,
                    realizado,
                    progress: progressPercent,
                    progressBonus,
                    superProgress: superProgressPercent,
                    daysElapsed,
                    daysRemaining,
                    projected,
                    projectedByToday,
                    status,
                    statusByToday
                });
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

    const hoje = new Date();
    const weekRange = getWeekRange(progress.semana_referencia);
    const deficit = Math.max(0, progress.meta_valor - progress.realizado);
    const ahead = Math.max(0, progress.realizado - progress.meta_valor);
    const needsDaily = progress.daysRemaining > 0 ? deficit / progress.daysRemaining : 0;

    // Helper para obter cor do status
    const getStatusColor = (status: 'on-track' | 'ahead' | 'behind') => {
        if (status === 'ahead') return 'text-green-600';
        if (status === 'behind') return 'text-red-600';
        return 'text-yellow-600';
    };

    // Helper para obter texto do status
    const getStatusText = (status: 'on-track' | 'ahead' | 'behind') => {
        if (status === 'ahead') return 'À Frente';
        if (status === 'behind') return 'Atrasado';
        return 'No Ritmo';
    };

    // Badge principal: se já bateu a meta, mostrar isso. Senão, mostrar status por semana (projeção)
    const getMainStatusBadge = () => {
        if (progress.progress >= 100) return { text: 'Meta Batida! 🎉', color: 'bg-green-500', icon: Trophy };
        if (progress.superProgress >= 100) return { text: 'Super Meta! 🚀', color: 'bg-purple-500', icon: Zap };
        // Mostrar status baseado na projeção da semana
        if (progress.status === 'ahead') return { text: 'Projeção: À Frente', color: 'bg-green-500', icon: TrendingUp };
        if (progress.status === 'behind') return { text: 'Projeção: Atrasado', color: 'bg-red-500', icon: Target };
        return { text: 'Projeção: No Ritmo', color: 'bg-yellow-500', icon: Target };
    };

    const mainStatusBadge = getMainStatusBadge();
    const MainStatusIcon = mainStatusBadge.icon;

    // Usar status até hoje para cor da borda (mais relevante para o dia a dia)
    const borderColorClass = progress.progress >= 100 
        ? 'border-green-500' 
        : progress.statusByToday === 'ahead' 
            ? 'border-green-300'
            : progress.statusByToday === 'behind'
                ? 'border-red-300'
                : 'border-yellow-300';

    return (
        <Card className={`border-2 shadow-lg overflow-visible ${borderColorClass}`}>
            <CardHeader className={`bg-gradient-to-r ${mainStatusBadge.color} bg-opacity-10 pb-3`}>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span>Meta Semanal</span>
                        {storeName && <span className="text-sm font-normal text-muted-foreground">({storeName})</span>}
                    </CardTitle>
                    <Badge className={`${mainStatusBadge.color} text-white`}>
                        <MainStatusIcon className="h-3 w-3 mr-1" />
                        {mainStatusBadge.text}
                    </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                    {format(weekRange.start, "dd/MM", { locale: ptBR })} a {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 overflow-visible">
                {/* Progress Bars with Bonus Checkpoints */}
                <div className="space-y-4">
                    {/* Single Unified Progress Bar with Checkpoints */}
                    {progress.super_meta_valor > 0 ? (
                        <div className="space-y-3">
                            {/* Header with labels */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                                        <span className="text-muted-foreground text-xs">Meta: {formatCurrency(progress.meta_valor)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-purple-500 flex-shrink-0"></div>
                                        <span className="text-muted-foreground text-xs">Super: {formatCurrency(progress.super_meta_valor)}</span>
                                    </div>
                                </div>
                                <span className="text-muted-foreground font-semibold text-xs">
                                    Vendido: {formatCurrency(progress.realizado)}
                                </span>
                            </div>

                            {/* Single Progress Bar Container - com padding extra para labels */}
                            <div className="relative pb-8 overflow-x-hidden">
                                <div className="relative h-8 bg-muted rounded-full border-2 border-muted-foreground/20 mb-2 overflow-hidden">
                                {/* Progress Fill - até meta ou realizado (o que for menor) */}
                                <div 
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 transition-all duration-500 rounded-full"
                                    style={{ 
                                        width: `${Math.min(
                                            (progress.realizado / progress.super_meta_valor) * 100, 
                                            (progress.meta_valor / progress.super_meta_valor) * 100
                                        )}%` 
                                    }}
                                />
                                
                                {/* Progress Fill - entre meta e super meta (verde) */}
                                {progress.realizado > progress.meta_valor && (
                                    <div 
                                        className="absolute top-0 h-full bg-gradient-to-r from-green-500 via-green-500/90 to-green-500/80 transition-all duration-500 rounded-full"
                                        style={{ 
                                            left: `${(progress.meta_valor / progress.super_meta_valor) * 100}%`,
                                            width: `${Math.min(
                                                ((progress.realizado - progress.meta_valor) / (progress.super_meta_valor - progress.meta_valor)) * 100,
                                                100 - ((progress.meta_valor / progress.super_meta_valor) * 100)
                                            ) * ((progress.super_meta_valor - progress.meta_valor) / progress.super_meta_valor) * 100}%` 
                                        }}
                                    />
                                )}

                                {/* Checkpoint 1: Meta Semanal Marker (proporcional) */}
                                {progress.meta_valor > 0 && (
                                    <div 
                                        className="absolute top-0 h-full w-1 bg-green-600 z-20 shadow-lg"
                                        style={{ 
                                            left: `${(progress.meta_valor / progress.super_meta_valor) * 100}%`,
                                            transform: 'translateX(-50%)'
                                        }}
                                        title={`Meta Semanal: ${formatCurrency(progress.meta_valor)}`}
                                    />
                                )}

                                {/* Checkpoint 2: Super Meta Marker (final) */}
                                <div 
                                    className="absolute top-0 right-0 h-full w-1 bg-purple-600 z-20 shadow-lg rounded-r-full"
                                    style={{ right: '0' }}
                                    title={`Super Meta: ${formatCurrency(progress.super_meta_valor)}`}
                                />
                            </div>
                            
                            {/* Labels acima da barra - fora do container da barra para não sair */}
                            <div className="relative h-8 mb-2">
                                {/* Label Super Meta acima */}
                                {progress.meta_valor > 0 && (
                                    <div 
                                        className={`absolute text-[10px] sm:text-xs font-bold whitespace-nowrap px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-md ${
                                            progress.realizado >= progress.meta_valor 
                                                ? progress.realizado >= progress.super_meta_valor
                                                    ? 'bg-purple-500 text-white border-2 border-purple-700' 
                                                    : 'bg-green-500 text-white border-2 border-green-700' 
                                                : 'bg-green-200 text-green-800 border border-green-400'
                                        }`}
                                        style={{ 
                                            left: `${Math.min((progress.meta_valor / progress.super_meta_valor) * 100, 95)}%`,
                                            top: '0',
                                            transform: 'translateX(-50%)',
                                            maxWidth: '45%'
                                        }}
                                    >
                                        🎯 Meta
                                        <div className="text-[9px] font-normal mt-0.5 whitespace-nowrap">
                                            {formatCurrency(progress.meta_valor, { showSymbol: false, maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                )}
                                {/* Label Super Meta acima - garantir que não ultrapasse */}
                                <div 
                                    className={`absolute text-[10px] sm:text-xs font-bold whitespace-nowrap px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-md ${
                                        progress.realizado >= progress.super_meta_valor 
                                            ? 'bg-purple-500 text-white border-2 border-purple-700' 
                                            : 'bg-purple-200 text-purple-800 border border-purple-400'
                                    }`}
                                    style={{ 
                                        right: '0',
                                        top: '0',
                                        transform: 'translateX(0)',
                                        maxWidth: '45%',
                                        textAlign: 'right'
                                    }}
                                >
                                    <span className="hidden sm:inline">🏆 </span>Super
                                    <div className="text-[9px] font-normal mt-0.5 whitespace-nowrap">
                                        {formatCurrency(progress.super_meta_valor, { showSymbol: false, maximumFractionDigits: 0 })}
                                    </div>
                                </div>

                                {/* Current Position Indicator - garantir que não ultrapasse o container */}
                                <div 
                                    className="absolute top-1/2 h-6 w-1 bg-foreground z-30 shadow-xl"
                                    style={{ 
                                        left: `${Math.min((progress.realizado / progress.super_meta_valor) * 100, 100)}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    {/* Current value label below - ajustar para não sair */}
                                    <div 
                                        className="absolute top-full text-[10px] sm:text-xs font-bold bg-background border-2 px-2 py-1 rounded shadow-md whitespace-nowrap mt-2"
                                        style={{
                                            left: '50%',
                                            transform: `${Math.min((progress.realizado / progress.super_meta_valor) * 100, 100) >= 90 ? 'translateX(-100%)' : Math.min((progress.realizado / progress.super_meta_valor) * 100, 100) <= 10 ? 'translateX(0)' : 'translateX(-50%)'}`,
                                            maxWidth: 'calc(100vw - 2rem)'
                                        }}
                                    >
                                        {formatCurrency(progress.realizado, { maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>

                            {/* Scale markers below - garantir que não ultrapassem o container */}
                            <div className="flex items-center justify-between text-[9px] sm:text-xs text-muted-foreground px-1 gap-1">
                                <span className="flex-shrink-0 text-xs">R$ 0</span>
                                {progress.meta_valor > 0 && (
                                    <span className="font-medium text-green-600 flex-shrink-0 text-center text-[9px] sm:text-xs hidden sm:inline">
                                        Meta: {formatCurrency(progress.meta_valor, { showSymbol: false, maximumFractionDigits: 0 })}
                                    </span>
                                )}
                                <span className="font-medium text-purple-600 flex-shrink-0 text-right text-[9px] sm:text-xs">
                                    Super: {formatCurrency(progress.super_meta_valor, { showSymbol: false, maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            </div>

                            {/* Status Messages */}
                            <div className="space-y-2">
                                {progress.realizado >= progress.super_meta_valor && weeklyBonuses.super_meta_bonus !== null && (
                                    <div className="text-xs sm:text-sm text-purple-700 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                                        🏆 <strong>Super Meta atingida!</strong> Bônus: R$ {weeklyBonuses.super_meta_bonus}
                                    </div>
                                )}
                                {progress.realizado >= progress.meta_valor && progress.realizado < progress.super_meta_valor && weeklyBonuses.meta_bonus !== null && (
                                    <div className="text-xs sm:text-sm text-green-700 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                        ✅ <strong>Meta atingida!</strong> Bônus: R$ {weeklyBonuses.meta_bonus}
                                        {weeklyBonuses.super_meta_bonus !== null && (
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Faltam {formatCurrency(progress.super_meta_valor - progress.realizado)} para a Super Meta (R$ {weeklyBonuses.super_meta_bonus})
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="font-semibold">Meta Semanal</span>
                                <span className="text-muted-foreground">
                                    {formatCurrency(progress.realizado)} / {formatCurrency(progress.meta_valor)}
                                </span>
                            </div>
                            <div className="relative h-6 bg-muted rounded-full overflow-hidden border border-muted-foreground/20">
                                <Progress 
                                    value={Math.min(progress.progress, 100)} 
                                    className="h-full"
                                />
                            </div>
                        </div>
                    )}

                </div>

                {showDetails && (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
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
                                <div className="text-[10px] text-muted-foreground mt-1">Baseada na média</div>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-lg text-center">
                                <div className="text-xs text-muted-foreground mb-1">Média Diária</div>
                                <div className="text-lg font-bold">
                                    {formatCurrency(progress.realizado / Math.max(progress.daysElapsed, 1))}
                                </div>
                            </div>
                        </div>

                        {/* Status até hoje vs o que deveria ter vendido */}
                        {progress.projectedByToday !== undefined && progress.projectedByToday > 0 && (
                            <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                                progress.statusByToday === 'behind' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
                                progress.statusByToday === 'ahead' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' :
                                'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                            }`}>
                                <div className="flex items-start gap-2">
                                    {progress.statusByToday === 'behind' ? (
                                        <Target className={`h-5 w-5 ${getStatusColor(progress.statusByToday)} mt-0.5 flex-shrink-0`} />
                                    ) : progress.statusByToday === 'ahead' ? (
                                        <TrendingUp className={`h-5 w-5 ${getStatusColor(progress.statusByToday)} mt-0.5 flex-shrink-0`} />
                                    ) : (
                                        <Target className={`h-5 w-5 ${getStatusColor(progress.statusByToday)} mt-0.5 flex-shrink-0`} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-semibold ${getStatusColor(progress.statusByToday)}`}>
                                            Status até {format(hoje, "dd/MM", { locale: ptBR })}: {getStatusText(progress.statusByToday)}
                                        </p>
                                        <div className="text-xs sm:text-sm mt-2 space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Vendido até hoje:</span>
                                                <span className="font-bold">{formatCurrency(progress.realizado)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Meta até hoje:</span>
                                                <span className="font-bold">{formatCurrency(progress.projectedByToday)}</span>
                                            </div>
                                            {progress.realizado >= progress.projectedByToday ? (
                                                <div className="flex justify-between text-green-600 font-bold mt-1 pt-1 border-t">
                                                    <span>Diferença:</span>
                                                    <span>+{formatCurrency(progress.realizado - progress.projectedByToday)} 🎉</span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between text-red-600 font-bold mt-1 pt-1 border-t">
                                                    <span>Faltando:</span>
                                                    <span>{formatCurrency(progress.projectedByToday - progress.realizado)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status Message - Projeção da Semana */}
                        {progress.progress < 100 && progress.daysRemaining > 0 && (
                            <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                                progress.status === 'behind' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
                                progress.status === 'ahead' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' :
                                'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                            }`}>
                                {progress.status === 'behind' ? (
                                    <div className="flex items-start gap-2">
                                        <Target className={`h-5 w-5 ${getStatusColor(progress.status)} mt-0.5 flex-shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-semibold ${getStatusColor(progress.status)}`}>Projeção da Semana: Atrasado</p>
                                            <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-1">
                                                Com base na média diária atual, a projeção para o final da semana é de <strong>{formatCurrency(progress.projected)}</strong>.
                                                Faltam <strong>{formatCurrency(deficit)}</strong> para bater a meta semanal.
                                                Você precisa vender <strong>{formatCurrency(needsDaily)}</strong> por dia nos próximos {progress.daysRemaining} dias.
                                            </p>
                                        </div>
                                    </div>
                                ) : progress.status === 'ahead' ? (
                                    <div className="flex items-start gap-2">
                                        <TrendingUp className={`h-5 w-5 ${getStatusColor(progress.status)} mt-0.5 flex-shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-semibold ${getStatusColor(progress.status)}`}>Projeção da Semana: À Frente</p>
                                            <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 mt-1">
                                                Com base na média diária atual, a projeção para o final da semana é de <strong>{formatCurrency(progress.projected)}</strong>.
                                                {progress.progress >= 100 && (
                                                    <> Você já superou a meta em <strong>{formatCurrency(ahead)}</strong>! Continue assim para bater a super meta!</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <Target className={`h-5 w-5 ${getStatusColor(progress.status)} mt-0.5 flex-shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-semibold ${getStatusColor(progress.status)}`}>Projeção da Semana: No Ritmo</p>
                                            <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                                Com base na média diária atual, a projeção para o final da semana é de <strong>{formatCurrency(progress.projected)}</strong>.
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

