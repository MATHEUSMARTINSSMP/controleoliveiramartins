import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingUp, TrendingDown, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

interface HistoricalGoal {
    mes: string;
    metaMensal: number;
    vendidoMes: number;
    progress: number;
    atingida: boolean;
    colaboradoras: {
        id: string;
        name: string;
        vendido: number;
        meta: number;
        atingiu: boolean;
    }[];
}

export function GoalsHistory() {
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [historyData, setHistoryData] = useState<HistoricalGoal | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAvailableMonths();
    }, []);

    useEffect(() => {
        if (selectedMonth) {
            fetchHistoryForMonth(selectedMonth);
        }
    }, [selectedMonth]);

    const fetchAvailableMonths = async () => {
        try {
            // Buscar meses únicos que têm metas cadastradas
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("mes_referencia")
                .eq("tipo", "MENSAL")
                .is("colaboradora_id", null)
                .order("mes_referencia", { ascending: false });

            if (error) throw error;

            const uniqueMonths = [...new Set(data?.map((g) => g.mes_referencia) || [])];
            setAvailableMonths(uniqueMonths);

            // Selecionar o mês anterior por padrão
            if (uniqueMonths.length > 1) {
                setSelectedMonth(uniqueMonths[1]); // Segundo item = mês anterior
            } else if (uniqueMonths.length > 0) {
                setSelectedMonth(uniqueMonths[0]);
            }
        } catch (error) {
            console.error("Error fetching available months:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoryForMonth = async (mesRef: string) => {
        try {
            setLoading(true);

            // Buscar meta mensal
            const { data: metaData, error: metaError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor, store_id")
                .eq("mes_referencia", mesRef)
                .eq("tipo", "MENSAL")
                .is("colaboradora_id", null)
                .maybeSingle();

            if (metaError) throw metaError;
            if (!metaData) {
                setHistoryData(null);
                return;
            }

            // Buscar vendas do mês
            const startOfMonth = `${mesRef.slice(0, 4)}-${mesRef.slice(4, 6)}-01`;
            const endOfMonth = `${mesRef.slice(0, 4)}-${mesRef.slice(4, 6)}-${new Date(
                parseInt(mesRef.slice(0, 4)),
                parseInt(mesRef.slice(4, 6)),
                0
            ).getDate()}`;

            const { data: salesData, error: salesError } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor, colaboradora_id, profiles!sales_colaboradora_id_fkey(name)")
                .eq("store_id", metaData.store_id)
                .gte("data_venda", `${startOfMonth}T00:00:00`)
                .lte("data_venda", `${endOfMonth}T23:59:59`);

            if (salesError) throw salesError;

            const vendidoMes = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
            const metaMensal = Number(metaData.meta_valor);
            const progress = metaMensal > 0 ? (vendidoMes / metaMensal) * 100 : 0;

            // Buscar metas individuais
            const { data: metasIndividuais } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("colaboradora_id, meta_valor, profiles!goals_colaboradora_id_fkey(name)")
                .eq("mes_referencia", mesRef)
                .eq("tipo", "INDIVIDUAL")
                .not("colaboradora_id", "is", null);

            // Agrupar vendas por colaboradora
            const salesByColab = salesData?.reduce((acc: any, sale: any) => {
                const colabId = sale.colaboradora_id;
                if (!acc[colabId]) {
                    acc[colabId] = { id: colabId, name: sale.profiles?.name || "Desconhecida", vendido: 0 };
                }
                acc[colabId].vendido += Number(sale.valor || 0);
                return acc;
            }, {});

            // Combinar com metas
            const colaboradoras = metasIndividuais?.map((meta: any) => {
                const vendido = salesByColab?.[meta.colaboradora_id]?.vendido || 0;
                const metaValor = Number(meta.meta_valor);
                return {
                    id: meta.colaboradora_id,
                    name: meta.profiles?.name || "Desconhecida",
                    vendido,
                    meta: metaValor,
                    atingiu: vendido >= metaValor,
                };
            }) || [];

            setHistoryData({
                mes: mesRef,
                metaMensal,
                vendidoMes,
                progress,
                atingida: progress >= 100,
                colaboradoras: colaboradoras.sort((a, b) => b.vendido - a.vendido),
            });
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatMonth = (mesRef: string) => {
        const year = mesRef.slice(0, 4);
        const month = mesRef.slice(4, 6);
        return `${month}/${year}`;
    };

    if (loading && availableMonths.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Histórico de Metas
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

    return (
        <Card className="bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Calendar className="h-5 w-5 text-primary" />
                        Histórico de Metas
                    </CardTitle>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableMonths.map((mes) => (
                                <SelectItem key={mes} value={mes}>
                                    {formatMonth(mes)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!historyData ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Selecione um mês para ver o histórico
                    </p>
                ) : (
                    <>
                        {/* Resumo do Mês */}
                        <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Meta da Loja - {formatMonth(historyData.mes)}</h3>
                                <Badge variant={historyData.atingida ? "default" : "destructive"}>
                                    {historyData.atingida ? (
                                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Atingida</>
                                    ) : (
                                        <><XCircle className="h-3 w-3 mr-1" /> Não atingida</>
                                    )}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Vendido</p>
                                    <p className="font-semibold text-lg">
                                        R$ {historyData.vendidoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Meta</p>
                                    <p className="font-semibold text-lg">
                                        R$ {historyData.metaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                {historyData.progress >= 100 ? (
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                    <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                                <span className={historyData.progress >= 100 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                    {historyData.progress.toFixed(1)}% da meta
                                </span>
                            </div>
                        </div>

                        {/* Colaboradoras */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">Performance Individual</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {historyData.colaboradoras.map((colab) => (
                                    <div
                                        key={colab.id}
                                        className="p-3 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-between"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm break-words">{colab.name}</span>
                                                {colab.atingiu ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                R$ {colab.vendido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} / R${" "}
                                                {colab.meta.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                                            </p>
                                        </div>
                                        <Badge variant={colab.atingiu ? "default" : "outline"} className="ml-2">
                                            {((colab.vendido / colab.meta) * 100).toFixed(0)}%
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
