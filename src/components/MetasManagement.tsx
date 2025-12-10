import React, { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash, UserCheck, Calendar, Check, Store, Calculator, Save, ClipboardList, Edit, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, setDate, isWeekend, getDay, startOfWeek, endOfWeek, getWeek, getYear, addWeeks, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StoreLogo } from "@/lib/storeLogo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, ChevronDown, ChevronUp, XCircle } from "lucide-react";

const WeeklyGincanaResults = lazy(() => import("@/components/loja/WeeklyGincanaResults"));

const loadWhatsAppFunctions = async () => {
  const { sendWhatsAppMessage, formatGincanaMessage } = await import("@/lib/whatsapp");
  return { sendWhatsAppMessage, formatGincanaMessage };
};

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
                <div className="min-h-screen flex items-center justify-center bg-destructive/10 p-4">
                    <div className="max-w-md w-full bg-card p-6 rounded-lg shadow-lg border border-destructive/30">
                        <h2 className="text-xl font-bold text-destructive mb-4">Algo deu errado na página de Metas</h2>
                        <div className="bg-destructive/10 p-4 rounded text-sm font-mono text-destructive overflow-auto mb-4">
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
    const [colabGoals, setColabGoals] = useState<{ id: string, name: string, meta: number, superMeta: number, recebeMeta: boolean }[]>([]);

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
    const [weeklyColabGoals, setWeeklyColabGoals] = useState<{ id: string, name: string, meta: number, superMeta: number }[]>([]);
    
    // Weekly goals advanced states (para cálculo com daily_weights)
    const [monthlyGoal, setMonthlyGoal] = useState<{ meta_valor: number; super_meta_valor: number; daily_weights?: Record<string, number> } | null>(null);
    const [suggestedWeeklyMeta, setSuggestedWeeklyMeta] = useState<number>(0);
    const [suggestedWeeklySuperMeta, setSuggestedWeeklySuperMeta] = useState<number>(0);
    const [colaboradorasAtivas, setColaboradorasAtivas] = useState<{ id: string; name: string; active: boolean }[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [customizingGoals, setCustomizingGoals] = useState(false);
    const [customMetaEqual, setCustomMetaEqual] = useState<string>("");
    const [customSuperMetaEqual, setCustomSuperMetaEqual] = useState<string>("");
    const [customMetasIndividuais, setCustomMetasIndividuais] = useState<{ id: string; meta: number; superMeta: number }[]>([]);
    
    // Prêmios da gincana
    const [premioCheckpoint1, setPremioCheckpoint1] = useState<string>(""); // Prêmio para checkpoint 1 (meta)
    const [premioCheckpointFinal, setPremioCheckpointFinal] = useState<string>(""); // Prêmio para checkpoint final (super meta)
    const [isPremioFisicoCheckpoint1, setIsPremioFisicoCheckpoint1] = useState<boolean>(false);
    const [isPremioFisicoCheckpointFinal, setIsPremioFisicoCheckpointFinal] = useState<boolean>(false);
    const [savingWeeklyGoal, setSavingWeeklyGoal] = useState(false);

    function getCurrentWeekRef(): string {
        const hoje = new Date();
        const monday = startOfWeek(hoje, { weekStartsOn: 1 });
        const year = getYear(monday);
        const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
        // Formato: WWYYYY (ex: 462025 para semana 46 de 2025)
        return `${String(week).padStart(2, '0')}${year}`;
    }

    function getWeekRange(weekRef: string): { start: Date; end: Date } {
        // Suporta ambos os formatos: WWYYYY (novo) e YYYYWW (antigo - para migração)
        let week: number, year: number;
        
        if (!weekRef || weekRef.length !== 6) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (deve ter 6 caracteres)`);
        }
        
        // Verificar se é formato antigo (YYYYWW) ou novo (WWYYYY)
        const firstTwo = parseInt(weekRef.substring(0, 2));
        const firstFour = parseInt(weekRef.substring(0, 4));
        
        // Se começa com 20xx (2000-2099), é formato antigo YYYYWW
        if (firstTwo === 20 && firstFour >= 2000 && firstFour <= 2099) {
            // Formato antigo YYYYWW
            year = firstFour;
            week = parseInt(weekRef.substring(4, 6));
        } else if (firstTwo >= 1 && firstTwo <= 53) {
            // Formato novo WWYYYY (semana entre 1-53)
            week = firstTwo;
            year = parseInt(weekRef.substring(2, 6));
        } else {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (não é YYYYWW nem WWYYYY)`);
        }
        
        // Validar valores
        if (isNaN(week) || isNaN(year)) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (valores não numéricos)`);
        }
        
        if (week < 1 || week > 53) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (semana ${week} fora do range 1-53)`);
        }
        
        if (year < 2000 || year > 2100) {
            throw new Error(`Formato de semana_referencia inválido: ${weekRef} (ano ${year} fora do range 2000-2100)`);
        }
        
        // Get first Monday of the year
        const jan1 = new Date(year, 0, 1);
        const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
        const weekStart = addWeeks(firstMonday, week - 1);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        
        return { start: weekStart, end: weekEnd };
    }

    // Helper function to calculate weekly goal from monthly goal using daily_weights
    const calculateWeeklyGoalFromMonthlyHelper = (monthlyGoal: number, dailyWeights: Record<string, number>, weekRange: { start: Date; end: Date }, monthInfo?: { year: number; month: number }): number => {
        const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
        
        if (Object.keys(dailyWeights).length === 0) {
            const daysInMonth = monthInfo 
                ? new Date(monthInfo.year, monthInfo.month + 1, 0).getDate()
                : new Date(weekRange.start.getFullYear(), weekRange.start.getMonth() + 1, 0).getDate();
            const dailyGoal = monthlyGoal / daysInMonth;
            return dailyGoal * 7;
        }
        
        let somaPesosSemana = 0;
        weekDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayWeight = dailyWeights[dayKey] || 0;
            somaPesosSemana += dayWeight;
        });
        
        const proporcaoMaximaEsperada = 0.35;
        const proporcaoCalculada = somaPesosSemana / 100;
        
        let totalWeeklyGoal = (monthlyGoal * somaPesosSemana) / 100;
        
        if (proporcaoCalculada > proporcaoMaximaEsperada) {
            totalWeeklyGoal = monthlyGoal * proporcaoMaximaEsperada;
        }
        
        return totalWeeklyGoal;
    };

    // Função para carregar sugestões baseadas em meta mensal e daily_weights
    const loadSuggestions = async (forceLoadColabs = false) => {
        if (!selectedStore) return;
        
        setLoadingSuggestions(true);
        try {
            if (selectedWeek) {
                try {
                    const weekRange = getWeekRange(selectedWeek);
                    const startMonth = { year: weekRange.start.getFullYear(), month: weekRange.start.getMonth() };
                    const endMonth = { year: weekRange.end.getFullYear(), month: weekRange.end.getMonth() };
                    const semanaCruzaMeses = startMonth.year !== endMonth.year || startMonth.month !== endMonth.month;
                    
                    const monthRefStart = format(weekRange.start, "yyyyMM");
                    const monthRefEnd = semanaCruzaMeses ? format(weekRange.end, "yyyyMM") : monthRefStart;
                    
                    const { data: monthlyStoreGoal, error: goalError } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .select("meta_valor, super_meta_valor, daily_weights")
                        .eq("store_id", selectedStore)
                        .eq("tipo", "MENSAL")
                        .eq("mes_referencia", monthRefStart)
                        .is("colaboradora_id", null)
                        .single();
                    
                    let monthlyStoreGoalEnd: any = null;
                    if (semanaCruzaMeses && monthRefEnd !== monthRefStart) {
                        const { data: goalEnd } = await supabase
                            .schema("sistemaretiradas")
                            .from("goals")
                            .select("meta_valor, super_meta_valor, daily_weights")
                            .eq("store_id", selectedStore)
                            .eq("tipo", "MENSAL")
                            .eq("mes_referencia", monthRefEnd)
                            .is("colaboradora_id", null)
                            .single();
                        monthlyStoreGoalEnd = goalEnd?.data || null;
                    }

                    if (monthlyStoreGoal) {
                        let parsedDailyWeights: Record<string, number> = {};
                        if (monthlyStoreGoal.daily_weights) {
                            if (typeof monthlyStoreGoal.daily_weights === 'string') {
                                try {
                                    parsedDailyWeights = JSON.parse(monthlyStoreGoal.daily_weights);
                                } catch (e) {
                                    console.error('[loadSuggestions] Erro ao parsear daily_weights:', e);
                                }
                            } else if (typeof monthlyStoreGoal.daily_weights === 'object') {
                                parsedDailyWeights = monthlyStoreGoal.daily_weights as Record<string, number>;
                            }
                        }
                        
                        setMonthlyGoal({
                            ...monthlyStoreGoal,
                            daily_weights: parsedDailyWeights
                        });
                        
                        // O cálculo será feito pelo useEffect quando colaboradorasAtivas for definido
                    } else {
                        setMonthlyGoal(null);
                        setSuggestedWeeklyMeta(0);
                        setSuggestedWeeklySuperMeta(0);
                    }
                } catch (err) {
                    console.error("Error loading monthly goal:", err);
                    setMonthlyGoal(null);
                    setSuggestedWeeklyMeta(0);
                    setSuggestedWeeklySuperMeta(0);
                }
            } else {
                setMonthlyGoal(null);
                setSuggestedWeeklyMeta(0);
                setSuggestedWeeklySuperMeta(0);
            }

            let storeColabs: Colaboradora[] = [];
            try {
                const { data: directColabs, error: directError } = await supabase
                    .schema("sistemaretiradas")
                    .from("profiles")
                    .select("id, name, store_id")
                    .eq("role", "COLABORADORA")
                    .eq("active", true)
                    .eq("store_id", selectedStore);
                
                if (directError) {
                    console.error('[loadSuggestions] Erro ao buscar colaboradoras:', directError);
                    setColaboradorasAtivas([]);
                    setLoadingSuggestions(false);
                    return;
                }
                
                if (directColabs && directColabs.length > 0) {
                    storeColabs = directColabs;
                    setColaboradoras(prev => {
                        const existingIds = new Set(prev.map(c => c.id));
                        const newColabs = directColabs.filter(c => !existingIds.has(c.id));
                        return [...prev, ...newColabs];
                    });
                } else {
                    setColaboradorasAtivas([]);
                    setLoadingSuggestions(false);
                    return;
                }
            } catch (err: any) {
                console.error('[loadSuggestions] Erro ao buscar colaboradoras:', err);
                setColaboradorasAtivas([]);
                setLoadingSuggestions(false);
                return;
            }
            
            let existingColabIds = new Set<string>();
            if (selectedWeek) {
                try {
                    const { data: existingGoals } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .select("colaboradora_id")
                        .eq("store_id", selectedStore)
                        .eq("semana_referencia", selectedWeek)
                        .eq("tipo", "SEMANAL");

                    if (existingGoals) {
                        existingColabIds = new Set(existingGoals.filter(g => g.colaboradora_id).map(g => g.colaboradora_id));
                    }
                } catch (err) {
                    console.error("Error checking existing goals:", err);
                }
            }

            const newColabs = storeColabs.map(c => {
                const wasActive = colaboradorasAtivas.find(ca => ca.id === c.id)?.active;
                const shouldBeActive = wasActive !== undefined ? wasActive : (existingColabIds.has(c.id) || true);
                return {
                    id: c.id,
                    name: c.name || "Sem nome",
                    active: shouldBeActive
                };
            });
            
            setColaboradorasAtivas(newColabs);
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
            toast.error("Selecione pelo menos uma colaboradora para receber a gincana semanal");
            return;
        }

        if (suggestedWeeklyMeta === 0 || suggestedWeeklySuperMeta === 0) {
            toast.error("Calcule as sugestões primeiro (selecione loja e semana)");
            return;
        }

        handleSaveWeeklyGoals(activeColabs.map(c => ({
            id: c.id,
            meta: suggestedWeeklyMeta,
            superMeta: suggestedWeeklySuperMeta
        })));
    };

    const handleStartCustomizing = () => {
        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        if (activeColabs.length === 0) {
            toast.error("Selecione pelo menos uma colaboradora para receber a gincana semanal");
            return;
        }

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
            toast.error("Selecione pelo menos uma colaboradora para receber a gincana semanal");
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

    const updateIndividualMeta = (colabId: string, type: 'meta' | 'superMeta', value: string) => {
        setCustomMetasIndividuais(prev => {
            const existing = prev.find(c => c.id === colabId);
            if (existing) {
                return prev.map(c => 
                    c.id === colabId 
                        ? { ...c, [type]: parseFloat(value) || 0 }
                        : c
                );
            } else {
                return [...prev, { id: colabId, meta: 0, superMeta: 0, [type]: parseFloat(value) || 0 }];
            }
        });
    };

    const applyEqualToAll = () => {
        if (!customMetaEqual || !customSuperMetaEqual) {
            toast.error("Preencha os valores de meta e super meta primeiro");
            return;
        }

        const metaValue = parseFloat(customMetaEqual);
        const superMetaValue = parseFloat(customSuperMetaEqual);

        if (isNaN(metaValue) || isNaN(superMetaValue)) {
            toast.error("Valores inválidos");
            return;
        }

        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        setCustomMetasIndividuais(activeColabs.map(c => ({
            id: c.id,
            meta: metaValue,
            superMeta: superMetaValue
        })));
    };

    const handleApplyIndividualMetas = () => {
        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        if (activeColabs.length === 0) {
            toast.error("Selecione pelo menos uma colaboradora para receber a gincana semanal");
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

    const createBonusForWeeklyGincana = async (storeId: string, semanaReferencia: string, selectedColabIds: string[]) => {
        try {
            const weekRange = getWeekRange(semanaReferencia);
            const weekStartStr = format(weekRange.start, "dd/MM/yyyy");
            const weekEndStr = format(weekRange.end, "dd/MM/yyyy");
            
            const { data: store } = await supabase
                .schema("sistemaretiradas")
                .from("stores")
                .select("name")
                .eq("id", storeId)
                .single();
            
            const storeName = store?.name || "Loja";
            
            // Usar as colaboradoras selecionadas passadas como parâmetro
            const activeColabIds = selectedColabIds;
            
            const { data: existingBonus } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .select("id")
                .eq("store_id", storeId)
                .eq("periodo_semana", semanaReferencia)
                .eq("condicao_meta_tipo", "GINCANA_SEMANAL")
                .maybeSingle();
            
            if (existingBonus) {
                const valorBonus1 = isPremioFisicoCheckpoint1 ? null : (premioCheckpoint1 ? parseFloat(premioCheckpoint1) : 0);
                const valorBonusTexto1 = isPremioFisicoCheckpoint1 ? premioCheckpoint1 : null;
                const valorBonusFinal = isPremioFisicoCheckpointFinal ? null : (premioCheckpointFinal ? parseFloat(premioCheckpointFinal) : 0);
                const valorBonusTextoFinal = isPremioFisicoCheckpointFinal ? premioCheckpointFinal : null;
                
                await supabase
                    .schema("sistemaretiradas")
                    .from("bonuses")
                    .update({
                        valor_bonus: valorBonus1,
                        valor_bonus_texto: valorBonusTexto1,
                        descricao_premio: isPremioFisicoCheckpoint1 ? premioCheckpoint1 : null
                    })
                    .eq("id", existingBonus.id);
                
                // Atualizar colaboradoras vinculadas
                await supabase
                    .schema("sistemaretiradas")
                    .from("bonus_collaborators")
                    .delete()
                    .eq("bonus_id", existingBonus.id);
                
                if (activeColabIds.length > 0) {
                    const collaboratorsPayload = activeColabIds.map(colabId => ({
                        bonus_id: existingBonus.id,
                        colaboradora_id: colabId,
                        active: true
                    }));
                    await supabase
                        .schema("sistemaretiradas")
                        .from("bonus_collaborators")
                        .insert(collaboratorsPayload);
                }
                
                const { data: existingSuperBonus } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonuses")
                    .select("id")
                    .eq("store_id", storeId)
                    .eq("periodo_semana", semanaReferencia)
                    .eq("condicao_meta_tipo", "SUPER_GINCANA_SEMANAL")
                    .maybeSingle();
                
                if (existingSuperBonus) {
                    await supabase
                        .schema("sistemaretiradas")
                        .from("bonuses")
                        .update({
                            valor_bonus: valorBonusFinal,
                            valor_bonus_texto: valorBonusTextoFinal,
                            descricao_premio: isPremioFisicoCheckpointFinal ? premioCheckpointFinal : null
                        })
                        .eq("id", existingSuperBonus.id);
                    
                    // Atualizar colaboradoras vinculadas
                    await supabase
                        .schema("sistemaretiradas")
                        .from("bonus_collaborators")
                        .delete()
                        .eq("bonus_id", existingSuperBonus.id);
                    
                    if (activeColabIds.length > 0) {
                        const collaboratorsPayload = activeColabIds.map(colabId => ({
                            bonus_id: existingSuperBonus.id,
                            colaboradora_id: colabId,
                            active: true
                        }));
                        await supabase
                            .schema("sistemaretiradas")
                            .from("bonus_collaborators")
                            .insert(collaboratorsPayload);
                    }
                }
                
                return;
            }
            
            const valorBonus1 = isPremioFisicoCheckpoint1 ? null : (premioCheckpoint1 ? parseFloat(premioCheckpoint1) : 0);
            const valorBonusTexto1 = isPremioFisicoCheckpoint1 ? premioCheckpoint1 : null;
            const valorBonusFinal = isPremioFisicoCheckpointFinal ? null : (premioCheckpointFinal ? parseFloat(premioCheckpointFinal) : 0);
            const valorBonusTextoFinal = isPremioFisicoCheckpointFinal ? premioCheckpointFinal : null;
            
            const bonusGincanaPayload: any = {
                nome: `🎯 Gincana Semanal ${storeName} - ${weekStartStr} a ${weekEndStr}`,
                descricao: `Gincana semanal de ${storeName}. Atingir 100% da meta de faturamento da gincana semanal para ganhar o prêmio.`,
                tipo: "VALOR_FIXO",
                tipo_condicao: null,
                meta_minima_percentual: 100,
                vendas_minimas: null,
                valor_bonus: valorBonus1,
                descricao_premio: isPremioFisicoCheckpoint1 ? premioCheckpoint1 : null,
                valor_bonus_texto: valorBonusTexto1,
                valor_bonus_1: null,
                valor_bonus_2: null,
                valor_bonus_3: null,
                valor_bonus_texto_1: null,
                valor_bonus_texto_2: null,
                valor_bonus_texto_3: null,
                valor_condicao: null,
                ativo: true,
                store_id: storeId,
                // Campos obrigatórios para exibição correta no formulário
                // Métrica: FATURAMENTO (obrigatório para gincana semanal)
                condicao_tipo: "FATURAMENTO",
                // Ranking: "TODAS" (todas que atingirem ganham)
                condicao_ranking: "TODAS",
                // Identificador de gincana semanal
                condicao_meta_tipo: "GINCANA_SEMANAL",
                condicao_escopo: "INDIVIDUAL",
                condicao_faturamento: null,
                // Período de referência (obrigatório)
                periodo_tipo: "SEMANAL",
                periodo_data_inicio: format(weekRange.start, "yyyy-MM-dd"),
                periodo_data_fim: format(weekRange.end, "yyyy-MM-dd"),
                periodo_mes: null,
                periodo_semana: semanaReferencia,
                pre_requisitos: JSON.stringify(["Loja bateu meta mensal"]),
                enviar_notificacao_gincana: false, // Desativar para evitar envio duplicado - vamos enviar mensagem única consolidada
            };
            
            const { data: bonusGincana, error: errorGincana } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .insert([bonusGincanaPayload])
                .select()
                .single();
            
            if (errorGincana) {
                console.error(`[createBonusForWeeklyGincana] Erro ao criar bônus de gincana:`, errorGincana);
            } else if (bonusGincana && activeColabIds.length > 0) {
                // Vincular colaboradoras ativas ao bônus
                const collaboratorsPayload = activeColabIds.map(colabId => ({
                    bonus_id: bonusGincana.id,
                    colaboradora_id: colabId,
                    active: true
                }));
                await supabase
                    .schema("sistemaretiradas")
                    .from("bonus_collaborators")
                    .insert(collaboratorsPayload);
            }
            
            const bonusSuperGincanaPayload = {
                ...bonusGincanaPayload,
                nome: `🏆 Super Gincana Semanal ${storeName} - ${weekStartStr} a ${weekEndStr}`,
                descricao: `Super gincana semanal de ${storeName}. Atingir 100% da super meta de faturamento da gincana semanal para ganhar o prêmio.`,
                condicao_tipo: "FATURAMENTO", // Métrica: FATURAMENTO (obrigatório)
                condicao_meta_tipo: "SUPER_GINCANA_SEMANAL",
                valor_bonus: valorBonusFinal,
                descricao_premio: isPremioFisicoCheckpointFinal ? premioCheckpointFinal : null,
                valor_bonus_texto: valorBonusTextoFinal,
            };
            
            const { data: bonusSuperGincana, error: errorSuperGincana } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .insert([bonusSuperGincanaPayload])
                .select()
                .single();
            
            if (errorSuperGincana) {
                console.error(`[createBonusForWeeklyGincana] Erro ao criar bônus de super gincana:`, errorSuperGincana);
            } else if (bonusSuperGincana && activeColabIds.length > 0) {
                // Vincular colaboradoras ativas ao bônus
                const collaboratorsPayload = activeColabIds.map(colabId => ({
                    bonus_id: bonusSuperGincana.id,
                    colaboradora_id: colabId,
                    active: true
                }));
                await supabase
                    .schema("sistemaretiradas")
                    .from("bonus_collaborators")
                    .insert(collaboratorsPayload);
            }
            
            // Enviar UMA mensagem consolidada para as colaboradoras (apenas se criou novos bônus)
            if (!existingBonus && activeColabIds.length > 0 && bonusGincana) {
                // Buscar dados das colaboradoras (nome e telefone)
                const { data: colaboradorasData } = await supabase
                    .schema("sistemaretiradas")
                    .from("profiles")
                    .select("id, name, whatsapp")
                    .in("id", activeColabIds)
                    .eq("role", "COLABORADORA");
                
                if (colaboradorasData && colaboradorasData.length > 0) {
                    // Buscar metas da gincana para cada colaboradora
                    const { data: metasData } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .select("colaboradora_id, meta_valor, super_meta_valor")
                        .eq("store_id", storeId)
                        .eq("semana_referencia", semanaReferencia)
                        .eq("tipo", "SEMANAL")
                        .in("colaboradora_id", activeColabIds);
                    
                    // Criar mapa de metas por colaboradora
                    const metasMap = new Map<string, { meta: number; superMeta: number | null }>();
                    metasData?.forEach((meta: any) => {
                        metasMap.set(meta.colaboradora_id, {
                            meta: parseFloat(meta.meta_valor || 0),
                            superMeta: meta.super_meta_valor ? parseFloat(meta.super_meta_valor) : null
                        });
                    });
                    
                    // Formatar prêmios
                    const premioCheckpoint1Str = valorBonusTexto1 || (valorBonus1 && valorBonus1 > 0 ? formatBRL(valorBonus1) : null);
                    const premioCheckpointFinalStr = valorBonusTextoFinal || (valorBonusFinal && valorBonusFinal > 0 ? formatBRL(valorBonusFinal) : null);
                    
                    // Enviar UMA mensagem consolidada para cada colaboradora
                    colaboradorasData.forEach((colab) => {
                        const metaData = metasMap.get(colab.id);
                        if (!metaData) return;
                        
                        // Normalizar telefone
                        let telefone = colab.whatsapp;
                        if (!telefone || telefone.trim() === '') {
                            console.warn(`[createBonusForWeeklyGincana] Colaboradora ${colab.name} não tem WhatsApp cadastrado`);
                            return;
                        }
                        
                        // Remover caracteres não numéricos
                        telefone = telefone.replace(/\D/g, '');
                        
                        // Garantir DDI 55 (Brasil)
                        if (!telefone.startsWith('55')) {
                            telefone = '55' + telefone;
                        }
                        
                        // Enviar mensagem em background (não bloqueia)
                        (async () => {
                            try {
                                const { sendWhatsAppMessage, formatGincanaMessage } = await loadWhatsAppFunctions();
                                
                                // Formatar mensagem consolidada
                                const message = formatGincanaMessage({
                                    colaboradoraName: colab.name,
                                    storeName: storeName,
                                    semanaReferencia: semanaReferencia,
                                    metaValor: metaData.meta,
                                    superMetaValor: metaData.superMeta,
                                    dataInicio: weekStartStr,
                                    dataFim: weekEndStr,
                                    premioCheckpoint1: premioCheckpoint1Str,
                                    premioCheckpointFinal: premioCheckpointFinalStr
                                });
                                
                                console.log(`[createBonusForWeeklyGincana] 📱 Enviando WhatsApp consolidado para ${colab.name} (${telefone})...`);
                                const result = await sendWhatsAppMessage({
                                    phone: telefone,
                                    message: message,
                                    store_id: selectedStore || undefined, // Multi-tenancy: usar WhatsApp da loja se configurado
                                });
                                
                                if (result.success) {
                                    console.log(`[createBonusForWeeklyGincana] ✅ Mensagem consolidada enviada com sucesso para ${colab.name}`);
                                } else {
                                    console.error(`[createBonusForWeeklyGincana] ❌ Erro ao enviar mensagem consolidada para ${colab.name}:`, result.error);
                                }
                            } catch (error: any) {
                                console.error(`[createBonusForWeeklyGincana] ❌ Erro ao enviar WhatsApp consolidado para ${colab.name}:`, error);
                            }
                        })();
                    });
                }
            }
        } catch (err) {
            console.error(`[createBonusForWeeklyGincana] Erro ao criar bônus:`, err);
        }
    };

    const handleDeleteWeeklyGoals = async () => {
        if (!selectedStore || !selectedWeek) {
            toast.error("Selecione uma loja e uma semana primeiro");
            return;
        }

        try {
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .delete()
                .eq("store_id", selectedStore)
                .eq("semana_referencia", selectedWeek)
                .eq("tipo", "SEMANAL");

            if (error) throw error;

            toast.success("Gincanas semanais excluídas com sucesso!");
            setWeeklyDialogOpen(false);
            resetWeeklyForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error deleting weekly goals:", err);
            toast.error(err.message || "Erro ao excluir gincanas semanais");
        }
    };

    const prepareWeeklyGoalsData = (): { id: string; meta: number; superMeta: number }[] => {
        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        
        if (activeColabs.length === 0) {
            return [];
        }

        // Se está personalizando e tem metas individuais definidas, usar elas
        if (customizingGoals && customMetasIndividuais.length > 0) {
            return activeColabs.map(colab => {
                const customMeta = customMetasIndividuais.find(cm => cm.id === colab.id);
                if (customMeta && (customMeta.meta > 0 || customMeta.superMeta > 0)) {
                    return {
                        id: colab.id,
                        meta: customMeta.meta,
                        superMeta: customMeta.superMeta
                    };
                }
                // Se não tem meta individual, usar valores iguais se existirem
                if (customMetaEqual && customSuperMetaEqual) {
                    return {
                        id: colab.id,
                        meta: parseFloat(customMetaEqual) || 0,
                        superMeta: parseFloat(customSuperMetaEqual) || 0
                    };
                }
                // Fallback para sugestões
                return {
                    id: colab.id,
                    meta: suggestedWeeklyMeta || 0,
                    superMeta: suggestedWeeklySuperMeta || 0
                };
            }).filter(c => c.meta > 0 || c.superMeta > 0);
        }

        // Se está personalizando mas não tem individuais, usar valores iguais
        if (customizingGoals && customMetaEqual && customSuperMetaEqual) {
            const metaValue = parseFloat(customMetaEqual) || 0;
            const superMetaValue = parseFloat(customSuperMetaEqual) || 0;
            if (metaValue > 0 || superMetaValue > 0) {
                return activeColabs.map(colab => ({
                    id: colab.id,
                    meta: metaValue,
                    superMeta: superMetaValue
                }));
            }
        }

        // Senão, usar sugestões
        if (suggestedWeeklyMeta > 0 || suggestedWeeklySuperMeta > 0) {
            return activeColabs.map(colab => ({
                id: colab.id,
                meta: suggestedWeeklyMeta,
                superMeta: suggestedWeeklySuperMeta
            }));
        }

        return [];
    };

    const handleSaveWeeklyGoal = async () => {
        if (!selectedStore || !selectedWeek) {
            toast.error("Selecione uma loja e uma semana");
            return;
        }

        const activeColabs = colaboradorasAtivas.filter(c => c.active);
        if (activeColabs.length === 0) {
            toast.error("Selecione pelo menos uma colaboradora para receber a gincana semanal");
            return;
        }

        const colabsWithGoals = prepareWeeklyGoalsData();
        
        if (colabsWithGoals.length === 0) {
            toast.error("Defina as metas para as colaboradoras. Use as sugestões ou personalize as metas.");
            return;
        }

        if (selectedWeek.length !== 6 || !/^\d{6}$/.test(selectedWeek)) {
            toast.error("Formato de semana inválido");
            return;
        }

        setSavingWeeklyGoal(true);

        try {
            const payloads = colabsWithGoals.map(colab => ({
                store_id: selectedStore,
                semana_referencia: selectedWeek,
                tipo: "SEMANAL",
                meta_valor: colab.meta,
                super_meta_valor: colab.superMeta,
                colaboradora_id: colab.id,
                ativo: true,
                mes_referencia: null,
            }));

            const { error: deleteError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .delete()
                .eq("store_id", selectedStore)
                .eq("semana_referencia", selectedWeek)
                .eq("tipo", "SEMANAL");

            if (deleteError) throw deleteError;

            const { error: insertError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .insert(payloads);

            if (insertError) throw insertError;

            // Extrair IDs das colaboradoras que têm metas definidas (são as selecionadas)
            const selectedColabIds = colabsWithGoals.map(c => c.id);
            await createBonusForWeeklyGincana(selectedStore, selectedWeek, selectedColabIds);

            toast.success("Gincana semanal salva com sucesso!");
            setWeeklyDialogOpen(false);
            resetWeeklyForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error saving weekly goals:", err);
            toast.error(err.message || "Erro ao salvar gincana semanal");
        } finally {
            setSavingWeeklyGoal(false);
        }
    };

    const handleSaveWeeklyGoals = async (colabsWithGoals: { id: string; meta: number; superMeta: number }[]) => {
        // Função mantida para compatibilidade, mas não deve ser usada diretamente
        // Use handleSaveWeeklyGoal() que prepara os dados automaticamente
        if (!selectedStore || !selectedWeek || colabsWithGoals.length === 0) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        if (selectedWeek.length !== 6 || !/^\d{6}$/.test(selectedWeek)) {
            toast.error("Formato de semana inválido");
            return;
        }

        setSavingWeeklyGoal(true);

        try {
            const payloads = colabsWithGoals.map(colab => ({
                store_id: selectedStore,
                semana_referencia: selectedWeek,
                tipo: "SEMANAL",
                meta_valor: colab.meta,
                super_meta_valor: colab.superMeta,
                colaboradora_id: colab.id,
                ativo: true,
                mes_referencia: null,
            }));

            const { error: deleteError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .delete()
                .eq("store_id", selectedStore)
                .eq("semana_referencia", selectedWeek)
                .eq("tipo", "SEMANAL");

            if (deleteError) throw deleteError;

            const { error: insertError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .insert(payloads);

            if (insertError) throw insertError;

            // Extrair IDs das colaboradoras que têm metas definidas (são as selecionadas)
            const selectedColabIds = colabsWithGoals.map(c => c.id);
            await createBonusForWeeklyGincana(selectedStore, selectedWeek, selectedColabIds);

            toast.success("Gincana semanal criada com sucesso!");
            setWeeklyDialogOpen(false);
            resetWeeklyForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error saving weekly goals:", err);
            toast.error(err.message || "Erro ao salvar gincana semanal");
        } finally {
            setSavingWeeklyGoal(false);
        }
    };

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

    useEffect(() => {
        if (weeklyDialogOpen && selectedStore && selectedWeek) {
            loadSuggestions();
        }
    }, [selectedWeek, selectedStore, weeklyDialogOpen]);

    // Recalcular sugestões quando o número de colaboradoras ativas mudar
    useEffect(() => {
        const recalculate = async () => {
            if (weeklyDialogOpen && selectedStore && selectedWeek && monthlyGoal) {
                const activeColabsCount = colaboradorasAtivas.filter(c => c.active).length;
                
                if (activeColabsCount === 0) {
                    setSuggestedWeeklyMeta(0);
                    setSuggestedWeeklySuperMeta(0);
                    return;
                }
                
                try {
                    const weekRange = getWeekRange(selectedWeek);
                    const startMonth = { year: weekRange.start.getFullYear(), month: weekRange.start.getMonth() };
                    const endMonth = { year: weekRange.end.getFullYear(), month: weekRange.end.getMonth() };
                    const semanaCruzaMeses = startMonth.year !== endMonth.year || startMonth.month !== endMonth.month;
                    
                    const dailyWeights = monthlyGoal.daily_weights || {};
                    let weeklyMetaTotal = 0;
                    let weeklySuperMetaTotal = 0;
                    
                    if (semanaCruzaMeses) {
                        // Se cruza meses, buscar o segundo mês também
                        const monthRefStart = format(weekRange.start, "yyyyMM");
                        const monthRefEnd = format(weekRange.end, "yyyyMM");
                        
                        const { data: monthlyStoreGoalEnd } = await supabase
                            .schema("sistemaretiradas")
                            .from("goals")
                            .select("meta_valor, super_meta_valor, daily_weights")
                            .eq("store_id", selectedStore)
                            .eq("tipo", "MENSAL")
                            .eq("mes_referencia", monthRefEnd)
                            .is("colaboradora_id", null)
                            .single();
                        
                        if (monthlyStoreGoalEnd) {
                            let parsedDailyWeightsEnd: Record<string, number> = {};
                            if (monthlyStoreGoalEnd.daily_weights) {
                                if (typeof monthlyStoreGoalEnd.daily_weights === 'string') {
                                    try {
                                        parsedDailyWeightsEnd = JSON.parse(monthlyStoreGoalEnd.daily_weights);
                                    } catch (e) {
                                        console.error('[useEffect] Erro ao parsear daily_weights do segundo mês:', e);
                                    }
                                } else if (typeof monthlyStoreGoalEnd.daily_weights === 'object') {
                                    parsedDailyWeightsEnd = monthlyStoreGoalEnd.daily_weights as Record<string, number>;
                                }
                            }
                            
                            const metaMes1 = calculateWeeklyGoalFromMonthlyHelper(monthlyGoal.meta_valor, dailyWeights, weekRange, startMonth);
                            const superMetaMes1 = calculateWeeklyGoalFromMonthlyHelper(monthlyGoal.super_meta_valor, dailyWeights, weekRange, startMonth);
                            const metaMes2 = calculateWeeklyGoalFromMonthlyHelper(monthlyStoreGoalEnd.meta_valor, parsedDailyWeightsEnd, weekRange, endMonth);
                            const superMetaMes2 = calculateWeeklyGoalFromMonthlyHelper(monthlyStoreGoalEnd.super_meta_valor, parsedDailyWeightsEnd, weekRange, endMonth);
                            
                            weeklyMetaTotal = metaMes1 + metaMes2;
                            weeklySuperMetaTotal = superMetaMes1 + superMetaMes2;
                        } else {
                            // Se não encontrou o segundo mês, usar apenas o primeiro
                            weeklyMetaTotal = calculateWeeklyGoalFromMonthlyHelper(monthlyGoal.meta_valor, dailyWeights, weekRange, startMonth);
                            weeklySuperMetaTotal = calculateWeeklyGoalFromMonthlyHelper(monthlyGoal.super_meta_valor, dailyWeights, weekRange, startMonth);
                        }
                    } else {
                        weeklyMetaTotal = calculateWeeklyGoalFromMonthlyHelper(monthlyGoal.meta_valor, dailyWeights, weekRange, startMonth);
                        weeklySuperMetaTotal = calculateWeeklyGoalFromMonthlyHelper(monthlyGoal.super_meta_valor, dailyWeights, weekRange, startMonth);
                    }
                    
                    // Dividir pelo número de colaboradoras ATIVAS (com switch ligado)
                    const weeklyMeta = activeColabsCount > 0 ? weeklyMetaTotal / activeColabsCount : weeklyMetaTotal;
                    const weeklySuperMeta = activeColabsCount > 0 ? weeklySuperMetaTotal / activeColabsCount : weeklySuperMetaTotal;

                    setSuggestedWeeklyMeta(parseFloat(weeklyMeta.toFixed(2)));
                    setSuggestedWeeklySuperMeta(parseFloat(weeklySuperMeta.toFixed(2)));
                } catch (err) {
                    console.error("[useEffect] Erro ao recalcular sugestões:", err);
                }
            }
        };
        
        recalculate();
    }, [colaboradorasAtivas, weeklyDialogOpen, selectedStore, selectedWeek, monthlyGoal]);

    // ✅ Recalcular pesos automaticamente quando o mês ou loja mudar (apenas para novas distribuições)
    useEffect(() => {
        // Apenas gerar pesos automaticamente se:
        // 1. Loja estiver selecionada
        // 2. Mês estiver no formato correto (YYYYMM)
        // 3. NÃO estiver editando uma meta existente (para preservar pesos salvos durante edição)
        // 4. Dialog estiver aberto (para evitar gerar quando não está no formulário)
        if (selectedStore && mesReferencia && mesReferencia.length === 6 && dialogOpen && !editingGoal) {
            const year = parseInt(mesReferencia.substring(0, 4));
            const monthStr = mesReferencia.substring(4, 6);
            const month = parseInt(monthStr) - 1;

            // Validar formato do mês
            if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11) {
                // Pequeno delay para evitar múltiplas chamadas rápidas
                const timeoutId = setTimeout(() => {
                    generateWeights();
                }, 100);

                return () => clearTimeout(timeoutId);
            }
        }
    }, [mesReferencia, selectedStore, dialogOpen]);

    const fetchGoals = async () => {
        try {
            const { data, error } = await supabase
                .schema("sistemaretiradas")
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

    // Função auxiliar para ordenar semana_referencia (formato WWYYYY)
    const sortWeekRef = (a: string, b: string): number => {
        // Suporta ambos os formatos para migração
        const parseWeekRef = (ref: string): { year: number; week: number } => {
            if (ref.length !== 6) return { year: 0, week: 0 };
            
            const firstTwo = parseInt(ref.substring(0, 2));
            if (firstTwo > 50) {
                // Formato antigo YYYYWW
                return {
                    year: parseInt(ref.substring(0, 4)),
                    week: parseInt(ref.substring(4, 6))
                };
            } else {
                // Formato novo WWYYYY
                return {
                    year: parseInt(ref.substring(2, 6)),
                    week: parseInt(ref.substring(0, 2))
                };
            }
        };
        
        const aParsed = parseWeekRef(a);
        const bParsed = parseWeekRef(b);
        
        // Ordenar por ano primeiro, depois por semana
        if (aParsed.year !== bParsed.year) {
            return bParsed.year - aParsed.year; // Mais recente primeiro
        }
        return bParsed.week - aParsed.week; // Semana mais recente primeiro
    };

    const fetchWeeklyGoals = async () => {
        try {
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select(`*, stores (name)`)
                .eq("tipo", "SEMANAL")
                .limit(500); // Limitar para performance

            if (error) throw error;
            if (data) {
                // Agrupar por loja e ordenar: por loja (alfabética), depois por semana (mais recente primeiro)
                const groupedByStore = new Map<string, any[]>();
                
                data.forEach((goal: any) => {
                    const storeId = goal.store_id || 'unknown';
                    if (!groupedByStore.has(storeId)) {
                        groupedByStore.set(storeId, []);
                    }
                    groupedByStore.get(storeId)!.push(goal);
                });
                
                // Ordenar cada grupo por semana (mais recente primeiro)
                groupedByStore.forEach((goals, storeId) => {
                    goals.sort((a: any, b: any) =>
                    sortWeekRef(a.semana_referencia || "", b.semana_referencia || "")
                );
                });
                
                // Ordenar lojas alfabeticamente e juntar tudo
                const sortedStores = Array.from(groupedByStore.keys()).sort();
                const sorted: any[] = [];
                
                sortedStores.forEach(storeId => {
                    sorted.push(...groupedByStore.get(storeId)!);
                });
                
                setWeeklyGoals(sorted as any);
            }
        } catch (err) {
            console.error("Error fetching weekly goals:", err);
            toast.error("Erro ao carregar gincanas semanais");
        }
    };

    const fetchStores = async () => {
        const { data } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("*")
            .eq("active", true);
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

    // Function to complete weights for all days in month (fill missing days)
    const completeWeightsForMonth = (existingWeights: Record<string, number>, monthRef: string): Record<string, number> => {
        const year = parseInt(monthRef.substring(0, 4));
        const month = parseInt(monthRef.substring(4, 6)) - 1;
        const daysInMonth = getDaysInMonth(new Date(year, month));
        const completed: Record<string, number> = { ...existingWeights };

        // Add missing days with weight 0
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = format(date, "yyyy-MM-dd");
            if (!completed[dateStr]) {
                completed[dateStr] = 0;
            }
        }

        return completed;
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
            superMeta: 0,
            recebeMeta: true // Por padrão, todas recebem meta
        })));

        generateWeights();
    };

    const distributeGoals = () => {
        if (!metaLoja || !superMetaLoja) return;

        const meta = parseFloat(metaLoja);
        const superMeta = parseFloat(superMetaLoja);
        // Contar apenas colaboradoras que recebem meta
        const count = colabGoals.filter(c => c.recebeMeta).length;

        if (count === 0) {
            toast.error("Nenhuma colaboradora marcada para receber meta!");
            return;
        }

        const individualMeta = meta / count;
        const individualSuperMeta = superMeta / count;

        setColabGoals(colabGoals.map(c => {
            // Só distribuir para colaboradoras que recebem meta
            if (!c.recebeMeta) {
                return { ...c, meta: 0, superMeta: 0 };
            }
            return {
            ...c,
            meta: parseFloat(individualMeta.toFixed(2)),
            superMeta: parseFloat(individualSuperMeta.toFixed(2))
            };
        }));
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

    const handleToggleRecebeMeta = (id: string, recebeMeta: boolean) => {
        setColabGoals(prev => prev.map(c => {
            if (c.id !== id) return c;
            // Se desativar, zerar as metas
            if (!recebeMeta) {
                return { ...c, recebeMeta: false, meta: 0, superMeta: 0 };
            }
            return { ...c, recebeMeta: true };
        }));
    };

    const validateTotal = () => {
        // Considerar apenas colaboradoras que recebem meta
        const colabsComMeta = colabGoals.filter(c => c.recebeMeta);
        const totalMeta = colabsComMeta.reduce((sum, c) => sum + c.meta, 0);
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

            // 1. Verificar se meta da loja já existe
            const { data: existingStoreGoal } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("id")
                .eq("store_id", selectedStore)
                .eq("mes_referencia", mesReferencia)
                .eq("tipo", "MENSAL")
                .is("colaboradora_id", null)
                .maybeSingle();

            let storeGoalData;
            if (existingStoreGoal) {
                // UPDATE - Se existe, atualizar
                const { data, error } = await supabase
                    .schema("sistemaretiradas")
                    .from("goals")
                    .update(storePayload)
                    .eq("id", existingStoreGoal.id)
                .select()
                .single();
                if (error) {
                    console.error("Erro ao atualizar meta da loja:", error);
                    throw error;
                }
                storeGoalData = data;
            } else {
                // INSERT - Se não existe, criar
                const { data, error } = await supabase
                    .schema("sistemaretiradas")
                    .from("goals")
                    .insert(storePayload)
                    .select()
                    .single();
                if (error) {
                    console.error("Erro ao criar meta da loja:", error);
                    throw error;
                }
                storeGoalData = data;
            }

            // 2. Create/Update Individual Goals - APENAS para colaboradoras que recebem meta
            const individualPayloads = colabGoals
                .filter(c => c.recebeMeta) // Filtrar apenas as que recebem meta
                .map(c => ({
                tipo: "INDIVIDUAL",
                mes_referencia: mesReferencia,
                store_id: selectedStore,
                colaboradora_id: c.id,
                meta_valor: c.meta,
                super_meta_valor: c.superMeta,
                ativo: true,
                daily_weights: dailyWeights // Inherit weights
            }));

            // Para metas individuais, fazer UPDATE ou INSERT individualmente
            for (const payload of individualPayloads) {
                const { data: existingGoal } = await supabase
                    .schema("sistemaretiradas")
                .from("goals")
                    .select("id")
                    .eq("store_id", payload.store_id)
                    .eq("mes_referencia", payload.mes_referencia)
                    .eq("tipo", payload.tipo)
                    .eq("colaboradora_id", payload.colaboradora_id)
                    .maybeSingle();

                if (existingGoal) {
                    // UPDATE - Se existe, atualizar
                    const { error } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .update(payload)
                        .eq("id", existingGoal.id);
                    if (error) {
                        console.error(`Erro ao atualizar meta individual para colaboradora ${payload.colaboradora_id}:`, error);
                        throw error;
                    }
                } else {
                    // INSERT - Se não existe, criar
                    const { error } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .insert(payload);
                    if (error) {
                        console.error(`Erro ao criar meta individual para colaboradora ${payload.colaboradora_id}:`, error);
                        throw error;
                    }
                }
            }

            // 3. Remover metas de colaboradoras que não recebem mais meta
            const colabsSemMeta = colabGoals.filter(c => !c.recebeMeta);
            for (const colab of colabsSemMeta) {
                const { data: existingGoal } = await supabase
                    .schema("sistemaretiradas")
                    .from("goals")
                    .select("id")
                    .eq("store_id", selectedStore)
                    .eq("mes_referencia", mesReferencia)
                    .eq("tipo", "INDIVIDUAL")
                    .eq("colaboradora_id", colab.id)
                    .maybeSingle();

                if (existingGoal) {
                    // DELETE - Remover meta se existe
                    const { error } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .delete()
                        .eq("id", existingGoal.id);
                    if (error) {
                        console.error(`Erro ao remover meta individual para colaboradora ${colab.id}:`, error);
                        // Não lançar erro aqui, apenas logar
                    }
                }
            }

            toast.success("Metas criadas com sucesso!");
            setDialogOpen(false);
            setEditingGoal(null); // Limpar estado de edição
            fetchGoals();
        } catch (error: any) {
            toast.error("Erro ao salvar metas: " + error.message);
        }
    };

    const handleEdit = (storeId: string, month: string) => {
        if (!storeId) {
            toast.error("ID da loja não encontrado");
            return;
        }

        // 1. Find Store Goal (pode não existir se ainda não foi criada)
        const storeGoal = goals.find(g => g.store_id === storeId && g.mes_referencia === month && g.tipo === 'MENSAL');

        // 2. Find Individual Goals
        const individualGoals = goals.filter(g => g.store_id === storeId && g.mes_referencia === month && g.tipo === 'INDIVIDUAL');

        // 3. Populate State
        setSelectedStore(storeId);
        setMesReferencia(month);

        if (storeGoal) {
            // Editando meta existente
        setMetaLoja(storeGoal.meta_valor.toString());
        setSuperMetaLoja(storeGoal.super_meta_valor.toString());
            // Complete weights for all days in month (fix missing days like day 31)
            const completedWeights = completeWeightsForMonth(storeGoal.daily_weights || {}, month);
            setDailyWeights(completedWeights);
            // Marcar que estamos editando para não sobrescrever os pesos
            setEditingGoal(storeGoal);
        } else {
            // Criando nova meta (não existe meta MENSAL ainda)
            setMetaLoja("");
            setSuperMetaLoja("");
            setDailyWeights({});
            setEditingGoal(null);

            // Se há metas individuais, calcular total para sugerir
            if (individualGoals.length > 0) {
                const totalMeta = individualGoals.reduce((sum, g) => sum + g.meta_valor, 0);
                const totalSuper = individualGoals.reduce((sum, g) => sum + g.super_meta_valor, 0);
                setMetaLoja(totalMeta.toString());
                setSuperMetaLoja(totalSuper.toString());
            }
        }

        // 4. Map individual goals to colabGoals format
        // Load collaborators for the store, then merge with existing goals values
        const activeColabs = colaboradoras.filter(c => c.store_id === storeId);

        const mergedColabs = activeColabs.map(c => {
            const goal = individualGoals.find(g => g.colaboradora_id === c.id);
            return {
                id: c.id,
                name: c.name,
                meta: goal ? goal.meta_valor : 0,
                superMeta: goal ? goal.super_meta_valor : 0,
                recebeMeta: !!goal // Se tem meta, recebe meta
            };
        });

        setColabGoals(mergedColabs);
        setDialogOpen(true);
    };

    const handleDelete = async (storeId: string, month: string) => {
        // Confirmar exclusão
        if (!confirm(`Tem certeza que deseja excluir todas as metas mensais de ${month}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            // Buscar todas as metas (mensal e individuais) para esta loja e mês
            const { data: goalsToDelete } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("id")
                .eq("store_id", storeId)
                .eq("mes_referencia", month)
                .in("tipo", ["MENSAL", "INDIVIDUAL"]);

            if (!goalsToDelete || goalsToDelete.length === 0) {
                toast.error("Nenhuma meta encontrada para excluir");
                return;
            }

            // Deletar todas as metas
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .delete()
                .eq("store_id", storeId)
                .eq("mes_referencia", month)
                .in("tipo", ["MENSAL", "INDIVIDUAL"]);

            if (error) {
                console.error("Erro ao excluir metas:", error);
                throw error;
            }

            toast.success("Metas excluídas com sucesso!");
            fetchGoals(); // Recarregar lista
        } catch (error: any) {
            console.error("Erro ao excluir metas:", error);
            toast.error("Erro ao excluir metas: " + error.message);
        }
    };

    const getWeekOptions = () => {
        const options = [];
        const hoje = new Date();
        for (let i = -2; i <= 4; i++) {
            const weekDate = addWeeks(hoje, i);
            const monday = startOfWeek(weekDate, { weekStartsOn: 1 });
            const year = getYear(monday);
            const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
            const weekRef = `${String(week).padStart(2, '0')}${year}`;
            const weekRange = getWeekRange(weekRef);
            options.push({
                value: weekRef,
                label: `${format(weekRange.start, "dd/MM", { locale: ptBR })} - ${format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })} (Semana ${week})`
            });
        }
        return options;
    };

    const resetWeeklyForm = () => {
        setEditingWeeklyGoal(null);
        setSelectedStore("");
        setSelectedWeek(getCurrentWeekRef());
        setWeeklyMetaValor("");
        setWeeklySuperMetaValor("");
        setWeeklyColabGoals([]);
        setColaboradorasAtivas([]);
        setMonthlyGoal(null);
        setSuggestedWeeklyMeta(0);
        setSuggestedWeeklySuperMeta(0);
        setCustomizingGoals(false);
        setCustomMetaEqual("");
        setCustomSuperMetaEqual("");
        setCustomMetasIndividuais([]);
        setPremioCheckpoint1("");
        setPremioCheckpointFinal("");
        setIsPremioFisicoCheckpoint1(false);
        setIsPremioFisicoCheckpointFinal(false);
    };

    const handleEditWeekly = async (goal: Goal) => {
        setEditingWeeklyGoal(goal);
        setSelectedStore(goal.store_id || "");
        setSelectedWeek(goal.semana_referencia || getCurrentWeekRef());

        // Fetch all weekly goals for this store and week
        const { data: weeklyGoalsData } = await supabase
            .schema("sistemaretiradas")
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

        setWeeklyDialogOpen(true);
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



    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-3 sm:p-6 space-y-4 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0">
                        <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">Gerenciar Metas</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Defina metas por loja e distribua entre a equipe</p>
                    </div>
                </div>
                {activeTab === 'mensal' ? (
                    <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-xs sm:text-sm w-full sm:w-auto" size="sm">
                        <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Nova Distribuição Mensal</span>
                        <span className="sm:hidden">Nova Mensal</span>
                </Button>
                ) : (
                    <Button onClick={() => { resetWeeklyForm(); setWeeklyDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-xs sm:text-sm w-full sm:w-auto" size="sm">
                        <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Nova Gincana Semanal</span>
                        <span className="sm:hidden">Nova Gincana</span>
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mensal' | 'semanal')}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="mensal" className="text-xs sm:text-sm">
                        <span className="hidden sm:inline">Metas Mensais</span>
                        <span className="sm:hidden">Mensais</span>
                    </TabsTrigger>
                    <TabsTrigger value="semanal" className="text-xs sm:text-sm">
                        <span className="hidden sm:inline">Gincanas Semanais</span>
                        <span className="sm:hidden">Gincanas</span>
                    </TabsTrigger>
                </TabsList>

                {/* Mensal Tab */}
                <TabsContent value="mensal" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 bg-card p-3 sm:p-4 rounded-lg border shadow-sm">
                        <div className="w-full sm:w-48">
                            <Label className="text-xs sm:text-sm">Filtrar por Loja</Label>
                    <Select value={storeFilter} onValueChange={setStoreFilter}>
                                <SelectTrigger className="text-xs sm:text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas</SelectItem>
                                    {stores.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex items-center gap-2">
                                                <StoreLogo storeId={s.id} className="w-4 h-4 object-contain flex-shrink-0" />
                                                <span>{s.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                        </SelectContent>
                    </Select>
                </div>
                        <div className="w-full sm:w-48">
                            <Label className="text-xs sm:text-sm">Mês</Label>
                            <Input 
                                value={monthFilter} 
                                onChange={e => setMonthFilter(e.target.value)} 
                                placeholder="YYYYMM"
                                className="text-xs sm:text-sm"
                            />
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
                        <div className="p-3 sm:p-4 bg-muted/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 border-b">
                            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                                <StoreLogo storeId={group.storeGoal?.store_id || group.individuals[0]?.store_id} className="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-base sm:text-lg truncate">{group.store?.name || 'Loja Desconhecida'}</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground">Referência: {group.month}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
                                <div className="text-right flex-1 sm:flex-initial">
                                    <p className="text-xs text-muted-foreground hidden sm:block">Meta da Loja</p>
                                    <p className="font-bold text-sm sm:text-lg">R$ {group.storeGoal?.meta_valor?.toLocaleString('pt-BR') || '0,00'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => handleEdit(group.storeGoal?.store_id || group.individuals[0]?.store_id, group.month)} className="flex-shrink-0 text-xs sm:text-sm">
                                        <Edit className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">Editar</span>
                                    </Button>
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => handleDelete(group.storeGoal?.store_id || group.individuals[0]?.store_id, group.month)} 
                                        className="flex-shrink-0 text-xs sm:text-sm"
                                    >
                                        <Trash className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">Excluir</span>
                                </Button>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 sm:p-4 bg-card">
                            <h4 className="text-[10px] sm:text-xs font-semibold mb-3 text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                                <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                                Metas Individuais
                            </h4>
                            <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {group.individuals.map((ind: any) => (
                                    <div key={ind.id} className="flex justify-between items-center p-2 sm:p-3 rounded-lg border bg-background hover:bg-muted/20 transition-colors">
                                        <span className="font-medium text-xs sm:text-sm truncate flex-1 min-w-0 mr-2">{ind.profiles?.name}</span>
                                        <div className="text-right flex-shrink-0">
                                            <div className="font-bold text-xs sm:text-sm">R$ {ind.meta_valor.toLocaleString('pt-BR')}</div>
                                                    <div className="text-[10px] sm:text-xs text-primary/80 font-medium">Super: R$ {ind.super_meta_valor.toLocaleString('pt-BR')}</div>
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
                    {/* Weekly Goals List - Agrupado por Loja */}
                    <div className="space-y-6">
                        {Object.entries(
                            weeklyGoals.reduce((acc, goal) => {
                                const storeId = goal.store_id || 'unknown';
                                if (!acc[storeId]) {
                                    acc[storeId] = {
                                        store: goal.stores,
                                        semanas: {} as Record<string, any>
                                    };
                                }
                                
                                const semanaRef = goal.semana_referencia || '';
                                if (!acc[storeId].semanas[semanaRef]) {
                                    acc[storeId].semanas[semanaRef] = {
                                        semana_referencia: semanaRef,
                                        goals: []
                                    };
                                }
                                acc[storeId].semanas[semanaRef].goals.push(goal);
                                return acc;
                            }, {} as Record<string, any>)
                        )
                        .sort(([_, a]: [string, any], [__, b]: [string, any]) => {
                            // Ordenar lojas alfabeticamente
                            const nameA = a.store?.name || '';
                            const nameB = b.store?.name || '';
                            return nameA.localeCompare(nameB);
                        })
                        .map(([storeId, storeGroup]: [string, any]) => {
                            // Ordenar semanas dentro da loja (mais recentes primeiro)
                            const semanasOrdenadas = Object.entries(storeGroup.semanas)
                                .sort(([_, a]: [string, any], [__, b]: [string, any]) => {
                                    try {
                                        const rangeA = getWeekRange(a.semana_referencia || "");
                                        const rangeB = getWeekRange(b.semana_referencia || "");
                                        return rangeB.start.getTime() - rangeA.start.getTime();
                                    } catch {
                                        return 0;
                                    }
                                });
                            
                            return (
                                <div key={storeId} className="space-y-4">
                                    {/* Cabeçalho da Loja */}
                                    <div className="flex items-center gap-3 pb-2 border-b-2 border-primary/30">
                                        <StoreLogo storeId={storeId} className="w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0" />
                                        <h2 className="text-lg sm:text-xl font-bold text-primary">{storeGroup.store?.name || 'Loja Desconhecida'}</h2>
                                    </div>
                                    
                                    {/* Semanas da Loja */}
                                    <div className="space-y-3 pl-4 sm:pl-6">
                                        {semanasOrdenadas.map(([semanaKey, group]: [string, any]) => {
                            let weekRange;
                            try {
                                weekRange = getWeekRange(group.semana_referencia || "");
                            } catch (err: any) {
                                weekRange = { start: new Date(), end: new Date() };
                            }
                            const isCurrentWeek = group.semana_referencia === getCurrentWeekRef();
                            const totalMeta = group.goals.reduce((sum: number, g: any) => sum + g.meta_valor, 0);
                            const totalSuper = group.goals.reduce((sum: number, g: any) => sum + g.super_meta_valor, 0);
                                            const colabsCount = new Set(group.goals.map((g: any) => g.colaboradora_id).filter((id: any) => id != null)).size;
                            
                            return (
                                <Card 
                                                    key={semanaKey}
                                                    className={`overflow-hidden shadow-md hover:shadow-lg transition-all border-l-4 ${
                                                        isCurrentWeek 
                                                            ? 'border-l-primary bg-gradient-to-r from-primary/5 to-transparent' 
                                                            : 'border-l-primary/60 bg-gradient-to-r from-primary/5 to-transparent'
                                                    }`}
                                                >
                                                    <div className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b">
                                                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className="font-bold text-base sm:text-lg truncate">
                                                    {format(weekRange.start, "dd/MM", { locale: ptBR })} a {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                                                                </h3>
                                                                <p className="text-xs sm:text-sm text-muted-foreground">
                                                                    Semana {group.semana_referencia?.substring(0, 2)}/{group.semana_referencia?.substring(2, 6)}
                                                </p>
                                            </div>
                                            {isCurrentWeek && (
                                                <Badge className="bg-primary text-primary-foreground text-xs">Semana Atual</Badge>
                                            )}
                                        </div>
                                                        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                                            <div className="text-left sm:text-right flex-1 sm:flex-initial">
                                                                <p className="text-xs text-muted-foreground">Total ({colabsCount} colaboradora{colabsCount > 1 ? 's' : ''})</p>
                                                <p className="font-bold text-sm sm:text-lg text-primary">R$ {totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                <p className="text-xs text-primary/80 font-medium">Super: R$ {totalSuper.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => handleEditWeekly(group.goals[0])} className="flex-shrink-0">
                                                <Edit className="h-4 w-4 mr-1 sm:mr-2" />
                                                <span className="hidden sm:inline">Editar</span>
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        {weeklyGoals.length === 0 && (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="text-center text-muted-foreground py-8">
                                        Nenhuma gincana semanal cadastrada. Clique em "Nova Gincana Semanal" para começar.
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    
                    {/* Histórico Expandido de Gincanas Semanais */}
                    {weeklyGoals.length > 0 && stores.length > 0 && (
                        <div className="space-y-6 mt-8">
                            {stores.map((store) => {
                                const hasGoalsForStore = weeklyGoals.some(g => g.store_id === store.id);
                                if (!hasGoalsForStore) return null;
                                
                                return (
                                    <div key={store.id} className="space-y-4">
                                        <div className="flex items-center gap-3 pb-2 border-b-2 border-primary/30">
                                            <StoreLogo storeId={store.id} className="w-8 h-8 sm:w-10 sm:h-10 object-contain flex-shrink-0" />
                                            <h2 className="text-lg sm:text-xl font-bold text-primary">{store.name}</h2>
                                        </div>
                                        <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                            <WeeklyGincanaResults 
                                                storeId={store.id} 
                                                showAllResults={true}
                                            />
                                        </Suspense>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* New Goal Dialog (Mensal) */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">Nova Distribuição de Metas</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
                        {/* 1. Store & Global Values */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg border">
                            <div className="sm:col-span-2">
                                <Label className="text-xs sm:text-sm">Loja</Label>
                                <Select value={selectedStore} onValueChange={handleStoreSelect}>
                                    <SelectTrigger className="text-xs sm:text-sm">
                                        <SelectValue placeholder="Selecione a Loja" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {stores.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div className="flex items-center gap-2">
                                                    <StoreLogo storeId={s.id} className="w-4 h-4 object-contain flex-shrink-0" />
                                                    <span>{s.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs sm:text-sm">Mês (YYYYMM)</Label>
                                <Input value={mesReferencia} onChange={e => setMesReferencia(e.target.value)} className="text-xs sm:text-sm" />
                            </div>
                            <div className="flex items-end">
                                <Button variant="outline" onClick={() => setShowWeights(!showWeights)} className="w-full text-xs sm:text-sm" size="sm">
                                    <Calendar className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline">Pesos Diários</span>
                                    <span className="sm:hidden">Pesos</span>
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <Label className="text-primary font-semibold text-xs sm:text-sm">Meta da Loja (R$)</Label>
                                <Input
                                    type="number"
                                    value={metaLoja}
                                    onChange={e => setMetaLoja(e.target.value)}
                                    className="text-base sm:text-lg font-bold"
                                />
                            </div>
                            <div>
                                <Label className="text-primary/80 font-semibold text-xs sm:text-sm">Super Meta da Loja (R$)</Label>
                                <Input
                                    type="number"
                                    value={superMetaLoja}
                                    onChange={e => setSuperMetaLoja(e.target.value)}
                                    className="text-base sm:text-lg font-bold"
                                />
                            </div>
                        </div>

                        <Button onClick={distributeGoals} className="w-full text-xs sm:text-sm" size="sm" disabled={!metaLoja || !selectedStore}>
                            <Calculator className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            Distribuir Igualmente
                        </Button>

                        {/* 2. Distribution List */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted p-2 sm:p-3 grid grid-cols-12 gap-2 font-medium text-xs sm:text-sm">
                                <div className="col-span-1 flex items-center justify-center">Recebe</div>
                                <div className="col-span-4 sm:col-span-3">Colaboradora</div>
                                <div className="col-span-3 sm:col-span-4">Meta Individual</div>
                                <div className="col-span-4">Super Meta</div>
                            </div>
                            <ScrollArea className="h-[250px] sm:h-[300px]">
                                {colabGoals.map(colab => (
                                    <div key={colab.id} className={`p-2 sm:p-3 grid grid-cols-12 gap-2 items-center border-b hover:bg-muted/20 ${!colab.recebeMeta ? 'opacity-50' : ''}`}>
                                        <div className="col-span-1 flex items-center justify-center">
                                            <Switch
                                                checked={colab.recebeMeta}
                                                onCheckedChange={(checked) => handleToggleRecebeMeta(colab.id, checked)}
                                                className="scale-75 sm:scale-100"
                                            />
                                        </div>
                                        <div className="col-span-4 sm:col-span-3 font-medium text-xs sm:text-sm truncate">{colab.name}</div>
                                        <div className="col-span-3 sm:col-span-4">
                                            <div className="relative">
                                                <span className="absolute left-2 top-2 text-[10px] sm:text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    value={colab.meta}
                                                    onChange={e => handleColabChange(colab.id, 'meta', e.target.value)}
                                                    className="pl-6 h-7 sm:h-8 text-xs sm:text-sm"
                                                    disabled={!colab.recebeMeta}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-4">
                                            <div className="relative">
                                                <span className="absolute left-2 top-2 text-[10px] sm:text-xs text-muted-foreground">R$</span>
                                                <Input
                                                    type="number"
                                                    value={colab.superMeta}
                                                    onChange={e => handleColabChange(colab.id, 'superMeta', e.target.value)}
                                                    className="pl-6 h-7 sm:h-8 text-xs sm:text-sm text-primary/80 font-medium"
                                                    disabled={!colab.recebeMeta}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </ScrollArea>
                            <div className="p-2 sm:p-3 bg-muted/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 border-t">
                                <span className="font-semibold text-xs sm:text-sm">Total Distribuído:</span>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                                    <span className={`text-xs sm:text-sm ${validateTotal() ? "text-status-ahead font-bold" : "text-status-behind font-bold"}`}>
                                        Meta: R$ {colabGoals.filter(c => c.recebeMeta).reduce((s, c) => s + c.meta, 0).toLocaleString('pt-BR')}
                                    </span>
                                    <span className="text-xs sm:text-sm text-primary/80 font-bold">
                                        Super: R$ {colabGoals.filter(c => c.recebeMeta).reduce((s, c) => s + c.superMeta, 0).toLocaleString('pt-BR')}
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
                                        <div className="p-3 bg-primary/10 dark:bg-primary/5 rounded-lg border border-primary/20 dark:border-primary/30">
                                            <div className="text-xs text-primary font-medium mb-1">Meta da Loja</div>
                                            <div className="text-xl font-bold text-foreground">
                                                R$ {parseFloat(metaLoja || "0").toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-primary/5 dark:bg-primary/5 rounded-lg border border-primary/10 dark:border-primary/20">
                                            <div className="text-xs text-primary/80 font-medium mb-1">Super Meta</div>
                                            <div className="text-xl font-bold text-foreground">
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

                                        {/* Days - Generate all days of month to ensure day 31 appears */}
                                        {(() => {
                                            const year = parseInt(mesReferencia.substring(0, 4));
                                            const month = parseInt(mesReferencia.substring(4, 6)) - 1;
                                            const daysInMonth = getDaysInMonth(new Date(year, month));

                                            // Get first day of week for the month (0 = Sunday, 1 = Monday, etc)
                                            const firstDayOfMonth = new Date(year, month, 1);
                                            const firstDayOfWeek = getDay(firstDayOfMonth);

                                            const days: Array<{ date: string; dayNum: number; weight: number }> = [];

                                            // Add empty cells for days before the first day of month
                                            for (let i = 0; i < firstDayOfWeek; i++) {
                                                days.push({
                                                    date: `empty-${i}`,
                                                    dayNum: 0,
                                                    weight: 0
                                                });
                                            }

                                            // Generate all days of the month
                                            for (let day = 1; day <= daysInMonth; day++) {
                                                const date = new Date(year, month, day);
                                                const dateStr = format(date, "yyyy-MM-dd");
                                                days.push({
                                                    date: dateStr,
                                                    dayNum: day,
                                                    weight: dailyWeights[dateStr] || 0
                                                });
                                            }

                                            return days.map(({ date, dayNum, weight }) => {
                                                if (dayNum === 0) {
                                                    return <div key={date} className="p-3" />; // Empty cell
                                                }

                                            const metaValue = parseFloat(metaLoja || "0");
                                            const superMetaValue = parseFloat(superMetaLoja || "0");
                                            const dailyMeta = (metaValue * weight) / 100;
                                            const dailySuperMeta = (superMetaValue * weight) / 100;
                                            const isFirstHalf = dayNum <= 15;

                                            return (
                                                <div
                                                    key={date}
                                                    className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${isFirstHalf
                                                            ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 dark:border-primary/40'
                                                            : 'bg-gradient-to-br from-muted/50 to-muted/30 border-border'
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
                                                                    <div className="text-[10px] text-primary font-medium">
                                                                        {formatBRL(dailyMeta, 0)}
                                                                </div>
                                                                    <div className="text-[10px] text-primary/80 font-medium">
                                                                        {formatBRL(dailySuperMeta, 0)}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                            });
                                        })()}
                                    </div>

                                    {/* Total Sum Indicator */}
                                    <div className={`p-2 rounded-lg border text-center font-semibold text-sm ${isValid
                                        ? 'bg-status-ahead/10 border-status-ahead/30 text-status-ahead'
                                        : 'bg-status-ontrack/10 border-status-ontrack/30 text-status-ontrack'
                                        }`}>
                                        Soma Total: {totalWeight.toFixed(2)}% {isValid ? '✓' : (totalWeight > 100 ? `(${(totalWeight - 100).toFixed(2)}% a mais)` : `(falta ${(100 - totalWeight).toFixed(2)}%)`)}
                                    </div>
                                    {/* Legend */}
                                    <div className="flex gap-4 justify-center text-xs pt-2 border-t">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30"></div>
                                            <span>Primeira quinzena ({firstQuinzenaTotal.toFixed(1)}%)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-border"></div>
                                            <span>Segunda quinzena ({secondQuinzenaTotal.toFixed(1)}%)</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 sm:pt-4">
                            <Button variant="outline" onClick={() => {
                                setDialogOpen(false);
                                setEditingGoal(null); // Limpar estado de edição ao cancelar
                            }} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={!validateTotal()} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                                <Save className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                Salvar Distribuição
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Weekly Goals Dialog */}
            <Dialog open={weeklyDialogOpen} onOpenChange={setWeeklyDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            {editingWeeklyGoal ? "Editar Gincana Semanal" : "Nova Gincana Semanal"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 sm:space-y-5 py-3 sm:py-4">
                        {/* 1. Seleção de Loja */}
                        <div>
                            <Label className="text-xs sm:text-sm font-semibold">1. Selecionar Loja *</Label>
                            <Select value={selectedStore} onValueChange={async (value) => {
                                setSelectedStore(value);
                                setColaboradorasAtivas([]);
                                setMonthlyGoal(null);
                                setSuggestedWeeklyMeta(0);
                                setSuggestedWeeklySuperMeta(0);
                                
                                if (value) {
                                    if (colaboradoras.length === 0) {
                                        await fetchColaboradoras();
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    }
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                    await loadSuggestions(true);
                                }
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
                                <div className="flex items-center justify-between mb-3">
                                    <Label className="text-xs sm:text-sm font-semibold block">
                                        2. Escolher Colaboradoras que Participarão da Gincana *
                                    </Label>
                                    {colaboradorasAtivas.length > 0 && (
                                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                            {colaboradorasAtivas.filter(c => c.active).length} de {colaboradorasAtivas.length} selecionada{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </div>
                                <Card className="border-2 border-primary/20">
                                    <CardContent className="p-3 sm:p-4">
                                        {loadingSuggestions ? (
                                            <div className="text-center text-sm text-muted-foreground py-8">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                                Carregando colaboradoras...
                                            </div>
                                        ) : (
                                            <ScrollArea className="h-[250px] sm:h-[300px]">
                                                <div className="space-y-2">
                                                    {colaboradorasAtivas.length === 0 && (
                                                        <div className="text-center text-sm text-muted-foreground py-4">
                                                            <p className="mb-2">Selecione uma loja para ver as colaboradoras.</p>
                                                        </div>
                                                    )}
                                                    {colaboradorasAtivas.map((colab) => (
                                                        <div key={colab.id} className="flex items-center justify-between p-3 sm:p-4 rounded-lg border-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                <UserCheck className={`h-4 w-4 flex-shrink-0 ${colab.active ? 'text-primary' : 'text-muted-foreground'}`} />
                                                                <span className="text-xs sm:text-sm font-medium truncate">{colab.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                                {colab.active ? (
                                                                    <Badge variant="default" className="text-[10px] sm:text-xs bg-primary">
                                                                        Participa
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                                                                        Não participa
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
                                                </div>
                                            </ScrollArea>
                                        )}
                                        {colaboradorasAtivas.length > 0 && (
                                            <div className="mt-3 pt-3 border-t">
                                                <p className="text-xs text-muted-foreground">
                                                    💡 Use o switch ao lado de cada colaboradora para incluí-la ou excluí-la da gincana semanal.
                                                    Apenas as colaboradoras com switch ativado receberão a gincana e as notificações WhatsApp.
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* 3. Seleção de Semana */}
                        <div>
                            <Label className="text-xs sm:text-sm font-semibold">3. Escolher Semana * (Segunda a Domingo)</Label>
                            <Select value={selectedWeek} onValueChange={async (value) => {
                                setSelectedWeek(value);
                                if (selectedStore && value) {
                                    await loadSuggestions();
                                }
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
                                
                                <Card className="bg-primary/10 dark:bg-primary/5 border-primary/20 dark:border-primary/30">
                                    <CardContent className="p-3 sm:p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs sm:text-sm text-primary font-medium">Meta Mensal Total da Loja</p>
                                                <p className="text-sm sm:text-base text-foreground font-semibold mt-1">
                                                    R$ {monthlyGoal.meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs sm:text-sm text-primary/80 font-medium">Super Meta Mensal</p>
                                                <p className="text-sm sm:text-base text-foreground font-semibold mt-1">
                                                    R$ {monthlyGoal.super_meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-status-ahead/10 dark:bg-status-ahead/5 border-status-ahead/20 dark:border-status-ahead/30">
                                    <CardContent className="p-3 sm:p-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs sm:text-sm text-status-ahead font-medium">Gincana Semanal Sugerida (por colaboradora ativa)</p>
                                                    <p className="text-base sm:text-lg text-foreground font-bold mt-1">
                                                        R$ {suggestedWeeklyMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[10px] sm:text-xs text-status-ahead mt-1">
                                                        ({colaboradorasAtivas.filter(c => c.active).length} colaboradora{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''} ativa{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''})
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs sm:text-sm text-primary/80 font-medium">Super Gincana Semanal Sugerida</p>
                                                    <p className="text-base sm:text-lg text-foreground font-bold mt-1">
                                                        R$ {suggestedWeeklySuperMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="space-y-2">
                            <Button
                                        onClick={handleStartCustomizing}
                                variant="outline"
                                        className="w-full text-xs sm:text-sm border-2"
                                size="sm"
                                        disabled={colaboradorasAtivas.filter(c => c.active).length === 0 || loadingSuggestions}
                            >
                                        <Calculator className="mr-2 h-4 w-4" />
                                        Personalizar Metas
                            </Button>
                                    <p className="text-xs text-muted-foreground text-center">
                                        💡 As sugestões serão aplicadas automaticamente ao salvar. Clique em "Personalizar Metas" se quiser ajustar valores individuais.
                                    </p>
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
                                        <p className="text-xs text-muted-foreground text-center">
                                            💡 Os valores serão aplicados automaticamente ao salvar a gincana.
                                        </p>
                                    </CardContent>
                                </Card>

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
                                        <p className="text-xs text-muted-foreground text-center">
                                            💡 As metas individuais serão aplicadas automaticamente ao salvar a gincana.
                                        </p>
                                    </CardContent>
                                </Card>
                                </div>
                        )}

                        {/* 5. Prêmios da Gincana */}
                        <div className="space-y-4 border-t pt-4">
                            <Label className="text-xs sm:text-sm font-semibold block">5. Definir Prêmios da Gincana</Label>
                            
                            {/* Prêmio Checkpoint 1 (Meta) */}
                            <Card className="bg-status-ahead/10 dark:bg-status-ahead/5 border-status-ahead/20 dark:border-status-ahead/30">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Prêmio Checkpoint 1 (Gincana Semanal - Meta)</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Label className="text-xs sm:text-sm">Tipo de Prêmio:</Label>
                                        <Select
                                            value={isPremioFisicoCheckpoint1 ? "FISICO" : "DINHEIRO"}
                                            onValueChange={(value) => setIsPremioFisicoCheckpoint1(value === "FISICO")}
                                        >
                                            <SelectTrigger className="text-xs sm:text-sm w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                                                <SelectItem value="FISICO">Prêmio Físico</SelectItem>
                                            </SelectContent>
                                        </Select>
                            </div>
                                    <div>
                                        <Label className="text-xs sm:text-sm">
                                            {isPremioFisicoCheckpoint1 ? "Descrição do Prêmio" : "Valor do Prêmio (R$)"}
                                        </Label>
                                        <Input
                                            type={isPremioFisicoCheckpoint1 ? "text" : "number"}
                                            step={isPremioFisicoCheckpoint1 ? undefined : "0.01"}
                                            value={premioCheckpoint1}
                                            onChange={(e) => setPremioCheckpoint1(e.target.value)}
                                            placeholder={isPremioFisicoCheckpoint1 ? "Ex: Airfryer" : "Ex: 500.00"}
                                            className="text-xs sm:text-sm"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Prêmio Checkpoint Final (Super Meta) */}
                            <Card className="bg-primary/10 dark:bg-primary/5 border-primary/20 dark:border-primary/30">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Prêmio Checkpoint Final (Super Gincana Semanal - Super Meta)</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Label className="text-xs sm:text-sm">Tipo de Prêmio:</Label>
                                        <Select
                                            value={isPremioFisicoCheckpointFinal ? "FISICO" : "DINHEIRO"}
                                            onValueChange={(value) => setIsPremioFisicoCheckpointFinal(value === "FISICO")}
                                        >
                                            <SelectTrigger className="text-xs sm:text-sm w-32">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                                                <SelectItem value="FISICO">Prêmio Físico</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs sm:text-sm">
                                            {isPremioFisicoCheckpointFinal ? "Descrição do Prêmio" : "Valor do Prêmio (R$)"}
                                        </Label>
                                        <Input
                                            type={isPremioFisicoCheckpointFinal ? "text" : "number"}
                                            step={isPremioFisicoCheckpointFinal ? undefined : "0.01"}
                                            value={premioCheckpointFinal}
                                            onChange={(e) => setPremioCheckpointFinal(e.target.value)}
                                            placeholder={isPremioFisicoCheckpointFinal ? "Ex: Smartphone" : "Ex: 1000.00"}
                                            className="text-xs sm:text-sm"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Mensagem quando não há meta mensal */}
                        {selectedStore && selectedWeek && !loadingSuggestions && !monthlyGoal && (
                            <Card className="bg-status-ontrack/10 dark:bg-status-ontrack/5 border-status-ontrack/20 dark:border-status-ontrack/30">
                                <CardContent className="p-3 sm:p-4">
                                    <p className="text-xs sm:text-sm text-status-ontrack">
                                        Meta mensal não encontrada para esta loja no mês correspondente à semana selecionada. 
                                        Defina a meta mensal primeiro.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Botões de Ação */}
                        <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3 sm:pt-4 border-t">
                            {editingWeeklyGoal && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDeleteWeeklyGoals}
                                    className="w-full sm:w-auto text-xs sm:text-sm"
                                    size="sm"
                                    disabled={savingWeeklyGoal}
                                >
                                    <Trash className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                    Excluir Gincana Semanal
                                </Button>
                            )}
                            <div className="flex gap-2 ml-auto">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setWeeklyDialogOpen(false);
                                    resetWeeklyForm();
                                }}
                                className="w-full sm:w-auto text-xs sm:text-sm"
                                size="sm"
                                    disabled={savingWeeklyGoal}
                            >
                                Cancelar
                            </Button>
                                <Button
                                    type="button"
                                    onClick={handleSaveWeeklyGoal}
                                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-xs sm:text-sm"
                                    size="sm"
                                    disabled={savingWeeklyGoal || colaboradorasAtivas.filter(c => c.active).length === 0}
                                >
                                    {savingWeeklyGoal ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                <Save className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                            Salvar Gincana Semanal
                                        </>
                                    )}
                            </Button>
                            </div>
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
