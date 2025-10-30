import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Filter, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ParcelaData {
  id: string;
  compra_id: string;
  n_parcela: number;
  competencia: string;
  valor_parcela: number;
  status_parcela: string;
  data_baixa: string | null;
  colaboradora_nome: string;
  item: string;
  data_compra: string;
}

const Relatorios = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [parcelas, setParcelas] = useState<ParcelaData[]>([]);
  const [colaboradoras, setColaboradoras] = useState<{ id: string; name: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deleteCompraId, setDeleteCompraId] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    colaboradora: "all",
    mes: "all",
    status: "all",
    dataCompra: "",
  });

  useEffect(() => {
    if (!loading && (!profile || profile.role !== "ADMIN")) {
      navigate("/");
    } else if (profile) {
      fetchData();
    }
  }, [profile, loading, navigate]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const { data: colabData } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "COLABORADORA")
        .eq("active", true);
      
      if (colabData) setColaboradoras(colabData);

      const { data: parcelasData, error } = await supabase
        .from("parcelas")
        .select(`
          id,
          compra_id,
          n_parcela,
          competencia,
          valor_parcela,
          status_parcela,
          data_baixa,
          purchases!inner(
            colaboradora_id,
            item,
            data_compra,
            profiles!inner(name)
          )
        `)
        .order("competencia", { ascending: false });

      if (error) throw error;

      const formattedData: ParcelaData[] = parcelasData?.map((p: any) => ({
        id: p.id,
        compra_id: p.compra_id,
        n_parcela: p.n_parcela,
        competencia: p.competencia,
        valor_parcela: p.valor_parcela,
        status_parcela: p.status_parcela,
        data_baixa: p.data_baixa,
        colaboradora_nome: p.purchases.profiles.name,
        item: p.purchases.item,
        data_compra: p.purchases.data_compra,
      })) || [];

      setParcelas(formattedData);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteCompra = async (compraId: string) => {
    try {
      // Deletar parcelas primeiro
      const { error: parcelasError } = await supabase
        .from("parcelas")
        .delete()
        .eq("compra_id", compraId);

      if (parcelasError) throw parcelasError;

      // Deletar compra
      const { error: compraError } = await supabase
        .from("purchases")
        .delete()
        .eq("id", compraId);

      if (compraError) throw compraError;

      toast.success("Compra excluída com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir compra: " + error.message);
    } finally {
      setDeleteCompraId(null);
    }
  };

  const getMesesDisponiveis = () => {
    const mesesSet = new Set(parcelas.map(p => p.competencia));
    return Array.from(mesesSet).sort().reverse();
  };

  const filteredParcelas = parcelas.filter(p => {
    if (filters.colaboradora !== "all") {
      const colab = colaboradoras.find(c => c.name === filters.colaboradora);
      if (!colab) return false;
      // Precisamos verificar a colaboradora pela compra
      const parcelaOriginal = parcelas.find(po => po.id === p.id);
      if (parcelaOriginal?.colaboradora_nome !== filters.colaboradora) return false;
    }
    if (filters.mes !== "all" && p.competencia !== filters.mes) return false;
    if (filters.status !== "all" && p.status_parcela !== filters.status) return false;
    if (filters.dataCompra && !p.data_compra.includes(filters.dataCompra)) return false;
    return true;
  });

  const exportToCSV = () => {
    const headers = ["Colaboradora", "Item", "Parcela", "Competência", "Valor", "Status", "Data Compra", "Data Baixa"];
    const rows = filteredParcelas.map(p => [
      p.colaboradora_nome,
      p.item,
      p.n_parcela,
      `${p.competencia.substring(4)}/${p.competencia.substring(0, 4)}`,
      `R$ ${p.valor_parcela.toFixed(2)}`,
      p.status_parcela,
      format(new Date(p.data_compra), "dd/MM/yyyy"),
      p.data_baixa ? format(new Date(p.data_baixa), "dd/MM/yyyy") : "-",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Relatórios
              </CardTitle>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Colaboradora</label>
                <Select value={filters.colaboradora} onValueChange={(v) => setFilters({...filters, colaboradora: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {colaboradoras.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Competência (Mês)</label>
                <Select value={filters.mes} onValueChange={(v) => setFilters({...filters, mes: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {getMesesDisponiveis().map(m => (
                      <SelectItem key={m} value={m}>
                        {m.substring(4)}/{m.substring(0, 4)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="AGENDADO">Agendado</SelectItem>
                    <SelectItem value="DESCONTADO">Descontado</SelectItem>
                    <SelectItem value="ESTORNADO">Estornado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Data da Compra</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filters.dataCompra}
                  onChange={(e) => setFilters({...filters, dataCompra: e.target.value})}
                />
              </div>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="rounded-lg border border-primary/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaboradora</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Compra</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParcelas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredParcelas.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.colaboradora_nome}</TableCell>
                          <TableCell>{p.item}</TableCell>
                          <TableCell>{p.n_parcela}</TableCell>
                          <TableCell>{p.competencia.substring(4)}/{p.competencia.substring(0, 4)}</TableCell>
                          <TableCell>R$ {p.valor_parcela.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              p.status_parcela === "DESCONTADO" ? "bg-success/10 text-success" :
                              p.status_parcela === "AGENDADO" ? "bg-primary/10 text-primary" :
                              p.status_parcela === "ESTORNADO" ? "bg-destructive/10 text-destructive" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {p.status_parcela}
                            </span>
                          </TableCell>
                          <TableCell>{format(new Date(p.data_compra), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteCompraId(p.compra_id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteCompraId} onOpenChange={() => setDeleteCompraId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta compra? Esta ação não pode ser desfeita e todas as parcelas associadas serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCompraId && handleDeleteCompra(deleteCompraId)} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Relatorios;
