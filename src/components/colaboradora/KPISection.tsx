/**
 * Colaboradora KPI Section
 * Modular component using React Query hooks
 */

import { KPICard } from "@/components/KPICard";
import { useColaboradoraKPIs } from "@/hooks/queries/use-colaboradora";
import { SkeletonKPICard } from "@/components/ui/skeleton-loaders";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { DollarSign, CalendarClock, CheckCircle, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface KPISectionProps {
  profileId: string;
}

function KPISectionContent({ profileId }: KPISectionProps) {
  const { data: kpis, isLoading, error } = useColaboradoraKPIs(profileId);

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Não foi possível carregar os dados
      </div>
    );
  }

  const limiteUtilizado = kpis.limiteTotal - kpis.limiteDisponivel;
  const percentualUtilizado = kpis.limiteTotal > 0 
    ? (limiteUtilizado / kpis.limiteTotal) * 100 
    : 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <KPICard
        title="Total Pendente"
        value={formatCurrency(kpis.totalPendente)}
        icon={DollarSign}
        data-testid="kpi-total-pendente"
      />
      <KPICard
        title="Próximas Parcelas"
        value={formatCurrency(kpis.proximasParcelas)}
        icon={CalendarClock}
        data-testid="kpi-proximas-parcelas"
      />
      <KPICard
        title="Total Pago"
        value={formatCurrency(kpis.totalPago)}
        icon={CheckCircle}
        data-testid="kpi-total-pago"
      />
      <KPICard
        title="Limite Disponível"
        value={formatCurrency(kpis.limiteDisponivel)}
        icon={Wallet}
        data-testid="kpi-limite-disponivel"
      />
    </div>
  );
}

export function KPISection({ profileId }: KPISectionProps) {
  return (
    <ErrorBoundary level="section">
      <KPISectionContent profileId={profileId} />
    </ErrorBoundary>
  );
}
