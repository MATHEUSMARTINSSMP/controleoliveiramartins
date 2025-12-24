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
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Atendimentos Hoje</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">{metrics.total_attendances}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taxa Conversão</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">{metrics.conversion_rate.toFixed(1)}%</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Vendas</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">{metrics.total_sales}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tempo Médio</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">
                        {Math.floor(metrics.avg_attendance_duration / 60)}min
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

