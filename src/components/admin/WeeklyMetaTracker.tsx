import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, getWeek } from "date-fns";

interface WeeklyMetaData {
    metaValor: number;
    vendidoSemana: number;
    progress: number;
    diasRestantes: number;
    mediaDiariaNecessaria: number;
    storeName: string;
}

export function WeeklyMetaTracker() {
    const [weeklyMeta, setWeeklyMeta] = useState<WeeklyMetaData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWeeklyMeta();
        const interval = setInterval(fetchWeeklyMeta, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchWeeklyMeta = async () => {
        try {
            const hoje = new Date();
            const semanaAtual = `${getWeek(hoje)}${format(hoje, "yyyy")}`;
            const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });
            const fimSemana = endOfWeek(hoje, { weekStartsOn: 0 });

            // Buscar meta semanal da loja
            const { data: metaData, error: metaError } = await supabase
                .from("goals")
                .select("meta_valor, store_id, stores(name)")
                .eq("tipo", "SEMANAL")
                .eq("semana_referencia", semanaAtual)
                .is("colaboradora_id", null)
                .maybeSingle();

            if (metaError) throw metaError;

            if (!metaData) {
                setWeeklyMeta(null);
                setLoading(false);
                return;
            }

            // Buscar vendas da semana
            const { data: salesData, error: salesError } = await supabase
                .from("sales")
                .select("valor")
                .eq("store_id", metaData.store_id)
                .gte("data_venda", format(inicioSemana, "yyyy-MM-dd'T'00:00:00"))
                .lte("data_venda", format(fimSemana, "yyyy-MM-dd'T'23:59:59"));

            if (salesError) throw salesError;

            const vendidoSemana = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
            const metaValor = Number(metaData.meta_valor);
            const progress = metaValor > 0 ? (vendidoSemana / metaValor) * 100 : 0;

            // Calcular dias restantes
            const diasRestantes = Math.max(0, Math.ceil((fimSemana.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
            const faltaParaMeta = Math.max(0, metaValor - vendidoSemana);
            const mediaDiariaNecessaria = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;

            setWeeklyMeta({
                metaValor,
                vendidoSemana,
                progress: Math.min(progress, 100),
                diasRestantes,
                mediaDiariaNecessaria,
                storeName: (metaData.stores as any)?.name || "Loja",
            });
        } catch (error) {
            console.error("Error fetching weekly meta:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Meta Semanal
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

    if (!weeklyMeta) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Meta Semanal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma meta semanal configurada
                    </p>
                </CardContent>
            </Card>
        );
    }

    const getProgressColor = () => {
        if (weeklyMeta.progress >= 100) return "bg-green-500";
        if (weeklyMeta.progress >= 80) return "bg-yellow-500";
        return "bg-blue-500";
    };

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    Meta Semanal
                    <Badge
                        variant={weeklyMeta.progress >= 100 ? "default" : "secondary"}
                        className="ml-auto"
                    >
                        {weeklyMeta.progress.toFixed(0)}%
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Vendido</span>
                        <span className="font-semibold">
                            R$ {weeklyMeta.vendidoSemana.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Meta</span>
                        <span className="font-semibold">
                            R$ {weeklyMeta.metaValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <Progress value={weeklyMeta.progress} className={`h-3 ${getProgressColor()}`} />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Target className="h-3 w-3" />
                            <span>Faltam</span>
                        </div>
                        <p className="text-lg font-bold">
                            R$ {Math.max(0, weeklyMeta.metaValor - weeklyMeta.vendidoSemana).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            <span>Dias restantes</span>
                        </div>
                        <p className="text-lg font-bold">{weeklyMeta.diasRestantes}</p>
                    </div>
                </div>

                {weeklyMeta.diasRestantes > 0 && weeklyMeta.progress < 100 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Média diária necessária</p>
                        <p className="text-lg font-bold text-primary">
                            R$ {weeklyMeta.mediaDiariaNecessaria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                )}

                {weeklyMeta.progress >= 100 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
                        <Trophy className="h-4 w-4" />
                        <span className="text-sm font-semibold">Meta batida! 🎉</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
