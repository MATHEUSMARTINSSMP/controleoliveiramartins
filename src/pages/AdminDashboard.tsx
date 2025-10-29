import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { DollarSign, TrendingUp, Clock, LogOut, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface KPIData {
  previsto: number;
  descontado: number;
  pendente: number;
  mesAtual: number;
}

const AdminDashboard = () => {
  const { profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIData>({ previsto: 0, descontado: 0, pendente: 0, mesAtual: 0 });

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/auth");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      } else {
        fetchKPIs();
      }
    }
  }, [profile, loading, navigate]);

  const fetchKPIs = async () => {
    try {
      const { data: parcelas, error } = await supabase
        .from("parcelas")
        .select("valor_parcela, status_parcela, competencia");

      if (error) throw error;

      const mesAtual = format(new Date(), "yyyyMM");

      const previsto = parcelas?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
      const descontado = parcelas
        ?.filter(p => p.status_parcela === "DESCONTADO")
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
      const pendente = parcelas
        ?.filter(p => p.status_parcela === "PENDENTE" || p.status_parcela === "AGENDADO")
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
      const mesAtualTotal = parcelas
        ?.filter(p => p.competencia === mesAtual && (p.status_parcela === "PENDENTE" || p.status_parcela === "AGENDADO"))
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      setKpis({ previsto, descontado, pendente, mesAtual: mesAtualTotal });
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      toast.error("Erro ao carregar indicadores");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <header className="bg-card/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50 shadow-[var(--shadow-card)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dashboard Admin
            </h1>
            <p className="text-sm text-muted-foreground">Bem-vindo, {profile.name}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="border-primary/20 hover:bg-primary/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <KPICard
            title="Total Previsto"
            value={`R$ ${kpis.previsto.toFixed(2)}`}
            icon={DollarSign}
          />
          <KPICard
            title="Descontar Mês Atual"
            value={`R$ ${kpis.mesAtual.toFixed(2)}`}
            icon={Calendar}
          />
          <KPICard
            title="Total Descontado"
            value={`R$ ${kpis.descontado.toFixed(2)}`}
            icon={TrendingUp}
            trend={{
              value: `${((kpis.descontado / kpis.previsto) * 100 || 0).toFixed(1)}%`,
              isPositive: kpis.descontado > 0,
            }}
          />
          <KPICard
            title="Total Pendente"
            value={`R$ ${kpis.pendente.toFixed(2)}`}
            icon={Clock}
          />
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <Button
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-md hover:shadow-lg"
            onClick={() => navigate("/admin/nova-compra")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Compra
          </Button>
          <Button
            variant="outline"
            className="border-primary/20 hover:bg-primary/10"
            onClick={() => navigate("/admin/lancamentos")}
          >
            Lançamentos e Descontos
          </Button>
          <Button
            variant="outline"
            className="border-primary/20 hover:bg-primary/10"
            onClick={() => navigate("/admin/relatorios")}
          >
            Ver Relatórios
          </Button>
        </div>

        <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-primary/10 p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-semibold mb-4">Gestão de Compras e Parcelas</h2>
          <p className="text-muted-foreground">
            Área em desenvolvimento. Use os botões acima para criar novas compras ou visualizar relatórios.
          </p>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
