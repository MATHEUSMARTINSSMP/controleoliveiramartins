import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ArrowLeft, Save, Calculator } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const WeeklyGoalsManagement = () => {
    const navigate = useNavigate();
    const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<WeeklyGoal | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Form states
    const [selectedStore, setSelectedStore] = useState<string>("");
    const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekRef());
    const [metaValor, setMetaValor] = useState<string>("");
    const [superMetaValor, setSuperMetaValor] = useState<string>("");

    useEffect(() => {
        fetchStores();
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

    const fetchWeeklyGoals = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("goals")
                .select(`*, stores (name)`)
                .eq("tipo", "SEMANAL")
                .order("semana_referencia", { ascending: false });

            if (error) throw error;
            if (data) {
                setWeeklyGoals(data as any);
            }
        } catch (err) {
            console.error("Error fetching weekly goals:", err);
            toast.error("Erro ao carregar metas semanais");
        } finally {
            setLoading(false);
        }
    };

    const calculateSuggestedGoals = async () => {
        if (!selectedStore) {
            toast.error("Selecione uma loja primeiro");
            return;
        }

        try {
            // Get monthly goal for the same month as the week
            const weekRange = getWeekRange(selectedWeek);
            const monthRef = format(weekRange.start, "yyyyMM");
            
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
                
                setMetaValor(suggestedMeta);
                setSuperMetaValor(suggestedSuper);
                toast.success("Metas sugeridas calculadas com base na meta mensal");
            } else {
                toast.warning("Meta mensal não encontrada. Defina manualmente.");
            }
        } catch (err) {
            console.error("Error calculating suggested goals:", err);
            toast.error("Erro ao calcular metas sugeridas");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedStore || !selectedWeek || !metaValor || !superMetaValor) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        const payload = {
            store_id: selectedStore,
            semana_referencia: selectedWeek,
            tipo: "SEMANAL",
            meta_valor: parseFloat(metaValor),
            super_meta_valor: parseFloat(superMetaValor),
            colaboradora_id: null, // Semanal goals are for the store, not individual
            ativo: true,
            mes_referencia: null, // Not used for weekly goals
        };

        try {
            if (editingGoal?.id) {
                const { error } = await supabase
                    .from("goals")
                    .update(payload)
                    .eq("id", editingGoal.id);

                if (error) throw error;
                toast.success("Meta semanal atualizada!");
            } else {
                // Check if weekly goal already exists
                const { data: existing } = await supabase
                    .from("goals")
                    .select("id")
                    .eq("store_id", selectedStore)
                    .eq("semana_referencia", selectedWeek)
                    .eq("tipo", "SEMANAL")
                    .single();

                if (existing) {
                    // Update existing
                    const { error } = await supabase
                        .from("goals")
                        .update(payload)
                        .eq("id", existing.id);

                    if (error) throw error;
                    toast.success("Meta semanal atualizada!");
                } else {
                    // Insert new
                    const { error } = await supabase
                        .from("goals")
                        .insert([payload]);

                    if (error) throw error;
                    toast.success("Meta semanal criada!");
                }
            }

            setDialogOpen(false);
            resetForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error saving weekly goal:", err);
            toast.error(err.message || "Erro ao salvar meta semanal");
        }
    };

    const handleEdit = (goal: WeeklyGoal) => {
        setEditingGoal(goal);
        setSelectedStore(goal.store_id);
        setSelectedWeek(goal.semana_referencia);
        setMetaValor(goal.meta_valor.toString());
        setSuperMetaValor(goal.super_meta_valor.toString());
        setDialogOpen(true);
    };

    const resetForm = () => {
        setEditingGoal(null);
        setSelectedStore("");
        setSelectedWeek(getCurrentWeekRef());
        setMetaValor("");
        setSuperMetaValor("");
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {weeklyGoals.map((goal) => {
                    const weekRange = getWeekRange(goal.semana_referencia);
                    const isCurrentWeek = goal.semana_referencia === getCurrentWeekRef();
                    
                    return (
                        <Card 
                            key={goal.id} 
                            className={`relative overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
                                isCurrentWeek ? 'border-2 border-primary' : ''
                            }`}
                        >
                            <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 to-purple-500/10">
                                <CardTitle className="flex justify-between items-center text-lg">
                                    <span>{goal.stores?.name || "Loja desconhecida"}</span>
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
                                        <span className="text-sm text-muted-foreground">Meta:</span>
                                        <span className="font-bold text-primary">
                                            R$ {goal.meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Super Meta:</span>
                                        <span className="font-bold text-purple-600">
                                            R$ {goal.super_meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleEdit(goal)}
                                >
                                    Editar
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
                {weeklyGoals.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        Nenhuma meta semanal cadastrada. Clique em "Nova Meta Semanal" para começar.
                    </div>
                )}
            </div>

            {/* Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingGoal ? "Editar Meta Semanal" : "Nova Meta Semanal"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                            <Label>Semana *</Label>
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
                                    value={metaValor}
                                    onChange={(e) => setMetaValor(e.target.value)}
                                    placeholder="Ex: 10000.00"
                                    required
                                />
                            </div>
                            <div className="flex-1">
                                <Label>Super Meta (R$) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={superMetaValor}
                                    onChange={(e) => setSuperMetaValor(e.target.value)}
                                    placeholder="Ex: 12000.00"
                                    required
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={calculateSuggestedGoals}
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
                                baseadas na meta mensal da loja (mensal ÷ 4.33). Você pode editar os valores sugeridos.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    resetForm();
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit">
                                <Save className="mr-2 h-4 w-4" />
                                {editingGoal ? "Atualizar" : "Criar"} Meta Semanal
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WeeklyGoalsManagement;

