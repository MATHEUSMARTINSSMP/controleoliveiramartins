import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Plus, Edit, Trash2, UserCheck, Calendar, ClipboardList, Check, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import WeeklyGoalProgress from "@/components/WeeklyGoalProgress";

interface Sale {
    id: string;
    colaboradora_id: string;
    valor: number;
    qtd_pecas: number;
    data_venda: string;
    observacoes: string | null;
    colaboradora: {
        name: string;
    };
}

interface Colaboradora {
    id: string;
    name: string;
    active: boolean;
}

export default function LojaDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [sales, setSales] = useState<Sale[]>([]);
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        colaboradora_id: "",
        valor: "",
        qtd_pecas: "",
        data_venda: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        observacoes: "",
    });


    const [goals, setGoals] = useState<any>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [colaboradorasPerformance, setColaboradorasPerformance] = useState<any[]>([]);
    const [rankingTop3, setRankingTop3] = useState<any[]>([]);
    const [rankingMonthly, setRankingMonthly] = useState<any[]>([]);
    const [offDayDialog, setOffDayDialog] = useState(false);
    const [selectedColabForOffDay, setSelectedColabForOffDay] = useState<string | null>(null);
    const [offDayDate, setOffDayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dailyGoal, setDailyGoal] = useState<number>(0);
    const [dailyProgress, setDailyProgress] = useState<number>(0);
    const [history7Days, setHistory7Days] = useState<any[]>([]);

    useEffect(() => {
        if (!profile || (profile.role !== 'LOJA' && profile.role !== 'ADMIN')) {
            navigate('/');
            return;
        }
        // Only fetch data if profile is loaded and it's a LOJA or ADMIN role
        // The second useEffect below will handle the actual fetchData call based on loading state
    }, [profile, navigate]);

    useEffect(() => {
        if (!loading && profile) {
            // Se for ADMIN, não carrega dados de loja específica automaticamente
            // Se for LOJA, carrega dados da loja do perfil
            if (profile.role === 'LOJA' && profile.store_default) {
                fetchData();
            }
        }
    }, [profile, loading]);

    const fetchGoals = async () => {
        const mesAtual = format(new Date(), 'yyyyMM');

        const { data, error } = await supabase
            .from('goals')
            .select('*')
            .eq('store_id', getStoreId())
            .eq('mes_referencia', mesAtual)
            .eq('tipo', 'MENSAL')
            .is('colaboradora_id', null)
            .single();

        if (!error && data) {
            setGoals(data);
            // Calculate daily goal based on days in month
            const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            const daily = Number(data.meta_valor) / daysInMonth;
            setDailyGoal(daily);
            // Compute today's progress from sales data
            const today = format(new Date(), 'yyyy-MM-dd');
            const { data: salesToday, error: salesErr } = await supabase
                .from('sales')
                .select('valor')
                .eq('store_id', getStoreId())
                .gte('data_venda', `${today}T00:00:00`);
            if (!salesErr && salesToday) {
                const totalHoje = salesToday.reduce((sum: number, s: any) => sum + Number(s.valor), 0);
                setDailyProgress((totalHoje / daily) * 100);
            }
        }
    };

    const fetch7DayHistory = async () => {
        const startDate = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        const { data, error } = await supabase
            .from('sales')
            .select('data_venda, valor, qtd_pecas')
            .eq('store_id', getStoreId())
            .gte('data_venda', `${startDate}T00:00:00`)
            .order('data_venda', { ascending: true });
        if (!error && data) {
            // Group by day
            const grouped: Record<string, any> = {};
            data.forEach((sale: any) => {
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
    };

    const fetchData = async () => {
        await Promise.all([
            fetchSales(),
            fetchColaboradoras(),
            fetchGoals(),
            fetchMetrics(),
            fetchColaboradorasPerformance(),
            fetchRankingTop3(),
            fetchMonthlyRanking(),
            fetch7DayHistory()
        ]);
        setLoading(false);
    };

    const fetchMetrics = async () => {
        const mesAtual = format(new Date(), 'yyyyMM');

        const { data, error } = await supabase
            .from('store_metrics')
            .select('*')
            .eq('store_id', getStoreId())
            .eq('mes_referencia', mesAtual)
            .single();

        if (!error && data) {
            setMetrics(data);
        }
    };

    const fetchColaboradorasPerformance = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const mesAtual = format(new Date(), 'yyyyMM');

        // Buscar vendas do dia por colaboradora
        const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('colaboradora_id, valor, qtd_pecas')
            .eq('store_id', getStoreId())
            .gte('data_venda', `${today}T00:00:00`);

        // Buscar metas individuais
        const { data: goalsData, error: goalsError } = await supabase
            .from('goals')
            .select('colaboradora_id, meta_valor, super_meta_valor')
            .eq('store_id', getStoreId())
            .eq('mes_referencia', mesAtual)
            .eq('tipo', 'INDIVIDUAL');

        if (!salesError && salesData && !goalsError && goalsData) {
            const performance = colaboradoras.map(colab => {
                const colabSales = salesData.filter(s => s.colaboradora_id === colab.id);
                const vendido = colabSales.reduce((sum, s) => sum + Number(s.valor), 0);
                const qtdPecas = colabSales.reduce((sum, s) => sum + Number(s.qtd_pecas), 0);
                const ticketMedio = colabSales.length > 0 ? vendido / colabSales.length : 0;

                const goal = goalsData.find(g => g.colaboradora_id === colab.id);

                return {
                    id: colab.id,
                    name: colab.name,
                    vendido,
                    meta: goal?.meta_valor || 0,
                    superMeta: goal?.super_meta_valor || 0,
                    percentual: goal?.meta_valor ? (vendido / goal.meta_valor) * 100 : 0,
                    qtdVendas: colabSales.length,
                    qtdPecas,
                    ticketMedio,
                };
            });

            setColaboradorasPerformance(performance);
        }
    };

    const fetchRankingTop3 = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');

        const { data: salesData, error } = await supabase
            .from('sales')
            .select(`
                colaboradora_id,
                valor,
                profiles!inner(name)
            `)
            .eq('store_id', getStoreId())
            .gte('data_venda', `${today}T00:00:00`);

        if (!error && salesData) {
            // Agrupar por colaboradora
            const grouped = salesData.reduce((acc: any, sale: any) => {
                const id = sale.colaboradora_id;
                if (!acc[id]) {
                    acc[id] = {
                        colaboradora_id: id,
                        name: sale.profiles.name,
                        total: 0,
                        qtdVendas: 0
                    };
                }
                acc[id].total += Number(sale.valor);
                acc[id].qtdVendas += 1;
                return acc;
            }, {});

            // Converter para array e ordenar
            const ranking = Object.values(grouped)
                .sort((a: any, b: any) => b.total - a.total)
                .slice(0, 3); // Top 3

            setRankingTop3(ranking as any[]);
        }
    };

    const fetchMonthlyRanking = async () => {
        const mesAtual = format(new Date(), 'yyyyMM');
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;

        const { data: salesData, error } = await supabase
            .from('sales')
            .select(`
                colaboradora_id,
                valor,
                profiles!inner(name)
            `)
            .eq('store_id', getStoreId())
            .gte('data_venda', `${startOfMonth}T00:00:00`);

        if (!error && salesData) {
            const grouped = salesData.reduce((acc: any, sale: any) => {
                const id = sale.colaboradora_id;
                if (!acc[id]) {
                    acc[id] = {
                        colaboradora_id: id,
                        name: sale.profiles.name,
                        total: 0,
                        qtdVendas: 0
                    };
                }
                acc[id].total += Number(sale.valor);
                acc[id].qtdVendas += 1;
                return acc;
            }, {});

            const ranking = Object.values(grouped)
                .sort((a: any, b: any) => b.total - a.total)
                .slice(0, 3);

            setRankingMonthly(ranking as any[]);
        }
    };

    const fetchSales = async () => {
        if (!profile?.store_default) return;

        const today = format(new Date(), 'yyyy-MM-dd');

        const { data, error } = await supabase
            .from('sales')
            .select(`
        *,
        colaboradora:profiles!colaboradora_id(name)
      `)
            .eq('store_id', getStoreId())
            .gte('data_venda', `${today}T00:00:00`)
            .order('data_venda', { ascending: false });

        if (error) {
            toast.error('Erro ao carregar vendas');
            console.error(error);
        } else {
            setSales(data || []);
        }
    };

    const fetchColaboradoras = async () => {
        if (!profile?.store_default) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, active')
            .eq('role', 'COLABORADORA')
            .eq('store_default', profile.store_default)
            .eq('active', true)
            .order('name');

        if (error) {
            toast.error('Erro ao carregar colaboradoras');
        } else {
            setColaboradoras(data || []);
        }
    };

    const getStoreId = () => {
        return profile?.store_default;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.colaboradora_id || !formData.valor || !formData.qtd_pecas) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        const { error } = await supabase.from('sales').insert({
            colaboradora_id: formData.colaboradora_id,
            store_id: getStoreId(),
            valor: parseFloat(formData.valor),
            qtd_pecas: parseInt(formData.qtd_pecas),
            data_venda: formData.data_venda,
            observacoes: formData.observacoes || null,
            lancado_por_id: profile?.id,
        });

        if (error) {
            toast.error('Erro ao lançar venda');
            console.error(error);
        } else {
            toast.success('Venda lançada com sucesso!');
            setDialogOpen(false);
            resetForm();
            fetchSales();
        }
    };

    const resetForm = () => {
        setFormData({
            colaboradora_id: "",
            valor: "",
            qtd_pecas: "",
            data_venda: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            observacoes: "",
        });
        setEditingSaleId(null);
    };

    const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

    const handleEdit = (sale: Sale) => {
        setFormData({
            colaboradora_id: sale.colaboradora_id,
            valor: sale.valor.toString(),
            qtd_pecas: sale.qtd_pecas.toString(),
            data_venda: format(new Date(sale.data_venda), "yyyy-MM-dd'T'HH:mm"),
            observacoes: sale.observacoes || "",
        });
        setEditingSaleId(sale.id);
        setDialogOpen(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.colaboradora_id || !formData.valor || !formData.qtd_pecas) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        const { error } = await supabase
            .from('sales')
            .update({
                colaboradora_id: formData.colaboradora_id,
                valor: parseFloat(formData.valor),
                qtd_pecas: parseInt(formData.qtd_pecas),
                data_venda: formData.data_venda,
                observacoes: formData.observacoes || null,
            })
            .eq('id', editingSaleId!);

        if (error) {
            toast.error('Erro ao atualizar venda');
            console.error(error);
        } else {
            toast.success('Venda atualizada com sucesso!');
            setDialogOpen(false);
            resetForm();
            fetchSales();
        }
    };

    const handleDelete = async (saleId: string) => {
        if (!confirm('Tem certeza que deseja deletar esta venda?')) return;

        const { error } = await supabase
            .from('sales')
            .delete()
            .eq('id', saleId);

        if (error) {
            toast.error('Erro ao deletar venda');
            console.error(error);
        } else {
            toast.success('Venda excluída com sucesso!');
            await fetchData();
        }
    };

    const handleOpenOffDayDialog = (colaboradoraId: string) => {
        setSelectedColabForOffDay(colaboradoraId);
        setOffDayDate(format(new Date(), 'yyyy-MM-dd'));
        setOffDayDialog(true);
    };

    const handleMarkOffDay = async () => {
        if (!selectedColabForOffDay || !offDayDate) {
            toast.error('Selecione uma colaboradora e data');
            return;
        }

        try {
            const { error } = await supabase
                .from('collaborator_off_days')
                .insert([{
                    colaboradora_id: selectedColabForOffDay,
                    data_folga: offDayDate,
                    store_id: getStoreId()
                }]);

            if (error) throw error;

            toast.success('Folga marcada com sucesso!');
            setOffDayDialog(false);
            setSelectedColabForOffDay(null);
            await fetchData();
        } catch (error: any) {
            toast.error('Erro ao marcar folga: ' + error.message);
        }
    };

    const ticketMedio = formData.valor && formData.qtd_pecas
        ? (parseFloat(formData.valor) / parseInt(formData.qtd_pecas)).toFixed(2)
        : "0,00";

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Carregando...</div>;
    }

    return (
        <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">🏪 {profile?.store_default}</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">Gestão de Vendas</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Nova Venda
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingSaleId ? 'Editar' : 'Lançar Nova'} Venda</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={editingSaleId ? handleUpdate : handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="colaboradora">Vendedora *</Label>
                                <Select
                                    value={formData.colaboradora_id}
                                    onValueChange={(value) => setFormData({ ...formData, colaboradora_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a vendedora" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colaboradoras.map((colab) => (
                                            <SelectItem key={colab.id} value={colab.id}>
                                                {colab.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Off‑Day Dialog */}
                            <Dialog open={offDayDialog} onOpenChange={(open) => setOffDayDialog(open)}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Marcar Folga</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                        <Label htmlFor="offDayDate">Data da Folga</Label>
                                        <Input
                                            id="offDayDate"
                                            type="date"
                                            value={offDayDate}
                                            onChange={(e) => setOffDayDate(e.target.value)}
                                        />
                                        <div className="flex justify-end gap-2 pt-4">
                                            <Button variant="outline" onClick={() => setOffDayDialog(false)}>
                                                Cancelar
                                            </Button>
                                            <Button onClick={handleMarkOffDay}>Confirmar</Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="valor">Valor Total (R$) *</Label>
                                    <Input
                                        id="valor"
                                        type="number"
                                        step="0.01"
                                        value={formData.valor}
                                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                                        placeholder="0,00"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="qtd_pecas">Qtd Peças *</Label>
                                    <Input
                                        id="qtd_pecas"
                                        type="number"
                                        value={formData.qtd_pecas}
                                        onChange={(e) => setFormData({ ...formData, qtd_pecas: e.target.value })}
                                        placeholder="0"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">
                                    💡 Ticket Médio Calculado: <span className="text-primary">R$ {ticketMedio}</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="data_venda">Data/Hora</Label>
                                <Input
                                    id="data_venda"
                                    type="datetime-local"
                                    value={formData.data_venda}
                                    onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="observacoes">Observações</Label>
                                <Input
                                    id="observacoes"
                                    value={formData.observacoes}
                                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                    placeholder="Observações opcionais"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                                    Cancelar
                                </Button>
                                <Button type="submit" className="flex-1">
                                    Lançar Venda
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* KPI Cards - Metas e Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Meta Mensal */}
                {goals && (
                    <Card>
                        <CardHeader className="pb-2 p-3 sm:p-6">
                            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Meta Mensal</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2">
                                <p className="text-lg sm:text-2xl font-bold truncate">R$ {goals.meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                {goals.super_meta_valor && (
                                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                        🏆 Super Meta: R$ {goals.super_meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Meta Diária */}
                {goals && (
                    <Card>
                        <CardHeader className="pb-2 p-3 sm:p-6">
                            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Meta Diária (Hoje)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2">
                                <p className="text-lg sm:text-2xl font-bold">R$ {dailyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <div className="flex items-center gap-2">
                                    <Progress value={Math.min(dailyProgress, 100)} className="h-2 flex-1" />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {dailyProgress.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Faturamento Hoje */}
                <Card>
                    <CardHeader className="pb-2 p-3 sm:p-6">
                        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Faturamento Hoje</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="space-y-2">
                            <p className="text-lg sm:text-2xl font-bold">R$ {sales.reduce((sum, s) => sum + s.valor, 0).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{sales.length} vendas</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Ticket Médio */}
                {metrics && (
                    <Card>
                        <CardHeader className="pb-2 p-3 sm:p-6">
                            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2">
                                <p className="text-lg sm:text-2xl font-bold">R$ {sales.length > 0 ? (sales.reduce((sum, s) => sum + s.valor, 0) / sales.length).toFixed(2) : '0.00'}</p>
                                <div className="flex items-center gap-2">
                                    <Progress
                                        value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.valor, 0) / sales.length) / metrics.meta_ticket_medio) * 100, 100) : 0}
                                        className="h-2 flex-1"
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap truncate">
                                        Meta: R$ {metrics.meta_ticket_medio?.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* PA (Peças por Atendimento) */}
                {metrics && (
                    <Card>
                        <CardHeader className="pb-2 p-3 sm:p-6">
                            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">PA (Peças/Venda)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2">
                                <p className="text-lg sm:text-2xl font-bold">{sales.length > 0 ? (sales.reduce((sum, s) => sum + s.qtd_pecas, 0) / sales.length).toFixed(1) : '0.0'}</p>
                                <div className="flex items-center gap-2">
                                    <Progress
                                        value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.qtd_pecas, 0) / sales.length) / metrics.meta_pa) * 100, 100) : 0}
                                        className="h-2 flex-1"
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        Meta: {metrics.meta_pa?.toFixed(1)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Segunda linha de métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Preço por Peça */}
                {metrics && (
                    <Card>
                        <CardHeader className="pb-2 p-3 sm:p-6">
                            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Preço Médio por Peça</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2">
                                <p className="text-lg sm:text-2xl font-bold">
                                    R$ {sales.length > 0 ?
                                        (sales.reduce((sum, s) => sum + s.valor, 0) / sales.reduce((sum, s) => sum + s.qtd_pecas, 0)).toFixed(2) :
                                        '0.00'}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Progress
                                        value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.valor, 0) / sales.reduce((sum, s) => sum + s.qtd_pecas, 0)) / metrics.meta_preco_medio_peca) * 100, 100) : 0}
                                        className="h-2 flex-1"
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap truncate">
                                        Meta: R$ {metrics.meta_preco_medio_peca?.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Meta Semanal Gamificada */}
            {profile?.store_default && (
                <WeeklyGoalProgress storeId={getStoreId()} showDetails={true} />
            )}

            {/* Tabela de Performance por Vendedora */}
            {colaboradorasPerformance.length > 0 && (
                <Card>
                    <CardHeader className="p-3 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">Performance por Vendedora (Hoje)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm">Vendedora</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Vendido</TableHead>
                                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Meta Dia</TableHead>
                                        <TableHead className="text-xs sm:text-sm">%</TableHead>
                                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Ticket Médio</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Vendas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {colaboradorasPerformance.map((perf) => (
                                        <TableRow key={perf.id}>
                                            <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[120px]">{perf.name}</TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium">R$ {perf.vendido.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">R$ {perf.meta > 0 ? (perf.meta / 30).toFixed(2) : '0.00'}</TableCell>
                                            <TableCell className="text-xs sm:text-sm">
                                                <span className={
                                                    perf.percentual >= 120 ? 'text-yellow-600 font-bold' :
                                                        perf.percentual >= 100 ? 'text-green-600 font-bold' :
                                                            perf.percentual >= 90 ? 'text-yellow-500' :
                                                                'text-red-600'
                                                }>
                                                    {perf.percentual.toFixed(0)}%
                                                    {perf.percentual >= 120 && ' 🏆'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">R$ {perf.ticketMedio.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs sm:text-sm">{perf.qtdVendas}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Rankings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                {/* Ranking Diário */}
                {rankingTop3.length > 0 && (
                    <Card className="bg-gradient-to-br from-card to-muted/50 border-primary/10">
                        <CardHeader className="pb-2 p-3 sm:p-6">
                            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                                <span className="hidden sm:inline">Top 3 Vendedoras (Hoje)</span>
                                <span className="sm:hidden">Top 3 (Hoje)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2 sm:space-y-3">
                                {rankingTop3.map((item, index) => (
                                    <div key={item.colaboradora_id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-background/50 border border-border/50">
                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                            <div className={`
                                                w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0
                                                ${index === 0 ? 'bg-yellow-500 text-yellow-950' :
                                                    index === 1 ? 'bg-gray-300 text-gray-800' :
                                                        'bg-amber-700 text-amber-100'}
                                            `}>
                                                {index + 1}
                                            </div>
                                            <span className="font-medium text-xs sm:text-sm truncate">{item.name}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className="font-bold text-primary text-xs sm:text-sm">R$ {item.total.toFixed(2)}</p>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">{item.qtdVendas} vendas</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Ranking Mensal */}
                {rankingMonthly.length > 0 && (
                    <Card className="bg-gradient-to-br from-card to-muted/50 border-primary/10">
                        <CardHeader className="pb-2 p-3 sm:p-6">
                            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                                <span className="hidden sm:inline">Top 3 Vendedoras (Mês)</span>
                                <span className="sm:hidden">Top 3 (Mês)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            <div className="space-y-2 sm:space-y-3">
                                {rankingMonthly.map((item, index) => (
                                    <div key={item.colaboradora_id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-background/50 border border-border/50">
                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                            <div className={`
                                                w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0
                                                ${index === 0 ? 'bg-yellow-500 text-yellow-950' :
                                                    index === 1 ? 'bg-gray-300 text-gray-800' :
                                                        'bg-amber-700 text-amber-100'}
                                            `}>
                                                {index + 1}
                                            </div>
                                            <span className="font-medium text-xs sm:text-sm truncate">{item.name}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className="font-bold text-primary text-xs sm:text-sm">R$ {item.total.toFixed(2)}</p>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">{item.qtdVendas} vendas</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Histórico 7 Dias */}
            {history7Days.length > 0 && (
                <Card>
                    <CardHeader className="p-3 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">Histórico de Vendas (Últimos 7 Dias)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm">Data</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Vendas</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Peças</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history7Days.map((day) => (
                                        <TableRow key={day.day}>
                                            <TableCell className="text-xs sm:text-sm">{format(new Date(day.day + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-xs sm:text-sm">{day.qtdVendas}</TableCell>
                                            <TableCell className="text-xs sm:text-sm">{day.qtdPecas}</TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium">R$ {day.total.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="p-3 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Vendas de Hoje</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs sm:text-sm">Horário</TableHead>
                                    <TableHead className="text-xs sm:text-sm">Vendedora</TableHead>
                                    <TableHead className="text-xs sm:text-sm">Valor</TableHead>
                                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Peças</TableHead>
                                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Ticket</TableHead>
                                    <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sales.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground text-xs sm:text-sm py-6">
                                            Nenhuma venda lançada hoje
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sales.map((sale) => (
                                        <TableRow key={sale.id}>
                                            <TableCell className="text-xs sm:text-sm">{format(new Date(sale.data_venda), 'HH:mm')}</TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium truncate max-w-[100px]">{sale.colaboradora.name}</TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium">R$ {sale.valor.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{sale.qtd_pecas}</TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">R$ {(sale.valor / sale.qtd_pecas).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 sm:gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(sale)} className="h-8 w-8 p-0">
                                                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => handleDelete(sale.id)}>
                                                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
