import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, Circle } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface GincanaCollaborator {
    id: string;
    name: string;
    vendidoSemana: number;
    metaSemanal: number;
    progress: number;
    checkpoint1: boolean;
    checkpointFinal: boolean;
}

export function WeeklyGoalsTracker() {
    const [collaborators, setCollaborators] = useState<GincanaCollaborator[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWeeklyGoals();
        const interval = setInterval(fetchWeeklyGoals, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchWeeklyGoals = async () => {
        try {
            const hoje = new Date();
            const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });
            const fimSemana = endOfWeek(hoje, { weekStartsOn: 0 });

            // Buscar todas as colaboradoras ativas
            const { data: colabsData, error: colabsError } = await supabase
                .from("profiles")
                .select("id, name, store_id")
                .eq("role", "COLABORADORA")
                .eq("active", true)
                .order("name");

            if (colabsError) throw colabsError;

            if (!colabsData || colabsData.length === 0) {
                setCollaborators([]);
                setLoading(false);
                return;
            }

            // Para cada colaboradora, buscar meta semanal e vendas
            const collaboratorsWithProgress = await Promise.all(
                colabsData.map(async (colab) => {
                    // Buscar meta semanal individual
                    const { data: metaData } = await supabase
                        .from("goals")
                        .select("meta_valor, super_meta_valor")
                        .eq("colaboradora_id", colab.id)
                        .eq("tipo", "GINCANA_SEMANAL")
                        .maybeSingle();

                    // Buscar vendas da semana
                    const { data: salesData } = await supabase
                        .from("sales")
                        .select("valor")
                        .eq("colaboradora_id", colab.id)
                        .gte("data_venda", format(inicioSemana, "yyyy-MM-dd'T'00:00:00"))
                        .lte("data_venda", format(fimSemana, "yyyy-MM-dd'T'23:59:59"));

                    const vendidoSemana = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
                    const metaSemanal = metaData?.meta_valor || 0;
                    const superMeta = metaData?.super_meta_valor || 0;
                    const progress = metaSemanal > 0 ? (vendidoSemana / metaSemanal) * 100 : 0;

                    return {
                        id: colab.id,
                        name: colab.name,
                        vendidoSemana,
                        metaSemanal,
                        progress: Math.min(progress, 100),
                        checkpoint1: progress >= 100,
                        checkpointFinal: superMeta > 0 && vendidoSemana >= superMeta,
                    };
                })
            );

            // Ordenar por progresso (maior primeiro)
            collaboratorsWithProgress.sort((a, b) => b.progress - a.progress);

            setCollaborators(collaboratorsWithProgress);
        } catch (error) {
            console.error("Error fetching weekly goals:", error);
        } finally {
            setLoading(false);
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return "bg-green-500";
        if (progress >= 80) return "bg-yellow-500";
        return "bg-blue-500";
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Gincanas Semanais
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

    const totalCheckpoint1 = collaborators.filter((c) => c.checkpoint1).length;
    const totalCheckpointFinal = collaborators.filter((c) => c.checkpointFinal).length;

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5 text-primary" />
                    Gincanas Semanais
                    <div className="ml-auto flex gap-1">
                        <Badge variant="secondary" className="text-xs">
                            CP1: {totalCheckpoint1}
                        </Badge>
                        <Badge variant="default" className="text-xs">
                            Final: {totalCheckpointFinal}
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {collaborators.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma gincana configurada
                    </p>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {collaborators.map((colab) => (
                            <div
                                key={colab.id}
                                className="p-2.5 rounded-lg bg-muted/50 border border-border/50 space-y-1.5"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-sm font-medium truncate">{colab.name}</span>
                                        <div className="flex gap-1">
                                            {colab.checkpoint1 && (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" title="Checkpoint 1" />
                                            )}
                                            {colab.checkpointFinal && (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-yellow-600" title="Checkpoint Final" />
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold">{colab.progress.toFixed(0)}%</span>
                                </div>
                                <Progress value={colab.progress} className={`h-1.5 ${getProgressColor(colab.progress)}`} />
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>R$ {colab.vendidoSemana.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                                    <span>Meta: R$ {colab.metaSemanal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
