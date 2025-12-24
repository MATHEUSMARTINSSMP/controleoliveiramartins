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

    const fetchMetrics = useCallback(async () => {
        if (!storeId) return;

        try {
            setLoading(true);
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
        } catch (error: any) {
            console.error('[useListaDaVezMetrics] Erro ao buscar métricas:', error);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (!storeId) return;

        fetchMetrics();

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
                    // Aguardar um pouco para garantir que o banco processou
                    setTimeout(() => fetchMetrics(), 500);
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
                    setTimeout(() => fetchMetrics(), 500);
                }
            )
            .subscribe((status) => {
                console.log('[useListaDaVezMetrics] Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    fetchMetrics();
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

