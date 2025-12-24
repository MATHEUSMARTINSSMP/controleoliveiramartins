/**
 * Componente de Histórico de Tarefas Completas
 * Mostra quem completou cada tarefa e quando
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, History, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskCompletion {
    id: string;
    task_id: string;
    profile_id: string;
    completed_at: string;
    notes: string | null;
    completion_date: string;
    task_title: string;
    task_description: string | null;
    profile_name: string;
}

interface TaskHistoryProps {
    storeId: string | null;
    date: Date;
    enabled?: boolean;
}

export function TaskHistory({ storeId, date, enabled = true }: TaskHistoryProps) {
    const [completions, setCompletions] = useState<TaskCompletion[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !storeId) {
            setCompletions([]);
            return;
        }

        fetchHistory();
    }, [storeId, date, enabled]);

    const fetchHistory = async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            const dateStr = format(date, 'yyyy-MM-dd');

            // Buscar completions com dados da tarefa e do perfil
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('task_completions')
                .select(`
                    id,
                    task_id,
                    profile_id,
                    completed_at,
                    notes,
                    completion_date,
                    daily_tasks!inner (
                        id,
                        title,
                        description,
                        store_id
                    ),
                    profiles!inner (
                        id,
                        name
                    )
                `)
                .eq('completion_date', dateStr)
                .eq('daily_tasks.store_id', storeId)
                .order('completed_at', { ascending: false });

            if (error) throw error;

            const formatted = (data || []).map((item: any) => ({
                id: item.id,
                task_id: item.task_id,
                profile_id: item.profile_id,
                completed_at: item.completed_at,
                notes: item.notes,
                completion_date: item.completion_date,
                task_title: item.daily_tasks?.title || 'Tarefa desconhecida',
                task_description: item.daily_tasks?.description,
                profile_name: item.profiles?.name || 'Desconhecido'
            }));

            setCompletions(formatted);
        } catch (error: any) {
            console.error('[TaskHistory] Erro ao buscar histórico:', error);
            setCompletions([]);
        } finally {
            setLoading(false);
        }
    };

    if (!enabled || !storeId) return null;

    if (loading) {
        return (
            <Card className="border-2 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        Histórico de Tarefas Completas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (completions.length === 0) {
        return (
            <Card className="border-2 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        Histórico de Tarefas Completas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma tarefa foi completada ainda hoje.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-2 shadow-sm">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Histórico de Tarefas Completas ({completions.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Tarefa</TableHead>
                                <TableHead className="w-[150px]">Colaboradora</TableHead>
                                <TableHead className="w-[150px]">Completada em</TableHead>
                                <TableHead>Observações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {completions.map((completion) => (
                                <TableRow key={completion.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium text-sm">{completion.task_title}</p>
                                            {completion.task_description && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {completion.task_description}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{completion.profile_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <Badge variant="outline" className="w-fit">
                                                {format(new Date(completion.completed_at), 'HH:mm', { locale: ptBR })}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground mt-1">
                                                {format(new Date(completion.completed_at), "dd/MM/yyyy", { locale: ptBR })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {completion.notes ? (
                                            <p className="text-sm text-muted-foreground">{completion.notes}</p>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Sem observações</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

