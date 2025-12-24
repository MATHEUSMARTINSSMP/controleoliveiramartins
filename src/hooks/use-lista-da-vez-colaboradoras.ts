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
    const isInitialLoadRef = useRef(true); // ✅ Flag para distinguir carregamento inicial de atualizações

    const fetchColaboradoras = useCallback(async (silent = false) => {
        if (!storeId) return;

        try {
            // ✅ Só mostrar loading no carregamento inicial ou quando não for silencioso
            if (isInitialLoadRef.current || !silent) {
                setLoading(true);
            }
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
            isInitialLoadRef.current = false; // ✅ Marcar que já carregou inicialmente
        } catch (error: any) {
            console.error('[useListaDaVezColaboradoras] Erro ao buscar colaboradoras:', error);
        } finally {
            if (isInitialLoadRef.current || !silent) {
                setLoading(false);
            }
        }
    }, [storeId, queueMembers]);

    useEffect(() => {
        if (!storeId) {
            isInitialLoadRef.current = true; // Reset flag quando storeId mudar
            return;
        }

        // ✅ Reset flag quando storeId mudar
        isInitialLoadRef.current = true;
        fetchColaboradoras(false); // Carregamento inicial

        // ✅ Debounce para evitar múltiplas atualizações rápidas
        let debounceTimeout: NodeJS.Timeout | null = null;
        const debouncedFetch = (silent: boolean) => {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                fetchColaboradoras(silent);
            }, 300); // 300ms de debounce
        };

        // Setup realtime subscription para profiles (caso alguém seja ativado/desativado)
        const channel = supabase
            .channel(`lista-da-vez-colaboradoras-${storeId}`) // ✅ Canal fixo para reutilizar
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
                    // ✅ Atualizar silenciosamente com debounce quando detectar mudança (sem loading)
                    debouncedFetch(true); // silent = true
                }
            )
            .subscribe((status) => {
                console.log('[useListaDaVezColaboradoras] Subscription status:', status);
                // ✅ NÃO fazer fetch automático na reconexão - apenas escutar mudanças
                // O fetch inicial já foi feito acima
            });

        channelRef.current = channel;

        return () => {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            channel.unsubscribe();
        };
    }, [storeId, fetchColaboradoras]);

    return {
        colaboradoras,
        loading,
        fetchColaboradoras
    };
}

