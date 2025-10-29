import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { DollarSign, Calendar, CheckCircle, LogOut, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface UserKPIs {
  totalPendente: number;
  proximasParcelas: number;
  totalPago: number;
}

const ColaboradoraDashboard = () => {
  const { profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<UserKPIs | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/auth");
      } else if (profile.role === "ADMIN") {
        navigate("/admin");
      } else {
        fetchUserKPIs();
      }
    }
  }, [profile, loading, navigate]);

  const fetchUserKPIs = async () => {
    if (!profile) return;

    try {
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id")
        .eq("colaboradora_id", profile.id);

      if (!purchases) return;

      const purchaseIds = purchases.map(p => p.id);
      
      const { data: parcelas, error } = await supabase
        .from("parcelas")
        .select("valor_parcela, status_parcela, competencia")
        .in("compra_id", purchaseIds);

      if (error) throw error;

      const totalPendente = parcelas
        ?.filter(p => p.status_parcela === "PENDENTE" || p.status_parcela === "AGENDADO")
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      const currentMonth = new Date().toISOString().slice(0, 7).replace("-", "");
      const proximasParcelas = parcelas
        ?.filter(p => 
          (p.status_parcela === "PENDENTE" || p.status_parcela === "AGENDADO") &&
          p.competencia <= currentMonth
        )
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      const totalPago = parcelas
        ?.filter(p => p.status_parcela === "DESCONTADO")
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      setKpis({ totalPendente, proximasParcelas, totalPago });
    } catch (error) {
      console.error("Error fetching user KPIs:", error);
      toast.error("Erro ao carregar seus dados");
      setKpis({ totalPendente: 0, proximasParcelas: 0, totalPago: 0 });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading || !profile || kpis === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="text-center">
          <div className="inline-block p-6 rounded-full bg-gradient-to-br from-primary to-accent mb-6 animate-pulse">
            <ShoppingBag className="w-16 h-16 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <header className="bg-card/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50 shadow-[var(--shadow-card)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Minhas Compras
            </h1>
            <p className="text-sm text-muted-foreground">Bem-vinda, {profile.name}</p>
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
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <KPICard
            title="Próximas Parcelas"
            value={`R$ ${kpis?.proximasParcelas?.toFixed(2) || '0.00'}`}
            icon={Calendar}
          />
          <KPICard
            title="Total Pendente"
            value={`R$ ${kpis?.totalPendente?.toFixed(2) || '0.00'}`}
            icon={DollarSign}
          />
          <KPICard
            title="Total Pago"
            value={`R$ ${kpis?.totalPago?.toFixed(2) || '0.00'}`}
            icon={CheckCircle}
          />
        </div>

        <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-primary/10 p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-semibold mb-4">Histórico de Compras</h2>
          <p className="text-muted-foreground">
            Seu histórico completo de compras e parcelas aparecerá aqui em breve.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ColaboradoraDashboard;
