// Utility functions for monthly discount calendar

import { format, startOfMonth, endOfMonth, eachMonthOfInterval, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface MonthlyBreakdown {
    month: string; // "2025-01" format
    monthLabel: string; // "Janeiro 2025"
    parcelas: {
        count: number;
        pendente: number;
        pago: number;
        items: any[];
    };
    adiantamentos: {
        count: number;
        aprovado: number;
        descontado: number;
        items: any[];
    };
    totalPendente: number;
    totalPago: number;
    total: number;
    status: 'previsto' | 'parcial' | 'descontado' | 'atrasado';
}

export interface PeriodFilter {
    type: 'mes-atual' | 'ultimo-mes' | 'ultimos-3' | 'ultimos-6' | 'personalizado';
    startDate?: Date;
    endDate?: Date;
}

export function getMonthsInPeriod(filter: PeriodFilter): Date[] {
    const today = new Date();
    const firstOfMonth = startOfMonth(today);

    switch (filter.type) {
        case 'mes-atual':
            return [firstOfMonth];

        case 'ultimo-mes':
            return [subMonths(firstOfMonth, 1)];

        case 'ultimos-3':
            return eachMonthOfInterval({
                start: subMonths(firstOfMonth, 2),
                end: firstOfMonth
            });

        case 'ultimos-6':
            return eachMonthOfInterval({
                start: subMonths(firstOfMonth, 5),
                end: firstOfMonth
            });

        case 'personalizado':
            if (!filter.startDate || !filter.endDate) return [firstOfMonth];
            return eachMonthOfInterval({
                start: startOfMonth(filter.startDate),
                end: endOfMonth(filter.endDate)
            });

        default:
            return [firstOfMonth];
    }
}

export function aggregateMonthlyData(
    parcelas: any[],
    adiantamentos: any[],
    months: Date[]
): MonthlyBreakdown[] {
    return months.map(month => {
        const monthKey = format(month, 'yyyy-MM');
        const monthLabel = format(month, 'MMMM yyyy', { locale: ptBR });

        // Filter parcelas for this month (by competencia)
        const monthParcelas = parcelas.filter(p => {
            const competencia = p.competencia; // Format: YYYYMM
            const parcelaMonth = `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}`;
            return parcelaMonth === monthKey;
        });

        const parcelasPendentes = monthParcelas.filter(p => p.status_parcela === 'PENDENTE');
        const parcelasPagas = monthParcelas.filter(p => p.status_parcela === 'PAGA');

        const parcelasPendenteTotal = parcelasPendentes.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0);
        const parcelasPagasTotal = parcelasPagas.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0);

        // Filter adiantamentos for this month (by mes_competencia)
        const monthAdiantamentos = adiantamentos.filter(a => {
            const competencia = a.mes_competencia; // Format: YYYYMM
            const adiantamentoMonth = `${competencia.slice(0, 4)}-${competencia.slice(4, 6)}`;
            return adiantamentoMonth === monthKey && ['APROVADO', 'DESCONTADO'].includes(a.status);
        });

        const adiantamentosAprovados = monthAdiantamentos.filter(a => a.status === 'APROVADO');
        const adiantamentosDescontados = monthAdiantamentos.filter(a => a.status === 'DESCONTADO');

        const adiantamentosAprovadoTotal = adiantamentosAprovados.reduce((sum, a) => sum + parseFloat(a.valor || 0), 0);
        const adiantamentosDescontadoTotal = adiantamentosDescontados.reduce((sum, a) => sum + parseFloat(a.valor || 0), 0);

        // Calculate totals
        const totalGeral = parcelasPendenteTotal + parcelasPagasTotal + adiantamentosAprovadoTotal + adiantamentosDescontadoTotal;
        const totalPago = parcelasPagasTotal + adiantamentosDescontadoTotal;
        const totalPendente = parcelasPendenteTotal + adiantamentosAprovadoTotal;

        // Determine status
        let status: 'previsto' | 'parcial' | 'descontado' | 'atrasado' = 'previsto';
        const now = new Date();
        const isInPast = month < startOfMonth(now);
        const isCurrentMonth = format(month, 'yyyy-MM') === format(now, 'yyyy-MM');

        if (totalGeral === 0) {
            status = 'previsto';
        } else if (totalPendente === 0) {
            status = 'descontado';
        } else if (totalPago > 0) {
            status = 'parcial';
        } else if (isInPast && totalPendente > 0) {
            status = 'atrasado';
        }

        return {
            month: monthKey,
            monthLabel,
            parcelas: {
                count: monthParcelas.length,
                pendente: parcelasPendenteTotal,
                pago: parcelasPagasTotal,
                items: monthParcelas
            },
            adiantamentos: {
                count: monthAdiantamentos.length,
                aprovado: adiantamentosAprovadoTotal,
                descontado: adiantamentosDescontadoTotal,
                items: monthAdiantamentos
            },
            totalPendente,
            totalPago,
            total: totalGeral,
            status
        };
    }).reverse(); // Most recent first
}

export function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'descontado':
            return 'default'; // green
        case 'parcial':
            return 'secondary'; // yellow
        case 'atrasado':
            return 'destructive'; // red
        case 'previsto':
        default:
            return 'outline'; // gray
    }
}

export function getStatusLabel(status: string): string {
    switch (status) {
        case 'descontado':
            return 'Descontado';
        case 'parcial':
            return 'Parcialmente';
        case 'atrasado':
            return 'Atrasado';
        case 'previsto':
        default:
            return 'Previsto';
    }
}
