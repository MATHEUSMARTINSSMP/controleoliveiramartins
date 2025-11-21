import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ArrowLeft, Save, Calculator, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WeeklyGoal {
    id?: string;
    store_id: string;
    semana_referencia: string;
    meta_valor: number;
    super_meta_valor: number;
    ativo: boolean;
    stores?: { name: string };
}

interface Store {
    id: string;
    name: string;
}

interface Colaboradora {
    id: string;
    name: string;
    store_id?: string;
}

const WeeklyGoalsManagement = () => {
    const navigate = useNavigate();
    const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<WeeklyGoal | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Form states
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekRef());
    const [weeklyMetaValor, setWeeklyMetaValor] = useState<string>("");
    const [weeklySuperMetaValor, setWeeklySuperMetaValor] = useState<string>("");
    const [weeklyColabGoals, setWeeklyColabGoals] = useState<{ id: string, name: string, meta: number, superMeta: number }[]>([]);

    useEffect(() => {
        fetchStores();
        fetchColaboradoras();
        fetchWeeklyGoals();
    }, []);

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

    const fetchStores = async () => {
        const { data } = await supabase
            .from("stores")
            .select("*")
            .eq("active", true);
        if (data) setStores(data);
    };

    const fetchColaboradoras = async () => {
        const { data } = await supabase
            .schema("sistemaretiradas")
            .from("profiles")
            .select("id, name, store_id")
            .eq("role", "COLABORADORA")
            .eq("active", true);
        if (data) setColaboradoras(data || []);
    };

    const fetchWeeklyGoals = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("goals")
                .select(`*, stores (name), profiles (name)`)
                .eq("tipo", "SEMANAL")
                .order("semana_referencia", { ascending: false });

            if (error) throw error;
            if (data) {
                // Agrupar por store_id e semana_referencia, pegando apenas um de cada grupo
                const grouped = data.reduce((acc: any, goal: any) => {
                    const key = `${goal.store_id}-${goal.semana_referencia}`;
                    if (!acc[key]) {
                        acc[key] = goal;
                    }
                    return acc;
                }, {});
                setWeeklyGoals(Object.values(grouped) as any);
            }
        } catch (err) {
            console.error("Error fetching weekly goals:", err);
            toast.error("Erro ao carregar metas semanais");
        } finally {
            setLoading(false);
        }
    };

    const calculateWeeklyGoalFromMonthly = async () => {
        if (!selectedStore || !selectedWeek) {
            toast.error("Selecione uma loja e uma semana primeiro");
            return;
        }

        try {
            // Get active collaborators for the store
            const activeColabs = colaboradoras.filter(c => c.store_id === selectedStore);
            
            if (activeColabs.length === 0) {
                toast.error("Nenhuma colaboradora ativa encontrada nesta loja");
                return;
            }

            // Get month from week
            const weekRange = getWeekRange(selectedWeek);
            const monthRef = format(weekRange.start, "yyyyMM");
            
            // Get monthly individual goals
            const { data: monthlyGoals } = await supabase
                .from("goals")
                .select("colaboradora_id, meta_valor, super_meta_valor")
                .eq("store_id", selectedStore)
                .eq("tipo", "INDIVIDUAL")
                .eq("mes_referencia", monthRef);

            if (monthlyGoals && monthlyGoals.length > 0) {
                // Calculate weekly goals per collaborator
                const colabGoalsData = activeColabs.map(colab => {
                    const monthlyGoal = monthlyGoals.find(g => g.colaboradora_id === colab.id);
                    if (monthlyGoal) {
                        // Calculate: monthly / 4.33 (average weeks per month)
                        const weeklyMeta = monthlyGoal.meta_valor / 4.33;
                        const weeklySuper = monthlyGoal.super_meta_valor / 4.33;
                        return {
                            id: colab.id,
                            name: colab.name,
                            meta: parseFloat(weeklyMeta.toFixed(2)),
                            superMeta: parseFloat(weeklySuper.toFixed(2))
                        };
                    } else {
                        return {
                            id: colab.id,
                            name: colab.name,
                            meta: 0,
                            superMeta: 0
                        };
                    }
                });

                setWeeklyColabGoals(colabGoalsData);
                
                // Calculate total
                const totalMeta = colabGoalsData.reduce((sum, c) => sum + c.meta, 0);
                const totalSuper = colabGoalsData.reduce((sum, c) => sum + c.superMeta, 0);
                
                setWeeklyMetaValor(totalMeta.toFixed(2));
                setWeeklySuperMetaValor(totalSuper.toFixed(2));
                
                toast.success(`Metas sugeridas para ${activeColabs.length} colaboradora(s) baseadas nas metas mensais`);
            } else {
                toast.warning("Metas mensais individuais não encontradas. Defina manualmente.");
                // Initialize with empty goals
                setWeeklyColabGoals(activeColabs.map(c => ({
                    id: c.id,
                    name: c.name,
                    meta: 0,
                    superMeta: 0
                })));
            }
        } catch (err) {
            console.error("Error calculating suggested goals:", err);
            toast.error("Erro ao calcular metas sugeridas");
        }
    };

    const handleWeeklyColabChange = (id: string, field: 'meta' | 'superMeta', value: string) => {
        const numValue = parseFloat(value) || 0;
        setWeeklyColabGoals(prev => prev.map(c => {
            if (c.id !== id) return c;
            if (field === 'meta') {
                // Recalculate super meta proportionally
                const ratio = parseFloat(weeklySuperMetaValor) / parseFloat(weeklyMetaValor || '1');
                return { ...c, meta: numValue, superMeta: parseFloat((numValue * ratio).toFixed(2)) };
            } else {
                return { ...c, superMeta: numValue };
            }
        }));
    };

    const distributeWeeklyGoals = () => {
        if (!weeklyMetaValor || !weeklySuperMetaValor || weeklyColabGoals.length === 0) return;

        const totalMeta = parseFloat(weeklyMetaValor);
        const totalSuper = parseFloat(weeklySuperMetaValor);
        const count = weeklyColabGoals.length;

        const individualMeta = totalMeta / count;
        const individualSuper = totalSuper / count;

        setWeeklyColabGoals(weeklyColabGoals.map(c => ({
            ...c,
            meta: parseFloat(individualMeta.toFixed(2)),
            superMeta: parseFloat(individualSuper.toFixed(2))
        })));
    };

    const handleSaveWeeklyGoal = async () => {
        if (!selectedStore) {
            toast.error("Selecione uma loja");
            return;
        }

        if (!selectedWeek) {
            toast.error("Selecione uma semana");
            return;
        }

        // Buscar colaboradoras ativas da loja
        const activeColabs = colaboradoras.filter(c => c.store_id === selectedStore);
        if (activeColabs.length === 0) {
            toast.error("Nenhuma colaboradora ativa encontrada nesta loja");
            return;
        }

        // Se colaboradoras não foram carregadas ainda, carregar e distribuir
        let colabsToSave = [...weeklyColabGoals];
        if (colabsToSave.length === 0) {
            // Se temos valores totais, distribuir igualmente
            if (weeklyMetaValor && weeklySuperMetaValor) {
                const totalMeta = parseFloat(weeklyMetaValor);
                const totalSuper = parseFloat(weeklySuperMetaValor);
                const individualMeta = totalMeta / activeColabs.length;
                const individualSuper = totalSuper / activeColabs.length;
                
                colabsToSave = activeColabs.map(c => ({
                    id: c.id,
                    name: c.name,
                    meta: parseFloat(individualMeta.toFixed(2)),
                    superMeta: parseFloat(individualSuper.toFixed(2))
                }));
            } else {
                toast.error("Preencha os valores de Meta Total e Super Meta Total primeiro, ou clique em 'Carregar Colaboradoras'");
                return;
            }
        }

        // Filtrar colaboradoras com metas definidas (> 0)
        const colabsWithGoals = colabsToSave.filter(c => c.meta > 0 || c.superMeta > 0);
        
        if (colabsWithGoals.length === 0) {
            toast.error("Defina pelo menos uma meta para uma colaboradora");
            return;
        }

        try {
            // Create/Update individual weekly goals for each collaborator
            const payloads = colabsWithGoals.map(colab => ({
                store_id: selectedStore,
                semana_referencia: selectedWeek,
                tipo: "SEMANAL",
                meta_valor: colab.meta > 0 ? colab.meta : 0,
                super_meta_valor: colab.superMeta > 0 ? colab.superMeta : 0,
                colaboradora_id: colab.id,
                ativo: true,
                mes_referencia: null,
            }));

            // Delete existing weekly goals for this store and week
            const { error: deleteError } = await supabase
                .from("goals")
                .delete()
                .eq("store_id", selectedStore)
                .eq("semana_referencia", selectedWeek)
                .eq("tipo", "SEMANAL");

            if (deleteError) throw deleteError;

            // Insert new weekly goals
            const { error: insertError } = await supabase
                .from("goals")
                .insert(payloads);

            if (insertError) throw insertError;

            toast.success(`Metas semanais criadas para ${colabsWithGoals.length} colaboradora(s)!`);
            setDialogOpen(false);
            resetForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error saving weekly goals:", err);
            toast.error(err.message || "Erro ao salvar metas semanais");
        }
    };

    const handleEditWeekly = async (goal: WeeklyGoal) => {
        setEditingGoal(goal);
        setSelectedStore(goal.store_id);
        setSelectedWeek(goal.semana_referencia);

        // Fetch all weekly goals for this store and week
        const { data: weeklyGoalsData } = await supabase
            .from("goals")
            .select("*, profiles (name)")
            .eq("store_id", goal.store_id)
            .eq("semana_referencia", goal.semana_referencia)
            .eq("tipo", "SEMANAL");

        if (weeklyGoalsData && weeklyGoalsData.length > 0) {
            const colabGoalsData = weeklyGoalsData.map((g: any) => ({
                id: g.colaboradora_id,
                name: g.profiles?.name || "Colaboradora desconhecida",
                meta: g.meta_valor,
                superMeta: g.super_meta_valor
            }));

            setWeeklyColabGoals(colabGoalsData);

            const totalMeta = colabGoalsData.reduce((sum, c) => sum + c.meta, 0);
            const totalSuper = colabGoalsData.reduce((sum, c) => sum + c.superMeta, 0);
            
            setWeeklyMetaValor(totalMeta.toFixed(2));
            setWeeklySuperMetaValor(totalSuper.toFixed(2));
        } else {
            // If no goals found, load active collaborators
            const activeColabs = colaboradoras.filter(c => c.store_id === goal.store_id);
            setWeeklyColabGoals(activeColabs.map(c => ({
                id: c.id,
                name: c.name,
                meta: 0,
                superMeta: 0
            })));
            setWeeklyMetaValor("");
            setWeeklySuperMetaValor("");
        }

        setDialogOpen(true);
    };

    const resetForm = () => {
        setEditingGoal(null);
        setSelectedStore("");
        setSelectedWeek(getCurrentWeekRef());
        setWeeklyMetaValor("");
        setWeeklySuperMetaValor("");
        setWeeklyColabGoals([]);
    };

    // Generate week options (current week and 4 weeks ahead)
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

    if (loading) {
        return <div className="text-center py-10">Carregando metas semanais...</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/admin")}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar
                    </Button>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Gerenciar Metas Semanais
                    </h1>
                </div>
                <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Nova Meta Semanal
                </Button>
            </div>

            {/* Weekly Goals Grid */}
            <div className="space-y-4">
                {Object.entries(
                    weeklyGoals.reduce((acc, goal) => {
                        const key = `${goal.store_id}-${goal.semana_referencia}`;
                        if (!acc[key]) {
                            acc[key] = {
                                store: goal.stores,
                                semana_referencia: goal.semana_referencia,
                                goals: []
                            };
                        }
                        acc[key].goals.push(goal);
                        return acc;
                    }, {} as Record<string, any>)
                ).map(([key, group]: [string, any]) => {
                    const weekRange = getWeekRange(group.semana_referencia || "");
                    const isCurrentWeek = group.semana_referencia === getCurrentWeekRef();
                    const totalMeta = group.goals.reduce((sum: number, g: any) => sum + g.meta_valor, 0);
                    const totalSuper = group.goals.reduce((sum: number, g: any) => sum + g.super_meta_valor, 0);
                    
                    return (
                        <Card 
                            key={key} 
                            className={`relative overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
                                isCurrentWeek ? 'border-2 border-primary' : ''
                            }`}
                        >
                            <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 to-purple-500/10">
                                <CardTitle className="flex justify-between items-center text-lg">
                                    <span>{group.store?.name || "Loja desconhecida"}</span>
                                    {isCurrentWeek && (
                                        <span className="text-xs font-normal bg-primary text-primary-foreground px-2 py-1 rounded">
                                            Semana Atual
                                        </span>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <div className="text-sm text-muted-foreground">
                                    {format(weekRange.start, "dd/MM", { locale: ptBR })} - {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Total ({group.goals.length} colaboradora{group.goals.length > 1 ? 's' : ''}):</span>
                                        <span className="font-bold text-primary">
                                            R$ {totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Super Meta Total:</span>
                                        <span className="font-bold text-purple-600">
                                            R$ {totalSuper.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleEditWeekly(group.goals[0])}
                                >
                                    Editar
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
                {weeklyGoals.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                        Nenhuma meta semanal cadastrada. Clique em "Nova Meta Semanal" para começar.
                    </div>
                )}
            </div>

            {/* Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            {editingGoal ? "Editar Meta Semanal" : "Nova Meta Semanal"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                        <div>
                            <Label className="text-xs sm:text-sm">Loja *</Label>
                            <Select value={selectedStore} onValueChange={(value) => {
                                setSelectedStore(value);
                                setWeeklyColabGoals([]);
                                setWeeklyMetaValor("");
                                setWeeklySuperMetaValor("");
                            }}>
                                <SelectTrigger className="text-xs sm:text-sm">
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
                            <Label className="text-xs sm:text-sm">Semana * (Segunda a Domingo)</Label>
                            <Select value={selectedWeek} onValueChange={(value) => {
                                setSelectedWeek(value);
                                setWeeklyColabGoals([]);
                                setWeeklyMetaValor("");
                                setWeeklySuperMetaValor("");
                            }}>
                                <SelectTrigger className="text-xs sm:text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {getWeekOptions().map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="text-xs sm:text-sm">
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {selectedStore && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    const activeColabs = colaboradoras.filter(c => c.store_id === selectedStore);
                                    if (activeColabs.length === 0) {
                                        toast.error("Nenhuma colaboradora ativa encontrada nesta loja");
                                        return;
                                    }
                                    setWeeklyColabGoals(activeColabs.map(c => ({
                                        id: c.id,
                                        name: c.name,
                                        meta: 0,
                                        superMeta: 0
                                    })));
                                }}
                                className="w-full text-xs sm:text-sm"
                                size="sm"
                            >
                                <UserCheck className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Carregar Colaboradoras da Loja</span>
                                <span className="sm:hidden">Carregar Colaboradoras</span>
                            </Button>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-2">
                            <div className="flex-1 w-full sm:w-auto">
                                <Label className="text-xs sm:text-sm">Meta Total (R$) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={weeklyMetaValor}
                                    onChange={(e) => setWeeklyMetaValor(e.target.value)}
                                    placeholder="Ex: 10000.00"
                                    className="text-xs sm:text-sm"
                                />
                            </div>
                            <div className="flex-1 w-full sm:w-auto">
                                <Label className="text-xs sm:text-sm">Super Meta Total (R$) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={weeklySuperMetaValor}
                                    onChange={(e) => setWeeklySuperMetaValor(e.target.value)}
                                    placeholder="Ex: 12000.00"
                                    className="text-xs sm:text-sm"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={calculateWeeklyGoalFromMonthly}
                                className="gap-2 w-full sm:w-auto text-xs sm:text-sm"
                                size="sm"
                                disabled={!selectedStore || !selectedWeek}
                            >
                                <Calculator className="h-3 w-3 sm:h-4 sm:w-4" />
                                Sugerir
                            </Button>
                        </div>

                        {/* Cálculo simples */}
                        {weeklyColabGoals.length > 0 && (
                            <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm">
                                    <div>
                                        <p className="font-semibold text-purple-900 dark:text-purple-100">
                                            Número de colaboradoras: <span className="text-purple-600 dark:text-purple-400">{weeklyColabGoals.length}</span>
                                        </p>
                                        <p className="text-purple-700 dark:text-purple-300 text-xs mt-1">
                                            Meta individual: R$ {(parseFloat(weeklyMetaValor || "0") / weeklyColabGoals.length).toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-purple-900 dark:text-purple-100">
                                            Total: <span className="text-purple-600 dark:text-purple-400">R$ {weeklyColabGoals.reduce((sum, c) => sum + c.meta, 0).toFixed(2)}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-900 dark:text-blue-100">
                                💡 <strong>Dica:</strong> As metas semanais são calculadas por colaboradora. Use o botão "Sugerir" para calcular automaticamente 
                                baseadas nas metas mensais individuais (mensal ÷ 4.33). Você pode editar livremente.
                            </p>
                        </div>

                        {/* Distribuição Individual */}
                        {weeklyColabGoals.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-base font-semibold">Metas Individuais</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={distributeWeeklyGoals}
                                        disabled={!weeklyMetaValor || !weeklySuperMetaValor}
                                    >
                                        <Calculator className="h-3 w-3 mr-1" />
                                        Distribuir Igualmente
                                    </Button>
                                </div>
                                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                    <div className="bg-muted p-2 grid grid-cols-12 gap-2 font-medium text-xs sticky top-0 z-10">
                                        <div className="col-span-4 sm:col-span-5">Colaboradora</div>
                                        <div className="col-span-4">Meta</div>
                                        <div className="col-span-4">Super Meta</div>
                                    </div>
                                    {weeklyColabGoals.map((colab) => (
                                        <div key={colab.id} className="p-2 grid grid-cols-12 gap-2 items-center border-b hover:bg-muted/20">
                                            <div className="col-span-4 sm:col-span-5 font-medium text-sm truncate">{colab.name}</div>
                                            <div className="col-span-4">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={colab.meta}
                                                    onChange={(e) => handleWeeklyColabChange(colab.id, 'meta', e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="col-span-4">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={colab.superMeta}
                                                    onChange={(e) => handleWeeklyColabChange(colab.id, 'superMeta', e.target.value)}
                                                    className="h-8 text-sm text-purple-700"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className="p-2 bg-muted/50 flex justify-between items-center border-t text-xs sm:text-sm">
                                        <span className="font-semibold">Total:</span>
                                        <div className="flex gap-3">
                                            <span className="text-primary font-bold">
                                                Meta: R$ {weeklyColabGoals.reduce((s, c) => s + c.meta, 0).toFixed(2)}
                                            </span>
                                            <span className="text-purple-600 font-bold">
                                                Super: R$ {weeklyColabGoals.reduce((s, c) => s + c.superMeta, 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 sm:pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    resetForm();
                                }}
                                className="w-full sm:w-auto text-xs sm:text-sm"
                                size="sm"
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveWeeklyGoal} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                                <Save className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                {editingGoal ? "Atualizar" : "Criar"} Meta Semanal
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WeeklyGoalsManagement;

