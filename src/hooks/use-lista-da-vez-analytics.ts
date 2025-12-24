import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface CollaboratorDetailedMetrics {
    profile_id: string;
    profile_name: string;
    total_attendances: number;
    total_sales: number;
    total_losses: number;
    conversion_rate: number;
    total_sale_value: number;
    avg_sale_value: number;
    avg_attendance_duration: number;
    total_attendance_time: number;
    min_attendance_duration: number;
    max_attendance_duration: number;
    avg_time_to_first_attendance: number;
    total_queue_time: number;
    avg_queue_time: number;
    best_day: string | null;
    best_day_attendances: number;
    best_day_sales: number;
    worst_day: string | null;
    worst_day_attendances: number;
    worst_day_sales: number;
}

interface StoreDetailedMetrics {
    store_id: string;
    store_name: string;
    total_attendances: number;
    total_sales: number;
    total_losses: number;
    conversion_rate: number;
    total_sale_value: number;
    avg_sale_value: number;
    avg_attendance_duration: number;
    total_attendance_time: number;
    active_collaborators: number;
    total_queue_time: number;
    avg_queue_time: number;
    peak_hour: number;
    peak_hour_attendances: number;
    best_day: string | null;
    best_day_attendances: number;
    best_day_sales: number;
    worst_day: string | null;
    worst_day_attendances: number;
    worst_day_sales: number;
    top_collaborator_id: string | null;
    top_collaborator_name: string | null;
    top_collaborator_sales: number;
}

interface PeriodTrend {
    period_label: string;
    period_start: string;
    period_end: string;
    total_attendances: number;
    total_sales: number;
    total_losses: number;
    conversion_rate: number;
    total_sale_value: number;
    avg_attendance_duration: number;
    active_collaborators: number;
}

interface LossReasonAnalytics {
    loss_reason_id: string;
    loss_reason_name: string;
    total_losses: number;
    percentual: number;
    avg_attendance_duration: number;
    avg_sale_value_lost: number;
}

interface HourlyAnalytics {
    hour: number;
    total_attendances: number;
    total_sales: number;
    conversion_rate: number;
    avg_attendance_duration: number;
    avg_sale_value: number;
}

interface CollaboratorRanking {
    rank: number;
    profile_id: string;
    profile_name: string;
    total_attendances: number;
    total_sales: number;
    conversion_rate: number;
    total_sale_value: number;
    avg_attendance_duration: number;
}

interface PeriodComparison {
    metric_name: string;
    period1_value: number;
    period2_value: number;
    difference: number;
    percent_change: number;
}

export function useListaDaVezAnalytics(storeId: string | null) {
    const [loading, setLoading] = useState(false);

    const getCollaboratorDetailedMetrics = useCallback(async (
        profileId: string,
        startDate: Date,
        endDate: Date
    ): Promise<CollaboratorDetailedMetrics | null> => {
        if (!profileId) return null;

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_collaborator_detailed_metrics', {
                p_profile_id: profileId,
                p_start_date: format(startDate, 'yyyy-MM-dd'),
                p_end_date: format(endDate, 'yyyy-MM-dd')
            });

            if (error) throw error;
            return data && data.length > 0 ? data[0] as CollaboratorDetailedMetrics : null;
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao buscar métricas da colaboradora:', error);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getStoreDetailedMetrics = useCallback(async (
        startDate: Date,
        endDate: Date
    ): Promise<StoreDetailedMetrics | null> => {
        if (!storeId) return null;

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_store_detailed_metrics', {
                p_store_id: storeId,
                p_start_date: format(startDate, 'yyyy-MM-dd'),
                p_end_date: format(endDate, 'yyyy-MM-dd')
            });

            if (error) throw error;
            // ✅ CORREÇÃO: Verificar se data existe e tem elementos antes de acessar
            if (!data || !Array.isArray(data) || data.length === 0) {
                return null;
            }
            return data[0] as StoreDetailedMetrics;
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao buscar métricas da loja:', error);
            return null;
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const getPeriodTrends = useCallback(async (
        startDate: Date,
        endDate: Date,
        groupBy: 'day' | 'week' | 'month' = 'day'
    ): Promise<PeriodTrend[]> => {
        if (!storeId) return [];

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_period_trends', {
                p_store_id: storeId,
                p_start_date: format(startDate, 'yyyy-MM-dd'),
                p_end_date: format(endDate, 'yyyy-MM-dd'),
                p_group_by: groupBy
            });

            if (error) throw error;
            return (data || []) as PeriodTrend[];
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao buscar tendências:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const getLossReasonsAnalytics = useCallback(async (
        startDate: Date,
        endDate: Date
    ): Promise<LossReasonAnalytics[]> => {
        if (!storeId) return [];

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_loss_reasons_analytics', {
                p_store_id: storeId,
                p_start_date: format(startDate, 'yyyy-MM-dd'),
                p_end_date: format(endDate, 'yyyy-MM-dd')
            });

            if (error) throw error;
            return (data || []) as LossReasonAnalytics[];
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao buscar analytics de motivos:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const getHourlyAnalytics = useCallback(async (
        startDate: Date,
        endDate: Date
    ): Promise<HourlyAnalytics[]> => {
        if (!storeId) return [];

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_hourly_analytics', {
                p_store_id: storeId,
                p_start_date: format(startDate, 'yyyy-MM-dd'),
                p_end_date: format(endDate, 'yyyy-MM-dd')
            });

            if (error) throw error;
            return (data || []) as HourlyAnalytics[];
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao buscar analytics horários:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const getCollaboratorsRanking = useCallback(async (
        startDate: Date,
        endDate: Date,
        limit: number = 10
    ): Promise<CollaboratorRanking[]> => {
        if (!storeId) return [];

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_collaborators_ranking', {
                p_store_id: storeId,
                p_start_date: format(startDate, 'yyyy-MM-dd'),
                p_end_date: format(endDate, 'yyyy-MM-dd'),
                p_limit: limit
            });

            if (error) throw error;
            return (data || []) as CollaboratorRanking[];
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao buscar ranking:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const comparePeriods = useCallback(async (
        period1Start: Date,
        period1End: Date,
        period2Start: Date,
        period2End: Date
    ): Promise<PeriodComparison[]> => {
        if (!storeId) return [];

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('compare_periods', {
                p_store_id: storeId,
                p_period1_start: format(period1Start, 'yyyy-MM-dd'),
                p_period1_end: format(period1End, 'yyyy-MM-dd'),
                p_period2_start: format(period2Start, 'yyyy-MM-dd'),
                p_period2_end: format(period2End, 'yyyy-MM-dd')
            });

            if (error) throw error;
            return (data || []) as PeriodComparison[];
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao comparar períodos:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const exportAttendanceData = useCallback(async (
        startDate: Date,
        endDate: Date
    ): Promise<any[]> => {
        if (!storeId) return [];

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('export_attendance_data', {
                p_store_id: storeId,
                p_start_date: format(startDate, 'yyyy-MM-dd'),
                p_end_date: format(endDate, 'yyyy-MM-dd')
            });

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            console.error('[useListaDaVezAnalytics] Erro ao exportar dados:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    return {
        loading,
        getCollaboratorDetailedMetrics,
        getStoreDetailedMetrics,
        getPeriodTrends,
        getLossReasonsAnalytics,
        getHourlyAnalytics,
        getCollaboratorsRanking,
        comparePeriods,
        exportAttendanceData
    };
}

