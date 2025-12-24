import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Colaboradora {
    id: string;
    name: string;
    enabled: boolean;
    inQueue: boolean;
    status?: 'disponivel' | 'em_atendimento' | 'pausado' | 'indisponivel';
    position?: number;
    memberId?: string;
}

export function useListaDaVezColaboradoras(
    storeId: string | null,
    sessionId: string | null,
    queueMembers: Array<{ profile_id: string; status: string; position: number; id: string }>
) {
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [loading, setLoading] = useState(false);
    const channelRef = useRef<any>(null);

    const fetchColaboradoras = useCallback(async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            const { data: profiles, error } = await supabase
                .schema('sistemaretiradas')
                .from('profiles')
                .select('id, name')
                .eq('store_id', storeId)
                .eq('role', 'COLABORADORA')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;

            // Criar mapa de membros da fila
            const membersMap = new Map(
                queueMembers.map(m => [m.profile_id, { status: m.status, position: m.position, id: m.id }])
            );

            const colaboradorasData: Colaboradora[] = (profiles || []).map(p => {
                const member = membersMap.get(p.id);
                return {
                    id: p.id,
                    name: p.name,
                    enabled: !!member,
                    inQueue: !!member,
                    status: member?.status as any,
                    position: member?.position,
                    memberId: member?.id
                };
            });

            setColaboradoras(colaboradorasData);
        } catch (error: any) {
            console.error('[useListaDaVezColaboradoras] Erro ao buscar colaboradoras:', error);
        } finally {
            setLoading(false);
        }
    }, [storeId, queueMembers]);

    useEffect(() => {
        if (!storeId) return;

        fetchColaboradoras();

        // Setup realtime subscription para profiles (caso alguém seja ativado/desativado)
        const channel = supabase
            .channel(`lista-da-vez-colaboradoras-${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'profiles',
                    filter: `store_id=eq.${storeId}`
                },
                (payload) => {
                    console.log('[useListaDaVezColaboradoras] Mudança em profiles:', payload);
                    fetchColaboradoras();
                }
            )
            .subscribe((status) => {
                console.log('[useListaDaVezColaboradoras] Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    fetchColaboradoras();
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
        };
    }, [storeId, fetchColaboradoras]);

    return {
        colaboradoras,
        loading,
        fetchColaboradoras
    };
}

