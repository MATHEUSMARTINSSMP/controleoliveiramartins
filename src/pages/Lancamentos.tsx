import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Undo2, Trash2, ChevronDown, ChevronRight, Package, Plus, ShoppingBag, Calendar, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface Parcela {
  id: string;
  n_parcela: number;
  competencia: string;
  valor_parcela: number;
  status_parcela: string;
  data_baixa: string | null;
  motivo_estorno: string | null;
  compra_id: string;
  purchases: {
    colaboradora_id: string;
    item: string;
    num_parcelas: number;
    data_compra: string;
    preco_final: number;
    loja_id: string | null;
    profiles: {
      name: string;
    };
  };
}

interface Adiantamento {
  id: string;
  colaboradora_id: string;
  valor: number;
  mes_competencia: string;
  status: string;
  data_solicitacao: string;
  data_desconto: string | null;
  motivo_recusa: string | null;
  observacoes: string | null;
  profiles: {
    name: string;
  };
}

interface CompraCompleta {
  compra_id: string;
  colaboradora: string;
  loja_nome: string;
  data_compra: string;
  num_parcelas: number;
  valor_total: number;
  valor_por_parcela: number;
  valor_pago: number;
  valor_pendente: number;
  item: string;
  parcelas: Parcela[];
}

const Lancamentos = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [compras, setCompras] = useState<CompraCompleta[]>([]);
  const [adiantamentos, setAdiantamentos] = useState<Adiantamento[]>([]);
  const [lojas, setLojas] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParcela, setSelectedParcela] = useState<string | null>(null);
  const [selectedAdiantamento, setSelectedAdiantamento] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"TODOS" | "COMPRAS" | "PARCELAS" | "ADIANTAMENTOS">("TODOS");
  const [mesFiltro, setMesFiltro] = useState<string>("TODOS");
  const [adiantamentoParaExcluir, setAdiantamentoParaExcluir] = useState<string | null>(null);
  const [compraParaExcluir, setCompraParaExcluir] = useState<string | null>(null);
  const [expandedCompras, setExpandedCompras] = useState<Set<string>>(new Set());
  const [expandedParcelas, setExpandedParcelas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading) {
      if (!profile || profile.role !== "ADMIN") {
        navigate("/");
      } else {
        fetchData();
      }
    }
  }, [profile, authLoading, navigate]);

  const fetchLojas = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name")
        .eq("active", true);

      if (error) throw error;
      setLojas(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar lojas:", error);
    }
  };

  const fetchParcelas = async () => {
    try {
      const { data: parcelasData, error } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .select(`
          *,
          purchases!inner(
            colaboradora_id,
            item,
            num_parcelas,
            data_compra,
            preco_final,
            loja_id
          )
        `)
        .order("competencia", { ascending: true })
        .order("n_parcela", { ascending: true });

      if (error) throw error;

      // Buscar perfis das colaboradoras separadamente
      const colaboradoraIds = [...new Set(parcelasData?.map((p: any) => p.purchases?.colaboradora_id).filter(Boolean) || [])];
      const { data: profilesData } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name")
        .in("id", colaboradoraIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      // Formatar dados com nomes das colaboradoras
      const formatted = parcelasData?.map((p: any) => ({
        ...p,
        purchases: {
          ...p.purchases,
          profiles: {
            name: profilesMap.get(p.purchases?.colaboradora_id) || "Desconhecido"
          }
        }
      })) || [];

      setParcelas(formatted);
    } catch (error: any) {
      toast.error("Erro ao carregar parcelas");
      console.error(error);
    }
  };

  const fetchCompras = async () => {
    try {
      const { data: comprasData, error } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
        .select(`
          id,
          colaboradora_id,
          item,
          data_compra,
          preco_final,
          num_parcelas,
          loja_id,
          parcelas(
            id,
            n_parcela,
            competencia,
            valor_parcela,
            status_parcela,
            data_baixa
          )
        `)
        .order("data_compra", { ascending: false });

      if (error) throw error;

      // Buscar perfis e lojas
      const colaboradoraIds = [...new Set(comprasData?.map((c: any) => c.colaboradora_id).filter(Boolean) || [])];
      const storeIds = [...new Set(comprasData?.map((c: any) => c.loja_id).filter(Boolean) || [])];

      const [profilesData, storesData] = await Promise.all([
        supabase
          .schema("sistemaretiradas")
          .from("profiles")
          .select("id, name")
          .in("id", colaboradoraIds),
        supabase
          .schema("sistemaretiradas")
          .from("stores")
          .select("id, name")
          .in("id", storeIds)
      ]);

      const profilesMap = new Map(profilesData.data?.map(p => [p.id, p.name]) || []);
      const storesMap = new Map(storesData.data?.map(s => [s.id, s.name]) || []);

      // Formatar compras com cálculos
      const formatted: CompraCompleta[] = comprasData?.map((c: any) => {
        const parcelas = c.parcelas || [];
        const valorPago = parcelas
          .filter((p: any) => p.status_parcela === "DESCONTADO")
          .reduce((sum: number, p: any) => sum + p.valor_parcela, 0);
        const valorPendente = c.preco_final - valorPago;
        const valorPorParcela = c.num_parcelas > 0 ? c.preco_final / c.num_parcelas : 0;

        return {
          compra_id: c.id,
          colaboradora: profilesMap.get(c.colaboradora_id) || "Desconhecido",
          loja_nome: storesMap.get(c.loja_id) || "Não informado",
          data_compra: c.data_compra,
          num_parcelas: c.num_parcelas,
          valor_total: c.preco_final,
          valor_por_parcela: valorPorParcela,
          valor_pago: valorPago,
          valor_pendente: valorPendente,
          item: c.item,
          parcelas: parcelas.map((p: any) => ({
            ...p,
            purchases: {
              colaboradora_id: c.colaboradora_id,
              item: c.item,
              num_parcelas: c.num_parcelas,
              data_compra: c.data_compra,
              preco_final: c.preco_final,
              loja_id: c.loja_id,
              profiles: {
                name: profilesMap.get(c.colaboradora_id) || "Desconhecido"
              }
            }
          }))
        };
      }) || [];

      setCompras(formatted);
    } catch (error: any) {
      toast.error("Erro ao carregar compras");
      console.error(error);
    }
  };

  const fetchAdiantamentos = async () => {
    try {
      const { data: adiantamentosData, error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .select("*")
        .eq("status", "APROVADO" as any)
        .order("mes_competencia", { ascending: true });

      if (error) throw error;

      // Buscar perfis separadamente
      const colaboradoraIds = [...new Set(adiantamentosData?.map(a => a.colaboradora_id) || [])];
      const { data: profilesData } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name")
        .in("id", colaboradoraIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      const formatted = adiantamentosData?.map(a => ({
        ...a,
        profiles: { name: profilesMap.get(a.colaboradora_id) || "Desconhecido" }
      })) || [];

      setAdiantamentos(formatted);
    } catch (error: any) {
      toast.error("Erro ao carregar adiantamentos");
      console.error(error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchLojas(), fetchParcelas(), fetchCompras(), fetchAdiantamentos()]);
    setLoading(false);
  };

  // Agrupar parcelas por mês (competência)
  const parcelasPorMes = useMemo(() => {
    const parcelasFiltradas = parcelas.filter(p => mesFiltro === "TODOS" || p.competencia === mesFiltro);

    const agrupadas = parcelasFiltradas.reduce((acc, parcela) => {
      const mes = parcela.competencia;
      if (!acc[mes]) {
        acc[mes] = [];
      }
      acc[mes].push(parcela);
      return acc;
    }, {} as Record<string, Parcela[]>);

    return Object.entries(agrupadas)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, parcelas]) => ({
        mes,
        parcelas: parcelas.sort((a, b) => a.n_parcela - b.n_parcela)
      }));
  }, [parcelas, mesFiltro]);

  // Agrupar dados consolidados por mês e colaboradora
  const dadosConsolidados = useMemo(() => {
    // Obter todos os meses únicos de parcelas e adiantamentos
    const mesesParcelas = new Set(parcelas.map(p => p.competencia));
    const mesesAdiantamentos = new Set(adiantamentos.map(a => a.mes_competencia));
    const todosMeses = Array.from(new Set([...mesesParcelas, ...mesesAdiantamentos]))
      .filter(mes => mesFiltro === "TODOS" || mes === mesFiltro)
      .sort((a, b) => b.localeCompare(a));

    return todosMeses.map(mes => {
      // Parcelas do mês
      const parcelasMes = parcelas.filter(p => p.competencia === mes);

      // Adiantamentos do mês
      const adiantamentosMes = adiantamentos.filter(a => a.mes_competencia === mes);

      // Agrupar por colaboradora
      const porColaboradora = new Map<string, {
        colaboradoraId: string;
        colaboradoraNome: string;
        compras: Array<{
          compraId: string;
          item: string;
          parcelas: Parcela[];
        }>;
        adiantamentos: Adiantamento[];
        total: number;
      }>();

      // Processar parcelas (agrupar por compra)
      parcelasMes.forEach(parcela => {
        const colaboradoraId = parcela.purchases.colaboradora_id;
        const colaboradoraNome = parcela.purchases.profiles.name;

        if (!porColaboradora.has(colaboradoraId)) {
          porColaboradora.set(colaboradoraId, {
            colaboradoraId,
            colaboradoraNome,
            compras: [],
            adiantamentos: [],
            total: 0,
          });
        }

        const colaboradora = porColaboradora.get(colaboradoraId)!;

        // Verificar se a compra já existe
        let compra = colaboradora.compras.find(c => c.compraId === parcela.compra_id);
        if (!compra) {
          compra = {
            compraId: parcela.compra_id,
            item: parcela.purchases.item,
            parcelas: [],
          };
          colaboradora.compras.push(compra);
        }
        compra.parcelas.push(parcela);
      });

      // Processar adiantamentos
      adiantamentosMes.forEach(adiantamento => {
        const colaboradoraId = adiantamento.colaboradora_id || '';
        const colaboradoraNome = adiantamento.profiles.name;

        if (!porColaboradora.has(colaboradoraId)) {
          porColaboradora.set(colaboradoraId, {
            colaboradoraId,
            colaboradoraNome,
            compras: [],
            adiantamentos: [],
            total: 0,
          });
        }

        const colaboradora = porColaboradora.get(colaboradoraId)!;
        colaboradora.adiantamentos.push(adiantamento);
      });

      // Calcular totais
      porColaboradora.forEach(colaboradora => {
        const totalParcelas = colaboradora.compras.reduce((sum, compra) => {
          return sum + compra.parcelas.reduce((s, p) => {
            // Só contar parcelas pendentes ou agendadas
            if (p.status_parcela === "PENDENTE" || p.status_parcela === "AGENDADO") {
              return s + p.valor_parcela;
            }
            return s;
          }, 0);
        }, 0);

        const totalAdiantamentos = colaboradora.adiantamentos
          .filter(a => a.status === "APROVADO" && !a.data_desconto)
          .reduce((sum, a) => sum + a.valor, 0);

        colaboradora.total = totalParcelas + totalAdiantamentos;
      });

      return {
        mes,
        colaboradoras: Array.from(porColaboradora.values())
          .sort((a, b) => a.colaboradoraNome.localeCompare(b.colaboradoraNome)),
      };
    });
  }, [parcelas, adiantamentos, mesFiltro]);

  const handleDescontar = async (parcelaId: string) => {
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .update({
          status_parcela: "DESCONTADO",
          data_baixa: new Date().toISOString(),
          baixado_por_id: profile!.id,
        })
        .eq("id", parcelaId);

      if (error) throw error;

      toast.success("Parcela descontada com sucesso!");

      // Atualizar estado localmente para evitar refresh
      const dataBaixa = new Date().toISOString();

      setParcelas(prev => prev.map(p =>
        p.id === parcelaId
          ? { ...p, status_parcela: "DESCONTADO", data_baixa: dataBaixa }
          : p
      ));

      setCompras(prev => prev.map(c => ({
        ...c,
        parcelas: c.parcelas.map(p =>
          p.id === parcelaId
            ? { ...p, status_parcela: "DESCONTADO", data_baixa: dataBaixa }
            : p
        )
      })));

    } catch (error: any) {
      toast.error("Erro ao descontar parcela");
    }
  };

  const handleEstornar = async () => {
    if (!selectedParcela || !motivoEstorno.trim()) {
      toast.error("Informe o motivo do estorno");
      return;
    }

    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .update({
          status_parcela: "ESTORNADO",
          motivo_estorno: motivoEstorno,
          baixado_por_id: profile!.id,
        })
        .eq("id", selectedParcela);

      if (error) throw error;
      toast.success("Parcela estornada com sucesso!");
      setSelectedParcela(null);
      setMotivoEstorno("");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao estornar parcela");
    }
  };

  const handleDescontarAdiantamento = async (adiantamentoId: string) => {
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .update({
          status: "DESCONTADO" as any,
          data_desconto: new Date().toISOString(),
          descontado_por_id: profile!.id,
        })
        .eq("id", adiantamentoId);

      if (error) throw error;

      toast.success("Adiantamento descontado com sucesso!");

      // Atualizar estado localmente
      const dataDesconto = new Date().toISOString();

      setAdiantamentos(prev => prev.map(a =>
        a.id === adiantamentoId
          ? { ...a, status: "DESCONTADO", data_desconto: dataDesconto }
          : a
      ));

    } catch (error: any) {
      toast.error("Erro ao descontar adiantamento");
    }
  };

  const handleEstornarAdiantamento = async () => {
    if (!selectedAdiantamento || !motivoEstorno.trim()) {
      toast.error("Informe o motivo do estorno");
      return;
    }

    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .update({
          status: "APROVADO" as any,
          data_desconto: null,
          motivo_recusa: motivoEstorno,
        })
        .eq("id", selectedAdiantamento);

      if (error) throw error;
      toast.success("Adiantamento estornado com sucesso!");
      setSelectedAdiantamento(null);
      setMotivoEstorno("");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao estornar adiantamento");
    }
  };

  const handleExcluirAdiantamento = async () => {
    if (!adiantamentoParaExcluir) return;

    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .delete()
        .eq("id", adiantamentoParaExcluir);

      if (error) throw error;
      toast.success("Adiantamento excluído com sucesso!");
      setAdiantamentoParaExcluir(null);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir adiantamento");
      console.error(error);
    }
  };

  const handleExcluirCompra = async () => {
    if (!compraParaExcluir) return;

    try {
      // Deletar parcelas primeiro
      const { error: parcelasError } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .delete()
        .eq("compra_id", compraParaExcluir);

      if (parcelasError) throw parcelasError;

      // Deletar compra
      const { error: compraError } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
        .delete()
        .eq("id", compraParaExcluir);

      if (compraError) throw compraError;

      toast.success("Compra excluída com sucesso!");
      setCompraParaExcluir(null);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir compra: " + error.message);
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PENDENTE: { variant: "outline", label: "Pendente" },
      AGENDADO: { variant: "secondary", label: "Agendado" },
      DESCONTADO: { variant: "default", label: "Descontado" },
      ESTORNADO: { variant: "destructive", label: "Estornado" },
      CANCELADO: { variant: "destructive", label: "Cancelado" },
      APROVADO: { variant: "secondary", label: "Aprovado" },
    };
    const config = variants[status] || variants.PENDENTE;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="mb-6">
          <img src="/elevea.png" alt="EleveaOne" className="h-16 w-auto animate-pulse max-w-[200px]" />
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto py-8">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Lançamentos e Descontos
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => navigate("/admin/nova-compra")}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Compra
                </Button>
                <Select value={mesFiltro} onValueChange={setMesFiltro}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    {Array.from(new Set([...parcelas.map(p => p.competencia), ...adiantamentos.map(a => a.mes_competencia)]))
                      .sort()
                      .reverse()
                      .map(mes => (
                        <SelectItem key={mes} value={mes}>
                          {mes.slice(4)}/{mes.slice(0, 4)}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="COMPRAS">Compras</SelectItem>
                    <SelectItem value="PARCELAS">Parcelas</SelectItem>
                    <SelectItem value="ADIANTAMENTOS">Adiantamentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="compras" className="space-y-4">
              <TabsList>
                <TabsTrigger value="compras">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Compras
                </TabsTrigger>
                <TabsTrigger value="parcelas">
                  <Calendar className="h-4 w-4 mr-2" />
                  Parcelas por Mês
                </TabsTrigger>
                <TabsTrigger value="adiantamentos">
                  <Package className="h-4 w-4 mr-2" />
                  Adiantamentos
                </TabsTrigger>
                <TabsTrigger value="consolidado">
                  <FileText className="h-4 w-4 mr-2" />
                  Consolidado
                </TabsTrigger>
              </TabsList>

              {/* ABA DE COMPRAS */}
              <TabsContent value="compras" className="space-y-4">
                {compras.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Nenhuma compra encontrada
                    </CardContent>
                  </Card>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Colaboradora</TableHead>
                          <TableHead>Loja</TableHead>
                          <TableHead>Data da Compra</TableHead>
                          <TableHead>Parcelas</TableHead>
                          <TableHead>Valor Total</TableHead>
                          <TableHead>Valor/Parcela</TableHead>
                          <TableHead>Já Pago</TableHead>
                          <TableHead>Falta Pagar</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compras.map((compra) => {
                          const isExpanded = expandedCompras.has(compra.compra_id);
                          const compraIdShort = compra.compra_id.substring(0, 8).toUpperCase();

                          const toggleExpand = () => {
                            const newExpanded = new Set(expandedCompras);
                            if (isExpanded) {
                              newExpanded.delete(compra.compra_id);
                            } else {
                              newExpanded.add(compra.compra_id);
                            }
                            setExpandedCompras(newExpanded);
                          };

                          return (
                            <>
                              {/* Linha principal da compra */}
                              <TableRow key={compra.compra_id} className={compra.valor_pendente === 0 ? "bg-muted/30" : ""}>
                                <TableCell>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleExpand}>
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {compra.colaboradora}
                                </TableCell>
                                <TableCell>
                                  {compra.loja_nome}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(compra.data_compra), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell>
                                  {compra.num_parcelas}x
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {formatCurrency(compra.valor_total)}
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(compra.valor_por_parcela)}
                                </TableCell>
                                <TableCell className="text-success">
                                  {formatCurrency(compra.valor_pago)}
                                </TableCell>
                                <TableCell className={compra.valor_pendente > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                                  {formatCurrency(compra.valor_pendente)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    {profile?.role === "ADMIN" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCompraParaExcluir(compra.compra_id);
                                        }}
                                        className="border-destructive/20 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Excluir Compra
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Parcelas expandidas */}
                              {isExpanded && (
                                <>
                                  {compra.parcelas
                                    .sort((a, b) => a.n_parcela - b.n_parcela)
                                    .map((parcela) => {
                                      const competenciaFormatada = `${parcela.competencia.slice(0, 4)}/${parcela.competencia.slice(4)}`;

                                      return (
                                        <TableRow key={parcela.id} className="bg-muted/20">
                                          <TableCell></TableCell>
                                          <TableCell className="text-muted-foreground text-xs pl-8">
                                            Parcela {parcela.n_parcela}/{compra.num_parcelas}
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs">
                                            Descontar em: {competenciaFormatada}
                                          </TableCell>
                                          <TableCell colSpan={3}></TableCell>
                                          <TableCell>
                                            {formatCurrency(parcela.valor_parcela)}
                                          </TableCell>
                                          <TableCell>
                                            {getStatusBadge(parcela.status_parcela)}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex gap-2">
                                              {parcela.status_parcela === "PENDENTE" || parcela.status_parcela === "AGENDADO" ? (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDescontar(parcela.id);
                                                  }}
                                                  className="border-primary/20"
                                                >
                                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                                  Descontar
                                                </Button>
                                              ) : parcela.status_parcela === "DESCONTADO" ? (
                                                <Dialog>
                                                  <DialogTrigger asChild>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedParcela(parcela.id);
                                                      }}
                                                      className="border-destructive/20"
                                                    >
                                                      <Undo2 className="h-4 w-4 mr-1" />
                                                      Estornar
                                                    </Button>
                                                  </DialogTrigger>
                                                  <DialogContent>
                                                    <DialogHeader>
                                                      <DialogTitle>Estornar Parcela</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                      <div>
                                                        <Label htmlFor="motivo">Motivo do Estorno *</Label>
                                                        <Textarea
                                                          id="motivo"
                                                          value={motivoEstorno}
                                                          onChange={(e) => setMotivoEstorno(e.target.value)}
                                                          placeholder="Descreva o motivo do estorno"
                                                          rows={4}
                                                        />
                                                      </div>
                                                      <Button
                                                        onClick={handleEstornar}
                                                        className="w-full"
                                                        variant="destructive"
                                                      >
                                                        Confirmar Estorno
                                                      </Button>
                                                    </div>
                                                  </DialogContent>
                                                </Dialog>
                                              ) : null}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  {/* Detalhes dos produtos */}
                                  <TableRow key={`${compra.compra_id}-items`}>
                                    <TableCell colSpan={10} className="bg-muted/40 p-5">
                                      <div className="space-y-3">
                                        <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                          <Package className="h-4 w-4 text-primary" />
                                          Produtos da Compra
                                          <span className="font-mono text-xs text-muted-foreground font-normal ml-1">({compraIdShort})</span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {compra.item.split(',').map((item, idx) => (
                                            <div key={idx} className="text-sm text-foreground py-1.5 px-3 bg-background/80 rounded-md border border-border/30">
                                              {item.trim()}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* ABA DE PARCELAS POR MÊS */}
              <TabsContent value="parcelas" className="space-y-4">
                {parcelasPorMes.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Nenhuma parcela encontrada
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {parcelasPorMes.map(({ mes, parcelas: parcelasMes }) => {
                      const mesFormatado = `${mes.slice(4)}/${mes.slice(0, 4)}`;
                      const totalMes = parcelasMes.reduce((sum, p) => sum + p.valor_parcela, 0);
                      const totalDescontado = parcelasMes
                        .filter(p => p.status_parcela === "DESCONTADO")
                        .reduce((sum, p) => sum + p.valor_parcela, 0);
                      const totalPendente = totalMes - totalDescontado;

                      return (
                        <Card key={mes}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">
                                {mesFormatado}
                              </CardTitle>
                              <div className="flex gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Total: </span>
                                  <span className="font-semibold">{formatCurrency(totalMes)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Descontado: </span>
                                  <span className="font-semibold text-success">{formatCurrency(totalDescontado)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Pendente: </span>
                                  <span className="font-semibold text-destructive">{formatCurrency(totalPendente)}</span>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-md border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>ID Compra</TableHead>
                                    <TableHead>Colaboradora</TableHead>
                                    <TableHead>Parcela</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Ações</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {parcelasMes.map((parcela) => {
                                    const compraIdShort = parcela.compra_id.substring(0, 8).toUpperCase();
                                    const isParcelaExpanded = expandedParcelas.has(parcela.id);

                                    const toggleParcelaExpand = () => {
                                      const newExpanded = new Set(expandedParcelas);
                                      if (isParcelaExpanded) {
                                        newExpanded.delete(parcela.id);
                                      } else {
                                        newExpanded.add(parcela.id);
                                      }
                                      setExpandedParcelas(newExpanded);
                                    };

                                    return (
                                      <>
                                        <TableRow key={parcela.id} className={parcela.status_parcela === "DESCONTADO" ? "bg-muted/20" : ""}>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleParcelaExpand}>
                                                {isParcelaExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                              </Button>
                                              <span className="font-mono text-xs font-semibold text-primary">
                                                {compraIdShort}
                                              </span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {parcela.purchases.profiles.name}
                                          </TableCell>
                                          <TableCell>
                                            {parcela.n_parcela}/{parcela.purchases.num_parcelas}
                                          </TableCell>
                                          <TableCell>{formatCurrency(parcela.valor_parcela)}</TableCell>
                                          <TableCell>{getStatusBadge(parcela.status_parcela)}</TableCell>
                                          <TableCell>
                                            <div className="flex gap-2">
                                              {parcela.status_parcela === "PENDENTE" || parcela.status_parcela === "AGENDADO" ? (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDescontar(parcela.id);
                                                  }}
                                                  className="border-primary/20"
                                                >
                                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                                  Descontar
                                                </Button>
                                              ) : parcela.status_parcela === "DESCONTADO" ? (
                                                <Dialog>
                                                  <DialogTrigger asChild>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedParcela(parcela.id);
                                                      }}
                                                      className="border-destructive/20"
                                                    >
                                                      <Undo2 className="h-4 w-4 mr-1" />
                                                      Estornar
                                                    </Button>
                                                  </DialogTrigger>
                                                  <DialogContent>
                                                    <DialogHeader>
                                                      <DialogTitle>Estornar Parcela</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                      <div>
                                                        <Label htmlFor="motivo">Motivo do Estorno *</Label>
                                                        <Textarea
                                                          id="motivo"
                                                          value={motivoEstorno}
                                                          onChange={(e) => setMotivoEstorno(e.target.value)}
                                                          placeholder="Descreva o motivo do estorno"
                                                          rows={4}
                                                        />
                                                      </div>
                                                      <Button
                                                        onClick={handleEstornar}
                                                        className="w-full"
                                                        variant="destructive"
                                                      >
                                                        Confirmar Estorno
                                                      </Button>
                                                    </div>
                                                  </DialogContent>
                                                </Dialog>
                                              ) : null}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                        {isParcelaExpanded && (
                                          <TableRow key={`${parcela.id}-detail`}>
                                            <TableCell colSpan={6} className="bg-muted/40 p-5">
                                              <div className="space-y-3">
                                                <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                                  <Package className="h-4 w-4 text-primary" />
                                                  Produtos da Compra
                                                  <span className="font-mono text-xs text-muted-foreground font-normal ml-1">({compraIdShort})</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                  {parcela.purchases.item.split(',').map((item, idx) => (
                                                    <div key={idx} className="text-sm text-foreground py-1.5 px-3 bg-background/80 rounded-md border border-border/30">
                                                      {item.trim()}
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ABA DE ADIANTAMENTOS */}
              <TabsContent value="adiantamentos" className="space-y-4">
                {adiantamentos.filter(a => mesFiltro === "TODOS" || a.mes_competencia === mesFiltro).length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Nenhum adiantamento encontrado
                    </CardContent>
                  </Card>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaboradora</TableHead>
                          <TableHead>Competência</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adiantamentos
                          .filter(a => mesFiltro === "TODOS" || a.mes_competencia === mesFiltro)
                          .map((adiantamento) => (
                            <TableRow key={adiantamento.id}>
                              <TableCell className="font-medium">
                                {adiantamento.profiles.name}
                              </TableCell>
                              <TableCell>
                                {adiantamento.mes_competencia.slice(0, 4)}/{adiantamento.mes_competencia.slice(4)}
                              </TableCell>
                              <TableCell>{formatCurrency(adiantamento.valor)}</TableCell>
                              <TableCell>{getStatusBadge(adiantamento.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {adiantamento.status === "APROVADO" && !adiantamento.data_desconto && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDescontarAdiantamento(adiantamento.id)}
                                      className="border-primary/20"
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Descontar
                                    </Button>
                                  )}
                                  {adiantamento.status === "DESCONTADO" && (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setSelectedAdiantamento(adiantamento.id)}
                                          className="border-destructive/20"
                                        >
                                          <Undo2 className="h-4 w-4 mr-1" />
                                          Estornar
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Estornar Adiantamento</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div>
                                            <Label htmlFor="motivoAd">Motivo do Estorno *</Label>
                                            <Textarea
                                              id="motivoAd"
                                              value={motivoEstorno}
                                              onChange={(e) => setMotivoEstorno(e.target.value)}
                                              placeholder="Descreva o motivo do estorno"
                                              rows={4}
                                            />
                                          </div>
                                          <Button
                                            onClick={handleEstornarAdiantamento}
                                            className="w-full"
                                            variant="destructive"
                                          >
                                            Confirmar Estorno
                                          </Button>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                  {profile?.role === "ADMIN" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setAdiantamentoParaExcluir(adiantamento.id)}
                                      className="border-destructive/20 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Excluir
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* ABA CONSOLIDADO */}
              <TabsContent value="consolidado" className="space-y-4">
                {dadosConsolidados.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Nenhum dado encontrado
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {dadosConsolidados.map(({ mes, colaboradoras }) => {
                      const mesFormatado = `${mes.slice(4)}/${mes.slice(0, 4)}`;

                      return (
                        <Card key={mes}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">
                                {mesFormatado}
                              </CardTitle>
                              <div className="flex gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Total: </span>
                                  <span className="font-semibold">
                                    {formatCurrency(colaboradoras.reduce((sum, c) => sum + c.total, 0))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {colaboradoras.map((colaboradora) => {
                                const todasParcelas = colaboradora.compras.flatMap(c =>
                                  c.parcelas.filter(p => p.status_parcela === "PENDENTE" || p.status_parcela === "AGENDADO")
                                );
                                const adiantamentosPendentes = colaboradora.adiantamentos.filter(
                                  a => a.status === "APROVADO" && !a.data_desconto
                                );

                                if (todasParcelas.length === 0 && adiantamentosPendentes.length === 0) {
                                  return null;
                                }

                                return (
                                  <div key={colaboradora.colaboradoraId} className="space-y-3">
                                    {/* Cabeçalho da Colaboradora */}
                                    <div className="flex items-center justify-between pb-2 border-b">
                                      <h3 className="font-semibold text-foreground">
                                        {colaboradora.colaboradoraNome}
                                      </h3>
                                      <div className="text-right">
                                        <span className="text-sm text-muted-foreground">Total: </span>
                                        <span className="font-semibold text-primary">
                                          {formatCurrency(colaboradora.total)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Tabela de Parcelas e Adiantamentos */}
                                    <div className="rounded-md border overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>ID Compra</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Parcela</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Ações</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {/* Parcelas */}
                                          {todasParcelas
                                            .sort((a, b) => {
                                              // Ordenar por data da compra, depois por número da parcela
                                              const dataA = new Date(a.purchases.data_compra).getTime();
                                              const dataB = new Date(b.purchases.data_compra).getTime();
                                              if (dataA !== dataB) return dataB - dataA;
                                              return a.n_parcela - b.n_parcela;
                                            })
                                            .map((parcela) => {
                                              const compraIdShort = parcela.compra_id.substring(0, 8).toUpperCase();

                                              return (
                                                <TableRow key={parcela.id}>
                                                  <TableCell className="text-muted-foreground text-sm">
                                                    Compra
                                                  </TableCell>
                                                  <TableCell>
                                                    <span className="font-mono text-xs font-semibold text-primary">
                                                      {compraIdShort}
                                                    </span>
                                                  </TableCell>
                                                  <TableCell>
                                                    {format(new Date(parcela.purchases.data_compra), "dd/MM/yyyy")}
                                                  </TableCell>
                                                  <TableCell>
                                                    {parcela.n_parcela}/{parcela.purchases.num_parcelas}
                                                  </TableCell>
                                                  <TableCell>{formatCurrency(parcela.valor_parcela)}</TableCell>
                                                  <TableCell>{getStatusBadge(parcela.status_parcela)}</TableCell>
                                                  <TableCell>
                                                    <Button
                                                      size="sm"
                                                      variant={parcela.status_parcela === "DESCONTADO" ? "ghost" : "outline"}
                                                      onClick={() => parcela.status_parcela !== "DESCONTADO" && handleDescontar(parcela.id)}
                                                      disabled={parcela.status_parcela === "DESCONTADO"}
                                                      className={parcela.status_parcela === "DESCONTADO" ? "text-muted-foreground" : "border-primary/20"}
                                                    >
                                                      {parcela.status_parcela === "DESCONTADO" ? (
                                                        <>
                                                          <CheckCircle2 className="h-4 w-4 mr-1" />
                                                          Descontado
                                                        </>
                                                      ) : (
                                                        <>
                                                          <CheckCircle2 className="h-4 w-4 mr-1" />
                                                          Descontar
                                                        </>
                                                      )}
                                                    </Button>
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}

                                          {/* Adiantamentos */}
                                          {adiantamentosPendentes.map((adiantamento) => (
                                            <TableRow key={adiantamento.id}>
                                              <TableCell className="text-muted-foreground text-sm">
                                                Adiantamento
                                              </TableCell>
                                              <TableCell className="text-muted-foreground">
                                                -
                                              </TableCell>
                                              <TableCell>
                                                {format(new Date(adiantamento.data_solicitacao), "dd/MM/yyyy")}
                                              </TableCell>
                                              <TableCell className="text-muted-foreground">
                                                -
                                              </TableCell>
                                              <TableCell>{formatCurrency(adiantamento.valor)}</TableCell>
                                              <TableCell>{getStatusBadge(adiantamento.status)}</TableCell>
                                              <TableCell>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => handleDescontarAdiantamento(adiantamento.id)}
                                                  className="border-primary/20"
                                                >
                                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                                  Descontar
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmação para excluir adiantamento */}
      <AlertDialog open={!!adiantamentoParaExcluir} onOpenChange={(open) => !open && setAdiantamentoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Adiantamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este adiantamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirAdiantamento}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação para excluir compra */}
      <AlertDialog open={!!compraParaExcluir} onOpenChange={(open) => !open && setCompraParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Compra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta compra e todas as suas parcelas? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirCompra}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Lancamentos;
