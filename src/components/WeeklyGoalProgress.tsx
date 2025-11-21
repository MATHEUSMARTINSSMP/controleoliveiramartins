import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Zap, TrendingUp, Calendar } from "lucide-react";
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

const WeeklyGoalProgress: React.FC<WeeklyGoalProgressProps> = ({ 
    storeId, 
    colaboradoraId,
    showDetails = true 
}) => {
    const [progress, setProgress] = useState<WeeklyProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [storeName, setStoreName] = useState<string>("");

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
        
        if (weekRef.length === 6) {
            // Verificar se é formato antigo (YYYYWW) ou novo (WWYYYY)
            const firstTwo = parseInt(weekRef.substring(0, 2));
            if (firstTwo > 50) {
                // Provavelmente é ano (20xx), formato antigo YYYYWW
                year = parseInt(weekRef.substring(0, 4));
                week = parseInt(weekRef.substring(4, 6));
            } else {
                // Formato novo WWYYYY
                week = parseInt(weekRef.substring(0, 2));
                year = parseInt(weekRef.substring(2, 6));
            }
        } else {
            // Fallback: assumir formato novo se não tiver 6 caracteres
            week = parseInt(weekRef.substring(0, 2));
            year = parseInt(weekRef.substring(2, 6));
        }
        
        // Validar valores
        if (isNaN(week) || isNaN(year) || week < 1 || week > 53 || year < 2000 || year > 2100) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef}`);
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
                {/* Progress Bars */}
                <div className="space-y-3">
                    {/* Main Goal Progress */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Meta</span>
                            <span className={`text-lg font-bold ${progress.progress >= 100 ? 'text-green-600' : 'text-primary'}`}>
                                {progress.progress.toFixed(1)}%
                            </span>
                        </div>
                        <Progress 
                            value={Math.min(progress.progress, 100)} 
                            className="h-4"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>{formatCurrency(progress.realizado)}</span>
                            <span>{formatCurrency(progress.meta_valor)}</span>
                        </div>
                    </div>

                    {/* Super Goal Progress */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Super Meta</span>
                            <span className={`text-lg font-bold ${progress.superProgress >= 100 ? 'text-purple-600' : 'text-purple-500'}`}>
                                {progress.superProgress.toFixed(1)}%
                            </span>
                        </div>
                        <Progress 
                            value={Math.min(progress.superProgress, 100)} 
                            className="h-4 bg-purple-100"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>{formatCurrency(progress.realizado)}</span>
                            <span>{formatCurrency(progress.super_meta_valor)}</span>
                        </div>
                    </div>
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

