import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DailyTask } from "@/hooks/useDailyTasks";
import { CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TaskCardProps {
    task: DailyTask;
    onToggleComplete: (taskId: string, completed: boolean) => void;
    onCompleteClick?: (task: DailyTask) => void; // Nova prop para abrir modal
    loading?: boolean;
}

export function TaskCard({ task, onToggleComplete, onCompleteClick, loading = false }: TaskCardProps) {
    const isCompleted = task.completed_by !== null;
    
    // Verificar se está próximo do horário limite (15 minutos antes)
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    let isOverdue = false;
    let isNearDeadline = false;
    
    if (task.due_time && !isCompleted) {
        const dueTime = task.due_time;
        const [dueHours, dueMinutes] = dueTime.split(':').map(Number);
        const [currentHours, currentMinutes] = currentTime.split(':').map(Number);
        
        const dueDate = new Date(2000, 0, 1, dueHours, dueMinutes);
        const currentDate = new Date(2000, 0, 1, currentHours, currentMinutes);
        
        const diffMinutes = (dueDate.getTime() - currentDate.getTime()) / (1000 * 60);
        
        isOverdue = diffMinutes < 0;
        isNearDeadline = diffMinutes >= 0 && diffMinutes <= 15; // 15 minutos antes
    }

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
                    ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 animate-pulse"
                    : isNearDeadline
                    ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
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
                                isOverdue && !isCompleted && "text-rose-700 dark:text-rose-300",
                                isNearDeadline && !isCompleted && "text-amber-700 dark:text-amber-300"
                            )}
                        >
                            {task.title}
                        </h4>
                        {/* Badge de Status */}
                        {isCompleted ? (
                            <Badge variant="default" className="text-xs shrink-0 bg-emerald-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                CONCLUÍDA
                            </Badge>
                        ) : isOverdue ? (
                            <Badge variant="destructive" className="text-xs shrink-0">
                                ⚠️ ATRASADO
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="text-xs shrink-0">
                                ⏳ PENDENTE
                            </Badge>
                        )}
                        
                        {/* Badge de Prioridade */}
                        {task.priority && (
                            <Badge
                                variant={
                                    task.priority === 'ALTA' ? 'destructive' :
                                    task.priority === 'MÉDIA' ? 'default' :
                                    'secondary'
                                }
                                className="text-xs shrink-0"
                            >
                                {task.priority}
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
                                    isOverdue && !isCompleted && "border-rose-500 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950",
                                    isNearDeadline && !isCompleted && "border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950"
                                )}
                            >
                                <Clock className="h-3 w-3 mr-1" />
                                Até {formatTime(task.due_time)}
                                {isNearDeadline && !isCompleted && " ⚠️"}
                            </Badge>
                        )}
                        {task.is_recurring && (
                            <Badge variant="outline" className="text-xs">
                                Recorrente
                            </Badge>
                        )}
                    </div>
                    
                    {/* Informações de Conclusão */}
                    {isCompleted && task.completed_at && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            {task.completion_notes && (
                                <p className="italic">"{task.completion_notes}"</p>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Botão de Ação */}
                <div className="flex flex-col gap-2 shrink-0">
                    {isCompleted ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleComplete(task.id, false)}
                            disabled={loading}
                            className="h-8 w-8 p-0"
                            title="Desmarcar tarefa"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => onCompleteClick ? onCompleteClick(task) : onToggleComplete(task.id, true)}
                            disabled={loading}
                            className="h-8"
                            title="Marcar como concluída"
                        >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Concluir
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

