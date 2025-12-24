import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Attendance {
    attendance_id: string;
    profile_id: string;
    profile_name: string;
    started_at: string;
    duration_minutes: number;
    time_diff_minutes: number;
    status: string;
}

interface LinkErpSaleToAttendanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    saleId: string;
    colaboradoraId: string;
    colaboradoraName: string;
    storeId: string;
    saleDate: string;
    saleValue: number;
    onLinked?: () => void;
}

export function LinkErpSaleToAttendanceDialog({
    open,
    onOpenChange,
    saleId,
    colaboradoraId,
    colaboradoraName,
    storeId,
    saleDate,
    saleValue,
    onLinked
}: LinkErpSaleToAttendanceDialogProps) {
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState<string | null>(null);
    const [linked, setLinked] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && saleId && colaboradoraId && storeId) {
            fetchAttendances();
        }
    }, [open, saleId, colaboradoraId, storeId, saleDate]);

    const fetchAttendances = async () => {
        setLoading(true);
        setError(null);
        try {
            // @ts-ignore - RPC function not in types yet
            const { data, error: fetchError } = await supabase.rpc(
                'get_active_attendances_for_sale',
                {
                    p_colaboradora_id: colaboradoraId,
                    p_store_id: storeId,
                    p_sale_date: saleDate,
                    p_minutes_tolerance: 30
                }
            );

            if (fetchError) throw fetchError;
            setAttendances((data || []) as Attendance[]);
        } catch (err: any) {
            console.error('[LinkErpSaleToAttendanceDialog] Erro ao buscar atendimentos:', err);
            setError(err.message || 'Erro ao buscar atendimentos');
        } finally {
            setLoading(false);
        }
    };

    const handleLink = async (attendanceId: string) => {
        setLinking(attendanceId);
        setError(null);
        try {
            const { error: linkError } = await supabase.rpc(
                'link_sale_to_attendance_manual',
                {
                    p_sale_id: saleId,
                    p_attendance_id: attendanceId
                }
            );

            if (linkError) throw linkError;

            setLinked(attendanceId);
            if (onLinked) {
                setTimeout(() => {
                    onLinked();
                    onOpenChange(false);
                }, 1500);
            } else {
                setTimeout(() => {
                    onOpenChange(false);
                }, 1500);
            }
        } catch (err: any) {
            console.error('[LinkErpSaleToAttendanceDialog] Erro ao linkar:', err);
            setError(err.message || 'Erro ao linkar venda com atendimento');
        } finally {
            setLinking(null);
        }
    };

    const handleSkip = () => {
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Linkar Venda do ERP com Atendimento</DialogTitle>
                    <DialogDescription>
                        Venda de <strong>{colaboradoraName}</strong> no valor de <strong>R$ {saleValue.toFixed(2)}</strong>
                        <br />
                        Selecione o atendimento correspondente ou pule para linkar depois.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Buscando atendimentos...</span>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                ) : attendances.length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground text-center">
                            Nenhum atendimento ativo encontrado para {colaboradoraName} no período.
                            <br />
                            Você pode linkar manualmente depois ou pular esta etapa.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {attendances.map((attendance) => {
                            const isLinking = linking === attendance.attendance_id;
                            const isLinked = linked === attendance.attendance_id;
                            const isBestMatch = attendance.time_diff_minutes === Math.min(...attendances.map(a => a.time_diff_minutes));

                            return (
                                <Card
                                    key={attendance.attendance_id}
                                    className={`transition-all ${
                                        isBestMatch ? 'border-primary shadow-sm' : ''
                                    } ${isLinked ? 'bg-green-50 dark:bg-green-950' : ''}`}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-medium">{attendance.profile_name}</span>
                                                    {isBestMatch && (
                                                        <Badge variant="default" className="text-xs">
                                                            Mais Próximo
                                                        </Badge>
                                                    )}
                                                    {isLinked && (
                                                        <Badge variant="outline" className="text-xs bg-green-100">
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            Linkado
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground space-y-1">
                                                    <p>
                                                        Iniciado: {format(new Date(attendance.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                    </p>
                                                    <p>
                                                        Duração: {attendance.duration_minutes} min
                                                    </p>
                                                    <p>
                                                        Diferença: {attendance.time_diff_minutes} min da venda
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleLink(attendance.attendance_id)}
                                                disabled={isLinking || isLinked}
                                                size="sm"
                                                variant={isBestMatch ? "default" : "outline"}
                                            >
                                                {isLinking ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                        Linkando...
                                                    </>
                                                ) : isLinked ? (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                                        Linkado
                                                    </>
                                                ) : (
                                                    "Linkar"
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={handleSkip}
                        disabled={linking !== null}
                    >
                        Pular (Linkar Depois)
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

