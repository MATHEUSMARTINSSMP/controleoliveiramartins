import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TaskStatistics as TaskStatisticsType } from "@/hooks/useTaskStatistics";
import { Trophy, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Loader2 } from "lucide-react";

interface TaskStatisticsProps {
    statistics: TaskStatisticsType | null;
    loading: boolean;
}

export function TaskStatistics({ statistics, loading }: TaskStatisticsProps) {
    if (loading && !statistics) {
        return (
            <Card className="border-2 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Estatísticas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!statistics) return null;

    const completionRate = statistics.total_tasks > 0 
        ? (statistics.completed_tasks / statistics.total_tasks) * 100 
        : 0;

    return (
        <Card className="border-2 shadow-sm bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Relatório do Dia
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {/* Métricas principais */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Total</p>
                        <p className="text-2xl font-bold text-primary">{statistics.total_tasks}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20">
                        <p className="text-xs text-muted-foreground mb-1">Concluídas</p>
                        <p className="text-2xl font-bold text-emerald-600">{statistics.completed_tasks}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
                        <p className="text-xs text-muted-foreground mb-1">Pendentes</p>
                        <p className="text-2xl font-bold text-amber-600">{statistics.pending_tasks}</p>
                    </div>
                </div>

                {/* Taxa de conclusão */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Taxa de Conclusão</span>
                        <Badge variant={completionRate >= 80 ? "default" : completionRate >= 50 ? "secondary" : "destructive"}>
                            {completionRate.toFixed(1)}%
                        </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-full transition-all ${
                                completionRate >= 80 
                                    ? 'bg-emerald-500' 
                                    : completionRate >= 50 
                                    ? 'bg-amber-500' 
                                    : 'bg-rose-500'
                            }`}
                            style={{ width: `${completionRate}%` }}
                        />
                    </div>
                </div>

                {/* Top performers */}
                {statistics.top_performers && statistics.top_performers.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-semibold">Destaques do Dia</span>
                        </div>
                        <div className="space-y-2">
                            {statistics.top_performers.map((performer, index) => (
                                <div
                                    key={performer.profile_id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={index === 0 ? "default" : "outline"}
                                            className={index === 0 ? "bg-amber-500" : ""}
                                        >
                                            {index + 1}º
                                        </Badge>
                                        <span className="text-sm font-medium">{performer.profile_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <span className="text-sm font-semibold text-emerald-600">
                                            {performer.tasks_completed}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

