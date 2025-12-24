import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Minimize2, Maximize2 } from "lucide-react";
import { useListaDaVezSession } from "@/hooks/use-lista-da-vez-session";
import { useListaDaVezQueue } from "@/hooks/use-lista-da-vez-queue";
import { useListaDaVezAttendances } from "@/hooks/use-lista-da-vez-attendances";
import { useListaDaVezColaboradoras } from "@/hooks/use-lista-da-vez-colaboradoras";
import { useListaDaVezMetrics } from "@/hooks/use-lista-da-vez-metrics";
import { ColaboradorasDisponiveis } from "./lista-da-vez/ColaboradorasDisponiveis";
import { EsperandoAtendimento } from "./lista-da-vez/EsperandoAtendimento";
import { EmAtendimento } from "./lista-da-vez/EmAtendimento";
import { ListaDaVezMetrics } from "./lista-da-vez/ListaDaVezMetrics";
import { FinalizarAtendimentoDialog } from "./lista-da-vez/FinalizarAtendimentoDialog";
import { HistoricoAtendimentos } from "./lista-da-vez/HistoricoAtendimentos";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ListaDaVezProps {
    storeId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenNewSale?: (attendanceId: string, colaboradoraId: string, saleValue: number) => void;
}

export function ListaDaVez({ storeId, open, onOpenChange, onOpenNewSale }: ListaDaVezProps) {
    const { profile } = useAuth();
    const [minimized, setMinimized] = useState(false);
    const [lossReasons, setLossReasons] = useState<Array<{ id: string; name: string }>>([]);
    const [finalizingAttendanceId, setFinalizingAttendanceId] = useState<string | null>(null);
    const [finalizingColaboradoraName, setFinalizingColaboradoraName] = useState<string>("");

    // Hooks modulares
    const { sessionId } = useListaDaVezSession(storeId);
    const { queueMembers, loading: queueLoading, addToQueue, removeFromQueue, fetchQueueMembers } = useListaDaVezQueue(sessionId, storeId);
    const { attendances, loading: attendancesLoading, startAttendance, endAttendance } = useListaDaVezAttendances(sessionId, storeId);
    const { colaboradoras, loading: colaboradorasLoading } = useListaDaVezColaboradoras(storeId, sessionId, queueMembers);
    const { metrics, loading: metricsLoading } = useListaDaVezMetrics(storeId);

    // Buscar motivos de perda
    useEffect(() => {
        if (!storeId) return;

        const fetchLossReasons = async () => {
            try {
                const { data, error } = await supabase
                    .schema('sistemaretiradas')
                    .from('loss_reasons')
                    .select('id, name')
                    .eq('is_active', true)
                    .or(`store_id.is.null,store_id.eq.${storeId}`)
                    .order('display_order');

                if (error) throw error;
                setLossReasons(data || []);
            } catch (error: any) {
                console.error('[ListaDaVez] Erro ao buscar motivos de perda:', error);
            }
        };

        fetchLossReasons();
    }, [storeId]);

    const handleToggleEnable = async (colaboradoraId: string, enabled: boolean) => {
        try {
            if (enabled) {
                await addToQueue(colaboradoraId);
            } else {
                const colaboradora = colaboradoras.find(c => c.id === colaboradoraId);
                if (colaboradora?.memberId) {
                    await removeFromQueue(colaboradora.memberId);
                }
            }
        } catch (error) {
            // Erro já tratado nos hooks
        }
    };

    const handleStartAttendance = async (memberId: string) => {
        try {
            // Iniciar sem nome do cliente (será preenchido depois se necessário)
            await startAttendance(memberId, "");
            // Forçar atualização da fila após iniciar atendimento
            // Isso garante que a colaboradora desapareça da lista "Esperando Atendimento"
            if (fetchQueueMembers) {
                setTimeout(() => {
                    fetchQueueMembers();
                }, 300);
            }
        } catch (error) {
            // Erro já tratado nos hooks
        }
    };

    const handleMoveToTop = async (memberId: string) => {
        try {
            const { data, error } = await supabase.rpc('move_member_to_top', {
                p_member_id: memberId
            });
            if (error) {
                console.error('[ListaDaVez] Erro RPC move_member_to_top:', error);
                throw error;
            }
            toast.success('Colaboradora movida para o topo da fila');
            // Forçar atualização imediata da fila
            if (fetchQueueMembers) {
                setTimeout(() => {
                    fetchQueueMembers();
                }, 200);
            }
        } catch (error: any) {
            console.error('[ListaDaVez] Erro ao mover para topo:', error);
            toast.error('Erro ao mover para o topo: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleMoveToEnd = async (memberId: string) => {
        try {
            const { data, error } = await supabase.rpc('move_member_to_end', {
                p_member_id: memberId
            });
            if (error) {
                console.error('[ListaDaVez] Erro RPC move_member_to_end:', error);
                throw error;
            }
            toast.success('Colaboradora movida para o final da fila');
            // Forçar atualização imediata da fila
            if (fetchQueueMembers) {
                setTimeout(() => {
                    fetchQueueMembers();
                }, 200);
            }
        } catch (error: any) {
            console.error('[ListaDaVez] Erro ao mover para final:', error);
            toast.error('Erro ao mover para o final: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const handleStopAttendance = (attendanceId: string) => {
        // Encontrar o nome da colaboradora
        const attendance = attendances.find(a => a.id === attendanceId);
        if (attendance) {
            setFinalizingColaboradoraName(attendance.profile_name);
            setFinalizingAttendanceId(attendanceId);
        }
    };

    const handleEndAttendance = async (
        attendanceId: string,
        result: 'venda' | 'perda',
        saleValue: number | null,
        lossReasonId: string | null
    ) => {
        try {
            await endAttendance(attendanceId, result, saleValue, lossReasonId);
            setFinalizingAttendanceId(null);
            setFinalizingColaboradoraName("");
            // Forçar atualização da fila após finalizar atendimento
            // Isso garante que a colaboradora volte para o final da fila
            if (fetchQueueMembers) {
                setTimeout(() => {
                    fetchQueueMembers();
                }, 300);
            }
        } catch (error) {
            // Erro já tratado nos hooks
        }
    };

    const loading = queueLoading || attendancesLoading || colaboradorasLoading;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className={`max-w-6xl ${minimized ? 'max-h-[200px]' : 'max-h-[90vh]'} overflow-y-auto transition-all`}>
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Lista da Vez
                        </DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMinimized(!minimized)}
                            title={minimized ? "Maximizar" : "Minimizar"}
                        >
                            {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                        </Button>
                    </DialogHeader>

                    {!minimized && (
                        <Tabs defaultValue="fila" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="fila">Fila de Atendimento</TabsTrigger>
                                <TabsTrigger value="historico">Histórico</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="fila" className="space-y-4 mt-4">
                                {/* Métricas */}
                                <ListaDaVezMetrics metrics={metrics} loading={metricsLoading} />

                                {/* Grid com 3 colunas */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Colaboradoras Disponíveis */}
                                    <ColaboradorasDisponiveis
                                        colaboradoras={colaboradoras}
                                        loading={colaboradorasLoading}
                                        onToggle={handleToggleEnable}
                                    />

                                    {/* Esperando Atendimento */}
                                    <EsperandoAtendimento
                                        members={queueMembers}
                                        loading={loading}
                                        onStartAttendance={handleStartAttendance}
                                        onMoveToTop={handleMoveToTop}
                                        onMoveToEnd={handleMoveToEnd}
                                    />

                                    {/* Em Atendimento */}
                                    <EmAtendimento
                                        attendances={attendances}
                                        loading={loading}
                                        onStopAttendance={handleStopAttendance}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="historico" className="mt-4">
                                <HistoricoAtendimentos
                                    storeId={storeId}
                                    sessionId={sessionId}
                                />
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog para finalizar atendimento */}
            {finalizingAttendanceId && (() => {
                const attendance = attendances.find(a => a.id === finalizingAttendanceId);
                return (
                    <FinalizarAtendimentoDialog
                        open={!!finalizingAttendanceId}
                        onOpenChange={(open) => {
                            if (!open) {
                                setFinalizingAttendanceId(null);
                                setFinalizingColaboradoraName("");
                            }
                        }}
                        attendanceId={finalizingAttendanceId}
                        colaboradoraId={attendance?.profile_id || ""}
                        colaboradoraName={finalizingColaboradoraName}
                        lossReasons={lossReasons}
                        onConfirm={handleEndAttendance}
                        onOpenNewSale={onOpenNewSale}
                        loading={loading}
                    />
                );
            })()}
        </>
    );
}
