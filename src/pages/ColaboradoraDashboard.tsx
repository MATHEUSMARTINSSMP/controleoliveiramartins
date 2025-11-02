import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calendar, CheckCircle, LogOut, ShoppingBag, Plus } from "lucide-react";
import { toast } from "sonner";

interface UserKPIs {
  totalPendente: number;
  proximasParcelas: number;
  totalPago: number;
  limiteTotal: number;
  limiteDisponivel: number;
  limiteMensal: number;
}

interface Adiantamento {
  id: string;
  valor: number;
  data_solicitacao: string;
  mes_competencia: string;
  status: string;
  motivo_recusa: string | null;
}

const ColaboradoraDashboard = () => {
  const { profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<UserKPIs | null>(null);
  const [adiantamentos, setAdiantamentos] = useState<Adiantamento[]>([]);

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/auth");
      } else if (profile.role === "ADMIN") {
        navigate("/admin");
      } else {
        fetchUserKPIs();
        fetchAdiantamentos();
      }
    }
  }, [profile, loading, navigate]);

  const fetchUserKPIs = async () => {
    if (!profile) return;

    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("limite_total, limite_mensal")
        .eq("id", profile.id)
        .single();

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

      const limiteTotal = Number(profileData?.limite_total || 1000);
      const limiteDisponivel = limiteTotal - totalPendente;
      const limiteMensal = Number(profileData?.limite_mensal || 800);

      setKpis({ totalPendente, proximasParcelas, totalPago, limiteTotal, limiteDisponivel, limiteMensal });
    } catch (error) {
      console.error("Error fetching user KPIs:", error);
      toast.error("Erro ao carregar seus dados");
      setKpis({ totalPendente: 0, proximasParcelas: 0, totalPago: 0, limiteTotal: 1000, limiteDisponivel: 1000, limiteMensal: 800 });
    }
  };

  const fetchAdiantamentos = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("adiantamentos")
      .select("*")
      .eq("colaboradora_id", profile.id)
      .order("data_solicitacao", { ascending: false });

    if (error) {
      console.error("Error fetching adiantamentos:", error);
    } else {
      setAdiantamentos(data || []);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDENTE: "secondary",
      APROVADO: "default",
      RECUSADO: "destructive",
      DESCONTADO: "outline",
    };

    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <KPICard
            title="Limite Total"
            value={`R$ ${kpis?.limiteTotal?.toFixed(2) || '0.00'}`}
            icon={DollarSign}
          />
          <KPICard
            title="Limite Disponível"
            value={`R$ ${kpis?.limiteDisponivel?.toFixed(2) || '0.00'}`}
            icon={CheckCircle}
          />
          <KPICard
            title="Limite Mensal"
            value={`R$ ${kpis?.limiteMensal?.toFixed(2) || '0.00'}`}
            icon={Calendar}
          />
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

        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Meus Adiantamentos</CardTitle>
            <Button onClick={() => navigate("/solicitar-adiantamento")}>
              <Plus className="mr-2 h-4 w-4" />
              Solicitar Adiantamento
            </Button>
          </CardHeader>
          <CardContent>
            {adiantamentos.length === 0 ? (
              <p className="text-muted-foreground">Você ainda não possui adiantamentos.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead>Mês Competência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo Recusa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adiantamentos.map((adiantamento) => (
                    <TableRow key={adiantamento.id}>
                      <TableCell>R$ {parseFloat(adiantamento.valor.toString()).toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(adiantamento.data_solicitacao).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>{adiantamento.mes_competencia}</TableCell>
                      <TableCell>{getStatusBadge(adiantamento.status)}</TableCell>
                      <TableCell>{adiantamento.motivo_recusa || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
