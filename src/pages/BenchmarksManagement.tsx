import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit, Save, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface Benchmark {
  id: string;
  store_id: string;
  store_name?: string;
  ideal_ticket_medio: number;
  ideal_pa: number;
  ideal_preco_medio: number;
}

const BenchmarksManagement = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; benchmark: Benchmark | null }>({
    open: false,
    benchmark: null,
  });
  const [formData, setFormData] = useState({
    ideal_ticket_medio: "",
    ideal_pa: "",
    ideal_preco_medio: "",
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
      // Buscar lojas
      const { data: storesData } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name")
        .eq("active", true)
        .order("name", { ascending: true });

      if (storesData) setStores(storesData);

      // Buscar benchmarks
      const { data: benchmarksData, error } = await supabase
        .schema("sistemaretiradas")
        .from("store_benchmarks")
        .select("*, stores(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedBenchmarks: Benchmark[] = (benchmarksData || []).map((b: any) => ({
        id: b.id,
        store_id: b.store_id,
        store_name: b.stores?.name || "Desconhecido",
        ideal_ticket_medio: Number(b.ideal_ticket_medio),
        ideal_pa: Number(b.ideal_pa),
        ideal_preco_medio: Number(b.ideal_preco_medio),
      }));

      setBenchmarks(formattedBenchmarks);
    } catch (error: any) {
      toast.error("Erro ao carregar benchmarks: " + error.message);
      console.error(error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleEdit = (benchmark: Benchmark) => {
    setFormData({
      ideal_ticket_medio: benchmark.ideal_ticket_medio.toString(),
      ideal_pa: benchmark.ideal_pa.toString(),
      ideal_preco_medio: benchmark.ideal_preco_medio.toString(),
    });
    setEditDialog({ open: true, benchmark });
  };

  const handleSave = async () => {
    if (!editDialog.benchmark) return;

    try {
      const ticketMedio = parseFloat(formData.ideal_ticket_medio);
      const pa = parseFloat(formData.ideal_pa);
      const precoMedio = parseFloat(formData.ideal_preco_medio);

      if (isNaN(ticketMedio) || isNaN(pa) || isNaN(precoMedio)) {
        toast.error("Todos os valores devem ser numéricos");
        return;
      }

      if (ticketMedio <= 0 || pa <= 0 || precoMedio <= 0) {
        toast.error("Todos os valores devem ser maiores que zero");
        return;
      }

      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("store_benchmarks")
        .update({
          ideal_ticket_medio: ticketMedio,
          ideal_pa: pa,
          ideal_preco_medio: precoMedio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editDialog.benchmark.id);

      if (error) throw error;

      toast.success("Benchmark atualizado com sucesso!");
      setEditDialog({ open: false, benchmark: null });
      fetchData(); // Recarrega dados para atualizar KPIs
    } catch (error: any) {
      toast.error("Erro ao salvar benchmark: " + error.message);
      console.error(error);
    }
  };

  const handleCreate = async (storeId: string) => {
    // Verifica se já existe benchmark para esta loja
    const exists = benchmarks.find((b) => b.store_id === storeId);
    if (exists) {
      toast.error("Já existe um benchmark para esta loja. Use a opção de editar.");
      return;
    }

    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("store_benchmarks")
        .insert({
          store_id: storeId,
          ideal_ticket_medio: 750.0,
          ideal_pa: 3.0,
          ideal_preco_medio: 400.0,
        });

      if (error) throw error;

      toast.success("Benchmark criado com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao criar benchmark: " + error.message);
      console.error(error);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="mb-6">
          <img src="/elevea.png" alt="EleveaOne" className="h-20 w-auto animate-pulse" />
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Lojas sem benchmark
  const storesWithoutBenchmark = stores.filter(
    (store) => !benchmarks.find((b) => b.store_id === store.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-3 sm:p-4">
      <div className="container mx-auto py-4 sm:py-8">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-3 sm:mb-4 text-xs sm:text-sm" size="sm">
          <ArrowLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Voltar
        </Button>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-lg sm:text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gerenciar Benchmarks
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Configure as metas de qualidade (Ticket Médio, P.A., Preço Médio) por loja.
              Estas metas são usadas para comparação nos dashboards comerciais.
            </p>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            {loadingData ? (
              <div className="flex items-center justify-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {/* Tabela de Benchmarks */}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Loja</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">Ticket Médio (R$)</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">P.A.</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm hidden md:table-cell">Preço Médio (R$)</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {benchmarks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground text-xs sm:text-sm py-6 sm:py-8">
                            Nenhum benchmark configurado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        benchmarks.map((benchmark) => (
                          <TableRow key={benchmark.id}>
                            <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[150px]">{benchmark.store_name}</TableCell>
                            <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell font-medium">
                              {formatCurrency(benchmark.ideal_ticket_medio, { showSymbol: false })}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">{benchmark.ideal_pa.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell font-medium">
                              {formatCurrency(benchmark.ideal_preco_medio, { showSymbol: false })}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(benchmark)}
                                className="text-primary hover:text-primary/80 h-8 w-8 p-0 sm:h-auto sm:w-auto sm:px-3"
                              >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Editar</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Criar Benchmarks para Lojas sem benchmark */}
                {storesWithoutBenchmark.length > 0 && (
                  <Card className="bg-muted/30 border-dashed">
                    <CardHeader className="p-3 sm:p-6">
                      <CardTitle className="text-base sm:text-lg">Lojas sem Benchmark</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Clique no botão para criar um benchmark padrão para a loja.
                      </p>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {storesWithoutBenchmark.map((store) => (
                          <div
                            key={store.id}
                            className="flex items-center justify-between p-2 sm:p-3 bg-background rounded-lg border"
                          >
                            <span className="font-medium text-xs sm:text-sm truncate flex-1 min-w-0 mr-2">{store.name}</span>
                            <Button
                              size="sm"
                              onClick={() => handleCreate(store.id)}
                              variant="outline"
                              className="text-xs sm:text-sm flex-shrink-0"
                            >
                              <span className="hidden sm:inline">Criar Benchmark</span>
                              <span className="sm:hidden">Criar</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, benchmark: null })}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Editar Benchmark - {editDialog.benchmark?.store_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            <div>
              <Label htmlFor="ticket_medio" className="text-xs sm:text-sm">Ticket Médio Ideal (R$)</Label>
              <Input
                id="ticket_medio"
                type="number"
                step="0.01"
                value={formData.ideal_ticket_medio}
                onChange={(e) => setFormData({ ...formData, ideal_ticket_medio: e.target.value })}
                placeholder="750.00"
                className="text-xs sm:text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Valor médio esperado por venda
              </p>
            </div>
            <div>
              <Label htmlFor="pa" className="text-xs sm:text-sm">P.A. Ideal (Peças por Atendimento)</Label>
              <Input
                id="pa"
                type="number"
                step="0.01"
                value={formData.ideal_pa}
                onChange={(e) => setFormData({ ...formData, ideal_pa: e.target.value })}
                placeholder="3.00"
                className="text-xs sm:text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Número médio de peças vendidas por atendimento
              </p>
            </div>
            <div>
              <Label htmlFor="preco_medio" className="text-xs sm:text-sm">Preço Médio Ideal (R$)</Label>
              <Input
                id="preco_medio"
                type="number"
                step="0.01"
                value={formData.ideal_preco_medio}
                onChange={(e) => setFormData({ ...formData, ideal_preco_medio: e.target.value })}
                placeholder="400.00"
                className="text-xs sm:text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Valor médio por peça vendida
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, benchmark: null })}
              className="w-full sm:w-auto text-xs sm:text-sm"
              size="sm"
            >
              <X className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
              <Save className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BenchmarksManagement;

