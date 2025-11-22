import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColaboradoraCommercial } from "@/components/colaboradora/ColaboradoraCommercial";
import { Achievements } from "@/components/colaboradora/Achievements";
import {
  DollarSign,
  Calendar,
  CalendarClock,
  CheckCircle,
  LogOut,
  ShoppingBag,
  Plus,
  KeyRound,
  Filter,
  X
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { StoreLogo, getStoreIdFromProfile } from "@/lib/storeLogo";
import {
  type PeriodFilter,
  type MonthlyBreakdown,
  getMonthsInPeriod,
  aggregateMonthlyData,
  getStatusBadgeVariant,
  getStatusLabel
} from "@/lib/monthlyCalendar";

interface UserKPIs {
  totalPendente: number;
  proximasParcelas: number;
  totalPago: number;
  limiteTotal: number;
  limiteDisponivel: number;
  limiteMensal: number;
  limiteDisponivelMensal: number;
}

interface Adiantamento {
  id: string;
  valor: number;
  data_solicitacao: string;
  mes_competencia: string;
  status: string;
  motivo_recusa: string | null;
  observacoes: string | null;
}

interface Compra {
  id: string;
  data_compra: string;
  item: string;
  preco_final: number;
  num_parcelas: number;
  stores: { name: string } | null;
  status_compra: string;
}

interface Parcela {
  id: string;
  n_parcela: number;
  competencia: string;
  valor_parcela: number;
  status_parcela: string;
  compra_id: string;
  purchases: {
    item: string;
    stores: { name: string } | null;
  } | null;
}

const ColaboradoraDashboard = () => {
  const { profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<UserKPIs | null>(null);
  const [adiantamentos, setAdiantamentos] = useState<Adiantamento[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [lojas, setLojas] = useState<{ id: string, name: string }[]>([]);

  // Filters
  const [comprasFilters, setComprasFilters] = useState({
    dataInicio: "",
    dataFim: "",
    loja: "TODAS",
    status: "TODOS",
    busca: ""
  });

  const [parcelasFilters, setParcelasFilters] = useState({
    mesAno: "TODOS",
    status: "TODOS",
    valorMin: "",
    valorMax: ""
  });

  const [adiantamentosFilters, setAdiantamentosFilters] = useState({
    dataInicio: "",
    dataFim: "",
    status: "TODOS",
    mesCompetencia: "TODOS"
  });

  // Monthly calendar state
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({ type: 'ultimos-3' });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthlyBreakdown[]>([]);
  const [expandedMonthRow, setExpandedMonthRow] = useState<string | null>(null);

  // Goals and Sales state
  const [goalData, setGoalData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [dailyGoal, setDailyGoal] = useState<number>(0);
  const [dailyProgress, setDailyProgress] = useState<number>(0);

  const [history7Days, setHistory7Days] = useState<any[]>([]);
  const [userRanking, setUserRanking] = useState<number | null>(null);

  // Password dialog
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });

  useEffect(() => {
    if (!loading && profile) {
      fetchAllData();
    }
  }, [profile, loading]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchUserKPIs(),
      fetchAdiantamentos(),
      fetchCompras(),
      fetchParcelas(),
      fetchLojas(),
      fetchGoalsAndSales()
    ]);
  };

  const fetchLojas = async () => {
    const { data } = await supabase.schema("sistemaretiradas").from("stores").select("id, name").eq("active", true);
    if (data) setLojas(data);
  };

  const fetchUserKPIs = async () => {
    if (!profile) return;

    try {
      const { data: profileData } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("limite_total, limite_mensal")
        .eq("id", profile.id)
        .single();

      const { data: purchases } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
        .select("id")
        .eq("colaboradora_id", profile.id);

      if (!purchases) return;

      const purchaseIds = purchases.map(p => p.id);

      const { data: parcelas } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .select("valor_parcela, status_parcela, competencia")
        .in("compra_id", purchaseIds);

      const { data: adiantamentosData } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .select("valor, mes_competencia")
        .eq("colaboradora_id", profile.id)
        .in("status", ["APROVADO", "DESCONTADO"]);

      const totalParcelasPendentes = parcelas
        ?.filter(p => p.status_parcela === "PENDENTE" || p.status_parcela === "AGENDADO")
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      const totalAdiantamentos = adiantamentosData?.reduce((sum, a) => sum + Number(a.valor), 0) || 0;
      const totalPendente = totalParcelasPendentes + totalAdiantamentos;

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

      // Calculate current month usage (parcelas + adiantamentos)
      const currentMonthStr = format(new Date(), 'yyyyMM');

      const parcelasEsteMes = parcelas
        ?.filter(p =>
          p.competencia === currentMonthStr &&
          p.status_parcela === 'PENDENTE'
        )
        .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      const adiantamentosEsteMes = adiantamentosData
        ?.filter(a => {
          // Adiantamentos with mes_competencia matching current month
          // Check both APROVADO and DESCONTADO as both count against monthly limit
          return a.mes_competencia === currentMonthStr;
        })
        .reduce((sum, a) => sum + Number(a.valor), 0) || 0;

      const usadoEsteMes = parcelasEsteMes + adiantamentosEsteMes;
      const limiteDisponivelMensal = Math.max(0, limiteMensal - usadoEsteMes);

      setKpis({
        totalPendente,
        proximasParcelas,
        totalPago,
        limiteTotal,
        limiteDisponivel,
        limiteMensal,
        limiteDisponivelMensal
      });
    } catch (error) {
      console.error("Error fetching user KPIs:", error);
      toast.error("Erro ao carregar seus dados");
      setKpis({
        totalPendente: 0,
        proximasParcelas: 0,
        totalPago: 0,
        limiteTotal: 1000,
        limiteDisponivel: 1000,
        limiteMensal: 800,
        limiteDisponivelMensal: 800
      });
    }
  };

  const fetchAdiantamentos = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .schema("sistemaretiradas")
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

  const fetchGoalsAndSales = async () => {
    if (!profile) return;

    try {
      const mesAtual = format(new Date(), 'yyyyMM');
      const today = format(new Date(), 'yyyy-MM-dd');

      // Buscar meta individual
      const { data: goal } = await supabase
        .from('goals')
        .select('*')
        .eq('colaboradora_id', profile.id)
        .eq('mes_referencia', mesAtual)
        .eq('tipo', 'INDIVIDUAL')
        .single();

      // Buscar vendas do mês
      const { data: sales } = await supabase
        .from('sales')
        .select('*')
        .eq('colaboradora_id', profile.id)
        .gte('data_venda', `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`);

      // Buscar vendas de hoje
      const { data: salesToday } = await supabase
        .from('sales')
        .select('*')
        .eq('colaboradora_id', profile.id)
        .gte('data_venda', `${today}T00:00:00`);

      // Buscar bônus ativos
      const { data: bonusesData } = await supabase
        .from('bonuses')
        .select('*')
        .eq('ativo', true)
        .order('valor_condicao', { ascending: true });

      const totalMes = sales?.reduce((sum, s) => sum + Number(s.valor), 0) || 0;
      const totalHoje = salesToday?.reduce((sum, s) => sum + Number(s.valor), 0) || 0;
      const qtdVendasHoje = salesToday?.length || 0;
      const qtdPecasHoje = salesToday?.reduce((sum, s) => sum + Number(s.qtd_pecas), 0) || 0;
      const ticketMedioHoje = qtdVendasHoje > 0 ? totalHoje / qtdVendasHoje : 0;
      const paHoje = qtdVendasHoje > 0 ? qtdPecasHoje / qtdVendasHoje : 0;

      setGoalData({
        ...goal,
        realizado: totalMes,
        percentual: goal ? (totalMes / goal.meta_valor) * 100 : 0,
      });

      setSalesData({
        totalHoje,
        qtdVendasHoje,
        qtdPecasHoje,
        ticketMedioHoje,
        paHoje,
      });

      setBonuses(bonusesData || []);

      // Calculate Daily Goal
      if (goal) {
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const daily = Number(goal.meta_valor) / daysInMonth;
        setDailyGoal(daily);
        setDailyProgress((totalHoje / daily) * 100);
      }

      // Fetch 7-Day History
      const startDate = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const { data: historyData } = await supabase
        .from('sales')
        .select('data_venda, valor, qtd_pecas')
        .eq('colaboradora_id', profile.id)
        .gte('data_venda', `${startDate}T00:00:00`)
        .order('data_venda', { ascending: true });

      if (historyData) {
        const grouped: Record<string, any> = {};
        historyData.forEach((sale: any) => {
          const day = sale.data_venda.split('T')[0];
          if (!grouped[day]) {
            grouped[day] = { total: 0, qtdVendas: 0, qtdPecas: 0 };
          }
          grouped[day].total += Number(sale.valor);
          grouped[day].qtdVendas += 1;
          grouped[day].qtdPecas += Number(sale.qtd_pecas);
        });
        const result = Object.entries(grouped).map(([day, info]) => ({ day, ...info }));
        setHistory7Days(result);
      }

      // Fetch Ranking Position
      const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
      const { data: rankingData } = await supabase
        .from('sales')
        .select('colaboradora_id, valor')
        .gte('data_venda', `${startOfMonth}T00:00:00`);

      if (rankingData) {
        const grouped = rankingData.reduce((acc: any, sale: any) => {
          acc[sale.colaboradora_id] = (acc[sale.colaboradora_id] || 0) + Number(sale.valor);
          return acc;
        }, {});
        const sortedIds = Object.keys(grouped).sort((a, b) => grouped[b] - grouped[a]);
        const position = sortedIds.indexOf(profile.id) + 1;
        setUserRanking(position > 0 ? position : null);
      }

    } catch (error) {
      console.error('Error fetching goals and sales:', error);
    }
  };

  const fetchCompras = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .schema("sistemaretiradas")
      .from("purchases")
      .select(`
        id,
        data_compra,
        item,
        preco_final,
        num_parcelas,
        status_compra,
        stores (name)
      `)
      .eq("colaboradora_id", profile.id)
      .order("data_compra", { ascending: false });

    if (error) {
      console.error("Error fetching compras:", error);
    } else {
      setCompras(data || []);
    }
  };

  const fetchParcelas = async () => {
    if (!profile) return;

    try {
      const { data: purchases } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
        .select("id")
        .eq("colaboradora_id", profile.id);

      if (!purchases || purchases.length === 0) {
        setParcelas([]);
        return;
      }

      const purchaseIds = purchases.map(p => p.id);

      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .select("id, n_parcela, competencia, valor_parcela, status_parcela, compra_id")
        .in("compra_id", purchaseIds)
        .order("competencia", { ascending: false });

      if (error) {
        console.error("Error fetching parcelas:", error);
        setParcelas([]);
        return;
      }

      // Fetch purchase details separately
      const { data: purchasesDetails } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
        .select(`
          id,
          item,
          stores (name)
        `)
        .in("id", purchaseIds);

      // Map purchases to parcelas
      const purchasesMap = new Map(purchasesDetails?.map(p => [p.id, p]) || []);

      const parcelasWithPurchases = data?.map(p => ({
        ...p,
        purchases: purchasesMap.get(p.compra_id) || null
      })) || [];

      setParcelas(parcelasWithPurchases);
    } catch (error) {
      console.error("Error in fetchParcelas:", error);
      setParcelas([]);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setPasswordDialog(false);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast.error("Erro ao alterar senha: " + error.message);
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
      AGENDADO: "secondary",
      ESTORNADO: "destructive",
    };

    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  // Filter functions
  const filteredCompras = compras.filter(c => {
    const dataCompra = new Date(c.data_compra);
    const matchDataInicio = !comprasFilters.dataInicio || dataCompra >= new Date(comprasFilters.dataInicio);
    const matchDataFim = !comprasFilters.dataFim || dataCompra <= new Date(comprasFilters.dataFim);
    const matchLoja = comprasFilters.loja === "TODAS" || c.stores?.name === comprasFilters.loja;
    const matchStatus = comprasFilters.status === "TODOS" || c.status_compra === comprasFilters.status;
    const matchBusca = !comprasFilters.busca || c.item.toLowerCase().includes(comprasFilters.busca.toLowerCase());

    return matchDataInicio && matchDataFim && matchLoja && matchStatus && matchBusca;
  });

  const filteredParcelas = parcelas.filter(p => {
    const matchMesAno = parcelasFilters.mesAno === "TODOS" || p.competencia === parcelasFilters.mesAno;
    const matchStatus = parcelasFilters.status === "TODOS" || p.status_parcela === parcelasFilters.status;
    const matchValorMin = !parcelasFilters.valorMin || Number(p.valor_parcela) >= Number(parcelasFilters.valorMin);
    const matchValorMax = !parcelasFilters.valorMax || Number(p.valor_parcela) <= Number(parcelasFilters.valorMax);

    return matchMesAno && matchStatus && matchValorMin && matchValorMax;
  });

  const filteredAdiantamentos = adiantamentos.filter(a => {
    const dataSolicitacao = new Date(a.data_solicitacao);
    const matchDataInicio = !adiantamentosFilters.dataInicio || dataSolicitacao >= new Date(adiantamentosFilters.dataInicio);
    const matchDataFim = !adiantamentosFilters.dataFim || dataSolicitacao <= new Date(adiantamentosFilters.dataFim);
    const matchStatus = adiantamentosFilters.status === "TODOS" || a.status === adiantamentosFilters.status;
    const matchMesComp = adiantamentosFilters.mesCompetencia === "TODOS" || a.mes_competencia === adiantamentosFilters.mesCompetencia;

    return matchDataInicio && matchDataFim && matchStatus && matchMesComp;
  });

  // Get unique months from parcelas
  const mesesDisponiveis = Array.from(new Set(parcelas.map(p => p.competencia))).sort().reverse();
  const mesesAdiantamentos = Array.from(new Set(adiantamentos.map(a => a.mes_competencia))).sort().reverse();

  if (loading || !profile || kpis === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <img src="/elevea.png" alt="EleveaOne" className="h-20 w-auto animate-pulse" />
          </div>
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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <StoreLogo 
              storeId={getStoreIdFromProfile(profile)} 
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0" 
            />
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-semibold text-foreground truncate">
                Bem-vinda, {profile.name?.split(' ')[0] || profile.name}
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setPasswordDialog(true)}
              className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
              size="sm"
            >
              <KeyRound className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Alterar Senha</span>
              <span className="sm:hidden">Senha</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
              size="sm"
            >
              <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8">
          <KPICard
            title="Limite Total"
            value={formatCurrency(kpis?.limiteTotal || 0)}
            icon={DollarSign}
          />
          <KPICard
            title="Limite Disponível"
            value={formatCurrency(kpis?.limiteDisponivel || 0)}
            icon={CheckCircle}
          />
          <KPICard
            title="Limite Mensal"
            value={formatCurrency(kpis?.limiteMensal || 0)}
            icon={Calendar}
          />
          <KPICard
            title="Próximas Parcelas"
            value={formatCurrency(kpis?.proximasParcelas || 0)}
            icon={Calendar}
          />
          <KPICard
            title="Total Pendente"
            value={formatCurrency(kpis?.totalPendente || 0)}
            icon={DollarSign}
          />
          <KPICard
            title="Total Pago"
            value={formatCurrency(kpis?.totalPago || 0)}
            icon={CheckCircle}
          />
        </div>

        <Tabs defaultValue="metas" className="space-y-3 sm:space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="metas" className="text-[10px] sm:text-sm px-1 sm:px-3 py-2">
              <span className="hidden sm:inline">Minhas Metas</span>
              <span className="sm:hidden">Metas</span>
            </TabsTrigger>
            <TabsTrigger value="resumo" className="text-[10px] sm:text-sm px-1 sm:px-3 py-2">
              Resumo
            </TabsTrigger>
            <TabsTrigger value="compras" className="text-[10px] sm:text-sm px-1 sm:px-3 py-2">
              Compras
            </TabsTrigger>
            <TabsTrigger value="parcelas" className="text-[10px] sm:text-sm px-1 sm:px-3 py-2">
              Parcelas
            </TabsTrigger>
            <TabsTrigger value="adiantamentos" className="text-[10px] sm:text-sm px-1 sm:px-3 py-2">
              <span className="hidden sm:inline">Adiantamentos</span>
              <span className="sm:hidden">Adiant.</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA METAS */}
          <TabsContent value="metas" className="space-y-4">
            <ColaboradoraCommercial />
            {profile && (
              <Achievements 
                colaboradoraId={profile.id} 
                storeId={profile.store_id || getStoreIdFromProfile(profile) || ''} 
              />
            )}
          </TabsContent>

          {/* ABA COMPRAS */}
          <TabsContent value="compras" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <div>
                    <Label className="text-xs sm:text-sm">Data Início</Label>
                    <Input
                      type="date"
                      value={comprasFilters.dataInicio}
                      onChange={(e) => setComprasFilters({ ...comprasFilters, dataInicio: e.target.value })}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Data Fim</Label>
                    <Input
                      type="date"
                      value={comprasFilters.dataFim}
                      onChange={(e) => setComprasFilters({ ...comprasFilters, dataFim: e.target.value })}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Loja</Label>
                    <Select value={comprasFilters.loja} onValueChange={(v) => setComprasFilters({ ...comprasFilters, loja: v })}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todas</SelectItem>
                        {lojas.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Status</Label>
                    <Select value={comprasFilters.status} onValueChange={(v) => setComprasFilters({ ...comprasFilters, status: v })}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="PENDENTE">Pendente</SelectItem>
                        <SelectItem value="DESCONTADO">Descontado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Buscar Item</Label>
                    <Input
                      placeholder="Digite para buscar..."
                      value={comprasFilters.busca}
                      onChange={(e) => setComprasFilters({ ...comprasFilters, busca: e.target.value })}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                </div>
                {(comprasFilters.dataInicio || comprasFilters.dataFim || comprasFilters.loja !== "TODAS" || comprasFilters.status !== "TODOS" || comprasFilters.busca) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setComprasFilters({ dataInicio: "", dataFim: "", loja: "TODAS", status: "TODOS", busca: "" })}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar Filtros
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Minhas Compras ({filteredCompras.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Data</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Item</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Loja</TableHead>
                        <TableHead className="text-xs sm:text-sm">Valor</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Parcelas</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompras.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground text-xs sm:text-sm py-6">
                            Nenhuma compra encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCompras.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs sm:text-sm">{format(new Date(c.data_compra), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell max-w-[150px] truncate">{c.item}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">{c.stores?.name || "-"}</TableCell>
                            <TableCell className="text-xs sm:text-sm font-medium">{formatCurrency(c.preco_final)}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{c.num_parcelas}x</TableCell>
                            <TableCell className="text-xs sm:text-sm">{getStatusBadge(c.status_compra)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredCompras.length > 0 && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-semibold">
                      Total: {formatCurrency(filteredCompras.reduce((sum, c) => sum + Number(c.preco_final), 0))}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA PARCELAS */}
          <TabsContent value="parcelas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-xs sm:text-sm">Mês/Ano</Label>
                    <Select value={parcelasFilters.mesAno} onValueChange={(v) => setParcelasFilters({ ...parcelasFilters, mesAno: v })}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        {mesesDisponiveis.map(mes => (
                          <SelectItem key={mes} value={mes}>
                            {mes.slice(4)}/{mes.slice(0, 4)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Status</Label>
                    <Select value={parcelasFilters.status} onValueChange={(v) => setParcelasFilters({ ...parcelasFilters, status: v })}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="PENDENTE">Pendente</SelectItem>
                        <SelectItem value="AGENDADO">Agendado</SelectItem>
                        <SelectItem value="DESCONTADO">Descontado</SelectItem>
                        <SelectItem value="ESTORNADO">Estornado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Valor Mínimo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={parcelasFilters.valorMin}
                      onChange={(e) => setParcelasFilters({ ...parcelasFilters, valorMin: e.target.value })}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Valor Máximo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={parcelasFilters.valorMax}
                      onChange={(e) => setParcelasFilters({ ...parcelasFilters, valorMax: e.target.value })}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                </div>
                {(parcelasFilters.mesAno !== "TODOS" || parcelasFilters.status !== "TODOS" || parcelasFilters.valorMin || parcelasFilters.valorMax) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setParcelasFilters({ mesAno: "TODOS", status: "TODOS", valorMin: "", valorMax: "" })}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar Filtros
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Minhas Parcelas ({filteredParcelas.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Competência</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Item</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Loja</TableHead>
                        <TableHead className="text-xs sm:text-sm">Parcela</TableHead>
                        <TableHead className="text-xs sm:text-sm">Valor</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredParcelas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground text-xs sm:text-sm py-6">
                            Nenhuma parcela encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredParcelas.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs sm:text-sm">{p.competencia.slice(4)}/{p.competencia.slice(0, 4)}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell max-w-[150px] truncate">{p.purchases?.item || "-"}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">{p.purchases?.stores?.name || "-"}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{p.n_parcela}</TableCell>
                            <TableCell className="text-xs sm:text-sm font-medium">{formatCurrency(p.valor_parcela)}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{getStatusBadge(p.status_parcela)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredParcelas.length > 0 && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-semibold">
                      Total: {formatCurrency(filteredParcelas.reduce((sum, p) => sum + Number(p.valor_parcela), 0))}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA ADIANTAMENTOS */}
          <TabsContent value="adiantamentos" className="space-y-4">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                    Filtros
                  </CardTitle>
                  <Button onClick={() => navigate("/solicitar-adiantamento")} size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Solicitar Adiantamento</span>
                    <span className="sm:hidden">Solicitar</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-xs sm:text-sm">Data Início</Label>
                    <Input
                      type="date"
                      value={adiantamentosFilters.dataInicio}
                      onChange={(e) => setAdiantamentosFilters({ ...adiantamentosFilters, dataInicio: e.target.value })}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Data Fim</Label>
                    <Input
                      type="date"
                      value={adiantamentosFilters.dataFim}
                      onChange={(e) => setAdiantamentosFilters({ ...adiantamentosFilters, dataFim: e.target.value })}
                      className="text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Status</Label>
                    <Select value={adiantamentosFilters.status} onValueChange={(v) => setAdiantamentosFilters({ ...adiantamentosFilters, status: v })}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="PENDENTE">Pendente</SelectItem>
                        <SelectItem value="APROVADO">Aprovado</SelectItem>
                        <SelectItem value="RECUSADO">Recusado</SelectItem>
                        <SelectItem value="DESCONTADO">Descontado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Mês Competência</Label>
                    <Select value={adiantamentosFilters.mesCompetencia} onValueChange={(v) => setAdiantamentosFilters({ ...adiantamentosFilters, mesCompetencia: v })}>
                      <SelectTrigger className="text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        {mesesAdiantamentos.map(mes => (
                          <SelectItem key={mes} value={mes}>
                            {mes.slice(4)}/{mes.slice(0, 4)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(adiantamentosFilters.dataInicio || adiantamentosFilters.dataFim || adiantamentosFilters.status !== "TODOS" || adiantamentosFilters.mesCompetencia !== "TODOS") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setAdiantamentosFilters({ dataInicio: "", dataFim: "", status: "TODOS", mesCompetencia: "TODOS" })}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar Filtros
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Meus Adiantamentos ({filteredAdiantamentos.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Valor</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Data Solicitação</TableHead>
                        <TableHead className="text-xs sm:text-sm">Mês</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Observações/Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdiantamentos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground text-xs sm:text-sm py-6">
                            Nenhum adiantamento encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAdiantamentos.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs sm:text-sm font-medium">{formatCurrency(a.valor)}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{format(new Date(a.data_solicitacao), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{a.mes_competencia.slice(4)}/{a.mes_competencia.slice(0, 4)}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{getStatusBadge(a.status)}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell max-w-[200px] truncate">
                              {a.status === "RECUSADO" ? a.motivo_recusa : a.observacoes || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredAdiantamentos.length > 0 && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-semibold">
                      Total: {formatCurrency(filteredAdiantamentos.reduce((sum, a) => sum + Number(a.valor), 0))}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA RESUMO */}
          <TabsContent value="resumo">
            {/* RESUMO DO MÊS VIGENTE - DESTAQUE */}
            <Card className="mb-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader className="pb-3 p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                  <CalendarClock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  <span className="hidden sm:inline">Resumo do Mês ({format(new Date(), 'MMMM yyyy', { locale: { localize: { month: (n: number) => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][n] } } })})</span>
                  <span className="sm:hidden">Resumo do Mês</span>
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">Descontos previstos para este mês</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  {/* Parcelas do Mês */}
                  <div className="bg-background/60 p-3 sm:p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Parcelas de Compras</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          {(() => {
                            const thisMonth = format(new Date(), 'yyyyMM');
                            const count = parcelas.filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE').length;
                            return `${count} ${count === 1 ? 'parcela' : 'parcelas'}`;
                          })()}
                        </p>
                      </div>
                      <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-primary/60 flex-shrink-0 ml-2" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-primary">
                      {formatCurrency((() => {
                        const thisMonth = format(new Date(), 'yyyyMM');
                        return parcelas
                          .filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE')
                          .reduce((sum, p) => sum + parseFloat(p.valor_parcela || '0'), 0);
                      })())}
                    </p>
                  </div>

                  {/* Adiantamentos do Mês */}
                  <div className="bg-background/60 p-3 sm:p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Adiantamentos</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          {(() => {
                            const thisMonth = format(new Date(), 'yyyyMM');
                            const count = adiantamentos.filter(a => a.mes_competencia === thisMonth && ['APROVADO', 'DESCONTADO'].includes(a.status)).length;
                            return `${count} ${count === 1 ? 'adiantamento' : 'adiantamentos'}`;
                          })()}
                        </p>
                      </div>
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary/60 flex-shrink-0 ml-2" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-primary">
                      {formatCurrency((() => {
                        const thisMonth = format(new Date(), 'yyyyMM');
                        return adiantamentos
                          .filter(a => a.mes_competencia === thisMonth && ['APROVADO', 'DESCONTADO'].includes(a.status))
                          .reduce((sum, a) => sum + parseFloat(a.valor || '0'), 0);
                      })())}
                    </p>
                  </div>
                </div>

                {/* Total do Mês */}
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-primary/20">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total a Descontar</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Soma de parcelas + adiantamentos</p>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <p className="text-2xl sm:text-3xl font-bold text-primary">
                        {formatCurrency((() => {
                          const thisMonth = format(new Date(), 'yyyyMM');
                          const parcelasSum = parcelas
                            .filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE')
                            .reduce((sum, p) => sum + parseFloat(p.valor_parcela || '0'), 0);
                          const adiantamentosSum = adiantamentos
                            .filter(a => a.mes_competencia === thisMonth && ['APROVADO', 'DESCONTADO'].includes(a.status))
                            .reduce((sum, a) => sum + parseFloat(a.valor || '0'), 0);
                          return parcelasSum + adiantamentosSum;
                        })())}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        {(() => {
                          const thisMonth = format(new Date(), 'yyyyMM');
                          const parcelasSum = parcelas
                            .filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE')
                            .reduce((sum, p) => sum + parseFloat(p.valor_parcela || '0'), 0);
                          const adiantamentosSum = adiantamentos
                            .filter(a => a.mes_competencia === thisMonth && ['APROVADO', 'DESCONTADO'].includes(a.status))
                            .reduce((sum, a) => sum + parseFloat(a.valor || '0'), 0);
                          const total = parcelasSum + adiantamentosSum;
                          const percentOfLimit = kpis ? (total / kpis.limiteMensal) * 100 : 0;
                          return `${percentOfLimit.toFixed(1)}% do limite mensal`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base sm:text-lg font-semibold">Limite Total</Label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span>Usado:</span>
                        <span className="font-semibold">{formatCurrency(kpis.totalPendente)}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span>Disponível:</span>
                        <span className="font-semibold text-success">{formatCurrency(kpis.limiteDisponivel)}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm border-t pt-2">
                        <span>Total:</span>
                        <span className="font-bold">{formatCurrency(kpis.limiteTotal)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 sm:h-4 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${(kpis.totalPendente / kpis.limiteTotal) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
                        {((kpis.totalPendente / kpis.limiteTotal) * 100).toFixed(1)}% utilizado
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base sm:text-lg font-semibold">Totais por Status</Label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span>Pendente:</span>
                        <span className="font-semibold text-warning">{formatCurrency(kpis.totalPendente)}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span>Próximas Parcelas:</span>
                        <span className="font-semibold text-destructive">{formatCurrency(kpis.proximasParcelas)}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm border-t pt-2">
                        <span>Já Pago:</span>
                        <span className="font-bold text-success">{formatCurrency(kpis.totalPago)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 pt-3 sm:pt-4 border-t">
                  <div className="bg-primary/5 p-3 sm:p-4 rounded-lg">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total de Compras</p>
                    <p className="text-xl sm:text-2xl font-bold">{compras.length}</p>
                  </div>
                  <div className="bg-primary/5 p-3 sm:p-4 rounded-lg">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total de Parcelas</p>
                    <p className="text-xl sm:text-2xl font-bold">{parcelas.length}</p>
                  </div>
                  <div className="bg-primary/5 p-3 sm:p-4 rounded-lg">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">Adiantamentos</p>
                    <p className="text-xl sm:text-2xl font-bold">{adiantamentos.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Password Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nova Senha *</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar Nova Senha *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Digite a senha novamente"
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setPasswordDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleChangePassword}>
                Alterar Senha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ColaboradoraDashboard;
