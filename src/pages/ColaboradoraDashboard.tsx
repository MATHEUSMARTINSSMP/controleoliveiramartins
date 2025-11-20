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
      fetchLojas()
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
        .select("valor")
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPasswordDialog(true)}
              className="border-primary/20 hover:bg-primary/10"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Alterar Senha
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-primary/20 hover:bg-primary/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
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

        <Tabs defaultValue="compras" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="compras">Compras</TabsTrigger>
            <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
            <TabsTrigger value="adiantamentos">Adiantamentos</TabsTrigger>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
          </TabsList>

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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={comprasFilters.dataInicio}
                      onChange={(e) => setComprasFilters({ ...comprasFilters, dataInicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={comprasFilters.dataFim}
                      onChange={(e) => setComprasFilters({ ...comprasFilters, dataFim: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Loja</Label>
                    <Select value={comprasFilters.loja} onValueChange={(v) => setComprasFilters({ ...comprasFilters, loja: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todas</SelectItem>
                        {lojas.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={comprasFilters.status} onValueChange={(v) => setComprasFilters({ ...comprasFilters, status: v })}>
                      <SelectTrigger>
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
                    <Label>Buscar Item</Label>
                    <Input
                      placeholder="Digite para buscar..."
                      value={comprasFilters.busca}
                      onChange={(e) => setComprasFilters({ ...comprasFilters, busca: e.target.value })}
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
              <CardHeader>
                <CardTitle>Minhas Compras ({filteredCompras.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Parcelas</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompras.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhuma compra encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCompras.map(c => (
                          <TableRow key={c.id}>
                            <TableCell>{format(new Date(c.data_compra), "dd/MM/yyyy")}</TableCell>
                            <TableCell>{c.item}</TableCell>
                            <TableCell>{c.stores?.name || "-"}</TableCell>
                            <TableCell>{formatCurrency(c.preco_final)}</TableCell>
                            <TableCell>{c.num_parcelas}x</TableCell>
                            <TableCell>{getStatusBadge(c.status_compra)}</TableCell>
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
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Mês/Ano</Label>
                    <Select value={parcelasFilters.mesAno} onValueChange={(v) => setParcelasFilters({ ...parcelasFilters, mesAno: v })}>
                      <SelectTrigger>
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
                    <Label>Status</Label>
                    <Select value={parcelasFilters.status} onValueChange={(v) => setParcelasFilters({ ...parcelasFilters, status: v })}>
                      <SelectTrigger>
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
                    <Label>Valor Mínimo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={parcelasFilters.valorMin}
                      onChange={(e) => setParcelasFilters({ ...parcelasFilters, valorMin: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Valor Máximo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={parcelasFilters.valorMax}
                      onChange={(e) => setParcelasFilters({ ...parcelasFilters, valorMax: e.target.value })}
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
              <CardHeader>
                <CardTitle>Minhas Parcelas ({filteredParcelas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredParcelas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhuma parcela encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredParcelas.map(p => (
                          <TableRow key={p.id}>
                            <TableCell>{p.competencia.slice(4)}/{p.competencia.slice(0, 4)}</TableCell>
                            <TableCell>{p.purchases?.item || "-"}</TableCell>
                            <TableCell>{p.purchases?.stores?.name || "-"}</TableCell>
                            <TableCell>{p.n_parcela}</TableCell>
                            <TableCell>{formatCurrency(p.valor_parcela)}</TableCell>
                            <TableCell>{getStatusBadge(p.status_parcela)}</TableCell>
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
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros
                  </CardTitle>
                  <Button onClick={() => navigate("/solicitar-adiantamento")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Solicitar Adiantamento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={adiantamentosFilters.dataInicio}
                      onChange={(e) => setAdiantamentosFilters({ ...adiantamentosFilters, dataInicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={adiantamentosFilters.dataFim}
                      onChange={(e) => setAdiantamentosFilters({ ...adiantamentosFilters, dataFim: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={adiantamentosFilters.status} onValueChange={(v) => setAdiantamentosFilters({ ...adiantamentosFilters, status: v })}>
                      <SelectTrigger>
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
                    <Label>Mês Competência</Label>
                    <Select value={adiantamentosFilters.mesCompetencia} onValueChange={(v) => setAdiantamentosFilters({ ...adiantamentosFilters, mesCompetencia: v })}>
                      <SelectTrigger>
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
              <CardHeader>
                <CardTitle>Meus Adiantamentos ({filteredAdiantamentos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data Solicitação</TableHead>
                        <TableHead>Mês Competência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Observações/Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdiantamentos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Nenhum adiantamento encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAdiantamentos.map(a => (
                          <TableRow key={a.id}>
                            <TableCell>{formatCurrency(a.valor)}</TableCell>
                            <TableCell>{format(new Date(a.data_solicitacao), "dd/MM/yyyy")}</TableCell>
                            <TableCell>{a.mes_competencia.slice(4)}/{a.mes_competencia.slice(0, 4)}</TableCell>
                            <TableCell>{getStatusBadge(a.status)}</TableCell>
                            <TableCell className="max-w-xs truncate">
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
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CalendarClock className="h-6 w-6 text-primary" />
                  Resumo do Mês ({format(new Date(), 'MMMM yyyy', { locale: { localize: { month: (n: number) => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][n] } } })})
                </CardTitle>
                <p className="text-sm text-muted-foreground">Descontos previstos para este mês</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Parcelas do Mês */}
                  <div className="bg-background/60 p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Parcelas de Compras</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const thisMonth = format(new Date(), 'yyyyMM');
                            const count = parcelas.filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE').length;
                            return `${count} ${count === 1 ? 'parcela' : 'parcelas'}`;
                          })()}
                        </p>
                      </div>
                      <ShoppingBag className="h-5 w-5 text-primary/60" />
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency((() => {
                        const thisMonth = format(new Date(), 'yyyyMM');
                        return parcelas
                          .filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE')
                          .reduce((sum, p) => sum + parseFloat(p.valor_parcela || '0'), 0);
                      })())}
                    </p>
                  </div>

                  {/* Adiantamentos do Mês */}
                  <div className="bg-background/60 p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Adiantamentos</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const thisMonth = format(new Date(), 'yyyyMM');
                            const count = adiantamentos.filter(a => a.mes_competencia === thisMonth && a.status === 'APROVADO').length;
                            return `${count} ${count === 1 ? 'adiantamento' : 'adiantamentos'}`;
                          })()}
                        </p>
                      </div>
                      <DollarSign className="h-5 w-5 text-primary/60" />
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency((() => {
                        const thisMonth = format(new Date(), 'yyyyMM');
                        return adiantamentos
                          .filter(a => a.mes_competencia === thisMonth && a.status === 'APROVADO')
                          .reduce((sum, a) => sum + parseFloat(a.valor || '0'), 0);
                      })())}
                    </p>
                  </div>
                </div>

                {/* Total do Mês */}
                <div className="mt-4 pt-4 border-t border-primary/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total a Descontar</p>
                      <p className="text-xs text-muted-foreground mt-1">Soma de parcelas + adiantamentos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">
                        {formatCurrency((() => {
                          const thisMonth = format(new Date(), 'yyyyMM');
                          const parcelasSum = parcelas
                            .filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE')
                            .reduce((sum, p) => sum + parseFloat(p.valor_parcela || '0'), 0);
                          const adiantamentosSum = adiantamentos
                            .filter(a => a.mes_competencia === thisMonth && a.status === 'APROVADO')
                            .reduce((sum, a) => sum + parseFloat(a.valor || '0'), 0);
                          return parcelasSum + adiantamentosSum;
                        })())}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          const thisMonth = format(new Date(), 'yyyyMM');
                          const parcelasSum = parcelas
                            .filter(p => p.competencia === thisMonth && p.status_parcela === 'PENDENTE')
                            .reduce((sum, p) => sum + parseFloat(p.valor_parcela || '0'), 0);
                          const adiantamentosSum = adiantamentos
                            .filter(a => a.mes_competencia === thisMonth && a.status === 'APROVADO')
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
              <CardHeader>
                <CardTitle>Resumo Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-lg font-semibold">Limite Total</Label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Usado:</span>
                        <span className="font-semibold">{formatCurrency(kpis.totalPendente)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Disponível:</span>
                        <span className="font-semibold text-success">{formatCurrency(kpis.limiteDisponivel)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span>Total:</span>
                        <span className="font-bold">{formatCurrency(kpis.limiteTotal)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${(kpis.totalPendente / kpis.limiteTotal) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        {((kpis.totalPendente / kpis.limiteTotal) * 100).toFixed(1)}% utilizado
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-lg font-semibold">Totais por Status</Label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Pendente:</span>
                        <span className="font-semibold text-warning">{formatCurrency(kpis.totalPendente)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Próximas Parcelas:</span>
                        <span className="font-semibold text-destructive">{formatCurrency(kpis.proximasParcelas)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span>Já Pago:</span>
                        <span className="font-bold text-success">{formatCurrency(kpis.totalPago)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total de Compras</p>
                    <p className="text-2xl font-bold">{compras.length}</p>
                  </div>
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total de Parcelas</p>
                    <p className="text-2xl font-bold">{parcelas.length}</p>
                  </div>
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Adiantamentos</p>
                    <p className="text-2xl font-bold">{adiantamentos.length}</p>
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
