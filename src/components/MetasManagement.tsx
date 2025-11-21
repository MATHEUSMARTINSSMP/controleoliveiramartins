import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash, UserCheck, Calendar, Check, Store, Calculator, Save, ClipboardList, Edit, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, setDate, isWeekend, getDay, startOfWeek, endOfWeek, getWeek, getYear, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
                    <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-lg border border-red-200">
                        <h2 className="text-xl font-bold text-red-700 mb-4">Algo deu errado na página de Metas</h2>
                        <div className="bg-red-100 p-4 rounded text-sm font-mono text-red-800 overflow-auto mb-4">
                            {this.state.error?.toString()}
                        </div>
                        <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                            Tentar Novamente
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

interface Goal {
    id: string;
    tipo: string;
    mes_referencia: string | null;
    semana_referencia: string | null;
    store_id: string | null;
    colaboradora_id: string | null;
    meta_valor: number;
    super_meta_valor: number;
    ativo: boolean;
    daily_weights?: Record<string, number>;
    stores?: { name: string };
    profiles?: { name: string };
}

interface Colaboradora {
    id: string;
    name: string;
    store_id?: string;
}

interface StoreType {
    id: string;
    name: string;
}

const MetasManagementContent = () => {
    const navigate = useNavigate();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [stores, setStores] = useState<StoreType[]>([]);
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

    // Filter states
    const [storeFilter, setStoreFilter] = useState<string>('ALL');
    const [monthFilter, setMonthFilter] = useState<string>(format(new Date(), "yyyyMM"));

    // Form states
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [mesReferencia, setMesReferencia] = useState<string>(format(new Date(), "yyyyMM"));
    const [metaLoja, setMetaLoja] = useState<string>("");
    const [superMetaLoja, setSuperMetaLoja] = useState<string>("");

    // Distribution state
    const [colabGoals, setColabGoals] = useState<{ id: string, name: string, meta: number, superMeta: number }[]>([]);

    // Daily weights state
    const [dailyWeights, setDailyWeights] = useState<Record<string, number>>({});
    const [showWeights, setShowWeights] = useState(false);

    // Weekly goals state
    const [activeTab, setActiveTab] = useState<'mensal' | 'semanal'>('mensal');
    const [weeklyGoals, setWeeklyGoals] = useState<Goal[]>([]);
    const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false);
    const [editingWeeklyGoal, setEditingWeeklyGoal] = useState<Goal | null>(null);
    const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekRef());
    const [weeklyMetaValor, setWeeklyMetaValor] = useState<string>("");
    const [weeklySuperMetaValor, setWeeklySuperMetaValor] = useState<string>("");

    function getCurrentWeekRef(): string {
        const hoje = new Date();
        const monday = startOfWeek(hoje, { weekStartsOn: 1 });
        const year = getYear(monday);
        const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
        return `${year}${String(week).padStart(2, '0')}`;
    }

    function getWeekRange(weekRef: string): { start: Date; end: Date } {
        const year = parseInt(weekRef.substring(0, 4));
        const week = parseInt(weekRef.substring(4, 6));
        
        // Get first Monday of the year
        const jan1 = new Date(year, 0, 1);
        const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
        const weekStart = addWeeks(firstMonday, week - 1);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        return { start: weekStart, end: weekEnd };
    }

    useEffect(() => {
        fetchGoals();
        fetchStores();
        fetchColaboradoras();
    }, []);

    useEffect(() => {
        if (activeTab === 'semanal') {
            fetchWeeklyGoals();
        }
    }, [activeTab]);

    const fetchGoals = async () => {
        try {
            const { data, error } = await supabase
                .from("goals")
                .select(`*, stores (name), profiles (name)`)
                .in("tipo", ["MENSAL", "INDIVIDUAL"])
                .order("mes_referencia", { ascending: false });

            if (error) throw error;
            if (data) setGoals(data as any);
        } catch (err) {
            console.error("Error fetching goals:", err);
            toast.error("Erro ao carregar metas");
        }
    };

    const fetchWeeklyGoals = async () => {
        try {
            const { data, error } = await supabase
                .from("goals")
                .select(`*, stores (name)`)
                .eq("tipo", "SEMANAL")
                .order("semana_referencia", { ascending: false });

            if (error) throw error;
            if (data) setWeeklyGoals(data as any);
        } catch (err) {
            console.error("Error fetching weekly goals:", err);
            toast.error("Erro ao carregar metas semanais");
        }
    };

    const fetchStores = async () => {
        const { data } = await supabase.from("stores").select("*").eq("active", true);
        if (data) setStores(data);
    };

    const fetchColaboradoras = async () => {
        const { data } = await supabase
            .schema("sistemaretiradas")
            .from("profiles")
            .select("*")
            .eq("role", "COLABORADORA")
            .eq("active", true);
        if (data) setColaboradoras(data);
    };

    // Logic to generate weights
    const generateWeights = () => {
        const year = parseInt(mesReferencia.substring(0, 4));
        const month = parseInt(mesReferencia.substring(4, 6)) - 1;
        const daysInMonth = getDaysInMonth(new Date(year, month));
        const weights: Record<string, number> = {};

        // Base weights by day of week (User preference: Sat > Fri > Sun > Thu > Wed > Mon > Tue)
        const dayWeights = {
            0: 1.6, // Sunday
            1: 1.1, // Monday
            2: 1.0, // Tuesday
            3: 1.2, // Wednesday
            4: 1.3, // Thursday
            5: 1.8, // Friday
            6: 2.0, // Saturday
        };

        let sumFirst15 = 0;
        let sumRest = 0;

        // 1. Assign base weights
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = getDay(date);
            const dateStr = format(date, "yyyy-MM-dd");
            const weight = dayWeights[dayOfWeek as keyof typeof dayWeights];

            weights[dateStr] = weight;

            if (day <= 15) sumFirst15 += weight;
            else sumRest += weight;
        }


        // 2. Apply 65% curve for first 15 days
        // Formula: (sumFirst15 * Factor) / (sumFirst15 * Factor + sumRest) = 0.65
        // Factor = (0.65 * sumRest) / (0.35 * sumFirst15)
        const factor = (0.65 * sumRest) / (0.35 * sumFirst15);

        for (let day = 1; day <= 15; day++) {
            const date = new Date(year, month, day);
            const dateStr = format(date, "yyyy-MM-dd");
            weights[dateStr] = weights[dateStr] * factor;
        }

        // 3. Normalize to sum exactly 100 using Largest Remainder Method (1 decimal precision)
        const totalRawWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
        const targetTotal = 100;

        // Prepare items with ideal values and remainders
        const items = Object.entries(weights).map(([date, rawWeight]) => {
            const idealValue = (rawWeight / totalRawWeight) * targetTotal;
            // Floor to 1 decimal place
            const floorValue = Math.floor(idealValue * 10) / 10;
            const remainder = idealValue - floorValue;
            return {
                date,
                value: floorValue,
                remainder
            };
        });

        // Calculate current sum and deficit
        let currentSum = items.reduce((sum, item) => sum + item.value, 0);
        currentSum = Math.round(currentSum * 10) / 10; // Avoid floating point errors

        // Calculate how many 0.1 units we are missing
        let deficitSteps = Math.round((targetTotal - currentSum) * 10);

        // Sort by remainder descending to distribute the deficit to those closest to the next 0.1
        items.sort((a, b) => b.remainder - a.remainder);

        // Distribute the deficit
        for (let i = 0; i < deficitSteps; i++) {
            items[i % items.length].value += 0.1;
        }

        // Convert back to Record<string, number>
        const finalWeights: Record<string, number> = {};
        items.forEach(item => {
            finalWeights[item.date] = parseFloat(item.value.toFixed(1));
        });

        setDailyWeights(finalWeights);
    };

    const handleStoreSelect = (storeId: string) => {
        setSelectedStore(storeId);

        // Filter active collaborators for this store
        const activeColabs = colaboradoras.filter(c => c.store_id === storeId);

        setColabGoals(activeColabs.map(c => ({
            id: c.id,
            name: c.name,
            meta: 0,
            superMeta: 0
        })));

        generateWeights();
    };

    const distributeGoals = () => {
        if (!metaLoja || !superMetaLoja) return;

        const meta = parseFloat(metaLoja);
        const superMeta = parseFloat(superMetaLoja);
        const count = colabGoals.length;

        if (count === 0) return;

        const individualMeta = meta / count;
        const individualSuperMeta = superMeta / count;

        setColabGoals(colabGoals.map(c => ({
            ...c,
            meta: parseFloat(individualMeta.toFixed(2)),
            superMeta: parseFloat(individualSuperMeta.toFixed(2))
        })));
    };

    const handleColabChange = (id: string, field: 'meta' | 'superMeta', value: string) => {
        const numValue = parseFloat(value) || 0;

        setColabGoals(prev => prev.map(c => {
            if (c.id !== id) return c;

            if (field === 'meta') {
                // Recalculate super meta proportionally
                const ratio = parseFloat(superMetaLoja) / parseFloat(metaLoja);
                return { ...c, meta: numValue, superMeta: parseFloat((numValue * ratio).toFixed(2)) };
            } else {
                return { ...c, superMeta: numValue };
            }
        }));
    };

    const validateTotal = () => {
        const totalMeta = colabGoals.reduce((sum, c) => sum + c.meta, 0);
        const targetMeta = parseFloat(metaLoja) || 0;
        const metasValid = Math.abs(totalMeta - targetMeta) < 1; // Allow small float diff

        // Also validate daily weights sum to 100%
        const totalWeight = Object.values(dailyWeights).reduce((sum, w) => sum + w, 0);
        const weightsValid = Math.abs(totalWeight - 100) < 0.1;

        return metasValid && weightsValid;
    };

    const handleSave = async () => {
        if (!validateTotal()) {
            toast.error("A soma das metas individuais não bate com a Meta da Loja!");
            return;
        }

        try {
            // 1. Create/Update Store Goal
            const storePayload = {
                tipo: "MENSAL",
                mes_referencia: mesReferencia,
                store_id: selectedStore,
                colaboradora_id: null, // Explicitly set null for uniqueness check
                meta_valor: parseFloat(metaLoja),
                super_meta_valor: parseFloat(superMetaLoja),
                ativo: true,
                daily_weights: dailyWeights
            };

            const { data: storeGoalData, error: storeError } = await supabase
                .from("goals")
                .upsert(storePayload, { onConflict: 'store_id, mes_referencia, tipo, colaboradora_id' })
                .select()
                .single();

            if (storeError) throw storeError;

            // 2. Create/Update Individual Goals
            const individualPayloads = colabGoals.map(c => ({
                tipo: "INDIVIDUAL",
                mes_referencia: mesReferencia,
                store_id: selectedStore,
                colaboradora_id: c.id,
                meta_valor: c.meta,
                super_meta_valor: c.superMeta,
                ativo: true,
                daily_weights: dailyWeights // Inherit weights
            }));

            const { error: indError } = await supabase
                .from("goals")
                .upsert(individualPayloads, { onConflict: 'store_id, mes_referencia, tipo, colaboradora_id' });

            if (indError) throw indError;

            toast.success("Metas criadas com sucesso!");
            setDialogOpen(false);
            fetchGoals();
        } catch (error: any) {
            toast.error("Erro ao salvar metas: " + error.message);
        }
    };

    const handleEdit = (storeId: string, month: string) => {
        // 1. Find Store Goal
        const storeGoal = goals.find(g => g.store_id === storeId && g.mes_referencia === month && g.tipo === 'MENSAL');
        if (!storeGoal) return;

        // 2. Find Individual Goals
        const individualGoals = goals.filter(g => g.store_id === storeId && g.mes_referencia === month && g.tipo === 'INDIVIDUAL');

        // 3. Populate State
        setSelectedStore(storeId);
        setMesReferencia(month);
        setMetaLoja(storeGoal.meta_valor.toString());
        setSuperMetaLoja(storeGoal.super_meta_valor.toString());
        setDailyWeights(storeGoal.daily_weights || {});

        // 4. Map individual goals to colabGoals format
        // Load collaborators for the store, then merge with existing goals values
        const activeColabs = colaboradoras.filter(c => c.store_id === storeId);

        const mergedColabs = activeColabs.map(c => {
            const goal = individualGoals.find(g => g.colaboradora_id === c.id);
            return {
                id: c.id,
                name: c.name,
                meta: goal ? goal.meta_valor : 0,
                superMeta: goal ? goal.super_meta_valor : 0
            };
        });

        setColabGoals(mergedColabs);
        setDialogOpen(true);
    };

    const calculateWeeklyGoalFromMonthly = async () => {
        if (!selectedStore || !selectedWeek) {
            toast.error("Selecione uma loja e uma semana primeiro");
            return;
        }

        try {
            // Get month from week
            const weekRange = getWeekRange(selectedWeek);
            const monthRef = format(weekRange.start, "yyyyMM");
            
            // Get monthly goal
            const { data: monthlyGoal } = await supabase
                .from("goals")
                .select("meta_valor, super_meta_valor")
                .eq("store_id", selectedStore)
                .eq("tipo", "MENSAL")
                .eq("mes_referencia", monthRef)
                .is("colaboradora_id", null)
                .single();

            if (monthlyGoal) {
                // Calculate: monthly / 4.33 (average weeks per month)
                const suggestedMeta = (monthlyGoal.meta_valor / 4.33).toFixed(2);
                const suggestedSuper = (monthlyGoal.super_meta_valor / 4.33).toFixed(2);
                
                setWeeklyMetaValor(suggestedMeta);
                setWeeklySuperMetaValor(suggestedSuper);
                toast.success("Metas sugeridas calculadas com base na meta mensal");
            } else {
                toast.warning("Meta mensal não encontrada. Defina manualmente.");
            }
        } catch (err) {
            console.error("Error calculating suggested goals:", err);
            toast.error("Erro ao calcular metas sugeridas");
        }
    };

    const handleSaveWeeklyGoal = async () => {
        if (!selectedStore || !selectedWeek || !weeklyMetaValor || !weeklySuperMetaValor) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        const payload = {
            store_id: selectedStore,
            semana_referencia: selectedWeek,
            tipo: "SEMANAL",
            meta_valor: parseFloat(weeklyMetaValor),
            super_meta_valor: parseFloat(weeklySuperMetaValor),
            colaboradora_id: null,
            ativo: true,
            mes_referencia: null,
        };

        try {
            if (editingWeeklyGoal?.id) {
                const { error } = await supabase
                    .from("goals")
                    .update(payload)
                    .eq("id", editingWeeklyGoal.id);

                if (error) throw error;
                toast.success("Meta semanal atualizada!");
            } else {
                // Check if exists
                const { data: existing } = await supabase
                    .from("goals")
                    .select("id")
                    .eq("store_id", selectedStore)
                    .eq("semana_referencia", selectedWeek)
                    .eq("tipo", "SEMANAL")
                    .single();

                if (existing) {
                    const { error } = await supabase
                        .from("goals")
                        .update(payload)
                        .eq("id", existing.id);

                    if (error) throw error;
                    toast.success("Meta semanal atualizada!");
                } else {
                    const { error } = await supabase
                        .from("goals")
                        .insert([payload]);

                    if (error) throw error;
                    toast.success("Meta semanal criada!");
                }
            }

            setWeeklyDialogOpen(false);
            resetWeeklyForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error saving weekly goal:", err);
            toast.error(err.message || "Erro ao salvar meta semanal");
        }
    };

    const handleEditWeekly = (goal: Goal) => {
        setEditingWeeklyGoal(goal);
        setSelectedStore(goal.store_id || "");
        setSelectedWeek(goal.semana_referencia || getCurrentWeekRef());
        setWeeklyMetaValor(goal.meta_valor.toString());
        setWeeklySuperMetaValor(goal.super_meta_valor.toString());
        setWeeklyDialogOpen(true);
    };

    const resetWeeklyForm = () => {
        setEditingWeeklyGoal(null);
        setSelectedStore("");
        setSelectedWeek(getCurrentWeekRef());
        setWeeklyMetaValor("");
        setWeeklySuperMetaValor("");
    };

    const getWeekOptions = () => {
        const options = [];
        const hoje = new Date();
        for (let i = -2; i <= 4; i++) {
            const weekDate = addWeeks(hoje, i);
            const monday = startOfWeek(weekDate, { weekStartsOn: 1 });
            const year = getYear(monday);
            const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
            const weekRef = `${year}${String(week).padStart(2, '0')}`;
            const weekRange = getWeekRange(weekRef);
            
            options.push({
                value: weekRef,
                label: `${format(weekRange.start, "dd/MM", { locale: ptBR })} - ${format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })} (Semana ${week})`
            });
        }
        return options;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-primary">Gerenciar Metas</h1>
                        <p className="text-muted-foreground">Defina metas por loja e distribua entre a equipe</p>
                    </div>
                </div>
                {activeTab === 'mensal' ? (
                    <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Distribuição Mensal
                    </Button>
                ) : (
                    <Button onClick={() => { resetWeeklyForm(); setWeeklyDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Meta Semanal
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mensal' | 'semanal')}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="mensal">Metas Mensais</TabsTrigger>
                    <TabsTrigger value="semanal">Metas Semanais</TabsTrigger>
                </TabsList>

                {/* Mensal Tab */}
                <TabsContent value="mensal" className="space-y-6 mt-6">
                    {/* Filters */}
                    <div className="flex gap-4 bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-48">
                            <Label>Filtrar por Loja</Label>
                            <Select value={storeFilter} onValueChange={setStoreFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todas</SelectItem>
                                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-48">
                            <Label>Mês</Label>
                            <Input value={monthFilter} onChange={e => setMonthFilter(e.target.value)} placeholder="YYYYMM" />
                        </div>
                    </div>

                    {/* Goals List */}
                    <div className="space-y-6">
                {Object.entries(
                    goals
                        .filter(g => storeFilter === 'ALL' || g.store_id === storeFilter)
                        .filter(g => g.mes_referencia.includes(monthFilter))
                        .reduce((acc, goal) => {
                            const key = `${goal.store_id}-${goal.mes_referencia}`;
                            if (!acc[key]) acc[key] = { store: goal.stores, month: goal.mes_referencia, storeGoal: null, individuals: [] };

                            if (goal.tipo === 'MENSAL') acc[key].storeGoal = goal;
                            else if (goal.tipo === 'INDIVIDUAL') acc[key].individuals.push(goal);

                            return acc;
                        }, {} as Record<string, any>)
                ).map(([key, group]: [string, any]) => (
                    <Card key={key} className="overflow-hidden border-l-4 border-l-primary">
                        <div className="p-4 bg-muted/30 flex justify-between items-center border-b">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/10 p-2 rounded-full">
                                    <Store className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{group.store?.name || 'Loja Desconhecida'}</h3>
                                    <p className="text-sm text-muted-foreground">Referência: {group.month}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right hidden md:block">
                                    <p className="text-xs text-muted-foreground">Meta da Loja</p>
                                    <p className="font-bold text-lg">R$ {group.storeGoal?.meta_valor?.toLocaleString('pt-BR') || '0,00'}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => handleEdit(group.storeGoal?.store_id, group.month)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                            </div>
                        </div>

                        <div className="p-4 bg-card">
                            <h4 className="text-xs font-semibold mb-3 text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                                <UserCheck className="h-4 w-4" />
                                Metas Individuais
                            </h4>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {group.individuals.map((ind: any) => (
                                    <div key={ind.id} className="flex justify-between items-center p-3 rounded-lg border bg-background hover:bg-muted/20 transition-colors">
                                        <span className="font-medium text-sm">{ind.profiles?.name}</span>
                                        <div className="text-right">
                                            <div className="font-bold text-sm">R$ {ind.meta_valor.toLocaleString('pt-BR')}</div>
                                            <div className="text-xs text-purple-600 font-medium">Super: R$ {ind.super_meta_valor.toLocaleString('pt-BR')}</div>
                                        </div>
                                    </div>
                                ))}
                                {group.individuals.length === 0 && (
                                    <div className="col-span-full text-center py-4 text-muted-foreground text-sm italic">
                                        Nenhuma meta individual definida.
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
                    </div>
                </TabsContent>

                {/* Semanal Tab */}
                <TabsContent value="semanal" className="space-y-6 mt-6">
                    {/* Weekly Goals List */}
                    <div className="space-y-4">
                        {weeklyGoals.map((goal) => {
                            const weekRange = getWeekRange(goal.semana_referencia || "");
                            const isCurrentWeek = goal.semana_referencia === getCurrentWeekRef();
                            
                            return (
                                <Card 
                                    key={goal.id} 
                                    className={`overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
                                        isCurrentWeek ? 'border-2 border-primary' : ''
                                    }`}
                                >
                                    <div className="p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 flex justify-between items-center border-b">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                                <Calendar className="h-6 w-6 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{goal.stores?.name || 'Loja Desconhecida'}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(weekRange.start, "dd/MM", { locale: ptBR })} - {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                                                </p>
                                            </div>
                                            {isCurrentWeek && (
                                                <Badge className="bg-primary text-primary-foreground">Semana Atual</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right hidden md:block">
                                                <p className="text-xs text-muted-foreground">Meta Semanal</p>
                                                <p className="font-bold text-lg">R$ {goal.meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</p>
                                                <p className="text-xs text-purple-600 font-medium">Super: R$ {goal.super_meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => handleEditWeekly(goal)}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Editar
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                        {weeklyGoals.length === 0 && (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center text-muted-foreground py-8">
                                        Nenhuma meta semanal cadastrada. Clique em "Nova Meta Semanal" para começar.
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* New Goal Dialog (Mensal) */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Nova Distribuição de Metas</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* 1. Store & Global Values */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                            <div className="md:col-span-2">
                                <Label>Loja</Label>
                                <Select value={selectedStore} onValueChange={handleStoreSelect}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a Loja" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Mês (YYYYMM)</Label>
                                <Input value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} />
                            </div>
                            <div className="flex items-end">
                                <Button variant="outline" onClick={() => setShowWeights(!showWeights)} className="w-full">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Pesos Diários
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-blue-600 font-semibold">Meta da Loja (R$)</Label>
                                <Input
                                    type="number"
                                    value={metaLoja}
                                    onChange={e => setMetaLoja(e.target.value)}
                                    className="text-lg font-bold"
                                />
                            </div>
                            <div>
                                <Label className="text-purple-600 font-semibold">Super Meta da Loja (R$)</Label>
                                <Input
                                    type="number"
                                    value={superMetaLoja}
                                    onChange={e => setSuperMetaLoja(e.target.value)}
                                    className="text-lg font-bold"
                                />
                            </div>
                        </div>

                        <Button onClick={distributeGoals} className="w-full" disabled={!metaLoja || !selectedStore}>
                            <Calculator className="mr-2 h-4 w-4" />
                            Distribuir Igualmente
                        </Button>

                        {/* 2. Distribution List */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted p-3 grid grid-cols-12 gap-2 font-medium text-sm">
                                <div className="col-span-4">Colaboradora</div>
                                <div className="col-span-4">Meta Individual</div>
                                <div className="col-span-4">Super Meta</div>
                            </div>
                            <ScrollArea className="h-[300px]">
                                {colabGoals.map(colab => (
                                    <div key={colab.id} className="p-3 grid grid-cols-12 gap-2 items-center border-b hover:bg-muted/20">
                                        <div className="col-span-4 font-medium">{colab.name}</div>
                                        <div className="col-span-4">
                                            <div className="relative">
                                                <span className="absolute left-2 top-2 text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    value={colab.meta}
                                                    onChange={e => handleColabChange(colab.id, 'meta', e.target.value)}
                                                    className="pl-6 h-8"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-4">
                                            <div className="relative">
                                                <span className="absolute left-2 top-2 text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    value={colab.superMeta}
                                                    onChange={e => handleColabChange(colab.id, 'superMeta', e.target.value)}
                                                    className="pl-6 h-8 text-purple-700 font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </ScrollArea>
                            <div className="p-3 bg-muted/50 flex justify-between items-center border-t">
                                <span className="font-semibold">Total Distribuído:</span>
                                <div className="flex gap-4">
                                    <span className={validateTotal() ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                        Meta: R$ {colabGoals.reduce((s, c) => s + c.meta, 0).toLocaleString('pt-BR')}
                                    </span>
                                    <span className="text-purple-600 font-bold">
                                        Super: R$ {colabGoals.reduce((s, c) => s + c.superMeta, 0).toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Weights Dialog/Section */}
                        {showWeights && (() => {
                            const totalWeight = Object.values(dailyWeights).reduce((sum, w) => sum + w, 0);
                            const isValid = Math.abs(totalWeight - 100) < 0.1;

                            // Calculate quinzena totals
                            let firstQuinzenaTotal = 0;
                            let secondQuinzenaTotal = 0;
                            Object.entries(dailyWeights).forEach(([date, weight]) => {
                                const dayNum = parseInt(date.split('-')[2]);
                                if (dayNum <= 15) {
                                    firstQuinzenaTotal += weight;
                                } else {
                                    secondQuinzenaTotal += weight;
                                }
                            });

                            return (
                                <div className="p-6 border-2 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold">Pesos Diários (Automático: 65% até dia 15)</h3>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => generateWeights()}
                                            className="gap-2"
                                        >
                                            <Calendar className="h-4 w-4" />
                                            Redefinir Padrão
                                        </Button>
                                    </div>

                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Meta da Loja</div>
                                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                                R$ {parseFloat(metaLoja || "0").toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Super Meta</div>
                                            <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                                                R$ {parseFloat(superMetaLoja || "0").toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-2">
                                        {/* Header */}
                                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                                                {day}
                                            </div>
                                        ))}

                                        {/* Days */}
                                        {Object.entries(dailyWeights).sort().map(([date, weight]) => {
                                            const dayNum = parseInt(date.split('-')[2]);
                                            const metaValue = parseFloat(metaLoja || "0");
                                            const superMetaValue = parseFloat(superMetaLoja || "0");
                                            // weight is already a percentage (e.g., 5.91 means 5.91%)
                                            const dailyMeta = (metaValue * weight) / 100;
                                            const dailySuperMeta = (superMetaValue * weight) / 100;
                                            const isFirstHalf = dayNum <= 15;


                                            return (
                                                <div
                                                    key={date}
                                                    className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${isFirstHalf
                                                        ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-300 dark:border-blue-700'
                                                        : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/20 border-gray-300 dark:border-gray-700'
                                                        }`}
                                                >
                                                    <div className="text-center space-y-1">
                                                        <div className="text-sm font-bold text-foreground">{dayNum}</div>
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            value={weight}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                const rounded = Math.round(val * 10) / 10; // Round to 1 decimal
                                                                setDailyWeights(prev => ({ ...prev, [date]: rounded }));
                                                            }}
                                                            className="h-7 text-xs p-1 text-center font-semibold border-2"
                                                        />
                                                        {metaValue > 0 && (
                                                            <>
                                                                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                                                    R$ {dailyMeta.toFixed(0)}
                                                                </div>
                                                                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                                                    R$ {dailySuperMeta.toFixed(0)}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Total Sum Indicator */}
                                    <div className={`p-2 rounded-lg border text-center font-semibold text-sm ${isValid
                                        ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
                                        : 'bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-400'
                                        }`}>
                                        Soma Total: {totalWeight.toFixed(2)}% {isValid ? '✓' : (totalWeight > 100 ? `(${(totalWeight - 100).toFixed(2)}% a mais)` : `(falta ${(100 - totalWeight).toFixed(2)}%)`)}
                                    </div>
                                    {/* Legend */}
                                    <div className="flex gap-4 justify-center text-xs pt-2 border-t">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300"></div>
                                            <span>Primeira quinzena ({firstQuinzenaTotal.toFixed(1)}%)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300"></div>
                                            <span>Segunda quinzena ({secondQuinzenaTotal.toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={!validateTotal()}>
                                <Save className="mr-2 h-4 w-4" />
                                Salvar Distribuição
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Weekly Goal Dialog */}
            <Dialog open={weeklyDialogOpen} onOpenChange={setWeeklyDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingWeeklyGoal ? "Editar Meta Semanal" : "Nova Meta Semanal"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Loja *</Label>
                            <Select value={selectedStore} onValueChange={setSelectedStore}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma loja" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores.map((store) => (
                                        <SelectItem key={store.id} value={store.id}>
                                            {store.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Semana * (Segunda a Domingo)</Label>
                            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {getWeekOptions().map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Label>Meta (R$) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={weeklyMetaValor}
                                    onChange={(e) => setWeeklyMetaValor(e.target.value)}
                                    placeholder="Ex: 10000.00"
                                />
                            </div>
                            <div className="flex-1">
                                <Label>Super Meta (R$) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={weeklySuperMetaValor}
                                    onChange={(e) => setWeeklySuperMetaValor(e.target.value)}
                                    placeholder="Ex: 12000.00"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={calculateWeeklyGoalFromMonthly}
                                className="gap-2"
                                disabled={!selectedStore}
                            >
                                <Calculator className="h-4 w-4" />
                                Sugerir
                            </Button>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-900 dark:text-blue-100">
                                💡 <strong>Dica:</strong> Use o botão "Sugerir" para calcular automaticamente as metas semanais 
                                baseadas na meta mensal da loja (mensal ÷ 4.33). Você pode editar os valores sugeridos livremente.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setWeeklyDialogOpen(false);
                                    resetWeeklyForm();
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveWeeklyGoal}>
                                <Save className="mr-2 h-4 w-4" />
                                {editingWeeklyGoal ? "Atualizar" : "Criar"} Meta Semanal
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function MetasManagement() {
    return (
        <ErrorBoundary>
            <MetasManagementContent />
        </ErrorBoundary>
    );
}
