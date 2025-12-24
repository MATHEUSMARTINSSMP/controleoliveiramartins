import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Attendance {
    id: string;
    profile_id: string;
    profile_name: string;
    cliente_nome: string | null;
    started_at: string;
    duration_seconds: number | null;
}

export function useListaDaVezAttendances(sessionId: string | null, storeId: string | null) {
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(false);
    const channelRef = useRef<any>(null);

    const fetchAttendances = useCallback(async () => {
        if (!sessionId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('attendances')
                .select(`
                    id,
                    profile_id,
                    cliente_nome,
                    started_at,
                    duration_seconds,
                    profiles!attendances_profile_id_fkey(name)
                `)
                .eq('session_id', sessionId)
                .eq('status', 'em_andamento')
                .order('started_at', { ascending: true });

            if (error) throw error;

            const attendancesData: Attendance[] = (data || []).map((item: any) => ({
                id: item.id,
                profile_id: item.profile_id,
                profile_name: item.profiles?.name || 'Sem nome',
                cliente_nome: item.cliente_nome,
                started_at: item.started_at,
                duration_seconds: item.duration_seconds
            }));

            setAttendances(attendancesData);
        } catch (error: any) {
            console.error('[useListaDaVezAttendances] Erro ao buscar atendimentos:', error);
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || !storeId) return;

        fetchAttendances();

        // Setup realtime subscription
        const channel = supabase
            .channel(`lista-da-vez-attendances-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'attendances',
                    filter: `session_id=eq.${sessionId}`
                },
                (payload) => {
                    console.log('[useListaDaVezAttendances] Mudança detectada:', payload);
                    fetchAttendances();
                }
            )
            .subscribe((status) => {
                console.log('[useListaDaVezAttendances] Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    // Forçar atualização inicial após subscribe
                    fetchAttendances();
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
        };
    }, [sessionId, storeId, fetchAttendances]);

    const startAttendance = async (memberId: string, clienteNome: string = "") => {
        if (!memberId) {
            toast.error('Erro: membro não encontrado');
            return;
        }

        // Prevenir chamadas duplicadas
        if (loading) {
            console.warn('[useListaDaVezAttendances] Tentativa de iniciar atendimento enquanto já está processando');
            return;
        }

        try {
            setLoading(true);
            const { data: attendanceId, error } = await supabase.rpc('start_attendance', {
                p_member_id: memberId,
                p_cliente_nome: clienteNome.trim() || null,
                p_cliente_id: null,
                p_cliente_telefone: null
            });

            if (error) throw error;
            toast.success('Atendimento iniciado!');
            // Pequeno delay para garantir que o banco processou
            await new Promise(resolve => setTimeout(resolve, 150));
            // Forçar atualização imediata de ambas as listas
            await fetchAttendances();
            return attendanceId;
        } catch (error: any) {
            console.error('[useListaDaVezAttendances] Erro ao iniciar atendimento:', error);
            toast.error('Erro: ' + (error.message || 'Erro desconhecido'));
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const endAttendance = async (
        attendanceId: string,
        result: 'venda' | 'perda',
        saleValue: number | null,
        lossReasonId: string | null
    ) => {
        if (!attendanceId || !result) {
            toast.error('Dados incompletos');
            return;
        }

        // Prevenir chamadas duplicadas
        if (loading) {
            console.warn('[useListaDaVezAttendances] Tentativa de finalizar atendimento enquanto já está processando');
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.rpc('end_attendance', {
                p_attendance_id: attendanceId,
                p_result: result,
                p_sale_value: saleValue,
                p_items_count: null,
                p_categories: null,
                p_loss_reason_id: lossReasonId,
                p_loss_reason_other: null,
                p_notes: null
            });

            if (error) {
                // Se for erro de constraint única, a função já tratou, apenas avisar
                if (error.code === '23505') {
                    console.warn('[useListaDaVezAttendances] Erro de constraint única (já tratado pela função):', error);
                    toast.info('Atendimento finalizado!');
                } else {
                    throw error;
                }
            } else {
                toast.success('Atendimento finalizado!');
            }
            
            // Pequeno delay para garantir que o banco processou
            await new Promise(resolve => setTimeout(resolve, 200));
            // Forçar atualização imediata
            await fetchAttendances();
        } catch (error: any) {
            console.error('[useListaDaVezAttendances] Erro ao finalizar atendimento:', error);
            toast.error('Erro: ' + (error.message || 'Erro desconhecido'));
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        attendances,
        loading,
        fetchAttendances,
        startAttendance,
        endAttendance
    };
}

