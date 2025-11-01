import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Trash2, ChevronDown, ChevronRight, Undo2 } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ParcelaData {
  id: string;
  compra_id: string;
  n_parcela: number;
  competencia: string;
  valor_parcela: number;
  status_parcela: string;
  data_baixa: string | null;
}

interface CompraData {
  id: string;
  colaboradora_nome: string;
  item: string;
  data_compra: string;
  preco_final: number;
  num_parcelas: number;
  parcelas: ParcelaData[];
}

interface DeletedItem {
  type: 'compra' | 'parcela';
  id: string;
  compraId?: string;
  timestamp: number;
}

const Relatorios = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [compras, setCompras] = useState<CompraData[]>([]);
  const [colaboradoras, setColaboradoras] = useState<{ id: string; name: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ type: 'compra' | 'parcela'; id: string; compraId?: string } | null>(null);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [expandedCompras, setExpandedCompras] = useState<Set<string>>(new Set());
  
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

      const { data: comprasData, error } = await supabase
        .from("purchases")
        .select(`
          id,
          item,
          data_compra,
          preco_final,
          num_parcelas,
          profiles!purchases_colaboradora_id_fkey(name),
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

      const formattedData: CompraData[] = comprasData?.map((c: any) => ({
        id: c.id,
        colaboradora_nome: c.profiles.name,
        item: c.item,
        data_compra: c.data_compra,
        preco_final: c.preco_final,
        num_parcelas: c.num_parcelas,
        parcelas: c.parcelas || [],
      })) || [];

      setCompras(formattedData);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.type === 'compra') {
        // Deletar parcelas primeiro
        const { error: parcelasError } = await supabase
          .from("parcelas")
          .delete()
          .eq("compra_id", deleteDialog.id);

        if (parcelasError) throw parcelasError;

        // Deletar compra
        const { error: compraError } = await supabase
          .from("purchases")
          .delete()
          .eq("id", deleteDialog.id);

        if (compraError) throw compraError;

        setDeletedItems([...deletedItems, { type: 'compra', id: deleteDialog.id, timestamp: Date.now() }]);
        toast.success("Compra excluída! Você pode desfazer nos próximos 30 segundos.");
      } else {
        // Deletar parcela
        const { error } = await supabase
          .from("parcelas")
          .delete()
          .eq("id", deleteDialog.id);

        if (error) throw error;

        setDeletedItems([...deletedItems, { 
          type: 'parcela', 
          id: deleteDialog.id, 
          compraId: deleteDialog.compraId,
          timestamp: Date.now() 
        }]);
        toast.success("Parcela excluída! Você pode desfazer nos próximos 30 segundos.");
      }

      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleUndo = async (item: DeletedItem) => {
    // Remove from deleted items
    setDeletedItems(deletedItems.filter(d => d.id !== item.id));
    toast.success("Exclusão desfeita!");
    fetchData();
  };

  // Auto-remove deleted items after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDeletedItems(prev => prev.filter(item => now - item.timestamp < 30000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getMesesDisponiveis = () => {
    const mesesSet = new Set<string>();
    compras.forEach(c => {
      c.parcelas.forEach(p => mesesSet.add(p.competencia));
    });
    return Array.from(mesesSet).sort().reverse();
  };

  const filteredCompras = compras.filter(c => {
    // Filter by deleted items
    if (deletedItems.some(d => d.type === 'compra' && d.id === c.id)) return false;
    
    if (filters.colaboradora !== "all" && c.colaboradora_nome !== filters.colaboradora) return false;
    if (filters.dataCompra && !c.data_compra.includes(filters.dataCompra)) return false;
    
    // Filter by month and status (check if any parcela matches)
    if (filters.mes !== "all" || filters.status !== "all") {
      const hasMatchingParcela = c.parcelas.some(p => {
        if (filters.mes !== "all" && p.competencia !== filters.mes) return false;
        if (filters.status !== "all" && p.status_parcela !== filters.status) return false;
        return true;
      });
      if (!hasMatchingParcela) return false;
    }
    
    return true;
  });

  const exportToCSV = () => {
    const headers = ["Colaboradora", "Item", "Data Compra", "Valor Total", "Parcelas", "Parcela N°", "Competência", "Valor Parcela", "Status"];
    const rows: string[][] = [];
    
    filteredCompras.forEach(c => {
      c.parcelas.forEach(p => {
        rows.push([
          c.colaboradora_nome,
          c.item,
          format(new Date(c.data_compra), "dd/MM/yyyy"),
          `R$ ${c.preco_final.toFixed(2)}`,
          c.num_parcelas.toString(),
          p.n_parcela.toString(),
          `${p.competencia.substring(4)}/${p.competencia.substring(0, 4)}`,
          `R$ ${p.valor_parcela.toFixed(2)}`,
          p.status_parcela,
        ]);
      });
    });

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const toggleCompra = (compraId: string) => {
    const newExpanded = new Set(expandedCompras);
    if (newExpanded.has(compraId)) {
      newExpanded.delete(compraId);
    } else {
      newExpanded.add(compraId);
    }
    setExpandedCompras(newExpanded);
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

            {deletedItems.length > 0 && (
              <div className="mb-4 space-y-2">
                {deletedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                    <span className="text-sm">
                      {item.type === 'compra' ? 'Compra excluída' : 'Parcela excluída'} - Você pode desfazer
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndo(item)}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Desfazer
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCompras.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum registro encontrado
                  </div>
                ) : (
                  filteredCompras.map((compra) => (
                    <Collapsible
                      key={compra.id}
                      open={expandedCompras.has(compra.id)}
                      onOpenChange={() => toggleCompra(compra.id)}
                    >
                      <div className="rounded-lg border border-primary/10 bg-card">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 hover:bg-accent/5 cursor-pointer transition-colors">
                            <div className="flex items-center gap-4 flex-1">
                              {expandedCompras.has(compra.id) ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
                                <div>
                                  <p className="text-sm text-muted-foreground">Colaboradora</p>
                                  <p className="font-medium">{compra.colaboradora_nome}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Item</p>
                                  <p className="font-medium">{compra.item}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Data Compra</p>
                                  <p className="font-medium">{format(new Date(compra.data_compra), "dd/MM/yyyy")}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Valor Total</p>
                                  <p className="font-medium">R$ {compra.preco_final.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Parcelas</p>
                                  <p className="font-medium">{compra.num_parcelas}x de R$ {(compra.preco_final / compra.num_parcelas).toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDialog({ type: 'compra', id: compra.id });
                              }}
                              className="text-destructive hover:text-destructive ml-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="border-t border-primary/10">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Parcela</TableHead>
                                  <TableHead>Competência</TableHead>
                                  <TableHead>Valor</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Data Baixa</TableHead>
                                  <TableHead>Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {compra.parcelas
                                  .filter(p => !deletedItems.some(d => d.type === 'parcela' && d.id === p.id))
                                  .map((parcela) => (
                                  <TableRow key={parcela.id}>
                                    <TableCell>{parcela.n_parcela}/{compra.num_parcelas}</TableCell>
                                    <TableCell>
                                      {parcela.competencia.substring(4)}/{parcela.competencia.substring(0, 4)}
                                    </TableCell>
                                    <TableCell>R$ {parcela.valor_parcela.toFixed(2)}</TableCell>
                                    <TableCell>
                                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                        parcela.status_parcela === "DESCONTADO" ? "bg-success/10 text-success" :
                                        parcela.status_parcela === "AGENDADO" ? "bg-primary/10 text-primary" :
                                        parcela.status_parcela === "ESTORNADO" ? "bg-destructive/10 text-destructive" :
                                        "bg-muted text-muted-foreground"
                                      }`}>
                                        {parcela.status_parcela}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {parcela.data_baixa ? format(new Date(parcela.data_baixa), "dd/MM/yyyy") : "-"}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteDialog({ type: 'parcela', id: parcela.id, compraId: compra.id })}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === 'compra' 
                ? 'Tem certeza que deseja excluir esta compra? Todas as parcelas associadas serão excluídas. Você terá 30 segundos para desfazer.'
                : 'Tem certeza que deseja excluir esta parcela? Você terá 30 segundos para desfazer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Relatorios;
