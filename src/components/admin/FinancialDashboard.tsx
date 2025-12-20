import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/KPICard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Clock, Plus, Calendar, Edit, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
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

export const FinancialDashboard = () => {
    const navigate = useNavigate();
    const [kpis, setKpis] = useState<KPIData>({ previsto: 0, descontado: 0, pendente: 0, mesAtual: 0 });
    const [colaboradoras, setColaboradoras] = useState<ColaboradoraLimite[]>([]);
    const [editLimiteDialog, setEditLimiteDialog] = useState<{ open: boolean; colaboradora: ColaboradoraLimite | null }>({
        open: false,
        colaboradora: null,
    });
    const [limiteForm, setLimiteForm] = useState({ limite_total: "", limite_mensal: "" });

    useEffect(() => {
        // Executar ambas as funções em paralelo para melhor performance
        Promise.all([fetchKPIs(), fetchColaboradorasLimites()]).catch(error => {
            console.error("Erro ao carregar dados do dashboard:", error);
        });
    }, []);

    const fetchKPIs = async () => {
        try {
            const mesAtual = format(new Date(), "yyyyMM");

            // Buscar todas as queries em paralelo para melhor performance
            const [
                { data: allParcelas, error: parcelasError },
                { data: parcelasDescontadas, error: descontadasError },
                { data: parcelasPendentes, error: pendentesError },
                { data: parcelasMesAtual, error: mesAtualError },
                { data: adiantamentos, error: adiantamentosError }
            ] = await Promise.all([
                // Total previsto: todas as parcelas
                supabase
                    .schema("sistemaretiradas")
                    .from("parcelas")
                    .select("valor_parcela"),
                
                // Total descontado: apenas parcelas descontadas
                supabase
                    .schema("sistemaretiradas")
                    .from("parcelas")
                    .select("valor_parcela")
                    .eq("status_parcela", "DESCONTADO"),
                
                // Parcelas pendentes/agendadas
                supabase
                .schema("sistemaretiradas")
                .from("parcelas")
                    .select("valor_parcela")
                    .in("status_parcela", ["PENDENTE", "AGENDADO"]),
                
                // Parcelas do mês atual (pendentes/agendadas)
                supabase
                    .schema("sistemaretiradas")
                    .from("parcelas")
                    .select("valor_parcela")
                    .eq("competencia", mesAtual)
                    .in("status_parcela", ["PENDENTE", "AGENDADO"]),
                
                // Adiantamentos aprovados
                supabase
                .schema("sistemaretiradas")
                .from("adiantamentos")
                .select("valor, status, mes_competencia")
                    .eq("status", "APROVADO")
            ]);

            if (parcelasError) throw parcelasError;
            if (descontadasError) throw descontadasError;
            if (pendentesError) throw pendentesError;
            if (mesAtualError) throw mesAtualError;
            if (adiantamentosError) {
                console.error("Error fetching adiantamentos:", adiantamentosError);
            }

            const previsto = allParcelas?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
            const descontado = parcelasDescontadas?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
            const pendenteParcelas = parcelasPendentes?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
            const pendenteAdiantamentos = adiantamentos?.reduce((sum, a) => sum + Number(a.valor || 0), 0) || 0;
            const pendente = pendenteParcelas + pendenteAdiantamentos;
            const mesAtualTotal = parcelasMesAtual?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

            setKpis({ previsto, descontado, pendente, mesAtual: mesAtualTotal });
        } catch (error) {
            console.error("Error fetching KPIs:", error);
            toast.error("Erro ao carregar indicadores");
        }
    };

    const fetchColaboradorasLimites = async () => {
        try {
            // Buscar todas as colaboradoras ativas de uma vez
            const { data: profiles, error } = await supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("id, name, limite_total, limite_mensal")
                .eq("role", "COLABORADORA")
                .eq("is_active", true);

            if (error) {
                console.error('Error fetching profiles:', error);
                toast.error("Erro ao carregar colaboradoras");
                return;
            }

            if (!profiles || profiles.length === 0) {
                setColaboradoras([]);
                return;
            }

            const profileIds = profiles.map(p => p.id);

            // Buscar TODAS as purchases de TODAS as colaboradoras de uma vez
            const { data: allPurchases } = await supabase
                    .schema("sistemaretiradas")
                    .from("purchases")
                .select("id, colaboradora_id")
                .in("colaboradora_id", profileIds);

            // Agrupar purchases por colaboradora
            const purchasesByColaboradora = new Map<string, string[]>();
            allPurchases?.forEach(p => {
                const existing = purchasesByColaboradora.get(p.colaboradora_id) || [];
                existing.push(p.id);
                purchasesByColaboradora.set(p.colaboradora_id, existing);
            });

            const allPurchaseIds = allPurchases?.map(p => p.id) || [];

            // Buscar TODAS as parcelas pendentes/agendadas de uma vez
            const { data: allParcelas } = allPurchaseIds.length > 0 ? await supabase
                        .schema("sistemaretiradas")
                        .from("parcelas")
                .select("valor_parcela, compra_id")
                .in("compra_id", allPurchaseIds)
                .in("status_parcela", ["PENDENTE", "AGENDADO"]) : { data: null };

            // Agrupar parcelas por compra_id, depois por colaboradora
            const parcelasByPurchase = new Map<string, number>();
            allParcelas?.forEach(p => {
                const existing = parcelasByPurchase.get(p.compra_id) || 0;
                parcelasByPurchase.set(p.compra_id, existing + Number(p.valor_parcela));
            });

            const parcelasByColaboradora = new Map<string, number>();
            purchasesByColaboradora.forEach((purchaseIds, colaboradoraId) => {
                const total = purchaseIds.reduce((sum, purchaseId) => {
                    return sum + (parcelasByPurchase.get(purchaseId) || 0);
                }, 0);
                parcelasByColaboradora.set(colaboradoraId, total);
            });

            // Buscar TODOS os adiantamentos de TODAS as colaboradoras de uma vez
            const { data: allAdiantamentos } = await supabase
                    .schema("sistemaretiradas")
                    .from("adiantamentos")
                .select("valor, colaboradora_id")
                .in("colaboradora_id", profileIds)
                    .in("status", ["APROVADO", "DESCONTADO"]);

            // Agrupar adiantamentos por colaboradora
            const adiantamentosByColaboradora = new Map<string, number>();
            allAdiantamentos?.forEach(a => {
                const existing = adiantamentosByColaboradora.get(a.colaboradora_id) || 0;
                adiantamentosByColaboradora.set(a.colaboradora_id, existing + Number(a.valor));
            });

            // Calcular limites de cada colaboradora
            const limites: ColaboradoraLimite[] = profiles.map(prof => {
                const totalParcelas = parcelasByColaboradora.get(prof.id) || 0;
                const totalAdiantamentos = adiantamentosByColaboradora.get(prof.id) || 0;
                const usado_total = totalParcelas + totalAdiantamentos;
                const disponivel = Number(prof.limite_total) - usado_total;

                return {
                    id: prof.id,
                    name: prof.name,
                    limite_total: Number(prof.limite_total),
                    limite_mensal: Number(prof.limite_mensal),
                    usado_total,
                    disponivel,
                };
                });

            setColaboradoras(limites);
        } catch (error) {
            console.error("Erro ao buscar limites:", error);
            toast.error("Erro ao carregar limites das colaboradoras");
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
                .schema("sistemaretiradas")
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

    return (
        <div className="space-y-6">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                    title="Total Previsto"
                    value={formatCurrency(kpis.previsto)}
                    icon={DollarSign}
                />
                <KPICard
                    title="Descontar Mês Atual"
                    value={formatCurrency(kpis.mesAtual)}
                    icon={Calendar}
                />
                <KPICard
                    title="Total Descontado"
                    value={formatCurrency(kpis.descontado)}
                    icon={TrendingUp}
                    trend={{
                        value: `${((kpis.descontado / kpis.previsto) * 100 || 0).toFixed(1)}%`,
                        isPositive: kpis.descontado > 0,
                    }}
                />
                <KPICard
                    title="Total Pendente"
                    value={formatCurrency(kpis.pendente)}
                    icon={Clock}
                />
            </div>

            <div className="flex gap-4 flex-wrap">
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
                    onClick={() => navigate("/admin/colaboradores")}
                >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Gerenciar Colaboradoras e Lojas
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
                                            <TableCell>{formatCurrency(colab.limite_total)}</TableCell>
                                            <TableCell>{formatCurrency(colab.usado_total)}</TableCell>
                                            <TableCell className={colab.disponivel < 0 ? "text-destructive font-semibold" : "text-success font-semibold"}>
                                                {formatCurrency(colab.disponivel)}
                                            </TableCell>
                                            <TableCell>{formatCurrency(colab.limite_mensal)}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 min-w-[80px] sm:min-w-[120px]">
                                                    <Progress
                                                        value={Math.min(percentual, 100)}
                                                        className={`h-2 ${percentual >= 90 ? "[&>div]:bg-destructive" :
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
