import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Clock, LogOut, Plus, Calendar, Trash2, Edit } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface ColaboradoraLimite {
  id: string;
  name: string;
  limite_total: number;
  limite_mensal: number;
  usado_total: number;
  disponivel: number;
}

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
  const [colaboradoras, setColaboradoras] = useState<ColaboradoraLimite[]>([]);
  const [deleteCompraId, setDeleteCompraId] = useState<string | null>(null);
  const [editLimiteDialog, setEditLimiteDialog] = useState<{ open: boolean; colaboradora: ColaboradoraLimite | null }>({
    open: false,
    colaboradora: null,
  });
  const [limiteForm, setLimiteForm] = useState({ limite_total: "", limite_mensal: "" });

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        navigate("/auth");
      } else if (profile.role !== "ADMIN") {
        navigate("/me");
      } else {
        fetchKPIs();
        fetchColaboradorasLimites();
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

  const fetchColaboradorasLimites = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, limite_total, limite_mensal")
        .eq("role", "COLABORADORA")
        .eq("active", true);

      if (!profiles) return;

      const limites: ColaboradoraLimite[] = [];

      for (const prof of profiles) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id")
          .eq("colaboradora_id", prof.id);

        const purchaseIds = purchases?.map(p => p.id) || [];

        const { data: parcelas } = await supabase
          .from("parcelas")
          .select("valor_parcela")
          .in("compra_id", purchaseIds)
          .in("status_parcela", ["PENDENTE", "AGENDADO"]);

        const usado_total = parcelas?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
        const disponivel = Number(prof.limite_total) - usado_total;

        limites.push({
          id: prof.id,
          name: prof.name,
          limite_total: Number(prof.limite_total),
          limite_mensal: Number(prof.limite_mensal),
          usado_total,
          disponivel,
        });
      }

      setColaboradoras(limites);
    } catch (error) {
      console.error("Erro ao buscar limites:", error);
    }
  };

  const handleDeleteCompra = async (compraId: string) => {
    try {
      const { error: parcelasError } = await supabase
        .from("parcelas")
        .delete()
        .eq("compra_id", compraId);

      if (parcelasError) throw parcelasError;

      const { error: compraError } = await supabase
        .from("purchases")
        .delete()
        .eq("id", compraId);

      if (compraError) throw compraError;

      toast.success("Compra excluída com sucesso!");
      fetchKPIs();
      fetchColaboradorasLimites();
    } catch (error: any) {
      toast.error("Erro ao excluir compra: " + error.message);
    } finally {
      setDeleteCompraId(null);
    }
  };

  const handleEditLimite = (colaboradora: ColaboradoraLimite) => {
    setEditLimiteDialog({ open: true, colaboradora });
    setLimiteForm({
      limite_total: colaboradora.limite_total.toString(),
      limite_mensal: colaboradora.limite_mensal.toString(),
    });
  };

  const handleSaveLimite = async () => {
    if (!editLimiteDialog.colaboradora) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          limite_total: parseFloat(limiteForm.limite_total),
          limite_mensal: parseFloat(limiteForm.limite_mensal),
        })
        .eq("id", editLimiteDialog.colaboradora.id);

      if (error) throw error;

      toast.success("Limites atualizados com sucesso!");
      setEditLimiteDialog({ open: false, colaboradora: null });
      fetchColaboradorasLimites();
    } catch (error: any) {
      toast.error("Erro ao atualizar limites: " + error.message);
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
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-md hover:shadow-lg"
            onClick={() => navigate("/admin/novo-adiantamento")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Adiantamento
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
            onClick={() => navigate("/admin/adiantamentos")}
          >
            Gerenciar Adiantamentos
          </Button>
          <Button
            variant="outline"
            className="border-primary/20 hover:bg-primary/10"
            onClick={() => navigate("/admin/relatorios")}
          >
            Ver Relatórios
          </Button>
          <Button
            variant="outline"
            className="border-primary/20 hover:bg-primary/10"
            onClick={() => navigate("/admin/colaboradores")}
          >
            Gerenciar Colaboradoras
          </Button>
        </div>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader>
            <CardTitle className="text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Limites das Colaboradoras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-primary/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Colaboradora</TableHead>
                    <TableHead className="font-semibold">Limite Total</TableHead>
                    <TableHead className="font-semibold">Usado</TableHead>
                    <TableHead className="font-semibold">Disponível</TableHead>
                    <TableHead className="font-semibold">Limite Mensal</TableHead>
                    <TableHead className="font-semibold">% Usado</TableHead>
                    <TableHead className="font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradoras.map((colab) => {
                    const percentual = (colab.usado_total / colab.limite_total) * 100;
                    return (
                      <TableRow key={colab.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{colab.name}</TableCell>
                        <TableCell>R$ {colab.limite_total.toFixed(2)}</TableCell>
                        <TableCell>R$ {colab.usado_total.toFixed(2)}</TableCell>
                        <TableCell className={colab.disponivel < 0 ? "text-destructive font-semibold" : "text-success font-semibold"}>
                          R$ {colab.disponivel.toFixed(2)}
                        </TableCell>
                        <TableCell>R$ {colab.limite_mensal.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 min-w-[120px]">
                            <Progress 
                              value={Math.min(percentual, 100)} 
                              className={`h-2 ${
                                percentual >= 90 ? "[&>div]:bg-destructive" : 
                                percentual >= 70 ? "[&>div]:bg-amber-500" : 
                                "[&>div]:bg-success"
                              }`}
                            />
                            <span className="text-xs font-medium text-right">
                              {percentual.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditLimite(colab)}
                            className="hover:bg-primary/10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={!!deleteCompraId} onOpenChange={() => setDeleteCompraId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta compra? Esta ação não pode ser desfeita.
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

      <Dialog open={editLimiteDialog.open} onOpenChange={(open) => setEditLimiteDialog({ open, colaboradora: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Limites - {editLimiteDialog.colaboradora?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="limite_total">Limite Total (R$)</Label>
              <Input
                id="limite_total"
                type="number"
                step="0.01"
                min="0"
                value={limiteForm.limite_total}
                onChange={(e) => setLimiteForm({ ...limiteForm, limite_total: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limite_mensal">Limite Mensal (R$)</Label>
              <Input
                id="limite_mensal"
                type="number"
                step="0.01"
                min="0"
                value={limiteForm.limite_mensal}
                onChange={(e) => setLimiteForm({ ...limiteForm, limite_mensal: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setEditLimiteDialog({ open: false, colaboradora: null })}>
                Cancelar
              </Button>
              <Button onClick={handleSaveLimite}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
