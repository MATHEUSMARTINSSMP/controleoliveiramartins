import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek, getYear, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

interface WeekResult {
    colaboradora_id: string;
    colaboradora_name: string;
    meta_valor: number;
    super_meta_valor: number;
    realizado: number;
    bateu_meta: boolean;
    bateu_super_meta: boolean;
    percentual: number;
}

interface WeeklyGincanaResultsProps {
    storeId: string;
    colaboradoraId?: string; // Se fornecido, mostra apenas resultado da colaboradora
    showAllResults?: boolean; // Se true, mostra todos os resultados; se false, apenas da colaboradora
}

function getCurrentWeekRef(): string {
    const hoje = new Date();
    const monday = startOfWeek(hoje, { weekStartsOn: 1 });
    const year = getYear(monday);
    const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
    return `${String(week).padStart(2, '0')}${year}`;
}

function getWeekRange(weekRef: string): { start: Date; end: Date } {
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

export default function WeeklyGincanaResults({
    storeId,
    colaboradoraId,
    showAllResults = true
}: WeeklyGincanaResultsProps) {
    const [weeklyGoals, setWeeklyGoals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
    const [weekResultsMap, setWeekResultsMap] = useState<Map<string, WeekResult[]>>(new Map());
    const [loadingResultsMap, setLoadingResultsMap] = useState<Map<string, boolean>>(new Map());
    const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
    const [selectedWeekForResults, setSelectedWeekForResults] = useState<string>("");
    const [weekResults, setWeekResults] = useState<WeekResult[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);
    const [fetchingWeeks, setFetchingWeeks] = useState<Set<string>>(new Set()); // Controlar quais semanas estão sendo buscadas

    useEffect(() => {
        fetchWeeklyGoals();
    }, [storeId]);

    const fetchWeeklyGoals = async () => {
        if (!storeId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select(`*, stores (name), profiles (name)`)
                .eq("tipo", "SEMANAL")
                .eq("store_id", storeId)
                .order("created_at", { ascending: false })
                .limit(100);

            if (error) throw error;

            if (data) {
                // Agrupar por semana_referencia
                const grouped = data.reduce((acc: any, goal: any) => {
                    const weekKey = goal.semana_referencia;
                    if (!acc[weekKey]) {
                        acc[weekKey] = [];
                    }
                    acc[weekKey].push(goal);
                    return acc;
                }, {});

                // Converter para array e ordenar
                const weeks = Object.entries(grouped).map(([weekRef, goals]: [string, any]) => ({
                    semana_referencia: weekRef,
                    goals: goals,
                    store: goals[0]?.stores
                }));

                // Ordenar por data (mais recentes primeiro)
                weeks.sort((a, b) => {
                    try {
                        const rangeA = getWeekRange(a.semana_referencia);
                        const rangeB = getWeekRange(b.semana_referencia);
                        return rangeB.start.getTime() - rangeA.start.getTime();
                    } catch {
                        return 0;
                    }
                });

                setWeeklyGoals(weeks);
            }
        } catch (err: any) {
            console.error("Erro ao buscar gincanas:", err);
            toast.error("Erro ao carregar gincanas semanais");
        } finally {
            setLoading(false);
        }
    };

    const fetchWeekResults = async (weekRef: string, useMap = true) => {
        // ✅ PREVENIR CHAMADAS DUPLICADAS: Verificar se já está buscando esta semana
        if (fetchingWeeks.has(weekRef)) {
            console.log(`[WeeklyGincanaResults] Já está buscando resultados para semana ${weekRef}, ignorando...`);
            return;
        }

        // Marcar como sendo buscada
        setFetchingWeeks(prev => new Set(prev).add(weekRef));

        if (useMap) {
            setLoadingResultsMap(prev => new Map(prev).set(weekRef, true));
        }

        try {
            const weekRange = getWeekRange(weekRef);
            const hoje = new Date();
            const isPastWeek = weekRange.end < hoje;

            // ✅ MUDANÇA: Não retornar cedo para semanas atuais - queremos mostrar resultados também
            // Remover a verificação que impedia buscar resultados da semana atual

            // ✅ NOVA LÓGICA: Buscar TODAS as colaboradoras que venderam na semana
            // 1. Primeiro, buscar todas as vendas da semana da loja
            let vendasQuery = supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("colaboradora_id, valor, profiles!sales_colaboradora_id_fkey (name)")
                .eq("store_id", storeId)
                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

            // Se colaboradoraId fornecido e showAllResults false, filtrar apenas essa colaboradora
            if (colaboradoraId && !showAllResults) {
                vendasQuery = vendasQuery.eq("colaboradora_id", colaboradoraId);
            }

            const { data: vendas, error: vendasError } = await vendasQuery;

            if (vendasError) throw vendasError;
            if (!vendas || vendas.length === 0) {
                if (useMap) {
                    setLoadingResultsMap(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(weekRef);
                        return newMap;
                    });
                }
                return;
            }

            // 2. Agrupar vendas por colaboradora e calcular total realizado
            const vendasPorColaboradora = new Map<string, { realizado: number; nome: string }>();

            vendas.forEach((venda: any) => {
                const colabId = venda.colaboradora_id;
                if (!colabId) return;

                const valor = parseFloat(venda.valor || '0');
                const nome = venda.profiles?.name || "Colaboradora desconhecida";

                if (vendasPorColaboradora.has(colabId)) {
                    const atual = vendasPorColaboradora.get(colabId)!;
                    atual.realizado += valor;
                } else {
                    vendasPorColaboradora.set(colabId, { realizado: valor, nome });
                }
            });

            // 3. Buscar metas da gincana para as colaboradoras que venderam
            const colabIdsArray = Array.from(vendasPorColaboradora.keys());

            let metasQuery = supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("*, profiles (name)")
                .eq("store_id", storeId)
                .eq("semana_referencia", weekRef)
                .eq("tipo", "SEMANAL")
                .in("colaboradora_id", colabIdsArray);

            const { data: goals, error: goalsError } = await metasQuery;

            // Criar mapa de metas por colaboradora
            const metasMap = new Map<string, any>();
            if (goals && !goalsError) {
                goals.forEach((goal: any) => {
                    metasMap.set(goal.colaboradora_id, goal);
                });
            }

            // 4. Construir resultados incluindo TODAS as colaboradoras que venderam
            const results: WeekResult[] = Array.from(vendasPorColaboradora.entries()).map(([colabId, dados]) => {
                const goal = metasMap.get(colabId);
                const meta_valor = goal ? parseFloat(goal.meta_valor || 0) : 0;
                const super_meta_valor = goal ? parseFloat(goal.super_meta_valor || 0) : 0;
                const realizado = dados.realizado;
                const bateu_meta = meta_valor > 0 && realizado >= meta_valor;
                const bateu_super_meta = super_meta_valor > 0 && realizado >= super_meta_valor;
                const percentual = meta_valor > 0 ? (realizado / meta_valor) * 100 : 0;

                return {
                    colaboradora_id: colabId,
                    colaboradora_name: dados.nome,
                    meta_valor,
                    super_meta_valor,
                    realizado,
                    bateu_meta,
                    bateu_super_meta,
                    percentual
                };
            });

            const validResults = results;

            if (useMap) {
                setWeekResultsMap(prev => new Map(prev).set(weekRef, validResults));
                setLoadingResultsMap(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(weekRef);
                    return newMap;
                });
            }
        } catch (err: any) {
            console.error("Erro ao buscar resultados:", err);
            if (useMap) {
                setLoadingResultsMap(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(weekRef);
                    return newMap;
                });
            }
        }
    };

    const toggleWeekExpanded = (weekRef: string) => {
        setExpandedWeeks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(weekRef)) {
                newSet.delete(weekRef);
            } else {
                newSet.add(weekRef);
                // Buscar resultados se ainda não foram carregados
                if (!weekResultsMap.has(weekRef)) {
                    fetchWeekResults(weekRef, true);
                }
            }
            return newSet;
        });
    };

    const handleViewResults = async (weekRef: string) => {
        setSelectedWeekForResults(weekRef);
        setResultsDialogOpen(true);
        setLoadingResults(true);

        // Buscar resultados
        try {
            const weekRange = getWeekRange(weekRef);
            const hoje = new Date();
            const isPastWeek = weekRange.end < hoje;

            if (!isPastWeek) {
                toast.info("Esta semana ainda não terminou. Os resultados estarão disponíveis após o término da semana.");
                setLoadingResults(false);
                setResultsDialogOpen(false);
                return;
            }

            // ✅ NOVA LÓGICA: Buscar TODAS as colaboradoras que venderam na semana (igual fetchWeekResults)
            // 1. Buscar todas as vendas da semana da loja
            let vendasQuery = supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("colaboradora_id, valor, profiles!sales_colaboradora_id_fkey (name)")
                .eq("store_id", storeId)
                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

            if (colaboradoraId && !showAllResults) {
                vendasQuery = vendasQuery.eq("colaboradora_id", colaboradoraId);
            }

            const { data: vendas, error: vendasError } = await vendasQuery;

            if (vendasError) throw vendasError;
            if (!vendas || vendas.length === 0) {
                toast.info("Nenhuma venda encontrada para esta semana.");
                setLoadingResults(false);
                return;
            }

            // 2. Agrupar vendas por colaboradora e calcular total realizado
            const vendasPorColaboradora = new Map<string, { realizado: number; nome: string }>();

            vendas.forEach((venda: any) => {
                const colabId = venda.colaboradora_id;
                if (!colabId) return;

                const valor = parseFloat(venda.valor || '0');
                const nome = venda.profiles?.name || "Colaboradora desconhecida";

                if (vendasPorColaboradora.has(colabId)) {
                    const atual = vendasPorColaboradora.get(colabId)!;
                    atual.realizado += valor;
                } else {
                    vendasPorColaboradora.set(colabId, { realizado: valor, nome });
                }
            });

            // 3. Buscar metas da gincana para as colaboradoras que venderam
            const colabIdsArray = Array.from(vendasPorColaboradora.keys());

            let metasQuery = supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("*, profiles (name)")
                .eq("store_id", storeId)
                .eq("semana_referencia", weekRef)
                .eq("tipo", "SEMANAL")
                .in("colaboradora_id", colabIdsArray);

            const { data: goals, error: goalsError } = await metasQuery;

            // Criar mapa de metas por colaboradora
            const metasMap = new Map<string, any>();
            if (goals && !goalsError) {
                goals.forEach((goal: any) => {
                    metasMap.set(goal.colaboradora_id, goal);
                });
            }

            // 4. Construir resultados incluindo TODAS as colaboradoras que venderam
            const validResults: WeekResult[] = Array.from(vendasPorColaboradora.entries()).map(([colabId, dados]) => {
                const goal = metasMap.get(colabId);
                const meta_valor = goal ? parseFloat(goal.meta_valor || 0) : 0;
                const super_meta_valor = goal ? parseFloat(goal.super_meta_valor || 0) : 0;
                const realizado = dados.realizado;
                const bateu_meta = meta_valor > 0 && realizado >= meta_valor;
                const bateu_super_meta = super_meta_valor > 0 && realizado >= super_meta_valor;
                const percentual = meta_valor > 0 ? (realizado / meta_valor) * 100 : 0;

                return {
                    colaboradora_id: colabId,
                    colaboradora_name: dados.nome,
                    meta_valor,
                    super_meta_valor,
                    realizado,
                    bateu_meta,
                    bateu_super_meta,
                    percentual
                };
            });

            setWeekResults(validResults);
        } catch (err: any) {
            console.error("Erro ao buscar resultados:", err);
            toast.error("Erro ao carregar resultados da gincana");
        } finally {
            setLoadingResults(false);
        }
    };


    if (loading) {
        return <div className="text-center py-4 text-muted-foreground">Carregando gincanas...</div>;
    }

    if (weeklyGoals.length === 0) {
        return null; // Não exibir nada se não houver gincanas
    }

    return (
        <>
            <Card className="border-2 border-blue-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-blue-700">
                        <Trophy className="h-6 w-6" />
                        Gincanas Semanais
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {weeklyGoals.map((weekGroup) => {
                            try {
                                const weekRange = getWeekRange(weekGroup.semana_referencia);
                                const hoje = new Date();
                                const isPastWeek = weekRange.end < hoje;
                                const isCurrentWeek = weekGroup.semana_referencia === getCurrentWeekRef();

                                // Se showAllResults false e colaboradoraId fornecido, mostrar apenas se a colaboradora tem meta nesta semana
                                if (!showAllResults && colaboradoraId) {
                                    const hasColabGoal = weekGroup.goals.some((g: any) => g.colaboradora_id === colaboradoraId);
                                    if (!hasColabGoal) return null;
                                }

                                const uniqueColabs = new Set(weekGroup.goals.map((g: any) => g.colaboradora_id).filter((id: any) => id != null));
                                const colabsCount = uniqueColabs.size;

                                // ✅ MUDANÇA: Buscar resultados da semana (realizado por colaboradora)
                                const weekResults = weekResultsMap.get(weekGroup.semana_referencia) || [];
                                const isLoadingWeek = loadingResultsMap.get(weekGroup.semana_referencia) || false;
                                const isFetchingWeek = fetchingWeeks.has(weekGroup.semana_referencia);

                                // Se é semana atual ou futura e ainda não temos resultados, buscar
                                // ✅ CORREÇÃO: Verificar também se não está sendo buscada para evitar loop infinito
                                if ((isCurrentWeek || !isPastWeek) && weekResults.length === 0 && !isLoadingWeek && !isFetchingWeek) {
                                    // Buscar resultados para a semana atual também
                                    fetchWeekResults(weekGroup.semana_referencia, true);
                                }

                                return (
                                    <Card
                                        key={weekGroup.semana_referencia}
                                        className={`relative overflow-hidden shadow-md hover:shadow-lg transition-shadow ${isCurrentWeek ? 'border-2 border-primary' : isPastWeek ? 'border-2 border-muted' : ''
                                            }`}
                                    >
                                        <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 to-purple-500/10">
                                            <CardTitle className="flex justify-between items-center text-lg">
                                                <span>{format(weekRange.start, "dd/MM", { locale: ptBR })} - {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}</span>
                                                <div className="flex gap-2">
                                                    {isCurrentWeek && (
                                                        <span className="text-xs font-normal bg-primary text-primary-foreground px-2 py-1 rounded">
                                                            Semana Atual
                                                        </span>
                                                    )}
                                                    {isPastWeek && !isCurrentWeek && (
                                                        <span className="text-xs font-normal bg-muted text-muted-foreground px-2 py-1 rounded">
                                                            Finalizada
                                                        </span>
                                                    )}
                                                </div>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-4 space-y-3">
                                            {loadingResultsMap.get(weekGroup.semana_referencia) ? (
                                                <div className="text-center py-4 text-muted-foreground text-sm">
                                                    Carregando resultados...
                                                </div>
                                            ) : weekResults.length > 0 ? (
                                                // ✅ MUDANÇA: Mostrar total por colaboradora
                                                <div className="space-y-3">
                                                    {weekResults
                                                        .sort((a, b) => b.realizado - a.realizado)
                                                        .map((result) => (
                                                            <div key={result.colaboradora_id} className="border rounded-lg p-3 space-y-1">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm font-semibold">{result.colaboradora_name}</span>
                                                                    <span className={`text-sm font-bold ${result.bateu_super_meta ? 'text-purple-600' :
                                                                            result.bateu_meta ? 'text-green-600' : 'text-muted-foreground'
                                                                        }`}>
                                                                        {formatCurrency(result.realizado)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                                    <span>Meta: {formatCurrency(result.meta_valor)}</span>
                                                                    <span>{result.percentual.toFixed(0)}%</span>
                                                                </div>
                                                                {result.super_meta_valor > 0 && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        Super: {formatCurrency(result.super_meta_valor)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                </div>
                                            ) : (
                                                // Fallback: mostrar total da loja se não houver resultados ainda
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Total ({colabsCount} colaboradora{colabsCount > 1 ? 's' : ''}):</span>
                                                        <span className="font-bold text-primary">
                                                            {formatCurrency(weekGroup.goals.reduce((sum: number, g: any) => sum + (g.meta_valor || 0), 0))}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Super Meta Total:</span>
                                                        <span className="font-bold text-purple-600">
                                                            {formatCurrency(weekGroup.goals.reduce((sum: number, g: any) => sum + (g.super_meta_valor || 0), 0))}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {isPastWeek && (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => handleViewResults(weekGroup.semana_referencia)}
                                                >
                                                    <Trophy className="h-4 w-4 mr-2" />
                                                    Ver Resultados
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            } catch (err) {
                                console.error(`Erro ao processar semana ${weekGroup.semana_referencia}:`, err);
                                return null;
                            }
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Dialog de Resultados - Formato Bonito como antes */}
            <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Resultados da Gincana Semanal
                        </DialogTitle>
                        {selectedWeekForResults && (() => {
                            try {
                                const weekRange = getWeekRange(selectedWeekForResults);
                                return (
                                    <p className="text-sm text-muted-foreground">
                                        {format(weekRange.start, "dd/MM", { locale: ptBR })} - {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
                                );
                            } catch {
                                return null;
                            }
                        })()}
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {loadingResults ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                                <p className="text-sm text-muted-foreground mt-2">Carregando resultados...</p>
                            </div>
                        ) : weekResults.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Nenhum resultado encontrado para esta gincana.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {weekResults
                                    .sort((a, b) => b.realizado - a.realizado)
                                    .map((result, index) => (
                                        <Card
                                            key={result.colaboradora_id}
                                            className={`border-2 ${result.bateu_super_meta
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                                                    : result.bateu_meta
                                                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                                        : 'border-red-200 bg-red-50 dark:bg-red-950/20'
                                                }`}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                                                            <h3 className="font-semibold text-base">{result.colaboradora_name}</h3>
                                                            {result.bateu_super_meta ? (
                                                                <Badge variant="default" className="bg-purple-600">
                                                                    <Trophy className="h-3 w-3 mr-1" />
                                                                    Super Meta
                                                                </Badge>
                                                            ) : result.bateu_meta ? (
                                                                <Badge variant="default" className="bg-green-600">
                                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                    Meta
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="destructive">
                                                                    <XCircle className="h-3 w-3 mr-1" />
                                                                    Não Bateu
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4 mt-3">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Meta</p>
                                                                <p className="font-semibold text-sm">R$ {result.meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Super Meta</p>
                                                                <p className="font-semibold text-sm">R$ {result.super_meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Realizado</p>
                                                                <p className={`font-bold text-base ${result.bateu_super_meta ? 'text-purple-600' :
                                                                        result.bateu_meta ? 'text-green-600' : 'text-red-600'
                                                                    }`}>
                                                                    R$ {result.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">% da Meta</p>
                                                                <p className={`font-semibold text-sm ${result.percentual >= 100 ? 'text-green-600' : 'text-red-600'
                                                                    }`}>
                                                                    {result.percentual.toFixed(1)}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

