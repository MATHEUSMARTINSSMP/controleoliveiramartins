import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QueueMember {
    id: string;
    profile_id: string;
    profile_name: string;
    position: number;
    status: 'disponivel' | 'em_atendimento' | 'pausado' | 'indisponivel';
    check_in_at: string;
}

export function useListaDaVezQueue(sessionId: string | null, storeId: string | null) {
    const [queueMembers, setQueueMembers] = useState<QueueMember[]>([]);
    const [loading, setLoading] = useState(false);
    const channelRef = useRef<any>(null);

    const fetchQueueMembers = useCallback(async () => {
        if (!sessionId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('queue_members')
                .select(`
                    id,
                    profile_id,
                    position,
                    status,
                    check_in_at,
                    profiles!queue_members_profile_id_fkey(name)
                `)
                .eq('session_id', sessionId)
                .eq('status', 'disponivel')
                .order('position', { ascending: true });

            if (error) throw error;

            const members: QueueMember[] = (data || []).map((item: any) => ({
                id: item.id,
                profile_id: item.profile_id,
                profile_name: item.profiles?.name || 'Sem nome',
                position: item.position,
                status: item.status,
                check_in_at: item.check_in_at
            }));

            setQueueMembers(members);
        } catch (error: any) {
            console.error('[useListaDaVezQueue] Erro ao buscar fila:', error);
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || !storeId) return;

        fetchQueueMembers();

        // Setup realtime subscription
        const channel = supabase
            .channel(`lista-da-vez-queue-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'queue_members',
                    filter: `session_id=eq.${sessionId}`
                },
                (payload) => {
                    console.log('[useListaDaVezQueue] Mudança detectada:', payload);
                    fetchQueueMembers();
                }
            )
            .subscribe((status) => {
                console.log('[useListaDaVezQueue] Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    // Forçar atualização inicial após subscribe
                    fetchQueueMembers();
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
        };
    }, [sessionId, storeId, fetchQueueMembers]);

    const addToQueue = async (profileId: string) => {
        if (!sessionId || !profileId) return;

        try {
            setLoading(true);
            const { data: memberId, error } = await supabase.rpc('add_to_queue', {
                p_session_id: sessionId,
                p_profile_id: profileId,
                p_entry_position: 'end'
            });

            if (error) throw error;
            toast.success('Habilitada para entrar na vez!');
            await fetchQueueMembers();
            return memberId;
        } catch (error: any) {
            console.error('[useListaDaVezQueue] Erro ao adicionar na fila:', error);
            toast.error('Erro: ' + (error.message || 'Erro desconhecido'));
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const removeFromQueue = async (memberId: string) => {
        if (!memberId) return;

        try {
            setLoading(true);
            const { error } = await supabase.rpc('remove_from_queue', {
                p_member_id: memberId
            });

            if (error) throw error;
            toast.success('Desabilitada da vez');
            await fetchQueueMembers();
        } catch (error: any) {
            console.error('[useListaDaVezQueue] Erro ao remover da fila:', error);
            toast.error('Erro: ' + (error.message || 'Erro desconhecido'));
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        queueMembers,
        loading,
        fetchQueueMembers,
        addToQueue,
        removeFromQueue
    };
}

