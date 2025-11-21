import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash, UserCheck, Calendar, Check, Store, Calculator, Save } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, setDate, isWeekend, getDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    mes_referencia: string;
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

function MetasManagementContent() {
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

    useEffect(() => {
        fetchGoals();
        fetchStores();
        fetchColaboradoras();
    }, []);

    const fetchGoals = async () => {
        try {
            const { data, error } = await supabase
                .from("goals")
                .select(`*, stores (name), profiles (name)`)
                .order("mes_referencia", { ascending: false });

            if (error) throw error;
            if (data) setGoals(data as any);
        } catch (err) {
            console.error("Error fetching goals:", err);
            toast.error("Erro ao carregar metas");
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
            weights[dateStr] = parseFloat((weights[dateStr] * factor).toFixed(2));
        }

        setDailyWeights(weights);
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
        return Math.abs(totalMeta - targetMeta) < 1; // Allow small float diff
    };

    const handleSave = async () => {
        if (!validateTotal()) {
            toast.error("A soma das metas individuais não bate com a Meta da Loja!");
            return;
        }

        try {
            // 1. Create/Update Store Goal
            const storePayload = {
                tipo: "LOJA",
                mes_referencia: mesReferencia,
                store_id: selectedStore,
                meta_valor: parseFloat(metaLoja),
                super_meta_valor: parseFloat(superMetaLoja),
                ativo: true,
                daily_weights: dailyWeights // Save weights here
            };

            const { data: storeGoalData, error: storeError } = await supabase
                .from("goals")
                .insert([storePayload])
                .select()
                .single();

            if (storeError) throw storeError;

            // 2. Create Individual Goals
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
                .insert(individualPayloads);

            if (indError) throw indError;

            toast.success("Metas criadas com sucesso!");
            setDialogOpen(false);
            fetchGoals();
        } catch (error: any) {
            toast.error("Erro ao salvar metas: " + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-6 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        Gerenciar Metas
                    </h1>
                    <p className="text-muted-foreground">Defina metas por loja e distribua entre a equipe</p>
                </div>
                <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Distribuição
                </Button>
            </div>

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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {goals
                    .filter(g => storeFilter === 'ALL' || g.store_id === storeFilter)
                    .filter(g => g.mes_referencia.includes(monthFilter))
                    .map(goal => (
                        <Card key={goal.id} className="relative group hover:shadow-md transition-all">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        {goal.tipo === 'LOJA' ? <Store className="h-5 w-5 text-blue-500" /> : <UserCheck className="h-5 w-5 text-green-500" />}
                                        {goal.tipo === 'LOJA' ? goal.stores?.name : goal.profiles?.name}
                                    </CardTitle>
                                    <Badge variant={goal.ativo ? "default" : "secondary"}>{goal.mes_referencia}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Meta:</span>
                                    <span className="font-semibold">R$ {goal.meta_valor.toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Super Meta:</span>
                                    <span className="font-semibold text-purple-600">R$ {goal.super_meta_valor.toLocaleString('pt-BR')}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
            </div>

            {/* New Goal Dialog */}
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
                        {showWeights && (
                            <div className="p-4 border rounded-lg bg-muted/10">
                                <h3 className="font-semibold mb-2">Pesos Diários (Automático: 65% até dia 15)</h3>
                                <div className="grid grid-cols-7 gap-1">
                                    {Object.entries(dailyWeights).sort().map(([date, weight]) => (
                                        <div key={date} className="text-center p-1 border rounded bg-background text-xs">
                                            <div className="text-muted-foreground">{date.split('-')[2]}</div>
                                            <Input
                                                type="number"
                                                value={weight}
                                                onChange={e => setDailyWeights(prev => ({ ...prev, [date]: parseFloat(e.target.value) }))}
                                                className="h-6 text-xs p-1 text-center"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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
