import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Metrics {
    total_attendances: number;
    total_sales: number;
    total_losses: number;
    conversion_rate: number;
    total_sale_value: number;
    avg_attendance_duration: number;
}

interface ListaDaVezMetricsProps {
    metrics: Metrics | null;
    loading: boolean;
}

export function ListaDaVezMetrics({ metrics, loading }: ListaDaVezMetricsProps) {
    if (loading && !metrics) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i}>
                        <CardContent className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!metrics) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-2 hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Atendimentos Hoje
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <p className="text-3xl font-bold text-primary">{metrics.total_attendances}</p>
                </CardContent>
            </Card>
            <Card className="border-2 hover:border-emerald-500/30 transition-all shadow-sm hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Taxa Conversão
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <p className="text-3xl font-bold text-emerald-600">{metrics.conversion_rate.toFixed(1)}%</p>
                </CardContent>
            </Card>
            <Card className="border-2 hover:border-blue-500/30 transition-all shadow-sm hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Vendas
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <p className="text-3xl font-bold text-blue-600">{metrics.total_sales}</p>
                </CardContent>
            </Card>
            <Card className="border-2 hover:border-amber-500/30 transition-all shadow-sm hover:shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Tempo Médio
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <p className="text-3xl font-bold text-amber-600">
                        {Math.floor(metrics.avg_attendance_duration / 60)}min
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

