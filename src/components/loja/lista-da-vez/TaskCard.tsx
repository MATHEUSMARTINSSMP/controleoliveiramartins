import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DailyTask } from "@/hooks/useDailyTasks";
import { CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TaskCardProps {
    task: DailyTask;
    onToggleComplete: (taskId: string, completed: boolean) => void;
    loading?: boolean;
}

export function TaskCard({ task, onToggleComplete, loading = false }: TaskCardProps) {
    const isCompleted = task.completed_by !== null;
    const isOverdue = task.due_time && !isCompleted && new Date(`2000-01-01T${task.due_time}`) < new Date();

    const formatTime = (time: string | null) => {
        if (!time) return '';
        try {
            const [hours, minutes] = time.split(':');
            return format(new Date(2000, 0, 1, parseInt(hours), parseInt(minutes)), 'HH:mm', { locale: ptBR });
        } catch {
            return time;
        }
    };

    return (
        <div
            className={cn(
                "p-4 border-2 rounded-xl transition-all hover:shadow-md",
                isCompleted
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                    : isOverdue
                    ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                    : "bg-card border-border hover:border-primary/30"
            )}
        >
            <div className="flex items-start gap-3">
                <Checkbox
                    checked={isCompleted}
                    onCheckedChange={(checked) => onToggleComplete(task.id, checked === true)}
                    disabled={loading}
                    className="mt-1 h-5 w-5"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h4
                            className={cn(
                                "text-sm font-semibold",
                                isCompleted && "line-through text-muted-foreground",
                                isOverdue && !isCompleted && "text-rose-700 dark:text-rose-300"
                            )}
                        >
                            {task.title}
                        </h4>
                        {isCompleted && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Concluída
                            </Badge>
                        )}
                    </div>
                    {task.description && (
                        <p
                            className={cn(
                                "text-xs text-muted-foreground mb-2",
                                isCompleted && "line-through"
                            )}
                        >
                            {task.description}
                        </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                        {task.due_time && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-xs",
                                    isOverdue && !isCompleted && "border-rose-500 text-rose-700 dark:text-rose-300"
                                )}
                            >
                                <Clock className="h-3 w-3 mr-1" />
                                Até {formatTime(task.due_time)}
                            </Badge>
                        )}
                        {task.is_recurring && (
                            <Badge variant="outline" className="text-xs">
                                Recorrente
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

