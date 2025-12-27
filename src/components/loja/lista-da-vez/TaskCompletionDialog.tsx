/**
 * Modal de Conclusão de Tarefa
 * Permite adicionar observações ao marcar uma tarefa como concluída
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DailyTask } from "@/hooks/useDailyTasks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock } from "lucide-react";

interface TaskCompletionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: DailyTask | null;
    onConfirm: (notes?: string) => void;
    loading?: boolean;
}

export function TaskCompletionDialog({
    open,
    onOpenChange,
    task,
    onConfirm,
    loading = false
}: TaskCompletionDialogProps) {
    const [notes, setNotes] = useState("");

    const handleConfirm = () => {
        onConfirm(notes.trim() || undefined);
        setNotes(""); // Limpar após confirmar
    };

    const handleCancel = () => {
        setNotes("");
        onOpenChange(false);
    };

    if (!task) return null;

    const formatTime = (time: string | null) => {
        if (!time) return '';
        try {
            const [hours, minutes] = time.split(':');
            return format(new Date(2000, 0, 1, parseInt(hours), parseInt(minutes)), 'HH:mm', { locale: ptBR });
        } catch {
            return time;
        }
    };

    const currentTime = format(new Date(), 'HH:mm', { locale: ptBR });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Marcar Tarefa como Concluída</DialogTitle>
                    <DialogDescription>
                        Confirme a conclusão da tarefa abaixo. Você pode adicionar observações opcionais.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    {/* Informações da Tarefa */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Tarefa</Label>
                        <div className="p-3 bg-muted rounded-md">
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Horários */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Horário Previsto
                            </Label>
                            <div className="p-3 bg-muted rounded-md text-sm">
                                {task.due_time ? formatTime(task.due_time) : 'Sem horário definido'}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Horário Atual
                            </Label>
                            <div className="p-3 bg-muted rounded-md text-sm font-medium">
                                {currentTime}
                            </div>
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="space-y-2">
                        <Label htmlFor="completion-notes">Observações (opcional)</Label>
                        <Textarea
                            id="completion-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Adicione observações sobre a conclusão desta tarefa..."
                            rows={4}
                            className="resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading}
                    >
                        {loading ? "Salvando..." : "Confirmar Conclusão"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

