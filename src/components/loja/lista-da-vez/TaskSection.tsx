import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DailyTask } from "@/hooks/useDailyTasks";
import { TaskCard } from "./TaskCard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskSectionProps {
    shiftName: string;
    shiftStartTime: string | null;
    shiftEndTime: string | null;
    shiftColor: string | null;
    tasks: DailyTask[];
    onToggleComplete: (taskId: string, completed: boolean) => void;
    onCompleteClick?: (task: DailyTask) => void;
    completedByNames?: Map<string, string>;
    loading?: boolean;
}

const shiftColors: Record<string, { bg: string; border: string; text: string }> = {
    amber: {
        bg: 'bg-amber-50/50 dark:bg-amber-950/20',
        border: 'border-amber-300 dark:border-amber-800',
        text: 'text-amber-900 dark:text-amber-100'
    },
    orange: {
        bg: 'bg-orange-50/50 dark:bg-orange-950/20',
        border: 'border-orange-300 dark:border-orange-800',
        text: 'text-orange-900 dark:text-orange-100'
    },
    purple: {
        bg: 'bg-purple-50/50 dark:bg-purple-950/20',
        border: 'border-purple-300 dark:border-purple-800',
        text: 'text-purple-900 dark:text-purple-100'
    },
    blue: {
        bg: 'bg-blue-50/50 dark:bg-blue-950/20',
        border: 'border-blue-300 dark:border-blue-800',
        text: 'text-blue-900 dark:text-blue-100'
    }
};

export function TaskSection({
    shiftName,
    shiftStartTime,
    shiftEndTime,
    shiftColor,
    tasks,
    onToggleComplete,
    onCompleteClick,
    completedByNames = new Map(),
    loading = false
}: TaskSectionProps) {
    if (tasks.length === 0) return null;

    const completedCount = tasks.filter(t => t.completed_by !== null).length;
    const colorScheme = shiftColor ? shiftColors[shiftColor] || shiftColors.blue : shiftColors.blue;

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
        <Card className={`border-2 ${colorScheme.border} shadow-sm`}>
            <CardHeader className={`pb-3 border-b ${colorScheme.bg}`}>
                <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${colorScheme.text}`}>
                        <div className={`h-2 w-2 rounded-full ${colorScheme.border.replace('border-', 'bg-')}`}></div>
                        {shiftName}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {(shiftStartTime || shiftEndTime) && (
                            <Badge variant="outline" className="text-xs">
                                {shiftStartTime && shiftEndTime 
                                    ? `${formatTime(shiftStartTime)} - ${formatTime(shiftEndTime)}`
                                    : shiftStartTime 
                                    ? `A partir de ${formatTime(shiftStartTime)}`
                                    : `Até ${formatTime(shiftEndTime)}`
                                }
                            </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                            {completedCount}/{tasks.length}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
                {tasks.map((task, taskIndex) => {
                    // Agrupar visualmente por horário: adicionar linha divisória quando muda o horário
                    const previousTask = taskIndex > 0 ? tasks[taskIndex - 1] : null;
                    const currentHour = task.due_time ? task.due_time.split(':')[0] : null;
                    const previousHour = previousTask?.due_time ? previousTask.due_time.split(':')[0] : null;
                    const shouldShowDivider = currentHour && previousHour && currentHour !== previousHour && taskIndex > 0;

                    return (
                        <div key={task.id}>
                            {shouldShowDivider && (
                                <div className="my-4 flex items-center gap-2">
                                    <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                                    <span className="text-xs text-muted-foreground font-medium">
                                        {currentHour}:00
                                    </span>
                                    <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                                </div>
                            )}
                            <TaskCard
                                task={task}
                                onToggleComplete={onToggleComplete}
                                onCompleteClick={onCompleteClick}
                                completedByName={task.completed_by ? completedByNames.get(task.completed_by) || null : null}
                                loading={loading}
                            />
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

