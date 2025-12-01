import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ArrowLeft, Save, Calculator, UserCheck, CheckCircle2, Trash2, Trophy, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { sendWhatsAppMessage, formatGincanaMessage } from "@/lib/whatsapp";

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
    
    // Histórico de resultados
    const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
    const [selectedWeekForResults, setSelectedWeekForResults] = useState<string>("");
    const [selectedStoreForResults, setSelectedStoreForResults] = useState<string>("");
    const [weekResults, setWeekResults] = useState<Array<{
        colaboradora_id: string;
        colaboradora_name: string;
        meta_valor: number;
        super_meta_valor: number;
        realizado: number;
        bateu_meta: boolean;
        bateu_super_meta: boolean;
        percentual: number;
    }>>([]);
    const [loadingResults, setLoadingResults] = useState(false);

    useEffect(() => {
        console.log('[WeeklyGoalsManagement] useEffect inicial - carregando dados...');
        const loadData = async () => {
            await Promise.all([
                fetchStores(),
                fetchColaboradoras(),
                fetchWeeklyGoals()
            ]);
            console.log('[WeeklyGoalsManagement] Dados iniciais carregados');
        };
        loadData();
    }, []);

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

    const fetchStores = async () => {
        try {
            console.log('[fetchStores] Iniciando busca de lojas...');
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("stores")
                .select("*")
                .eq("active", true);
            
            if (error) {
                console.error('[fetchStores] Erro:', error);
                toast.error("Erro ao carregar lojas");
                return;
            }
            
            if (data) {
                console.log('[fetchStores] Lojas carregadas:', data.length);
                setStores(data);
            }
        } catch (err) {
            console.error('[fetchStores] Exception:', err);
            toast.error("Erro ao carregar lojas");
        }
    };

    const fetchColaboradoras = async () => {
        try {
            console.log('[fetchColaboradoras] ========== INICIANDO BUSCA ==========');
            console.log('[fetchColaboradoras] Chamando Supabase...');
            
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("id, name, store_id")
                .eq("role", "COLABORADORA")
                .eq("active", true);
            
            console.log('[fetchColaboradoras] Resposta recebida. Error:', error);
            console.log('[fetchColaboradoras] Data recebida:', data);
            
            if (error) {
                console.error('[fetchColaboradoras] ❌ ERRO:', error);
                console.error('[fetchColaboradoras] Código:', error.code);
                console.error('[fetchColaboradoras] Mensagem:', error.message);
                console.error('[fetchColaboradoras] Detalhes:', error.details);
                console.error('[fetchColaboradoras] Hint:', error.hint);
                toast.error(`Erro ao carregar colaboradoras: ${error.message}`);
                setColaboradoras([]);
                return;
            }
            
            if (data) {
                console.log('[fetchColaboradoras] ✅ Colaboradoras carregadas:', data.length);
                console.log('[fetchColaboradoras] Dados:', data);
                setColaboradoras(data || []);
            } else {
                console.warn('[fetchColaboradoras] ⚠️ Nenhuma colaboradora retornada (data é null/undefined)');
                setColaboradoras([]);
            }
        } catch (err: any) {
            console.error('[fetchColaboradoras] ❌ EXCEPTION:', err);
            console.error('[fetchColaboradoras] Stack:', err?.stack);
            toast.error(`Erro ao carregar colaboradoras: ${err?.message || String(err)}`);
            setColaboradoras([]);
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
        setLoading(true);
        try {
            // ✅ BUSCAR TODAS AS GINCANAS SEM FILTRO DE DATA (passadas e futuras)
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select(`*, stores (name), profiles (name)`)
                .eq("tipo", "SEMANAL")
                .order("created_at", { ascending: false })
                .limit(1000); // Aumentar limite para incluir histórico

            if (error) throw error;
            if (data) {
                console.log(`[fetchWeeklyGoals] ✅ Total de gincanas encontradas: ${data.length}`);
                // Ordenar no frontend para garantir ordenação correta com novo formato
                const sorted = [...data].sort((a: any, b: any) => 
                    sortWeekRef(a.semana_referencia || "", b.semana_referencia || "")
                );
                setWeeklyGoals(sorted as any);
            } else {
                console.warn('[fetchWeeklyGoals] ⚠️ Nenhuma gincana encontrada');
                setWeeklyGoals([]);
            }
        } catch (err) {
            console.error("Error fetching weekly goals:", err);
            toast.error("Erro ao carregar gincanas semanais");
        } finally {
            setLoading(false);
        }
    };
    
    // Função para buscar resultados de uma gincana passada
    const fetchWeekResults = async (weekRef: string, storeId: string) => {
        setLoadingResults(true);
        try {
            const weekRange = getWeekRange(weekRef);
            const hoje = new Date();
            const isPastWeek = weekRange.end < hoje;
            
            if (!isPastWeek) {
                toast.info("Esta semana ainda não terminou. Os resultados estarão disponíveis após o término da semana.");
                setLoadingResults(false);
                return;
            }
            
            // Buscar todas as metas da gincana desta semana e loja
            const { data: goals, error: goalsError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("*, profiles (name)")
                .eq("store_id", storeId)
                .eq("semana_referencia", weekRef)
                .eq("tipo", "SEMANAL")
                .not("colaboradora_id", "is", null);
            
            if (goalsError) throw goalsError;
            if (!goals || goals.length === 0) {
                toast.info("Nenhuma meta encontrada para esta gincana.");
                setLoadingResults(false);
                return;
            }
            
                    // Buscar vendas de cada colaboradora na semana
                    const results = await Promise.all(
                        goals.map(async (goal: any) => {
                            const { data: sales, error: salesError } = await supabase
                                .schema("sistemaretiradas")
                                .from("sales")
                                .select("valor")
                                .eq("colaboradora_id", goal.colaboradora_id)
                                .eq("store_id", storeId)
                                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));
                    
                    if (salesError) {
                        console.error(`Erro ao buscar vendas para colaboradora ${goal.colaboradora_id}:`, salesError);
                        return null;
                    }
                    
                    const realizado = sales?.reduce((sum, s) => sum + parseFloat(s.valor || '0'), 0) || 0;
                    const meta_valor = parseFloat(goal.meta_valor || 0);
                    const super_meta_valor = parseFloat(goal.super_meta_valor || 0);
                    const bateu_meta = realizado >= meta_valor;
                    const bateu_super_meta = realizado >= super_meta_valor;
                    const percentual = meta_valor > 0 ? (realizado / meta_valor) * 100 : 0;
                    
                    return {
                        colaboradora_id: goal.colaboradora_id,
                        colaboradora_name: goal.profiles?.name || "Colaboradora desconhecida",
                        meta_valor,
                        super_meta_valor,
                        realizado,
                        bateu_meta,
                        bateu_super_meta,
                        percentual
                    };
                })
            );
            
            // Filtrar resultados nulos
            const validResults = results.filter(r => r !== null) as typeof results[0][];
            setWeekResults(validResults);
        } catch (err: any) {
            console.error("Erro ao buscar resultados da gincana:", err);
            toast.error(`Erro ao buscar resultados: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setLoadingResults(false);
        }
    };
    
    const handleViewResults = (weekRef: string, storeId: string) => {
        setSelectedWeekForResults(weekRef);
        setSelectedStoreForResults(storeId);
        setResultsDialogOpen(true);
        fetchWeekResults(weekRef, storeId);
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

    const loadSuggestions = async (forceLoadColabs = false) => {
        if (!selectedStore) return;
        
        setLoadingSuggestions(true);
        try {
            // Se tem semana selecionada, buscar meta mensal e calcular sugestões
            if (selectedWeek) {
                try {
                    // Get month from week
                    const weekRange = getWeekRange(selectedWeek);
                    const monthRef = format(weekRange.start, "yyyyMM");
                    
                    // Get monthly goal for the store
                    const { data: monthlyStoreGoal } = await supabase
                        .schema("sistemaretiradas")
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
                } catch (err) {
                    console.error("Error loading monthly goal:", err);
                    setMonthlyGoal(null);
                    setSuggestedWeeklyMeta(0);
                    setSuggestedWeeklySuperMeta(0);
                }
            } else {
                // Sem semana, apenas limpar sugestões
                setMonthlyGoal(null);
                setSuggestedWeeklyMeta(0);
                setSuggestedWeeklySuperMeta(0);
            }

            // SEMPRE buscar colaboradoras diretamente do banco para esta loja (não depende do estado)
            console.log('[loadSuggestions] ========== BUSCANDO COLABORADORAS DO BANCO ==========');
            console.log('[loadSuggestions] Loja selecionada:', selectedStore);
            
            let storeColabs: Colaboradora[] = [];
            
            try {
                console.log('[loadSuggestions] Executando query no Supabase...');
                const { data: directColabs, error: directError } = await supabase
                    .schema("sistemaretiradas")
                    .from("profiles")
                    .select("id, name, store_id")
                    .eq("role", "COLABORADORA")
                    .eq("active", true)
                    .eq("store_id", selectedStore);
                
                console.log('[loadSuggestions] Resposta recebida. Error:', directError);
                console.log('[loadSuggestions] Data recebida:', directColabs);
                
                if (directError) {
                    console.error('[loadSuggestions] ❌ ERRO ao buscar colaboradoras:', directError);
                    console.error('[loadSuggestions] Código:', directError.code);
                    console.error('[loadSuggestions] Mensagem:', directError.message);
                    toast.error(`Erro ao buscar colaboradoras: ${directError.message}`);
                    setColaboradorasAtivas([]);
                    setLoadingSuggestions(false);
                    return;
                }
                
                if (directColabs && directColabs.length > 0) {
                    console.log('[loadSuggestions] ✅ Encontradas', directColabs.length, 'colaboradoras diretamente do banco');
                    console.log('[loadSuggestions] Colaboradoras:', directColabs.map(c => `${c.name} (${c.id})`));
                    storeColabs = directColabs;
                    
                    // Atualizar lista global de colaboradoras também (para outras partes do código)
                    setColaboradoras(prev => {
                        const existingIds = new Set(prev.map(c => c.id));
                        const newColabs = directColabs.filter(c => !existingIds.has(c.id));
                        const updated = [...prev, ...newColabs];
                        console.log('[loadSuggestions] Lista global atualizada:', updated.length, 'colaboradoras');
                        return updated;
                    });
                } else {
                    console.warn('[loadSuggestions] ⚠️ Nenhuma colaboradora encontrada no banco para loja:', selectedStore);
                    setColaboradorasAtivas([]);
                    setLoadingSuggestions(false);
                    toast.warning("Nenhuma colaboradora encontrada para esta loja. Verifique se há colaboradoras cadastradas e ativas.");
                    return;
                }
            } catch (err: any) {
                console.error('[loadSuggestions] ❌ EXCEPTION ao buscar colaboradoras:', err);
                console.error('[loadSuggestions] Stack:', err?.stack);
                toast.error(`Erro ao buscar colaboradoras: ${err?.message || String(err)}`);
                setColaboradorasAtivas([]);
                setLoadingSuggestions(false);
                return;
            }
            
            console.log('[loadSuggestions] ✅ Colaboradoras encontradas:', storeColabs.length);
            
            // Check existing weekly goals for this week to see who's already active (só se tiver semana)
            let existingColabIds = new Set<string>();
            if (selectedWeek) {
                try {
                    const { data: existingGoals, error: existingGoalsError } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .select("colaboradora_id")
                        .eq("store_id", selectedStore)
                        .eq("semana_referencia", selectedWeek)
                        .eq("tipo", "SEMANAL");

                    if (existingGoalsError) {
                        console.error("Error fetching existing goals:", existingGoalsError);
                        // Continuar mesmo com erro, apenas não marcar ninguém como ativo
                    } else if (existingGoals) {
                        existingColabIds = new Set(
                            existingGoals
                                .filter(g => g.colaboradora_id) // Filtrar nulos
                                .map(g => g.colaboradora_id) || []
                        );
                    }
                } catch (err) {
                    console.error("Error checking existing goals:", err);
                }
            }

            // Sempre atualizar colaboradoras ativas, mesmo sem semana
            const newColabs = storeColabs.map(c => {
                // Verificar se já estava ativa antes (manter estado)
                const wasActive = colaboradorasAtivas.find(ca => ca.id === c.id)?.active;
                // Se não tinha estado anterior, verificar se já tem gincana ou ativar por padrão
                const shouldBeActive = wasActive !== undefined 
                    ? wasActive 
                    : (existingColabIds.has(c.id) || true); // Por padrão, todas ativas
                
                return {
                    id: c.id,
                    name: c.name || "Sem nome",
                    active: shouldBeActive
                };
            });
            
            console.log('[loadSuggestions] ✅ Colaboradoras ativas atualizadas:', newColabs.length);
            console.log('[loadSuggestions] Colaboradoras:', newColabs.map(c => `${c.name} (${c.active ? 'ativa' : 'inativa'})`));
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
            toast.error("Selecione pelo menos uma colaboradora para receber a gincana semanal");
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
            setDialogOpen(false);
            resetForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error deleting weekly goals:", err);
            toast.error(err.message || "Erro ao excluir gincanas semanais");
        }
    };

    // Função helper para enviar notificações WhatsApp de gincana
    const sendGincanaNotifications = async (
        storeId: string,
        semanaReferencia: string,
        colabsWithGoals: { id: string; meta: number; superMeta: number }[],
        successCount: number
    ) => {
        try {
            console.log('[sendGincanaNotifications] Iniciando envio de notificações...');
            
            // 1. Buscar dados da loja
            const { data: storeData } = await supabase
                .schema("sistemaretiradas")
                .from("stores")
                .select("name")
                .eq("id", storeId)
                .single();
            
            if (!storeData) {
                console.warn('[sendGincanaNotifications] Loja não encontrada');
                return;
            }
            
            // 2. Buscar bônus ativos relacionados à gincana
            // Buscar bônus que:
            // - Estão ativos
            // - Têm enviar_notificacao_gincana = true
            // - Correspondem à semana (periodo_semana = semanaReferencia OU periodo_semana IS NULL)
            // - Correspondem à loja (store_id = storeId OU store_id IS NULL)
            // - São de gincana (condicao_meta_tipo = GINCANA_SEMANAL ou SUPER_GINCANA_SEMANAL)
            const { data: bonuses } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .select("*")
                .eq("ativo", true)
                .eq("enviar_notificacao_gincana", true)
                .or(`periodo_semana.eq.${semanaReferencia},periodo_semana.is.null`)
                .or(`store_id.eq.${storeId},store_id.is.null`)
                .or("condicao_meta_tipo.eq.GINCANA_SEMANAL,condicao_meta_tipo.eq.SUPER_GINCANA_SEMANAL");
            
            if (!bonuses || bonuses.length === 0) {
                console.log('[sendGincanaNotifications] Nenhum bônus ativo encontrado para esta gincana');
                return;
            }
            
            // 3. Calcular datas da semana
            const weekRange = getWeekRange(semanaReferencia);
            const dataInicio = format(weekRange.start, 'dd/MM/yyyy');
            const dataFim = format(weekRange.end, 'dd/MM/yyyy');
            
            // 4. Buscar dados das colaboradoras (nome e WhatsApp)
            const colaboradoraIds = colabsWithGoals.map(c => c.id);
            const { data: colaboradorasData } = await supabase
                .schema("sistemaretiradas")
                .from("profiles")
                .select("id, name, whatsapp")
                .in("id", colaboradoraIds)
                .eq("role", "COLABORADORA")
                .eq("active", true);
            
            if (!colaboradorasData || colaboradorasData.length === 0) {
                console.warn('[sendGincanaNotifications] Nenhuma colaboradora encontrada');
                return;
            }
            
            // 5. Preparar informações do bônus (pegar o primeiro bônus relevante)
            const bonus = bonuses[0];
            const premio = bonus.valor_bonus_texto || 
                          (bonus.valor_bonus > 0 ? `R$ ${bonus.valor_bonus.toFixed(2)}` : null) ||
                          bonus.descricao_premio;
            const condicoes = bonus.descricao || null;
            
            // 6. Enviar notificações para cada colaboradora
            let notificationsSent = 0;
            for (const colabData of colaboradorasData) {
                // Verificar se tem WhatsApp
                if (!colabData.whatsapp || colabData.whatsapp.trim() === '') {
                    console.log(`[sendGincanaNotifications] Colaboradora ${colabData.name} não tem WhatsApp cadastrado`);
                    continue;
                }
                
                // Buscar metas da colaboradora
                const colabGoals = colabsWithGoals.find(c => c.id === colabData.id);
                if (!colabGoals) {
                    console.warn(`[sendGincanaNotifications] Metas não encontradas para ${colabData.name}`);
                    continue;
                }
                
                // Formatar mensagem
                const message = formatGincanaMessage({
                    colaboradoraName: colabData.name,
                    storeName: storeData.name,
                    semanaReferencia: semanaReferencia,
                    metaValor: colabGoals.meta,
                    superMetaValor: colabGoals.superMeta > 0 ? colabGoals.superMeta : null,
                    dataInicio: dataInicio,
                    dataFim: dataFim,
                    premio: premio,
                    condicoes: condicoes,
                });
                
                // Normalizar WhatsApp (remover caracteres não numéricos)
                const normalizedWhatsapp = colabData.whatsapp.replace(/\D/g, '');
                
                // Enviar mensagem
                const result = await sendWhatsAppMessage({
                    phone: normalizedWhatsapp,
                    message: message,
                });
                
                if (result.success) {
                    notificationsSent++;
                    console.log(`[sendGincanaNotifications] ✅ Notificação enviada para ${colabData.name}`);
                } else {
                    console.warn(`[sendGincanaNotifications] ⚠️ Falha ao enviar para ${colabData.name}:`, result.error);
                }
            }
            
            if (notificationsSent > 0) {
                toast.success(`${notificationsSent} notificação(ões) WhatsApp enviada(s)!`);
            }
        } catch (error: any) {
            console.error('[sendGincanaNotifications] Erro ao enviar notificações:', error);
            // Não mostrar erro ao usuário, apenas logar
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
        // Validações iniciais
        if (!selectedStore || !selectedWeek || colabsWithGoals.length === 0) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        // Validar formato da semana
        if (selectedWeek.length !== 6 || !/^\d{6}$/.test(selectedWeek)) {
            toast.error("Formato de semana inválido. Por favor, selecione uma semana válida.");
            return;
        }

        // Validar IDs das colaboradoras
        const invalidColabs = colabsWithGoals.filter(c => !c.id || c.id.trim() === '');
        if (invalidColabs.length > 0) {
            toast.error("Algumas colaboradoras têm ID inválido. Por favor, recarregue a página.");
            return;
        }

        // Validar valores de meta
        const invalidMetas = colabsWithGoals.filter(c => isNaN(c.meta) || isNaN(c.superMeta) || c.meta < 0 || c.superMeta < 0);
        if (invalidMetas.length > 0) {
            toast.error("Algumas metas têm valores inválidos. Verifique se são números positivos.");
            return;
        }

        try {
            // Remover duplicatas baseado em colaboradora_id (manter a última entrada)
            const uniqueColabs = new Map<string, { id: string; meta: number; superMeta: number }>();
            colabsWithGoals.forEach(colab => {
                if (colab.id && (colab.meta > 0 || colab.superMeta > 0)) {
                    uniqueColabs.set(colab.id, colab);
                }
            });

            const uniqueColabsList = Array.from(uniqueColabs.values());

            if (uniqueColabsList.length === 0) {
                toast.error("Nenhuma meta válida para salvar. Defina pelo menos uma meta positiva.");
                return;
            }

            // Preparar payloads para inserção (DELETE + INSERT garante atualização se existir)
            const payloads = uniqueColabsList.map(colab => ({
                store_id: selectedStore,
                semana_referencia: selectedWeek,
                tipo: "SEMANAL",
                meta_valor: Math.max(0, colab.meta || 0),
                super_meta_valor: Math.max(0, colab.superMeta || 0),
                colaboradora_id: colab.id,
                ativo: true,
                mes_referencia: null,
            }));

            // Validar payloads antes de enviar
            const invalidPayloads = payloads.filter(p => 
                !p.store_id || !p.semana_referencia || !p.colaboradora_id || 
                isNaN(p.meta_valor) || isNaN(p.super_meta_valor)
            );
            
            if (invalidPayloads.length > 0) {
                console.error("Payloads inválidos:", invalidPayloads);
                toast.error("Dados inválidos detectados. Por favor, tente novamente.");
                return;
            }

            // Validar que não há duplicatas no payload antes de processar
            const seenKeys = new Set<string>();
            const duplicatePayloads = payloads.filter(p => {
                const key = `${p.store_id}-${p.semana_referencia}-${p.tipo}-${p.colaboradora_id}`;
                if (seenKeys.has(key)) {
                    return true;
                }
                seenKeys.add(key);
                return false;
            });

            if (duplicatePayloads.length > 0) {
                console.error("Duplicatas detectadas no payload:", duplicatePayloads);
                toast.error("Erro: Há metas duplicadas para a mesma colaboradora. Por favor, verifique os dados.");
                return;
            }

            // IMPORTANTE: Índices parciais (com WHERE) não funcionam com ON CONFLICT no PostgreSQL
            // Por isso, usamos sempre DELETE + INSERT, que é mais confiável e robusto
            // O índice único idx_goals_weekly_unique garante que não haverá duplicatas após DELETE
            
            // Estratégia: DELETE individual + INSERT em batch
            // 1. Deletar individualmente cada meta antes de inserir (garante limpeza completa)
            // 2. Verificar se ainda existem metas residuais
            // 3. DELETE em massa se necessário
            // 4. INSERT em batch
            // 5. Fallback: INSERT individual se batch falhar
            console.log(`💾 Salvando ${payloads.length} meta(s) para semana ${selectedWeek}...`);
            
            for (const payload of payloads) {
                // Deletar meta específica desta colaboradora/semana/loja
                const { error: deleteError } = await supabase
                    .schema("sistemaretiradas")
                    .from("goals")
                    .delete()
                    .eq("store_id", payload.store_id)
                    .eq("semana_referencia", payload.semana_referencia)
                    .eq("tipo", payload.tipo)
                    .eq("colaboradora_id", payload.colaboradora_id);

                if (deleteError) {
                    console.warn(`Erro ao deletar meta para colaboradora ${payload.colaboradora_id}:`, deleteError);
                    // Continuar mesmo se houver erro (pode não existir)
                }
            }

            // Delay para garantir que todos os DELETEs foram processados
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verificar se ainda existem metas antes de inserir (extra safety)
            const colaboradoraIds = payloads.map(p => p.colaboradora_id).filter(Boolean);
            const { data: remainingGoals } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("id, colaboradora_id")
                .eq("store_id", selectedStore)
                .eq("semana_referencia", selectedWeek)
                .eq("tipo", "SEMANAL")
                .in("colaboradora_id", colaboradoraIds);

            if (remainingGoals && remainingGoals.length > 0) {
                console.warn(`${remainingGoals.length} meta(s) ainda existe(m) após DELETE individual, deletando em massa...`);
                // Tentar deletar em massa como fallback
                const { error: deleteMassError } = await supabase
                    .schema("sistemaretiradas")
                    .from("goals")
                    .delete()
                    .eq("store_id", selectedStore)
                    .eq("semana_referencia", selectedWeek)
                    .eq("tipo", "SEMANAL")
                    .in("colaboradora_id", colaboradoraIds);
                
                if (deleteMassError) {
                    console.error("Erro ao deletar metas em massa:", deleteMassError);
                    // Continuar mesmo assim, tentar inserir
                }
                
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Inserir as novas metas em batch
            const { data: insertData, error: insertError } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .insert(payloads)
                .select();

            if (insertError) {
                console.error("Insert error:", insertError);
                
                // Se ainda der erro de duplicata, tentar inserir uma por uma
                if (insertError.code === '23505' || insertError.message?.includes('duplicate') || 
                    insertError.message?.includes('unique constraint')) {
                    console.warn("Erro de duplicata no batch insert, tentando inserção individual...");
                    const individualResults = [];
                    const individualErrors = [];
                    
                    for (const payload of payloads) {
                        // Deletar novamente antes de inserir (extra segurança)
                        await supabase
                            .schema("sistemaretiradas")
                            .from("goals")
                            .delete()
                            .eq("store_id", payload.store_id)
                            .eq("semana_referencia", payload.semana_referencia)
                            .eq("tipo", payload.tipo)
                            .eq("colaboradora_id", payload.colaboradora_id);
                        
                        await new Promise(resolve => setTimeout(resolve, 50));
                        
                        // Inserir individual
                        const { data: singleData, error: singleError } = await supabase
                            .schema("sistemaretiradas")
                            .from("goals")
                            .insert(payload)
                            .select()
                            .single();
                        
                        if (singleError) {
                            console.error(`Erro ao inserir meta para colaboradora ${payload.colaboradora_id}:`, singleError);
                            individualErrors.push({ payload, error: singleError });
                        } else {
                            individualResults.push(singleData);
                        }
                    }
                    
                    if (individualErrors.length > 0) {
                        console.error("Erros ao inserir individualmente:", individualErrors);
                        throw individualErrors[0].error;
                    }
                    
                    if (individualResults.length !== payloads.length) {
                        throw new Error(`Apenas ${individualResults.length} de ${payloads.length} meta(s) foram inseridas.`);
                    }
                    
                    const successCount = individualResults.length;
                    toast.success(`Gincanas semanais ${editingGoal ? 'atualizadas' : 'criadas'} para ${successCount} colaboradora(s)!`);
                    
                    // Enviar notificações WhatsApp
                    await sendGincanaNotifications(selectedStore, selectedWeek, colabsWithGoals, successCount);
                } else {
                    throw insertError;
                }
            } else {
                // Sucesso no batch insert!
                const successCount = insertData?.length || uniqueColabsList.length;
                toast.success(`Gincanas semanais ${editingGoal ? 'atualizadas' : 'criadas'} para ${successCount} colaboradora(s)!`);
                
                // Enviar notificações WhatsApp
                await sendGincanaNotifications(selectedStore, selectedWeek, colabsWithGoals, successCount);
            }
            setDialogOpen(false);
            resetForm();
            fetchWeeklyGoals();
        } catch (err: any) {
            console.error("Error saving weekly goals:", err);
            
            // Mensagens de erro mais específicas
            if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
                toast.error("Erro: Meta duplicada detectada. Isso não deveria acontecer. Por favor, recarregue a página e tente novamente.");
            } else if (err.code === '23514') {
                toast.error("Erro de validação: Verifique se os valores estão dentro dos limites permitidos.");
            } else if (err.code === '23503') {
                toast.error("Erro: Loja ou colaboradora não encontrada. Verifique se ainda estão ativas.");
            } else if (err.code === '23502') {
                toast.error("Erro: Campos obrigatórios faltando. Por favor, preencha todos os campos.");
            } else if (err.message?.includes('invalid input syntax')) {
                toast.error("Erro: Formato de dados inválido. Por favor, verifique os valores inseridos.");
            } else {
                toast.error(err.message || "Erro ao salvar gincanas semanais. Tente novamente.");
            }
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
            try {
                const weekDate = addWeeks(hoje, i);
                const monday = startOfWeek(weekDate, { weekStartsOn: 1 });
                const year = getYear(monday);
                const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
                // Formato novo: WWYYYY
                const weekRef = `${String(week).padStart(2, '0')}${year}`;
                try {
                    const weekRange = getWeekRange(weekRef);
                    options.push({
                        value: weekRef,
                        label: `${format(weekRange.start, "dd/MM", { locale: ptBR })} - ${format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })} (Semana ${week})`
                    });
                } catch (err) {
                    console.error(`Erro ao gerar opção de semana para ${weekRef}:`, err);
                    // Pular esta semana se houver erro
                }
            } catch (err) {
                console.error(`Error generating week option for offset ${i}:`, err);
                // Pular esta semana se houver erro
            }
        }
        return options;
    };

    if (loading) {
        return <div className="text-center py-10">Carregando gincanas semanais...</div>;
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
                        Gerenciar Gincanas Semanais
                    </h1>
                </div>
                <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Nova Gincana Semanal
                </Button>
            </div>

            {/* Weekly Goals Grid - Agrupado por Loja, ordenado por data (mais recentes primeiro) */}
            <div className="space-y-6">
                {Object.entries(
                    // Primeiro agrupar por loja
                    weeklyGoals.reduce((acc, goal) => {
                        const storeId = goal.store_id;
                        if (!acc[storeId]) {
                            acc[storeId] = {
                                store: goal.stores,
                                store_id: storeId,
                                weeks: {} as Record<string, any>
                            };
                        }
                        // Dentro de cada loja, agrupar por semana
                        const weekKey = goal.semana_referencia;
                        if (!acc[storeId].weeks[weekKey]) {
                            acc[storeId].weeks[weekKey] = {
                                semana_referencia: weekKey,
                                goals: []
                            };
                        }
                        acc[storeId].weeks[weekKey].goals.push(goal);
                        return acc;
                    }, {} as Record<string, any>)
                )
                // Ordenar por nome da loja
                .sort(([_, a]: [string, any], [__, b]: [string, any]) => {
                    const nameA = a.store?.name || '';
                    const nameB = b.store?.name || '';
                    return nameA.localeCompare(nameB);
                })
                .map(([storeId, storeGroup]: [string, any]) => {
                    // Para cada loja, ordenar semanas por número da semana (mais recentes primeiro)
                    const sortedWeeks = Object.entries(storeGroup.weeks)
                        .sort(([weekRefA, _], [weekRefB, __]) => {
                            // Converter semana_referencia para número para ordenar
                            try {
                                const rangeA = getWeekRange(weekRefA as string);
                                const rangeB = getWeekRange(weekRefB as string);
                                // Ordenar por data de início (mais recentes primeiro)
                                return rangeB.start.getTime() - rangeA.start.getTime();
                            } catch (err) {
                                // Se houver erro, manter ordem original
                                return 0;
                            }
                        });
                    
                    return (
                        <div key={storeId} className="space-y-3">
                            {/* Título da Loja */}
                            <h2 className="text-xl font-bold text-primary border-b-2 border-primary pb-2">
                                {storeGroup.store?.name || "Loja desconhecida"}
                            </h2>
                            
                            {/* Semanas desta loja */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedWeeks.map(([weekKey, weekGroup]: [string, any]) => {
                                    const group = weekGroup;
                                    // Proteger contra erro ao fazer parse da semana
                                    let weekRange;
                                    try {
                                        weekRange = getWeekRange(group.semana_referencia || "");
                                    } catch (err: any) {
                                        console.error(`Erro ao processar semana ${group.semana_referencia}:`, err);
                                        // Retornar valores padrão se houver erro
                                        weekRange = { start: new Date(), end: new Date() };
                                    }
                                    const isCurrentWeek = group.semana_referencia === getCurrentWeekRef();
                                    const isPastWeek = weekRange.end < new Date();
                                    
                                    // Contar colaboradoras únicas (pode ter metas duplicadas)
                                    const uniqueColabs = new Set(group.goals.map((g: any) => g.colaboradora_id).filter((id: any) => id != null));
                                    const colabsCount = uniqueColabs.size;
                                    
                                    const totalMeta = group.goals.reduce((sum: number, g: any) => sum + (g.meta_valor || 0), 0);
                                    const totalSuper = group.goals.reduce((sum: number, g: any) => sum + (g.super_meta_valor || 0), 0);
                                    
                                    return (
                                        <Card 
                                            key={weekKey} 
                                            className={`relative overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
                                                isCurrentWeek ? 'border-2 border-primary' : isPastWeek ? 'border-2 border-muted' : ''
                                            }`}
                                        >
                                            <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 to-purple-500/10">
                                                <CardTitle className="flex justify-between items-center text-lg">
                                                    <span>{format(weekRange.start, "dd/MM", { locale: ptBR })} - {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}</span>
                                                    <div className="flex gap-2">
                                                        {isCurrentWeek && (
                                                            <span className="text-xs font-normal bg-primary text-primary-foreground px-2 py-1 rounded">
                                                                Semana Atual
                                                            </span>
                                                        )}
                                                        {isPastWeek && !isCurrentWeek && (
                                                            <span className="text-xs font-normal bg-muted text-muted-foreground px-2 py-1 rounded">
                                                                Finalizada
                                                            </span>
                                                        )}
                                                    </div>
                                                </CardTitle>
                                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
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
                                <div className="flex gap-2">
                                    {isPastWeek && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleViewResults(group.semana_referencia, storeId)}
                                        >
                                            <Trophy className="h-4 w-4 mr-2" />
                                            Ver Resultados
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={isPastWeek ? "flex-1" : "w-full"}
                                        onClick={() => handleEditWeekly(group.goals[0])}
                                    >
                                        Editar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
                {weeklyGoals.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                        Nenhuma gincana semanal cadastrada. Clique em "Nova Gincana Semanal" para começar.
                    </div>
                )}
            </div>

            {/* Dialog de Resultados da Gincana */}
            <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            Resultados da Gincana Semanal
                        </DialogTitle>
                        {selectedWeekForResults && (() => {
                            try {
                                const weekRange = getWeekRange(selectedWeekForResults);
                                return (
                                    <p className="text-sm text-muted-foreground">
                                        {format(weekRange.start, "dd/MM", { locale: ptBR })} - {format(weekRange.end, "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
                                );
                            } catch {
                                return null;
                            }
                        })()}
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {loadingResults ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                                <p className="text-sm text-muted-foreground mt-2">Carregando resultados...</p>
                            </div>
                        ) : weekResults.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Nenhum resultado encontrado para esta gincana.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {weekResults
                                    .sort((a, b) => b.realizado - a.realizado) // Ordenar por realizado (maior primeiro)
                                    .map((result, index) => (
                                        <Card 
                                            key={result.colaboradora_id} 
                                            className={`border-2 ${
                                                result.bateu_super_meta 
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20' 
                                                    : result.bateu_meta 
                                                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                                                        : 'border-red-200 bg-red-50 dark:bg-red-950/20'
                                            }`}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                                                            <h3 className="font-semibold text-base">{result.colaboradora_name}</h3>
                                                            {result.bateu_super_meta ? (
                                                                <Badge variant="default" className="bg-purple-600">
                                                                    <Trophy className="h-3 w-3 mr-1" />
                                                                    Super Meta
                                                                </Badge>
                                                            ) : result.bateu_meta ? (
                                                                <Badge variant="default" className="bg-green-600">
                                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                    Meta
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="destructive">
                                                                    <XCircle className="h-3 w-3 mr-1" />
                                                                    Não Bateu
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4 mt-3">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Meta</p>
                                                                <p className="font-semibold text-sm">R$ {result.meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Super Meta</p>
                                                                <p className="font-semibold text-sm">R$ {result.super_meta_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Realizado</p>
                                                                <p className={`font-bold text-base ${
                                                                    result.bateu_super_meta ? 'text-purple-600' : 
                                                                    result.bateu_meta ? 'text-green-600' : 'text-red-600'
                                                                }`}>
                                                                    R$ {result.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">% da Meta</p>
                                                                <p className={`font-semibold text-sm ${
                                                                    result.percentual >= 100 ? 'text-green-600' : 'text-red-600'
                                                                }`}>
                                                                    {result.percentual.toFixed(1)}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">
                            {editingGoal ? "Editar Gincana Semanal" : "Nova Gincana Semanal"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 sm:space-y-5 py-3 sm:py-4">
                        {/* 1. Seleção de Loja */}
                        <div>
                            <Label className="text-xs sm:text-sm font-semibold">1. Selecionar Loja *</Label>
                            <Select value={selectedStore} onValueChange={async (value) => {
                                console.log('[Select Store] ========== LOJA SELECIONADA ==========');
                                console.log('[Select Store] Loja ID:', value);
                                console.log('[Select Store] Estado atual - colaboradoras totais:', colaboradoras.length);
                                
                                setSelectedStore(value);
                                setColaboradorasAtivas([]);
                                setMonthlyGoal(null);
                                setSuggestedWeeklyMeta(0);
                                setSuggestedWeeklySuperMeta(0);
                                
                                // Carregar colaboradoras da loja selecionada imediatamente
                                if (value) {
                                    console.log('[Select Store] Colaboradoras da loja selecionada:', colaboradoras.filter(c => c.store_id === value).length);
                                    
                                    // Se não temos colaboradoras, buscar agora
                                    if (colaboradoras.length === 0) {
                                        console.log('[Select Store] ⚠️ Nenhuma colaboradora carregada, buscando agora...');
                                        await fetchColaboradoras();
                                        // Aguardar para o estado atualizar
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                        console.log('[Select Store] Após fetch, colaboradoras:', colaboradoras.length);
                                    }
                                    
                                    // Aguardar um pouco para garantir que colaboradoras foram carregadas
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                    console.log('[Select Store] Chamando loadSuggestions(true)...');
                                    await loadSuggestions(true); // forceLoadColabs = true para carregar mesmo sem semana
                                    console.log('[Select Store] loadSuggestions concluído');
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
                                                    {colaboradorasAtivas.length === 0 && colaboradoras.filter(c => c.store_id === selectedStore).length > 0 && (
                                                        <div className="text-center text-sm text-muted-foreground py-4">
                                                            <p className="mb-2">Nenhuma colaboradora encontrada para esta loja.</p>
                                                            <p className="text-xs">Verifique se há colaboradoras cadastradas e ativas.</p>
                                                        </div>
                                                    )}
                                                    {colaboradorasAtivas.length === 0 && colaboradoras.filter(c => c.store_id === selectedStore).length === 0 && (
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

                                {/* Gincana Semanal Sugerida */}
                                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                                    <CardContent className="p-3 sm:p-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium">Gincana Semanal Sugerida (por colaboradora ativa)</p>
                                                    <p className="text-base sm:text-lg text-green-900 dark:text-green-100 font-bold mt-1">
                                                        R$ {suggestedWeeklyMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1">
                                                        ({colaboradorasAtivas.filter(c => c.active).length} colaboradora{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''} ativa{colaboradorasAtivas.filter(c => c.active).length !== 1 ? 's' : ''})
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs sm:text-sm text-purple-700 dark:text-purple-300 font-medium">Super Gincana Semanal Sugerida</p>
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
                                    Excluir Gincana Semanal
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

