import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { format, getDaysInMonth } from "date-fns";

interface ColaboradoraMetaDiaria {
    id: string;
    name: string;
    vendidoHoje: number;
    metaDiaria: number;
    progress: number;
}

export function DailyMetaTracker() {
    const [colaboradoras, setColaboradoras] = useState<ColaboradoraMetaDiaria[]>([]);
    const [loading, setLoading] = useState(true);
    const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>("TODAS");

    useEffect(() => {
        fetchStores();
    }, []);

    useEffect(() => {
        fetchDailyProgress();
        const interval = setInterval(fetchDailyProgress, 30000);
        return () => clearInterval(interval);
    }, [selectedStore]);

    const fetchStores = async () => {
        const { data } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("id, name")
            .eq("active", true)
            .order("name");

        if (data) setStores(data);
    };

    const fetchDailyProgress = async () => {
        try {
            const hoje = new Date();
            const hojeStr = format(hoje, "yyyy-MM-dd");
            const mesAtual = format(hoje, "yyyyMM");
            const diaAtual = hoje.getDate();
            const totalDias = getDaysInMonth(hoje);

            console.log("[DailyMetaTracker] Buscando metas diárias para:", hojeStr);

            // Buscar todas as metas mensais INDIVIDUAIS (por colaboradora) - usar schema como no dashboard da loja
            const { data: metasData, error: metaError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor, colaboradora_id, daily_weights")
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .not("colaboradora_id", "is", null);

            if (metaError) {
                console.error("[DailyMetaTracker] Erro ao buscar metas:", metaError);
                throw metaError;
            }

            if (!metasData || metasData.length === 0) {
                console.warn("[DailyMetaTracker] Nenhuma meta mensal individual encontrada");
                setColaboradoras([]);
                setLoading(false);
                return;
            }

            console.log("[DailyMetaTracker] Metas individuais encontradas:", metasData.length);

            const colaboradoraIds = metasData.map(m => m.colaboradora_id).filter(Boolean) as string[];

            // Buscar nomes de todas as colaboradoras (com filtro de loja se necessário)
            let profilesQuery = supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("id, name, store_id")
                .in("id", colaboradoraIds);

            if (selectedStore !== "TODAS") {
                profilesQuery = profilesQuery.eq("store_id", selectedStore);
            }

            const { data: profilesData } = await profilesQuery;

            const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p.name]));
            const filteredColabIds = (profilesData || []).map((p: any) => p.id).filter(Boolean) as string[];

            if (filteredColabIds.length === 0) {
                setColaboradoras([]);
                setLoading(false);
                return;
            }

            // Buscar vendas de hoje de todas as colaboradoras - usar schema como no dashboard da loja
            let query = supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor, colaboradora_id")
                .gte("data_venda", `${hojeStr}T00:00:00`)
                .lte("data_venda", `${hojeStr}T23:59:59`);

            if (filteredColabIds.length > 0) {
                query = query.in("colaboradora_id", filteredColabIds);
            }

            const { data: salesData, error: salesError } = await query;

            if (salesError) {
                console.error("[DailyMetaTracker] Erro ao buscar vendas:", salesError);
                throw salesError;
            }

            console.log("[DailyMetaTracker] Vendas encontradas:", salesData?.length || 0);

            // Agrupar vendas por colaboradora
            const salesByColab: Record<string, number> = {};
            salesData?.forEach((sale: any) => {
                const colabId = sale.colaboradora_id;
                if (!salesByColab[colabId]) {
                    salesByColab[colabId] = 0;
                }
                salesByColab[colabId] += Number(sale.valor || 0);
            });

            // Buscar vendas do mês até ontem para calcular déficit e ajustar meta diária
            const { data: salesMonthData } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor, colaboradora_id")
                .gte("data_venda", `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`)
                .lt("data_venda", `${hojeStr}T00:00:00`)
                .in("colaboradora_id", filteredColabIds);

            const salesMonthByColab: Record<string, number> = {};
            salesMonthData?.forEach((sale: any) => {
                const colabId = sale.colaboradora_id;
                if (!salesMonthByColab[colabId]) {
                    salesMonthByColab[colabId] = 0;
                }
                salesMonthByColab[colabId] += Number(sale.valor || 0);
            });

            // Criar lista de colaboradoras com suas metas diárias e vendas (apenas as filtradas)
            const colaboradorasList: ColaboradoraMetaDiaria[] = metasData
                .filter((meta: any) => filteredColabIds.includes(meta.colaboradora_id))
                .map((meta: any) => {
                    const colabId = meta.colaboradora_id;
                    const metaMensal = Number(meta.meta_valor || 0);
                    const dailyWeights = meta.daily_weights || {};
                    const vendidoHoje = salesByColab[colabId] || 0;
                    const vendidoAteOntem = salesMonthByColab[colabId] || 0;

                // Calcular meta diária padrão
                let metaDiariaPadrao = metaMensal / totalDias;
                if (Object.keys(dailyWeights).length > 0) {
                    const hojePeso = dailyWeights[hojeStr] || 0;
                    if (hojePeso > 0) {
                        metaDiariaPadrao = (metaMensal * hojePeso) / 100;
                    }
                }

                // Calcular meta esperada até ontem
                const metaEsperadaAteOntem = Object.keys(dailyWeights).length > 0
                    ? (() => {
                        let soma = 0;
                        for (let dia = 1; dia < diaAtual; dia++) {
                            const dataDia = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
                            const dataStr = format(dataDia, 'yyyy-MM-dd');
                            const peso = dailyWeights[dataStr] || 0;
                            soma += (metaMensal * peso) / 100;
                        }
                        return soma;
                    })()
                    : metaDiariaPadrao * (diaAtual - 1);

                // Calcular déficit e ajustar meta diária
                const deficit = metaEsperadaAteOntem - vendidoAteOntem;
                const diasRestantes = totalDias - diaAtual + 1; // +1 para incluir hoje

                let metaDiaria = metaDiariaPadrao;
                if (diasRestantes > 0 && deficit > 0) {
                    metaDiaria = metaDiariaPadrao + (deficit / diasRestantes);
                }

                const progress = metaDiaria > 0 ? (vendidoHoje / metaDiaria) * 100 : 0;

                    return {
                        id: colabId,
                        name: profilesMap.get(colabId) || "Desconhecida",
                        vendidoHoje,
                        metaDiaria,
                        progress: Math.min(progress, 100),
                    };
                });

            // Ordenar por progresso (maior primeiro)
            colaboradorasList.sort((a, b) => b.progress - a.progress);

            console.log("[DailyMetaTracker] Colaboradoras processadas:", colaboradorasList.length);

            setColaboradoras(colaboradorasList);
        } catch (error) {
            console.error("[DailyMetaTracker] Error fetching daily progress:", error);
        } finally {
            setLoading(false);
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return "bg-green-500";
        if (progress >= 80) return "bg-yellow-500";
        return "bg-red-500";
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Meta Diária
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

    if (!colaboradoras || colaboradoras.length === 0) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Meta Diária
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma meta diária configurada
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5 text-primary" />
                        Meta Diária
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
                    {colaboradoras.map((colab) => (
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
                                <span>Vendido: R$ {colab.vendidoHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Progress value={colab.progress} className={`h-2 ${getProgressColor(colab.progress)}`} />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
