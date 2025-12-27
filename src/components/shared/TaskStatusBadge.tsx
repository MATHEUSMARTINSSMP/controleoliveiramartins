/**
 * Componente reutilizável de Badge de Status de Tarefa
 * Exibe status: PENDENTE, ATRASADO, CONCLUÍDA
 */

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskStatus = "PENDENTE" | "ATRASADO" | "CONCLUÍDA";

interface TaskStatusBadgeProps {
    status: TaskStatus | string | null;
    className?: string;
    showIcon?: boolean;
}

export function TaskStatusBadge({ 
    status, 
    className,
    showIcon = true 
}: TaskStatusBadgeProps) {
    if (!status) {
        return (
            <Badge variant="secondary" className={cn("text-xs", className)}>
                {showIcon && <Clock className="h-3 w-3 mr-1" />}
                PENDENTE
            </Badge>
        );
    }

    const statusUpper = status.toUpperCase() as TaskStatus;

    switch (statusUpper) {
        case "CONCLUÍDA":
            return (
                <Badge 
                    variant="default" 
                    className={cn("text-xs bg-emerald-600 hover:bg-emerald-700", className)}
                >
                    {showIcon && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    CONCLUÍDA
                </Badge>
            );

        case "ATRASADO":
            return (
                <Badge 
                    variant="destructive" 
                    className={cn("text-xs", className)}
                >
                    {showIcon && <AlertTriangle className="h-3 w-3 mr-1" />}
                    ATRASADO
                </Badge>
            );

        case "PENDENTE":
        default:
            return (
                <Badge 
                    variant="secondary" 
                    className={cn("text-xs", className)}
                >
                    {showIcon && <Clock className="h-3 w-3 mr-1" />}
                    PENDENTE
                </Badge>
            );
    }
}

