import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, Calendar, User, DollarSign, XCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CreateAttendanceDialog } from "./CreateAttendanceDialog";
import { EditAttendanceDialog } from "./EditAttendanceDialog";

interface Attendance {
    id: string;
    profile_id: string;
    profile_name: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    status: string;
    result?: 'venda' | 'perda' | null;
    sale_value?: number | null;
    loss_reason?: string | null;
    loss_reason_id?: string | null;
    sale_id?: string | null;
    cliente_nome?: string | null;
}

interface HistoricoAtendimentosProps {
    storeId: string | null;
    sessionId: string | null;
}

export function HistoricoAtendimentos({ storeId, sessionId }: HistoricoAtendimentosProps) {
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (storeId) {
            fetchAttendances();
        }
    }, [storeId, dateFilter]);

    const fetchAttendances = async () => {
        if (!storeId) return;
        
        setLoading(true);
        try {
            const startDate = `${dateFilter}T00:00:00`;
            const endDate = `${dateFilter}T23:59:59`;

            // Buscar atendimentos
            const { data: attendancesData, error: attendancesError } = await supabase
                .schema('sistemaretiradas')
                .from('attendances')
                .select(`
                    id,
                    profile_id,
                    started_at,
                    ended_at,
                    duration_seconds,
                    status,
                    profiles!attendances_profile_id_fkey(name)
                `)
                .eq('store_id', storeId)
                .gte('started_at', startDate)
                .lte('started_at', endDate)
                .order('started_at', { ascending: false });

            if (attendancesError) throw attendancesError;

            // Buscar outcomes separadamente
            const attendanceIds = (attendancesData || []).map((a: any) => a.id);
            let outcomesMap: Record<string, any> = {};
            
            if (attendanceIds.length > 0) {
                const { data: outcomesData } = await supabase
                    .schema('sistemaretiradas')
                    .from('attendance_outcomes')
                    .select(`
                        attendance_id,
                        result,
                        sale_value,
                        loss_reason_id,
                        loss_reasons(name)
                    `)
                    .in('attendance_id', attendanceIds);

                if (outcomesData) {
                    outcomesMap = outcomesData.reduce((acc: any, outcome: any) => {
                        acc[outcome.attendance_id] = outcome;
                        return acc;
                    }, {});
                }
            }

            // Remover linha duplicada - error já foi verificado acima

            const attendances: Attendance[] = (attendancesData || []).map((item: any) => {
                const outcome = outcomesMap[item.id];
                
                return {
                    id: item.id,
                    profile_id: item.profile_id,
                    profile_name: item.profiles?.name || 'Desconhecido',
                    started_at: item.started_at,
                    ended_at: item.ended_at,
                    duration_seconds: item.duration_seconds,
                    status: item.status,
                    result: outcome?.result || null,
                    sale_value: outcome?.sale_value || null,
                    loss_reason: outcome?.loss_reasons?.name || null,
                    loss_reason_id: outcome?.loss_reason_id || null,
                    sale_id: outcome?.sale_id || null,
                    cliente_nome: item.cliente_nome || null
                };
            });

            setAttendances(attendances);
        } catch (error: any) {
            console.error('[HistoricoAtendimentos] Erro ao buscar atendimentos:', error);
            toast.error('Erro ao buscar histórico: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number | null): string => {
        if (!seconds) return '-';
        const minutes = Math.floor(seconds / 60);
        return `${minutes} min`;
    };

    const formatTime = (dateString: string): string => {
        return format(new Date(dateString), "HH:mm", { locale: ptBR });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Histórico de Atendimentos</CardTitle>
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-auto"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCreating(true)}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Novo
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Carregando...
                    </div>
                ) : attendances.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhum atendimento encontrado para esta data
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaboradora</TableHead>
                                    <TableHead>Início</TableHead>
                                    <TableHead>Fim</TableHead>
                                    <TableHead>Duração</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Resultado</TableHead>
                                    <TableHead>Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendances.map((attendance) => (
                                    <TableRow key={attendance.id}>
                                        <TableCell className="font-medium">
                                            {attendance.profile_name}
                                        </TableCell>
                                        <TableCell>
                                            {formatTime(attendance.started_at)}
                                        </TableCell>
                                        <TableCell>
                                            {attendance.ended_at ? formatTime(attendance.ended_at) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {formatDuration(attendance.duration_seconds)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                attendance.status === 'finalizado' ? 'default' : 
                                                attendance.status === 'em_andamento' ? 'secondary' : 
                                                'outline'
                                            }>
                                                {attendance.status === 'finalizado' ? 'Finalizado' :
                                                 attendance.status === 'em_andamento' ? 'Em Andamento' :
                                                 attendance.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {attendance.result === 'venda' ? (
                                                <div className="flex items-center gap-1 text-green-600">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span>Venda</span>
                                                    {attendance.sale_value && (
                                                        <span className="text-xs">R$ {attendance.sale_value.toFixed(2)}</span>
                                                    )}
                                                </div>
                                            ) : attendance.result === 'perda' ? (
                                                <div className="flex items-center gap-1 text-red-600">
                                                    <XCircle className="h-4 w-4" />
                                                    <span>Perda</span>
                                                    {attendance.loss_reason && (
                                                        <span className="text-xs">({attendance.loss_reason})</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEditingAttendance(attendance)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            {/* Dialogs */}
            <CreateAttendanceDialog
                open={creating}
                onOpenChange={(open) => {
                    setCreating(open);
                    if (!open) {
                        fetchAttendances();
                    }
                }}
                storeId={storeId}
                onCreated={fetchAttendances}
            />

            {editingAttendance && (
                <EditAttendanceDialog
                    open={!!editingAttendance}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditingAttendance(null);
                            fetchAttendances();
                        }
                    }}
                    attendance={editingAttendance}
                    storeId={storeId}
                    onUpdated={fetchAttendances}
                />
            )}
        </Card>
    );
}

