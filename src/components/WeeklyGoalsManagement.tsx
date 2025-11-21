import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ArrowLeft, Save, Calculator, UserCheck, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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
    const [monthlyGoal, setMonthlyGoal] = useState<{ meta_valor: number; super_meta_valor: number } | null>(null);
    const [suggestedWeeklyMeta, setSuggestedWeeklyMeta] = useState<number>(0);
    const [suggestedWeeklySuperMeta, setSuggestedWeeklySuperMeta] = useState<number>(0);
    const [colaboradorasAtivas, setColaboradorasAtivas] = useState<{ id: string; name: string; active: boolean }[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [customizingGoals, setCustomizingGoals] = useState(false);
    const [customMetaEqual, setCustomMetaEqual] = useState<string>("");
    const [customSuperMetaEqual, setCustomSuperMetaEqual] = useState<string>("");
    const [customMetasIndividuais, setCustomMetasIndividuais] = useState<{ id: string; meta: number; superMeta: number }[]>([]);

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
                // Retornar todas as metas individuais, não agrupar aqui
                setWeeklyGoals(data as any);
            }
        } catch (err) {
            console.error("Error fetching weekly goals:", err);
            toast.error("Erro ao carregar metas semanais");
        } finally {
            setLoading(false);
        }
    };

    // Carregar sugestões quando loja ou semana mudarem
    useEffect(() => {
        if (selectedStore && selectedWeek) {
            loadSuggestions();
        } else {
            setMonthlyGoal(null);
            setSuggestedWeeklyMeta(0);
            setSuggestedWeeklySuperMeta(0);
        }
    }, [selectedStore, selectedWeek]);

    // Recalcular sugestões quando colaboradoras ativas mudarem
    useEffect(() => {
        if (selectedStore && selectedWeek && monthlyGoal) {
            const activeCount = colaboradorasAtivas.filter(c => c.active).length;
            if (activeCount > 0) {
                const weeklyMeta = monthlyGoal.meta_valor / 4.33 / activeCount;
                const weeklySuperMeta = monthlyGoal.super_meta_valor / 4.33 / activeCount;
                setSuggestedWeeklyMeta(parseFloat(weeklyMeta.toFixed(2)));
                setSuggestedWeeklySuperMeta(parseFloat(weeklySuperMeta.toFixed(2)));
            }
        }
    }, [colaboradorasAtivas]);

    const loadSuggestions = async () => {
        if (!selectedStore || !selectedWeek) return;

        setLoadingSuggestions(true);
        try {
            // Get month from week
            const weekRange = getWeekRange(selectedWeek);
            const monthRef = format(weekRange.start, "yyyyMM");
            
            // Get monthly goal for the store
            const { data: monthlyStoreGoal } = await supabase
                .from("goals")
                .select("meta_valor, super_meta_valor")
                .eq("store_id", selectedStore)
                .eq("tipo", "MENSAL")
                .eq("mes_referencia", monthRef)
                .is("colaboradora_id", null)
                .single();

            if (monthlyStoreGoal) {
                setMonthlyGoal(monthlyStoreGoal);
                
                // Get active collaborators for the store
                const activeColabs = colaboradoras.filter(c => c.store_id === selectedStore);
                
                // Calculate weekly suggestions based on total store monthly goal
                // We'll recalculate when colaboradorasAtivas changes
                const colabsAtivasCount = activeColabs.length;
                
                // Calculate weekly suggestions: monthly / 4.33 / number of active collaborators (will be recalculated when user selects)
                const weeklyMeta = colabsAtivasCount > 0 
                    ? monthlyStoreGoal.meta_valor / 4.33 / colabsAtivasCount
                    : monthlyStoreGoal.meta_valor / 4.33;
                const weeklySuperMeta = colabsAtivasCount > 0
                    ? monthlyStoreGoal.super_meta_valor / 4.33 / colabsAtivasCount
                    : monthlyStoreGoal.super_meta_valor / 4.33;

                setSuggestedWeeklyMeta(parseFloat(weeklyMeta.toFixed(2)));
                setSuggestedWeeklySuperMeta(parseFloat(weeklySuperMeta.toFixed(2)));
            } else {
                setMonthlyGoal(null);
                setSuggestedWeeklyMeta(0);
                setSuggestedWeeklySuperMeta(0);
            }

            // Load collaborators for the store
            const storeColabs = colaboradoras.filter(c => c.store_id === selectedStore);
            
            // Check existing weekly goals for this week to see who's already active
            const { data: existingGoals } = await supabase
                .from("goals")
                .select("colaboradora_id")
                .eq("store_id", selectedStore)
                .eq("semana_referencia", selectedWeek)
                .eq("tipo", "SEMANAL");

            const existingColabIds = new Set(existingGoals?.map(g => g.colaboradora_id) || []);

            setColaboradorasAtivas(prev => {
                // Se já temos colaboradoras carregadas, manter o estado de active
                const prevMap = new Map(prev.map(c => [c.id, c.active]));
                return storeColabs.map(c => ({
                    id: c.id,
                    name: c.name,
                    active: prevMap.get(c.id) ?? existingColabIds.has(c.id)
                }));
            });
        } catch (err) {
            console.error("Error loading suggestions:", err);
            toast.error("Erro ao carregar sugestões");
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const toggleColaboradoraActive = (colabId: string) => {
        setColaboradorasAtivas(prev => prev.map(c => 
            c.id === colabId ? { ...c, active: !c.active } : c
        ));
    };

    const applySuggestions = () => {
        if (!selectedStore || !selectedWeek) {
            toast.error("Selecione uma loja e uma semana primeiro");
            return;
        }

        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        if (activeColabs.length === 0) {
            toast.error("Selecione pelo menos uma colaboradora para receber a meta semanal");
            return;
        }

        if (suggestedWeeklyMeta === 0 || suggestedWeeklySuperMeta === 0) {
            toast.error("Calcule as sugestões primeiro (selecione loja e semana)");
            return;
        }

        // Apply suggestions - the values are already per collaborator
        handleSaveWeeklyGoals(activeColabs.map(c => ({
            id: c.id,
            meta: suggestedWeeklyMeta,
            superMeta: suggestedWeeklySuperMeta
        })));
    };

    const handleStartCustomizing = () => {
        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        if (activeColabs.length === 0) {
            toast.error("Selecione pelo menos uma colaboradora para receber a meta semanal");
            return;
        }

        // Initialize custom metas with suggestions or empty
        setCustomMetaEqual(suggestedWeeklyMeta > 0 ? suggestedWeeklyMeta.toFixed(2) : "");
        setCustomSuperMetaEqual(suggestedWeeklySuperMeta > 0 ? suggestedWeeklySuperMeta.toFixed(2) : "");
        
        setCustomMetasIndividuais(activeColabs.map(c => ({
            id: c.id,
            meta: suggestedWeeklyMeta > 0 ? suggestedWeeklyMeta : 0,
            superMeta: suggestedWeeklySuperMeta > 0 ? suggestedWeeklySuperMeta : 0
        })));
        
        setCustomizingGoals(true);
    };

    const handleApplyEqualMeta = () => {
        if (!customMetaEqual || !customSuperMetaEqual) {
            toast.error("Preencha os valores de meta e super meta");
            return;
        }

        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        if (activeColabs.length === 0) {
            toast.error("Selecione pelo menos uma colaboradora para receber a meta semanal");
            return;
        }

        const metaValue = parseFloat(customMetaEqual);
        const superMetaValue = parseFloat(customSuperMetaEqual);

        if (isNaN(metaValue) || isNaN(superMetaValue) || metaValue <= 0 || superMetaValue <= 0) {
            toast.error("Valores de meta devem ser maiores que zero");
            return;
        }

        handleSaveWeeklyGoals(activeColabs.map(c => ({
            id: c.id,
            meta: metaValue,
            superMeta: superMetaValue
        })));
    };

    const handleApplyIndividualMetas = () => {
        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        if (activeColabs.length === 0) {
            toast.error("Selecione pelo menos uma colaboradora para receber a meta semanal");
            return;
        }

        const colabsWithMetas = customMetasIndividuais.filter(c => 
            activeColabs.some(ac => ac.id === c.id) && (c.meta > 0 || c.superMeta > 0)
        );

        if (colabsWithMetas.length === 0) {
            toast.error("Defina pelo menos uma meta para uma colaboradora");
            return;
        }

        handleSaveWeeklyGoals(colabsWithMetas.map(c => ({
            id: c.id,
            meta: c.meta,
            superMeta: c.superMeta
        })));
    };

    const handleDeleteWeeklyGoals = async () => {
        if (!selectedStore || !selectedWeek) {
            toast.error("Selecione uma loja e uma semana primeiro");
            return;
        }

        try {
            const { error } = await supabase
                .from("goals")
                .delete()
                .eq("store_id", selectedStore)
                .eq("semana_referencia", selectedWeek)
                .eq("tipo", "SEMANAL");

            if (error) throw error;

            toast.success("Metas semanais excluídas com sucesso!");
            setDialogOpen(false);
            resetForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error deleting weekly goals:", err);
            toast.error(err.message || "Erro ao excluir metas semanais");
        }
    };

    const updateIndividualMeta = (colabId: string, field: 'meta' | 'superMeta', value: string) => {
        const numValue = parseFloat(value) || 0;
        setCustomMetasIndividuais(prev => prev.map(c => 
            c.id === colabId ? { ...c, [field]: numValue } : c
        ));
    };

    const applyEqualToAll = () => {
        if (!customMetaEqual || !customSuperMetaEqual) {
            toast.error("Preencha os valores iguais primeiro");
            return;
        }

        const metaValue = parseFloat(customMetaEqual);
        const superMetaValue = parseFloat(customSuperMetaEqual);

        if (isNaN(metaValue) || isNaN(superMetaValue)) {
            toast.error("Valores inválidos");
            return;
        }

        setCustomMetasIndividuais(prev => prev.map(c => ({
            ...c,
            meta: metaValue,
            superMeta: superMetaValue
        })));
    };

    const handleSaveWeeklyGoals = async (colabsWithGoals: { id: string; meta: number; superMeta: number }[]) => {
        if (!selectedStore || !selectedWeek || colabsWithGoals.length === 0) {
            toast.error("Preencha todos os campos obrigatórios");
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
        setCustomizingGoals(false);
        
        // Fetch existing weekly goals to populate custom metas
        const { data: existingGoals } = await supabase
            .from("goals")
            .select("colaboradora_id, meta_valor, super_meta_valor")
            .eq("store_id", goal.store_id)
            .eq("semana_referencia", goal.semana_referencia)
            .eq("tipo", "SEMANAL");

        if (existingGoals && existingGoals.length > 0) {
            setCustomMetasIndividuais(existingGoals.map((g: any) => ({
                id: g.colaboradora_id,
                meta: g.meta_valor || 0,
                superMeta: g.super_meta_valor || 0
            })));
        }
        
        // Load suggestions will be triggered by useEffect
        // The dialog will open after suggestions load
        setDialogOpen(true);
    };

    const resetForm = () => {
        setEditingGoal(null);
        setSelectedStore("");
        setSelectedWeek(getCurrentWeekRef());
        setMonthlyGoal(null);
        setSuggestedWeeklyMeta(0);
        setSuggestedWeeklySuperMeta(0);
        setColaboradorasAtivas([]);
        setCustomizingGoals(false);
        setCustomMetaEqual("");
        setCustomSuperMetaEqual("");
        setCustomMetasIndividuais([]);
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
                                store_id: goal.store_id,
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
                    
                    // Contar colaboradoras únicas (pode ter metas duplicadas)
                    const uniqueColabs = new Set(group.goals.map((g: any) => g.colaboradora_id).filter((id: any) => id != null));
                    const colabsCount = uniqueColabs.size;
                    
                    const totalMeta = group.goals.reduce((sum: number, g: any) => sum + (g.meta_valor || 0), 0);
                    const totalSuper = group.goals.reduce((sum: number, g: any) => sum + (g.super_meta_valor || 0), 0);
                    
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
                                        <span className="text-sm text-muted-foreground">Total ({colabsCount} colaboradora{colabsCount > 1 ? 's' : ''}):</span>
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
                <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            {editingGoal ? "Editar Meta Semanal" : "Nova Meta Semanal"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 sm:space-y-5 py-3 sm:py-4">
                        {/* 1. Seleção de Loja */}
                        <div>
                            <Label className="text-xs sm:text-sm font-semibold">1. Selecionar Loja *</Label>
                            <Select value={selectedStore} onValueChange={(value) => {
                                setSelectedStore(value);
                                setColaboradorasAtivas([]);
                                setMonthlyGoal(null);
                                setSuggestedWeeklyMeta(0);
                                setSuggestedWeeklySuperMeta(0);
                            }}>
                                <SelectTrigger className="text-xs sm:text-sm mt-2">
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

                        {/* 2. Seleção de Colaboradoras */}
                        {selectedStore && (
                            <div>
                                <Label className="text-xs sm:text-sm font-semibold mb-3 block">2. Ativar/Desativar Colaboradoras para Receber Meta Semanal</Label>
                                <Card className="border-2">
                                    <CardContent className="p-3 sm:p-4">
                                        <ScrollArea className="h-[200px] sm:h-[250px]">
                                            <div className="space-y-2">
                                                {colaboradorasAtivas.length === 0 && colaboradoras.filter(c => c.store_id === selectedStore).length > 0 && (
                                                    <div className="text-center text-sm text-muted-foreground py-4">
                                                        Carregando colaboradoras...
                                                    </div>
                                                )}
                                                {colaboradorasAtivas.map((colab) => (
                                                    <div key={colab.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                                                        <span className="text-xs sm:text-sm font-medium flex-1 truncate pr-2">{colab.name}</span>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            {colab.active && (
                                                                <Badge variant="default" className="text-[10px] sm:text-xs">
                                                                    Ativa
                                                                </Badge>
                                                            )}
                                                            <Switch
                                                                checked={colab.active}
                                                                onCheckedChange={() => toggleColaboradoraActive(colab.id)}
                                                                className="scale-90 sm:scale-100"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                {colaboradorasAtivas.length === 0 && (
                                                    <div className="text-center text-sm text-muted-foreground py-4">
                                                        Selecione uma loja para ver as colaboradoras
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* 3. Seleção de Semana */}
                        <div>
                            <Label className="text-xs sm:text-sm font-semibold">3. Escolher Semana * (Segunda a Domingo)</Label>
                            <Select value={selectedWeek} onValueChange={(value) => {
                                setSelectedWeek(value);
                            }}>
                                <SelectTrigger className="text-xs sm:text-sm mt-2">
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

                        {/* 4. Sugestões Automáticas */}
                        {selectedStore && selectedWeek && monthlyGoal && (
                            <div className="space-y-3 sm:space-y-4">
                                <Label className="text-xs sm:text-sm font-semibold block">4. Sugestões do Sistema</Label>
                                
                                {/* Meta Mensal Total */}
                                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                                    <CardContent className="p-3 sm:p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-medium">Meta Mensal Total da Loja</p>
                                                <p className="text-sm sm:text-base text-blue-900 dark:text-blue-100 font-semibold mt-1">
                                                    R$ {monthlyGoal.meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 font-medium">Super Meta Mensal</p>
                                                <p className="text-sm sm:text-base text-purple-900 dark:text-purple-100 font-semibold mt-1">
                                                    R$ {monthlyGoal.super_meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Meta Semanal Sugerida */}
                                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                                    <CardContent className="p-3 sm:p-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium">Meta Semanal Sugerida (por colaboradora ativa)</p>
                                                    <p className="text-base sm:text-lg text-green-900 dark:text-green-100 font-bold mt-1">
                                                        R$ {suggestedWeeklyMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1">
                                                        ({colaboradorasAtivas.filter(c => c.active).length} colaboradora{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''} ativa{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''})
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 font-medium">Super Meta Semanal Sugerida</p>
                                                    <p className="text-base sm:text-lg text-purple-900 dark:text-purple-100 font-bold mt-1">
                                                        R$ {suggestedWeeklySuperMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Botões Aplicar */}
                                <div className="space-y-2">
                                    <Button
                                        onClick={applySuggestions}
                                        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-xs sm:text-sm"
                                        size="sm"
                                        disabled={colaboradorasAtivas.filter(c => c.active).length === 0 || loadingSuggestions}
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Aplicar Sugestão para {colaboradorasAtivas.filter(c => c.active).length} Colaboradora{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''} Ativa{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''}
                                    </Button>
                                    <Button
                                        onClick={handleStartCustomizing}
                                        variant="outline"
                                        className="w-full text-xs sm:text-sm border-2"
                                        size="sm"
                                        disabled={colaboradorasAtivas.filter(c => c.active).length === 0 || loadingSuggestions}
                                    >
                                        <Calculator className="mr-2 h-4 w-4" />
                                        Personalizar Meta
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Seção de Personalização */}
                        {customizingGoals && colaboradorasAtivas.filter(c => c.active).length > 0 && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs sm:text-sm font-semibold">Personalizar Metas</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCustomizingGoals(false)}
                                        className="text-xs h-6"
                                    >
                                        ✕ Fechar
                                    </Button>
                                </div>

                                {/* Opção: Meta Igual para Todas */}
                                <Card className="bg-muted/50 border-2">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Meta Igual para Todas as Colaboradoras</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-xs sm:text-sm">Meta (R$) *</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={customMetaEqual}
                                                    onChange={(e) => setCustomMetaEqual(e.target.value)}
                                                    placeholder="Ex: 10000.00"
                                                    className="text-xs sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs sm:text-sm">Super Meta (R$) *</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={customSuperMetaEqual}
                                                    onChange={(e) => setCustomSuperMetaEqual(e.target.value)}
                                                    placeholder="Ex: 12000.00"
                                                    className="text-xs sm:text-sm"
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            onClick={handleApplyEqualMeta}
                                            className="w-full text-xs sm:text-sm"
                                            size="sm"
                                            disabled={!customMetaEqual || !customSuperMetaEqual}
                                        >
                                            Aplicar Meta Igual para {colaboradorasAtivas.filter(c => c.active).length} Colaboradora{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''}
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Opção: Metas Individuais */}
                                <Card className="bg-muted/50 border-2">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <CardTitle className="text-sm">Personalizar Meta Individual por Colaboradora</CardTitle>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={applyEqualToAll}
                                                disabled={!customMetaEqual || !customSuperMetaEqual}
                                                className="text-xs"
                                            >
                                                <Calculator className="h-3 w-3 mr-1" />
                                                Usar Valores Iguais
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <ScrollArea className="h-[250px] sm:h-[300px]">
                                            <div className="space-y-2">
                                                {colaboradorasAtivas
                                                    .filter(c => c.active)
                                                    .map((colab) => {
                                                        const customMeta = customMetasIndividuais.find(cm => cm.id === colab.id);
                                                        return (
                                                            <div key={colab.id} className="p-3 rounded-lg border bg-background">
                                                                <div className="mb-2">
                                                                    <p className="text-xs sm:text-sm font-semibold">{colab.name}</p>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <div>
                                                                        <Label className="text-xs">Meta (R$)</Label>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={customMeta?.meta || 0}
                                                                            onChange={(e) => updateIndividualMeta(colab.id, 'meta', e.target.value)}
                                                                            className="text-xs sm:text-sm h-8"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-xs">Super Meta (R$)</Label>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={customMeta?.superMeta || 0}
                                                                            onChange={(e) => updateIndividualMeta(colab.id, 'superMeta', e.target.value)}
                                                                            className="text-xs sm:text-sm h-8"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </ScrollArea>
                                        <Button
                                            onClick={handleApplyIndividualMetas}
                                            className="w-full text-xs sm:text-sm"
                                            size="sm"
                                            variant="default"
                                        >
                                            Aplicar Metas Individuais
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Mensagem quando não há meta mensal */}
                        {selectedStore && selectedWeek && !loadingSuggestions && !monthlyGoal && (
                            <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                                <CardContent className="p-3 sm:p-4">
                                    <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                                        ⚠️ Meta mensal não encontrada para esta loja no mês correspondente à semana selecionada. 
                                        Defina a meta mensal primeiro.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Botões de Ação */}
                        <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3 sm:pt-4 border-t">
                            {/* Botão Excluir Meta (apenas se estiver editando e já existir meta) */}
                            {editingGoal && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDeleteWeeklyGoals}
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                    size="sm"
                                >
                                    <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                    Excluir Meta Semanal
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    resetForm();
                                }}
                                className="w-full sm:w-auto ml-auto text-xs sm:text-sm"
                                size="sm"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WeeklyGoalsManagement;

