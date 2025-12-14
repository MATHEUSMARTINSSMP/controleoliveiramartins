import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

const getSupabaseClient = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    return supabase;
};

/**
 * Retorna uma data no fuso horário de Brasília (America/Sao_Paulo)
 * para garantir que as queries usem o timezone correto
 */
const getBrazilDateString = (date: Date): string => {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
};

const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getCurrentWeekRef = () => {
    const hoje = new Date();
    const year = hoje.getFullYear();
    const week = getWeekNumber(hoje);
    return `${week}${year}`;
};

const getWeekRange = (weekRef: string) => {
    const week = parseInt(weekRef.substring(0, 2));
    const year = parseInt(weekRef.substring(2));
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const weekStart = new Date(year, 0, 4 + (week - 1) * 7 - jan4Day + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return { start: weekStart, end: weekEnd };
};

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
    colaboradoraId?: string;
    showAllResults?: boolean;
}

export default function WeeklyGincanaResults({ 
    storeId, 
    colaboradoraId, 
    showAllResults = true 
}: WeeklyGincanaResultsProps) {
    const [weeklyGoals, setWeeklyGoals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // ✅ Inicializar com apenas a semana atual expandida
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
        const currentWeek = getCurrentWeekRef();
        return new Set([currentWeek]);
    });
    const [weekResultsMap, setWeekResultsMap] = useState<Map<string, WeekResult[]>>(new Map());
    const [loadingResultsMap, setLoadingResultsMap] = useState<Map<string, boolean>>(new Map());
    const [fetchingWeeks, setFetchingWeeks] = useState<Set<string>>(new Set()); // Controlar quais semanas estão sendo buscadas
    const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
    const [selectedWeekForResults, setSelectedWeekForResults] = useState<string>("");
    const [weekResults, setWeekResults] = useState<WeekResult[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);

    useEffect(() => {
        fetchWeeklyGoals();
    }, [storeId]);

    // ✅ Buscar resultados das semanas atuais/futuras apenas uma vez quando weeklyGoals mudar
    useEffect(() => {
        if (weeklyGoals.length === 0) return;

        const hoje = new Date();
        const currentWeekRef = getCurrentWeekRef();

        weeklyGoals.forEach((weekGroup) => {
            try {
                const weekRange = getWeekRange(weekGroup.semana_referencia);
                const isPastWeek = weekRange.end < hoje;
                const isCurrentWeek = weekGroup.semana_referencia === currentWeekRef;
                
                // Buscar apenas semanas atuais ou futuras que ainda não foram buscadas
                if ((isCurrentWeek || !isPastWeek)) {
                    const hasWeekResults = weekResultsMap.has(weekGroup.semana_referencia);
                    const isLoadingWeek = loadingResultsMap.get(weekGroup.semana_referencia) || false;
                    const isFetchingWeek = fetchingWeeks.has(weekGroup.semana_referencia);

                    if (!hasWeekResults && !isLoadingWeek && !isFetchingWeek) {
                        fetchWeekResults(weekGroup.semana_referencia, true);
                    }
                }
            } catch (err) {
                console.error(`Erro ao processar semana ${weekGroup.semana_referencia}:`, err);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weeklyGoals.length]); // Apenas quando o número de semanas mudar

    const fetchWeeklyGoals = async () => {
        setLoading(true);
        try {
            const supabase = await getSupabaseClient();
            let query = supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("*, profiles!goals_colaboradora_id_fkey(name)")
                .eq("store_id", storeId)
                .eq("tipo", "SEMANAL")
                .not("semana_referencia", "is", null)
                .order("semana_referencia", { ascending: false });

            if (colaboradoraId && !showAllResults) {
                query = query.eq("colaboradora_id", colaboradoraId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Agrupar por semana_referencia
            const grouped = (data || []).reduce((acc: any, goal: any) => {
                const weekRef = goal.semana_referencia;
                if (!acc[weekRef]) {
                    acc[weekRef] = {
                        semana_referencia: weekRef,
                        goals: [],
                    };
                }
                acc[weekRef].goals.push(goal);
                return acc;
            }, {});

            setWeeklyGoals(Object.values(grouped));
        } catch (err: any) {
            console.error("Erro ao buscar gincanas semanais:", err);
            toast.error("Erro ao carregar gincanas semanais");
        } finally {
            setLoading(false);
        }
    };

    const fetchWeekResults = async (weekRef: string, useMap = true) => {
        // ✅ Prevenir busca duplicada
        if (fetchingWeeks.has(weekRef)) {
            console.log(`[WeeklyGincanaResults] Já está buscando resultados para semana ${weekRef}, ignorando...`);
            return;
        }

        // ✅ Adicionar à lista de semanas sendo buscadas
        setFetchingWeeks(prev => {
            const newSet = new Set(prev);
            newSet.add(weekRef);
            return newSet;
        });

        if (useMap) {
            setLoadingResultsMap(prev => {
                const newMap = new Map(prev);
                newMap.set(weekRef, true);
                return newMap;
            });
        } else {
            setLoadingResults(true);
        }

        try {
            const supabase = await getSupabaseClient();
            const weekRange = getWeekRange(weekRef);

            // 1. Buscar todas as vendas da semana para a loja
            // Usar timezone do Brasil para garantir que as datas estejam corretas
            const startDateStr = getBrazilDateString(weekRange.start);
            const endDateStr = getBrazilDateString(weekRange.end);
            
            const { data: allSales, error: allSalesError } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor, colaboradora_id, profiles!sales_colaboradora_id_fkey(name)")
                .eq("store_id", storeId)
                .gte("data_venda", `${startDateStr}T00:00:00-03:00`)
                .lte("data_venda", `${endDateStr}T23:59:59-03:00`);

            if (allSalesError) throw allSalesError;

            const vendasPorColaboradora = new Map<string, { nome: string; realizado: number }>();

            // Agrupar vendas por colaboradora
            allSales?.forEach((sale: any) => {
                const colabId = sale.colaboradora_id;
                if (colabId) {
                    if (!vendasPorColaboradora.has(colabId)) {
                        vendasPorColaboradora.set(colabId, {
                            nome: sale.profiles?.name || "Colaboradora desconhecida",
                            realizado: 0,
                        });
                    }
                    const dados = vendasPorColaboradora.get(colabId)!;
                    dados.realizado += parseFloat(sale.valor || '0');
                }
            });

            // 2. Buscar metas da semana
            let goalsQuery = supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("*, profiles!goals_colaboradora_id_fkey(name)")
                .eq("store_id", storeId)
                .eq("semana_referencia", weekRef)
                .eq("tipo", "SEMANAL")
                .not("colaboradora_id", "is", null);

            if (colaboradoraId && !showAllResults) {
                goalsQuery = goalsQuery.eq("colaboradora_id", colaboradoraId);
            }

            const { data: goals, error: goalsError } = await goalsQuery;
            if (goalsError) throw goalsError;

            // 3. Criar mapa de metas por colaboradora
            const metasMap = new Map<string, any>();
            if (goals) {
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

            if (useMap) {
                setWeekResultsMap(prev => {
                    const newMap = new Map(prev);
                    newMap.set(weekRef, validResults.length > 0 ? validResults : []);
                    return newMap;
                });
            } else {
                setWeekResults(validResults);
            }
        } catch (err: any) {
            console.error("Erro ao buscar resultados:", err);
            toast.error("Erro ao carregar resultados da gincana");
            if (useMap) {
                setWeekResultsMap(prev => {
                    const newMap = new Map(prev);
                    newMap.set(weekRef, []);
                    return newMap;
                });
            }
        } finally {
            if (useMap) {
                setLoadingResultsMap(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(weekRef);
                    return newMap;
                });
            } else {
                setLoadingResults(false);
            }
            // ✅ IMPORTANTE: Sempre remover da lista de semanas sendo buscadas, mesmo em caso de erro
            setFetchingWeeks(prev => {
                const newSet = new Set(prev);
                newSet.delete(weekRef);
                return newSet;
            });
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

    const handleViewResults = (weekRef: string) => {
        setSelectedWeekForResults(weekRef);
        setResultsDialogOpen(true);
        fetchWeekResults(weekRef, false);
    };

    if (loading) {
        return <div className="text-center py-4 text-muted-foreground">Carregando gincanas...</div>;
    }

    if (weeklyGoals.length === 0) {
        return null; // Não exibir nada se não houver gincanas
    }

    // Função para renderizar card da semana (com Collapsible)
    const renderWeekCard = (weekGroup: any, isCurrentWeek: boolean) => {
        try {
            const weekRange = getWeekRange(weekGroup.semana_referencia);
            const hoje = new Date();
            const isPastWeek = weekRange.end < hoje;
            const weekRef = weekGroup.semana_referencia;
            const isExpanded = expandedWeeks.has(weekRef);

            // Se showAllResults false e colaboradoraId fornecido, mostrar apenas se a colaboradora tem meta nesta semana
            if (!showAllResults && colaboradoraId) {
                const hasColabGoal = weekGroup.goals.some((g: any) => g.colaboradora_id === colaboradoraId);
                if (!hasColabGoal) return null;
            }

            const weekResults = weekResultsMap.get(weekRef);

            return (
                <Collapsible
                    key={weekRef}
                    open={isExpanded}
                    onOpenChange={(open) => {
                        toggleWeekExpanded(weekRef);
                    }}
                >
                    <Card
                        className={`relative overflow-hidden transition-all ${
                            isCurrentWeek 
                                ? 'border-4 border-primary shadow-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-purple-500/10 scale-105 z-10' 
                                : isPastWeek 
                                    ? 'border-2 border-muted shadow-md hover:shadow-lg' 
                                    : 'border-2 border-border shadow-md hover:shadow-lg'
                        }`}
                    >
                        <CollapsibleTrigger asChild>
                            <CardHeader className={`pb-2 cursor-pointer ${
                                isCurrentWeek 
                                    ? 'bg-gradient-to-r from-primary/30 via-primary/20 to-purple-500/20' 
                                    : 'bg-gradient-to-r from-primary/10 to-purple-500/10'
                            }`}>
                                <CardTitle className={`flex justify-between items-center ${isCurrentWeek ? 'text-lg font-bold' : 'text-lg'}`}>
                                    <span className={isCurrentWeek ? 'text-primary font-bold' : ''}>
                                        {format(weekRange.start, "dd/MM", { locale: ptBR })} - {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                    <div className="flex gap-2 items-center">
                                        {isCurrentWeek && (
                                            <span className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                                                ⭐ Semana Atual
                                            </span>
                                        )}
                                        {isPastWeek && !isCurrentWeek && (
                                            <span className="text-xs font-normal bg-muted text-muted-foreground px-2 py-1 rounded">
                                                Finalizada
                                            </span>
                                        )}
                                        {!isCurrentWeek && (
                                            isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )
                                        )}
                                    </div>
                                </CardTitle>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="pt-4 space-y-3">
                                {loadingResultsMap.get(weekRef) ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                        Carregando resultados...
                                    </div>
                                ) : weekResults && weekResults.length > 0 ? (
                                    // ✅ SEMPRE mostrar valores por colaboradora
                                    <div className="space-y-3">
                                        {weekResults
                                            .sort((a, b) => b.realizado - a.realizado)
                                            .map((result) => (
                                                <div 
                                                    key={result.colaboradora_id} 
                                                    className={`border rounded-lg p-3 space-y-1 ${
                                                        isCurrentWeek ? 'bg-background/80 border-primary/30' : 'bg-muted/30'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-semibold">{result.colaboradora_name}</span>
                                                        <span className={`text-sm font-bold ${
                                                            result.bateu_super_meta ? 'text-purple-600' :
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
                                    // Se não houver resultados ainda, mostrar metas por colaboradora
                                    <div className="space-y-3">
                                        {weekGroup.goals
                                            .filter((g: any) => g.colaboradora_id)
                                            .map((goal: any) => (
                                                <div 
                                                    key={goal.id} 
                                                    className={`border rounded-lg p-3 space-y-1 ${
                                                        isCurrentWeek ? 'bg-background/80 border-primary/30' : 'bg-muted/30'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-semibold">{goal.profiles?.name || 'Colaboradora'}</span>
                                                        <span className="text-sm font-bold text-muted-foreground">
                                                            R$ 0,00
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>Meta: {formatCurrency(goal.meta_valor || 0)}</span>
                                                        <span>0%</span>
                                                    </div>
                                                    {goal.super_meta_valor > 0 && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Super: {formatCurrency(goal.super_meta_valor)}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                )}
                                {isPastWeek && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleViewResults(weekRef)}
                                    >
                                        <Trophy className="h-4 w-4 mr-2" />
                                        Ver Resultados
                                    </Button>
                                )}
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
            );
        } catch (err) {
            console.error(`Erro ao processar semana ${weekGroup.semana_referencia}:`, err);
            return null;
        }
    };

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
                    {/* Próximas Semanas */}
                    {weeklyGoals.filter((wg) => {
                        try {
                            const range = getWeekRange(wg.semana_referencia);
                            const hoje = new Date();
                            return range.start > hoje;
                        } catch {
                            return false;
                        }
                    }).length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Próximas Semanas</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {weeklyGoals
                                    .filter((wg) => {
                                        try {
                                            const range = getWeekRange(wg.semana_referencia);
                                            const hoje = new Date();
                                            return range.start > hoje;
                                        } catch {
                                            return false;
                                        }
                                    })
                                    .map((weekGroup) => renderWeekCard(weekGroup, false))}
                            </div>
                        </div>
                    )}

                    {/* Semana Atual */}
                    {weeklyGoals
                        .filter((wg) => wg.semana_referencia === getCurrentWeekRef())
                        .map((weekGroup) => renderWeekCard(weekGroup, true))}

                    {/* Semanas Anteriores */}
                    {weeklyGoals.filter((wg) => {
                        try {
                            const range = getWeekRange(wg.semana_referencia);
                            const hoje = new Date();
                            const isCurrent = wg.semana_referencia === getCurrentWeekRef();
                            return range.end < hoje && !isCurrent;
                        } catch {
                            return false;
                        }
                    }).length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Semanas Anteriores</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {weeklyGoals
                                    .filter((wg) => {
                                        try {
                                            const range = getWeekRange(wg.semana_referencia);
                                            const hoje = new Date();
                                            const isCurrent = wg.semana_referencia === getCurrentWeekRef();
                                            return range.end < hoje && !isCurrent;
                                        } catch {
                                            return false;
                                        }
                                    })
                                    .map((weekGroup) => renderWeekCard(weekGroup, false))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog de Resultados Detalhados */}
            {resultsDialogOpen && selectedWeekForResults && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                Resultados da Gincana Semanal
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingResults ? (
                                <div className="text-center py-8 text-muted-foreground">Carregando resultados...</div>
                            ) : weekResults.length > 0 ? (
                                <div className="space-y-4">
                                    {weekResults
                                        .sort((a, b) => b.realizado - a.realizado)
                                        .map((result) => (
                                            <div key={result.colaboradora_id} className="border rounded-lg p-4 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold">{result.colaboradora_name}</span>
                                                    <span className={`text-lg font-bold ${
                                                        result.bateu_super_meta ? 'text-purple-600' :
                                                        result.bateu_meta ? 'text-green-600' : 'text-muted-foreground'
                                                    }`}>
                                                        {formatCurrency(result.realizado)}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-sm text-muted-foreground">
                                                        <span>Meta: {formatCurrency(result.meta_valor)}</span>
                                                        <span>{result.percentual.toFixed(1)}%</span>
                                                    </div>
                                                    {result.super_meta_valor > 0 && (
                                                        <div className="flex justify-between text-sm text-muted-foreground">
                                                            <span>Super Meta: {formatCurrency(result.super_meta_valor)}</span>
                                                            <span className={result.bateu_super_meta ? 'text-purple-600 font-semibold' : ''}>
                                                                {result.realizado >= result.super_meta_valor ? '✅' : '❌'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <Progress value={result.percentual} className="h-2" />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">Nenhum resultado encontrado para esta semana.</div>
                            )}
                            <div className="mt-6 flex justify-end">
                                <Button onClick={() => setResultsDialogOpen(false)}>Fechar</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}
