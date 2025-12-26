import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MousePointerClick, Phone, MapPin } from "lucide-react";

interface StatsInsightsProps {
    data: {
        views: { total: number; change: number };
        clicks: { total: number; change: number };
        calls: { total: number; change: number };
        directions: { total: number; change: number };
    };
}

export function StatsInsights({ data }: StatsInsightsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.views.total}</div>
                    <p className="text-xs text-muted-foreground">
                        <span className={data.views.change > 0 ? "text-green-500" : "text-red-500"}>
                            {data.views.change > 0 ? "+" : ""}{data.views.change}%
                        </span>{" "}
                        em relação ao período anterior
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cliques no Site</CardTitle>
                    <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.clicks.total}</div>
                    <p className="text-xs text-muted-foreground">
                        <span className={data.clicks.change > 0 ? "text-green-500" : "text-red-500"}>
                            {data.clicks.change > 0 ? "+" : ""}{data.clicks.change}%
                        </span>{" "}
                        em relação ao período anterior
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Chamadas</CardTitle>
                    <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.calls.total}</div>
                    <p className="text-xs text-muted-foreground">
                        <span className={data.calls.change > 0 ? "text-green-500" : "text-red-500"}>
                            {data.calls.change > 0 ? "+" : ""}{data.calls.change}%
                        </span>{" "}
                        em relação ao período anterior
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rotas Solicitadas</CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{data.directions.total}</div>
                    <p className="text-xs text-muted-foreground">
                        <span className={data.directions.change > 0 ? "text-green-500" : "text-red-500"}>
                            {data.directions.change > 0 ? "+" : ""}{data.directions.change}%
                        </span>{" "}
                        em relação ao período anterior
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
