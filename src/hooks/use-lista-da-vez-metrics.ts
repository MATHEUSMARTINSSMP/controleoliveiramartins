import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Metrics {
    total_attendances: number;
    total_sales: number;
    total_losses: number;
    conversion_rate: number;
    total_sale_value: number;
    avg_attendance_duration: number;
    total_attendance_time: number;
    active_collaborators: number;
}

export function useListaDaVezMetrics(storeId: string | null) {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(false);
    const channelRef = useRef<any>(null);
    const isInitialLoadRef = useRef(true); // ✅ Flag para distinguir carregamento inicial de atualizações

    const fetchMetrics = useCallback(async (silent = false) => {
        if (!storeId) return;

        try {
            // ✅ Só mostrar loading no carregamento inicial ou quando não for silencioso
            if (isInitialLoadRef.current || !silent) {
                setLoading(true);
            }
            const { data, error } = await supabase.rpc('get_store_metrics', {
                p_store_id: storeId,
                p_start_date: format(new Date(), 'yyyy-MM-dd'),
                p_end_date: format(new Date(), 'yyyy-MM-dd')
            });

            if (error) throw error;

            if (data && data.length > 0) {
                setMetrics(data[0] as Metrics);
            } else {
                setMetrics({
                    total_attendances: 0,
                    total_sales: 0,
                    total_losses: 0,
                    conversion_rate: 0,
                    total_sale_value: 0,
                    avg_attendance_duration: 0,
                    total_attendance_time: 0,
                    active_collaborators: 0
                });
            }
            isInitialLoadRef.current = false; // ✅ Marcar que já carregou inicialmente
        } catch (error: any) {
            console.error('[useListaDaVezMetrics] Erro ao buscar métricas:', error);
        } finally {
            if (isInitialLoadRef.current || !silent) {
                setLoading(false);
            }
        }
    }, [storeId]);

    useEffect(() => {
        if (!storeId) {
            isInitialLoadRef.current = true; // Reset flag quando storeId mudar
            return;
        }

        // ✅ Reset flag quando storeId mudar
        isInitialLoadRef.current = true;
        fetchMetrics(false); // Carregamento inicial

        // Setup realtime subscription para attendances e outcomes
        const channel = supabase
            .channel(`lista-da-vez-metrics-${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'attendance_outcomes'
                },
                (payload) => {
                    console.log('[useListaDaVezMetrics] Mudança em outcomes:', payload);
                    // ✅ Atualizar silenciosamente quando detectar mudança (sem loading)
                    setTimeout(() => fetchMetrics(true), 500); // silent = true
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'sistemaretiradas',
                    table: 'attendances',
                    filter: `store_id=eq.${storeId}`
                },
                (payload) => {
                    console.log('[useListaDaVezMetrics] Mudança em attendances:', payload);
                    // ✅ Atualizar silenciosamente quando detectar mudança (sem loading)
                    setTimeout(() => fetchMetrics(true), 500); // silent = true
                }
            )
            .subscribe((status) => {
                console.log('[useListaDaVezMetrics] Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    // ✅ Só fazer fetch inicial se ainda não carregou, senão atualizar silenciosamente
                    if (isInitialLoadRef.current) {
                        fetchMetrics(false); // Carregamento inicial
                    } else {
                        fetchMetrics(true); // Reconexão - silencioso
                    }
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
        };
    }, [storeId, fetchMetrics]);

    return {
        metrics,
        loading,
        fetchMetrics
    };
}

