import { useState, useEffect, useRef, Fragment, lazy, Suspense, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, getBrazilDateString, getBrazilNow, BRAZIL_TIMEZONE } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, UserCheck, Calendar, ClipboardList, Check, Trophy, LogOut, Medal, Award, Download, FileSpreadsheet, FileText, Database, ChevronDown, ChevronRight, Loader2, Store, AlertTriangle, X, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Switch } from "@/components/ui/switch";
import { useFolgas } from "@/hooks/useFolgas";
import { useGoalRedistribution } from "@/hooks/useGoalRedistribution";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { format, startOfWeek, getWeek, getYear, getDaysInMonth } from "date-fns";
import { StoreLogo } from "@/lib/storeLogo";
import {
    validateFormasPagamento,
    getFormaPrincipal,
    calcularTotalFormas,
    formatFormasPagamentoResumo,
    type FormaPagamento as FormaPagamentoType,
    PAYMENT_METHOD_TYPES,
    type PaymentMethodType
} from "@/lib/payment-validation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";
import { LoadingButton } from "@/components/ui/loading-button";
import { useQueryClient } from "@tanstack/react-query";
import { useClientSearch } from "@/hooks/use-client-search";
import { ClientSearchInput } from "@/components/shared/ClientSearchInput";
import { NewClientDialog } from "@/components/shared/NewClientDialog";
import {
    useStoreSettings,
    useStoreSales,
    useStoreColaboradoras,
    useStoreGoals,
    useStoreMetrics,
    useStoreMonthlyProgress,
    useStore7DayHistory,
    useStoreColaboradorasPerformance,
    useStoreRankingTop3,
    useStoreMonthlyRanking,
    useCreateSale,
    useDeleteSale,
} from "@/hooks/queries";
import { QUERY_KEYS } from "@/hooks/queries/types";

import { TimeClockLojaView } from "@/components/timeclock/TimeClockLojaView";

// Lazy imports com tratamento de erro
const WeeklyGoalProgress = lazy(() => import("@/components/WeeklyGoalProgress"));
const WeeklyBonusProgress = lazy(() => import("@/components/WeeklyBonusProgress"));
const WeeklyGincanaResults = lazy(() => import("@/components/loja/WeeklyGincanaResults"));
const PostSaleSchedulerDialog = lazy(() => import("@/components/loja/PostSaleSchedulerDialog"));
const TrophiesGallery = lazy(() => import("@/components/loja/TrophiesGallery").then(m => ({ default: m.TrophiesGallery })));
const CashbackLojaView = lazy(() => import("@/components/loja/CashbackLojaView"));
const CRMLojaView = lazy(() => import("@/components/loja/CRMLojaView"));
const WishlistLojaView = lazy(() => import("@/components/loja/WishlistLojaView"));
// const TimeClockLojaView = lazy(() => import("@/components/timeclock/TimeClockLojaView").then(m => ({ default: m.TimeClockLojaView })));
const StoreConditionalsAdjustments = lazy(() => import("@/components/loja/StoreConditionalsAdjustments"));
const CaixaLojaView = lazy(() => import("@/components/loja/CaixaLojaView"));

interface Sale {
    id: string;
    colaboradora_id: string;
    valor: number;
    qtd_pecas: number;
    data_venda: string;
    observacoes: string | null;
    tiny_order_id: string | null;
    cliente_id?: string | null;
    cliente_nome?: string | null;
    colaboradora: {
        name: string;
    };
}

interface Colaboradora {
    id: string;
    name: string;
    active?: boolean;
    is_active?: boolean;
}

export default function LojaDashboard() {
    const { profile, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [isReloading, setIsReloading] = useState(false);

    const handleReloadData = () => {
        setIsReloading(true);
        window.location.reload();
    };

    const [sales, setSales] = useState<Sale[]>([]);
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [storeId, setStoreId] = useState<string | null>(null);
    const [storeName, setStoreName] = useState<string | null>(null);
    const [salesDateFilter, setSalesDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [cashbackAtivo, setCashbackAtivo] = useState<boolean>(false);
    const [crmAtivo, setCrmAtivo] = useState<boolean>(false);
    const [pontoAtivo, setPontoAtivo] = useState<boolean>(false);
    const [wishlistAtivo, setWishlistAtivo] = useState<boolean>(false);
    const [ajustesCondicionaisAtivo, setAjustesCondicionaisAtivo] = useState<boolean>(false);
    const [caixaAtivo, setCaixaAtivo] = useState<boolean>(false);
    const [activeView, setActiveView] = useState<'metas' | 'cashback' | 'crm' | 'wishlist' | 'ponto' | 'ajustes' | 'caixa'>('metas');

    const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoType[]>([{
        tipo: 'DINHEIRO',
        valor: 0,
    }]);

    const [formData, setFormData] = useState({
        colaboradora_id: "",
        valor: "",
        qtd_pecas: "",
        data_venda: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        observacoes: "",
        cliente_id: "", // ID do cliente cadastrado (opcional)
        cliente_nome: "", // Nome do cliente (opcional, pode ser texto livre ou "Consumidor Final")
    });

    // Estados para busca de cliente
    const [searchCliente, setSearchCliente] = useState("");
    const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
    const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);

    // Buscar clientes (padrão cashback - busca todos uma vez)
    // Usar storeId do estado (pode ser da loja ou da colaboradora)
    const { clients: filteredClientsForSearchInput, allClients, refresh: refreshClients } = useClientSearch(searchCliente, {
        fetchOnce: true,
        storeId: storeId || profile?.store_id || undefined, // Filtrar por loja atual
    });

    // Debug: log quando storeId mudar
    useEffect(() => {
        console.log('[LojaDashboard] 📍 storeId atualizado:', {
            storeId,
            profileStoreId: profile?.store_id,
            finalStoreId: storeId || profile?.store_id || undefined
        });
    }, [storeId, profile?.store_id]);

    const [goals, setGoals] = useState<any>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [colaboradorasPerformance, setColaboradorasPerformance] = useState<any[]>([]);
    const [colaboradorasPerformanceCaixa, setColaboradorasPerformanceCaixa] = useState<any[]>([]);
    const [rankingTop3, setRankingTop3] = useState<any[]>([]);
    const [rankingMonthly, setRankingMonthly] = useState<any[]>([]);
    const [offDayDialog, setOffDayDialog] = useState(false);
    const [selectedColabForOffDay, setSelectedColabForOffDay] = useState<string | null>(null);
    const [offDayDate, setOffDayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dailyGoal, setDailyGoal] = useState<number>(0);
    const [dailyProgress, setDailyProgress] = useState<number>(0);
    const [monthlyProgress, setMonthlyProgress] = useState<number>(0);
    const [monthlyRealizado, setMonthlyRealizado] = useState<number>(0);
    const [history7Days, setHistory7Days] = useState<any[]>([]);
    const [monthlyDataByDay, setMonthlyDataByDay] = useState<{
        colaboradoraId: string;
        colaboradoraName: string;
        dailySales: Record<string, { valor: number; qtdVendas: number; qtdPecas: number; metaDiaria: number }>;
        totalMes: number;
    }[]>([]);

    // Estados para o diálogo de pós-venda (CRM)
    const [postSaleDialogOpen, setPostSaleDialogOpen] = useState(false);
    const [lastSaleData, setLastSaleData] = useState<{
        saleId: string;
        colaboradoraId: string;
        saleDate: string;
        saleObservations?: string;
        clienteId?: string; // ID do cliente (se selecionado)
        clienteNome?: string; // Nome do cliente (se selecionado)
        clienteTelefone?: string; // Telefone do cliente (se disponível)
    } | null>(null);

    // Refs para prevenir múltiplas chamadas
    const isIdentifyingStoreRef = useRef(false);
    const isFetchingDataRef = useRef(false);
    const lastFetchedStoreIdRef = useRef<string | null>(null);

    // ============= HOOKS REACT-QUERY (SUBSTITUINDO FUNÇÕES LEGADAS) =============
    const queryClient = useQueryClient();

    // Hook para configurações da loja (cashback_ativo, crm_ativo)
    const { data: storeSettings } = useStoreSettings(storeId);

    // Hook para vendas do dia
    const { data: salesData = [], isLoading: salesLoading, refetch: refetchSales } = useStoreSales(storeId, salesDateFilter);

    // Hook para colaboradoras da loja
    const { data: colaboradorasData = [], isLoading: colaboradorasLoading } = useStoreColaboradoras(storeId, storeName);

    // Hook para metas da loja
    const { data: goalsData, isLoading: goalsLoading } = useStoreGoals(storeId);

    // Hook para métricas do dia
    const { data: metricsData, isLoading: metricsLoading } = useStoreMetrics(storeId);

    // Hook para progresso mensal
    const { data: monthlyProgressData } = useStoreMonthlyProgress(storeId, goalsData?.meta_valor || 0);

    // Hook para histórico 7 dias
    const { data: history7DaysData = [] } = useStore7DayHistory(storeId);

    // Hook para ranking Top 3
    const { data: rankingTop3Data = [] } = useStoreRankingTop3(storeId);

    // Hook para ranking mensal
    const { data: rankingMonthlyData = [] } = useStoreMonthlyRanking(storeId, storeName);

    // Hook para performance das colaboradoras
    const { data: colaboradorasPerformanceData = [], refetch: refetchColaboradorasPerformance } = useStoreColaboradorasPerformance(
        storeId,
        colaboradorasData
    );

    // Hooks para gestão de folgas
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { offDays, toggleFolga, isOnLeave, refetch: refetchFolgas, loading: loadingFolgas } = useFolgas({ storeId, date: todayStr });

    const { redistributeGoalsForDate } = useGoalRedistribution({ storeId });

    // REDISTRIBUIÇÃO DE METAS - PÓS-PROCESSAMENTO
    // Calcula redistribuição baseada na situação INDIVIDUAL de cada colaboradora
    // - Atrás: meta base + déficit individual distribuído
    // - À frente: meta base × (1 + % à frente individual)
    // - Soma trabalhando = 100% da meta dinâmica da loja
    const redistributedPerformance = useMemo(() => {
        if (!colaboradorasPerformance || colaboradorasPerformance.length === 0) {
            return {
                data: [],
                totalMetaDiariaOriginal: 0,
                totalMetaDiariaRedistribuida: 0,
                totalTrabalhando: 0,
                totalFolga: 0
            };
        }

        const hoje = getBrazilNow();
        const todayStr = format(hoje, 'yyyy-MM-dd');
        const daysInMonth = getDaysInMonth(hoje);
        const diaAtual = hoje.getDate();
        const diasRestantesComHoje = daysInMonth - diaAtual + 1;
        const metaMensalLoja = goals?.meta_valor || 0;
        const dailyWeights = goals?.daily_weights || null;
        const year = hoje.getFullYear();
        const month = hoje.getMonth() + 1;

        // Identificar quem está de folga
        const offColabIds = new Set(offDays.map(od => od.colaboradora_id));
        const working = colaboradorasPerformance.filter(p => !offColabIds.has(p.id));
        const onLeave = colaboradorasPerformance.filter(p => offColabIds.has(p.id));

        // ========== PASSO 1: Calcular meta dinâmica INDIVIDUAL de cada colaboradora ==========
        const colabsComMetaDinamica = colaboradorasPerformance.map(perf => {
            const metaMensalColab = perf.meta || 0;
            // Usar vendidoMes se existir, senão totalVendas (campo do hook)
            const vendidoMesColab = perf.vendidoMes ?? perf.totalVendas ?? 0;
            const isOnLeaveToday = offColabIds.has(perf.id);

            // Meta base do dia (por peso ou uniforme)
            let metaBaseDoDia = metaMensalColab / daysInMonth;
            if (dailyWeights && Object.keys(dailyWeights).length > 0) {
                const hojePeso = dailyWeights[todayStr] || 0;
                if (hojePeso > 0) {
                    metaBaseDoDia = (metaMensalColab * hojePeso) / 100;
                }
            }

            // Meta esperada até ontem (individual)
            let metaEsperadaAteOntem = 0;
            if (dailyWeights && Object.keys(dailyWeights).length > 0) {
                for (let d = 1; d < diaAtual; d++) {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const peso = dailyWeights[dateStr] || 0;
                    metaEsperadaAteOntem += (metaMensalColab * peso) / 100;
                }
            } else {
                metaEsperadaAteOntem = (metaMensalColab / daysInMonth) * (diaAtual - 1);
            }

            // Diferença individual
            const diferencaIndividual = vendidoMesColab - metaEsperadaAteOntem;
            
            let metaDinamica: number;
            let situacao: 'afrente' | 'atras' | 'neutro';

            if (metaMensalColab <= 0) {
                // Sem meta = sem meta dinâmica
                metaDinamica = 0;
                situacao = 'neutro';
            } else if (diferencaIndividual >= 0 && metaEsperadaAteOntem > 0) {
                // À FRENTE: meta base × (1 + % à frente)
                const percentualAFrente = diferencaIndividual / metaEsperadaAteOntem;
                metaDinamica = metaBaseDoDia * (1 + percentualAFrente);
                situacao = 'afrente';
            } else if (diferencaIndividual < 0) {
                // ATRÁS: meta base + déficit distribuído
                const deficit = Math.abs(diferencaIndividual);
                const adicionalPorDia = diasRestantesComHoje > 0 ? deficit / diasRestantesComHoje : 0;
                metaDinamica = metaBaseDoDia + adicionalPorDia;
                situacao = 'atras';
            } else {
                // Primeiro dia do mês ou sem histórico
                metaDinamica = metaBaseDoDia;
                situacao = 'neutro';
            }

            // PROTEÇÃO: Meta nunca menor que a meta base do dia
            if (metaDinamica < metaBaseDoDia) {
                metaDinamica = metaBaseDoDia;
            }

            // PROTEÇÃO: Meta não pode ser maior que 50% da meta mensal
            const maxMetaDiaria = metaMensalColab * 0.5;
            if (metaDinamica > maxMetaDiaria && maxMetaDiaria > 0) {
                metaDinamica = maxMetaDiaria;
            }

            return {
                ...perf,
                metaBaseDoDia,
                metaDinamicaIndividual: metaDinamica,
                situacao,
                isOnLeave: isOnLeaveToday
            };
        });

        // ========== PASSO 2: Separar colaboradoras por situação ==========
        // Colaboradoras ATRÁS têm meta obrigatória (não pode ser reduzida)
        // Colaboradoras À FRENTE/NEUTRO podem ser ajustadas
        const workingBehind = colabsComMetaDinamica.filter(p => !p.isOnLeave && p.situacao === 'atras');
        const workingAheadOrNeutral = colabsComMetaDinamica.filter(p => !p.isOnLeave && p.situacao !== 'atras');

        // Soma das metas OBRIGATÓRIAS (quem está atrás - não pode reduzir)
        const somaMetasObrigatorias = workingBehind.reduce((sum, p) => sum + p.metaDinamicaIndividual, 0);

        // Soma das metas AJUSTÁVEIS (quem está à frente ou neutro)
        const somaMetasAjustaveis = workingAheadOrNeutral.reduce((sum, p) => sum + p.metaDinamicaIndividual, 0);

        // ========== PASSO 3: Redistribuir metas de folga ==========
        const totalMetaFolga = colabsComMetaDinamica
            .filter(p => p.isOnLeave)
            .reduce((sum, p) => sum + p.metaDinamicaIndividual, 0);

        const redistribuicaoPorColab = working.length > 0 ? totalMetaFolga / working.length : 0;

        // ========== PASSO 4: Ajustar APENAS as metas ajustáveis ==========
        // Meta dinâmica da loja (dailyGoal já calculado)
        const metaDinamicaLoja = dailyGoal || 0;

        // Quanto sobra para as ajustáveis depois de garantir as obrigatórias
        const metaDisponivelParaAjustaveis = Math.max(0, metaDinamicaLoja - somaMetasObrigatorias);

        // Fator de ajuste APENAS para as ajustáveis
        let fatorAjusteAjustaveis = 1;
        if (somaMetasAjustaveis > 0 && metaDisponivelParaAjustaveis > 0) {
            fatorAjusteAjustaveis = metaDisponivelParaAjustaveis / somaMetasAjustaveis;
        } else if (somaMetasAjustaveis > 0 && metaDisponivelParaAjustaveis <= 0) {
            // Não há espaço para ajustáveis - todas vão para meta base
            fatorAjusteAjustaveis = 0;
        }

        // Criar array final com metas ajustadas
        const enrichedData = colabsComMetaDinamica.map(perf => {
            if (perf.isOnLeave) {
                return {
                    ...perf,
                    metaDiariaRedistribuida: 0,
                    redistribuicaoExtra: 0,
                    vendidoHoje: perf.vendidoHoje || 0,
                    metaDiaria: perf.metaDinamicaIndividual
                };
            }

            let metaFinal: number;

            if (perf.situacao === 'atras') {
                // ATRÁS: meta obrigatória, não pode ser reduzida
                metaFinal = perf.metaDinamicaIndividual;
            } else {
                // À FRENTE ou NEUTRO: pode ser ajustada
                // Se fator = 0, usar meta base como mínimo
                metaFinal = Math.max(
                    perf.metaBaseDoDia,
                    perf.metaDinamicaIndividual * fatorAjusteAjustaveis
                );
            }

            // Adicionar redistribuição de folga
            const metaAjustadaFinal = metaFinal + redistribuicaoPorColab;

            return {
                ...perf,
                metaDiariaRedistribuida: metaAjustadaFinal,
                redistribuicaoExtra: redistribuicaoPorColab,
                vendidoHoje: perf.vendidoHoje || 0,
                metaDiaria: metaFinal
            };
        });

        // Validar soma
        const totalMetaRedist = enrichedData
            .filter(p => !p.isOnLeave)
            .reduce((sum, p) => sum + (p.metaDiariaRedistribuida || 0), 0);

        console.log('[RedistribuicaoMetas] INDIVIDUAL - Resumo:', {
            totalColaboradoras: colaboradorasPerformance.length,
            trabalhando: working.length,
            atras: workingBehind.length,
            aFrenteOuNeutro: workingAheadOrNeutral.length,
            folga: onLeave.length,
            somaMetasObrigatorias: somaMetasObrigatorias.toFixed(2),
            somaMetasAjustaveis: somaMetasAjustaveis.toFixed(2),
            metaDinamicaLoja: metaDinamicaLoja.toFixed(2),
            metaDisponivelParaAjustaveis: metaDisponivelParaAjustaveis.toFixed(2),
            fatorAjusteAjustaveis: fatorAjusteAjustaveis.toFixed(4),
            redistribuicaoPorColab: redistribuicaoPorColab.toFixed(2),
            totalMetaRedistribuida: totalMetaRedist.toFixed(2),
            detalhes: enrichedData.map(p => ({
                nome: p.name,
                situacao: p.situacao,
                metaBase: p.metaBaseDoDia?.toFixed(2),
                metaDinamica: p.metaDinamicaIndividual?.toFixed(2),
                metaFinal: p.metaDiariaRedistribuida?.toFixed(2),
                folga: p.isOnLeave
            }))
        });

        return {
            data: enrichedData,
            totalMetaDiariaOriginal: somaMetasObrigatorias + somaMetasAjustaveis,
            totalMetaDiariaRedistribuida: totalMetaRedist,
            totalTrabalhando: working.length,
            totalFolga: onLeave.length
        };
    }, [colaboradorasPerformance, offDays, goals, monthlyRealizado, dailyGoal]);

    // REDISTRIBUIÇÃO PARA CAIXA - LISTA COMPLETA (inclui gerentes sem meta)
    // Usa mesma lógica individual de redistributedPerformance
    const redistributedPerformanceCaixa = useMemo(() => {
        if (!colaboradorasPerformanceCaixa || colaboradorasPerformanceCaixa.length === 0) {
            return { data: [] };
        }

        const hoje = getBrazilNow();
        const todayStr = format(hoje, 'yyyy-MM-dd');
        const daysInMonth = getDaysInMonth(hoje);
        const diaAtual = hoje.getDate();
        const diasRestantesComHoje = daysInMonth - diaAtual + 1;
        const dailyWeights = goals?.daily_weights || null;
        const year = hoje.getFullYear();
        const month = hoje.getMonth() + 1;

        const offColabIds = new Set(offDays.map(od => od.colaboradora_id));

        // Calcular meta dinâmica individual para cada colaboradora
        const enrichedData = colaboradorasPerformanceCaixa.map(perf => {
            const metaMensalColab = perf.meta || 0;
            // Usar vendidoMes se existir, senão totalVendas (campo do hook)
            const vendidoMesColab = perf.vendidoMes ?? perf.totalVendas ?? 0;
            const isOnLeaveToday = offColabIds.has(perf.id);

            // Meta base do dia
            let metaBaseDoDia = metaMensalColab > 0 ? metaMensalColab / daysInMonth : 0;
            if (dailyWeights && Object.keys(dailyWeights).length > 0) {
                const hojePeso = dailyWeights[todayStr] || 0;
                if (hojePeso > 0) {
                    metaBaseDoDia = (metaMensalColab * hojePeso) / 100;
                }
            }

            // Meta esperada até ontem (individual)
            let metaEsperadaAteOntem = 0;
            if (dailyWeights && Object.keys(dailyWeights).length > 0) {
                for (let d = 1; d < diaAtual; d++) {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const peso = dailyWeights[dateStr] || 0;
                    metaEsperadaAteOntem += (metaMensalColab * peso) / 100;
                }
            } else {
                metaEsperadaAteOntem = (metaMensalColab / daysInMonth) * (diaAtual - 1);
            }

            const diferencaIndividual = vendidoMesColab - metaEsperadaAteOntem;
            let metaDinamica = metaBaseDoDia;

            if (metaMensalColab > 0) {
                if (diferencaIndividual >= 0 && metaEsperadaAteOntem > 0) {
                    // À frente: majorar
                    const percentualAFrente = diferencaIndividual / metaEsperadaAteOntem;
                    metaDinamica = metaBaseDoDia * (1 + percentualAFrente);
                } else if (diferencaIndividual < 0) {
                    // Atrás: compensar déficit distribuído
                    const deficit = Math.abs(diferencaIndividual);
                    const adicionalPorDia = diasRestantesComHoje > 0 ? deficit / diasRestantesComHoje : 0;
                    metaDinamica = metaBaseDoDia + adicionalPorDia;
                }

                // Proteção: nunca menor que meta base
                if (metaDinamica < metaBaseDoDia) {
                    metaDinamica = metaBaseDoDia;
                }

                // Proteção: max 50% da meta mensal
                const maxMeta = metaMensalColab * 0.5;
                if (metaDinamica > maxMeta) {
                    metaDinamica = maxMeta;
                }
            }

            return {
                ...perf,
                metaDiariaRedistribuida: isOnLeaveToday ? 0 : metaDinamica,
                redistribuicaoExtra: 0,
                isOnLeave: isOnLeaveToday,
                vendidoHoje: perf.vendidoHoje || 0,
                metaDiaria: metaDinamica
            };
        });

        return { data: enrichedData };
    }, [colaboradorasPerformanceCaixa, offDays, goals]);

    useEffect(() => {
        if (salesData) {
            setSales(salesData as Sale[]);
        }
    }, [salesData]);

    useEffect(() => {
        if (colaboradorasData) {
            setColaboradoras(colaboradorasData as Colaboradora[]);
        }
    }, [colaboradorasData]);

    useEffect(() => {
        if (goalsData) {
            setGoals(goalsData);
        }
    }, [goalsData]);

    useEffect(() => {
        if (metricsData) {
            setMetrics(metricsData);
        }
    }, [metricsData]);

    useEffect(() => {
        if (monthlyProgressData) {
            setMonthlyRealizado(monthlyProgressData.realizado);
            setMonthlyProgress(monthlyProgressData.percentual);
        }
    }, [monthlyProgressData]);

    useEffect(() => {
        if (history7DaysData) {
            setHistory7Days(history7DaysData);
        }
    }, [history7DaysData]);

    useEffect(() => {
        if (rankingTop3Data) {
            setRankingTop3(rankingTop3Data.map(r => ({
                colaboradora_id: r.colaboradoraId,
                colaboradora_name: r.colaboradoraName,
                total: r.total
            })));
        }
    }, [rankingTop3Data]);

    useEffect(() => {
        if (rankingMonthlyData) {
            setRankingMonthly(rankingMonthlyData.map(r => ({
                colaboradora_id: r.colaboradoraId,
                name: r.colaboradoraName,
                total: r.total,
                qtdVendas: (r as any).qtdVendas || 0
            })));
        }
    }, [rankingMonthlyData]);

    // Flag para controlar se devemos usar dados do React Query ou do fetchDataWithStoreId
    const useLocalPerformanceRef = useRef(false);

    useEffect(() => {
        // Só atualizar do React Query se não estivermos usando dados locais
        // Isso evita que o React Query sobrescreva dados atualizados localmente
        if (colaboradorasPerformanceData && !useLocalPerformanceRef.current) {
            // ✅ Planejamento usa apenas colaboradoras COM meta > 0
            const performanceComMeta = colaboradorasPerformanceData.filter((p: any) => p.meta > 0);
            setColaboradorasPerformance(performanceComMeta);
            // ✅ Caixa usa lista completa (todas as colaboradoras)
            setColaboradorasPerformanceCaixa(colaboradorasPerformanceData);
        }
    }, [colaboradorasPerformanceData]);
    // ============= FIM DOS HOOKS REACT-QUERY =============

    useEffect(() => {
        if (authLoading) {
            // Still loading auth, wait
            return;
        }

        if (!profile || (profile.role !== 'LOJA' && profile.role !== 'ADMIN')) {
            navigate('/');
            return;
        }

        // Verificar se o admin da loja está ativo
        if (profile.role === 'LOJA' && profile.store_id) {
            // Buscar admin da loja e verificar se está ativo
            supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('admin_id, profiles!stores_admin_id_fkey(id, is_active)')
                .eq('id', profile.store_id)
                .single()
                .then(({ data: storeData, error: storeError }) => {
                    if (storeError) {
                        console.error('Erro ao verificar admin da loja:', storeError);
                        return;
                    }

                    const adminIsActive = storeData?.profiles?.is_active !== false;
                    if (!adminIsActive) {
                        // Admin desativado - bloquear acesso
                        console.warn('⚠️ Admin da loja está desativado - bloqueando acesso');
                        return;
                    }

                    // Admin ativo - continuar normalmente
                    if (!isIdentifyingStoreRef.current) {
                        isIdentifyingStoreRef.current = true;
                        identifyStore();
                    }
                });
        } else if (profile.role === 'ADMIN') {
            // ADMIN não precisa carregar dados de loja específica aqui
            setLoading(false);
        }
    }, [profile, authLoading, navigate]);

    // ✅ ATUALIZAR ESTADOS DOS MÓDULOS quando storeSettings mudar OU quando storeId mudar
    useEffect(() => {
        const updateModuleStates = async () => {
            console.log('[LojaDashboard] 🔄 useEffect updateModuleStates executado:', {
                storeId,
                hasStoreSettings: !!storeSettings,
                storeSettingsData: storeSettings
            });

            // Prioridade 1: Usar storeSettings do hook React Query
            if (storeSettings) {
                console.log('[LojaDashboard] ✅ Atualizando módulos via storeSettings:', {
                    cashback: storeSettings.cashback_ativo,
                    crm: storeSettings.crm_ativo,
                    ponto: storeSettings.ponto_ativo,
                    wishlist: storeSettings.wishlist_ativo,
                    ajustesCondicionais: storeSettings.ajustes_condicionais_ativo,
                    caixa: storeSettings.caixa_ativo,
                    storeId: storeId,
                    cashbackType: typeof storeSettings.cashback_ativo,
                    crmType: typeof storeSettings.crm_ativo
                });

                // Usar Boolean() para garantir conversão correta
                const cashback = Boolean(storeSettings.cashback_ativo);
                const crm = Boolean(storeSettings.crm_ativo);
                const ponto = Boolean(storeSettings.ponto_ativo);
                const wishlist = Boolean(storeSettings.wishlist_ativo);
                const ajustesCondicionais = Boolean(storeSettings.ajustes_condicionais_ativo);
                const caixa = Boolean(storeSettings.caixa_ativo);

                console.log('[LojaDashboard] ✅ Valores booleanos calculados:', {
                    cashback,
                    crm,
                    ponto,
                    wishlist,
                    ajustesCondicionais,
                    caixa,
                    rawCashback: storeSettings.cashback_ativo,
                    rawCrm: storeSettings.crm_ativo
                });

                setCashbackAtivo(cashback);
                setCrmAtivo(crm);
                setPontoAtivo(ponto);
                setWishlistAtivo(wishlist);
                setAjustesCondicionaisAtivo(ajustesCondicionais);
                setCaixaAtivo(caixa);

                console.log('[LojaDashboard] ✅ Estados atualizados via storeSettings');
                return;
            }

            // Prioridade 2: Fallback direto do Supabase se storeSettings não estiver disponível
            if (storeId) {
                console.log('[LojaDashboard] ⚠️ storeSettings não disponível, usando fallback para storeId:', storeId);
                try {
                    const { data, error } = await supabase
                        .schema('sistemaretiradas')
                        .from('stores')
                        .select('cashback_ativo, crm_ativo, ponto_ativo, wishlist_ativo, ajustes_condicionais_ativo, caixa_ativo')
                        .eq('id', storeId)
                        .maybeSingle(); // ✅ Usar maybeSingle() para evitar erro quando não encontrar

                    if (error) {
                        console.error('[LojaDashboard] ❌ Erro ao buscar módulos (fallback):', error);
                        console.error('[LojaDashboard] ❌ Detalhes do erro:', {
                            message: error.message,
                            details: error.details,
                            hint: error.hint,
                            code: error.code
                        });
                        return;
                    }

                    if (data) {
                        console.log('[LojaDashboard] ✅ Módulos encontrados (fallback):', {
                            cashback: data.cashback_ativo,
                            crm: data.crm_ativo,
                            ponto: data.ponto_ativo,
                            wishlist: data.wishlist_ativo,
                            ajustesCondicionais: data.ajustes_condicionais_ativo,
                            caixa: data.caixa_ativo,
                            cashbackType: typeof data.cashback_ativo
                        });

                        const cashback = data.cashback_ativo === true;
                        const crm = data.crm_ativo === true;
                        const ponto = data.ponto_ativo === true;
                        const wishlist = data.wishlist_ativo === true;
                        const ajustesCondicionais = data.ajustes_condicionais_ativo === true;
                        const caixa = data.caixa_ativo === true;

                        console.log('[LojaDashboard] ✅ Setando módulos (fallback):', {
                            cashback,
                            crm,
                            ponto,
                            wishlist,
                            ajustesCondicionais,
                            caixa
                        });

                        setCashbackAtivo(cashback);
                        setCrmAtivo(crm);
                        setPontoAtivo(ponto);
                        setWishlistAtivo(wishlist);
                        setAjustesCondicionaisAtivo(ajustesCondicionais);
                        setCaixaAtivo(caixa);
                    } else {
                        console.warn('[LojaDashboard] ⚠️ data é null ou undefined no fallback');
                    }
                } catch (error) {
                    console.error('[LojaDashboard] ❌ Erro ao verificar status dos módulos:', error);
                }
            } else {
                console.log('[LojaDashboard] ⚠️ storeId não disponível ainda');
            }
        };

        updateModuleStates();
    }, [storeId, storeSettings]);

    const identifyStore = async () => {
        if (!profile) return;

        try {
            // Primeiro, tentar usar store_id se disponível
            let targetStoreId = profile.store_id;

            // Se não tiver store_id, tentar usar store_default como UUID
            if (!targetStoreId && profile.store_default) {
                // Verificar se store_default é um UUID válido (formato UUID)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(profile.store_default)) {
                    targetStoreId = profile.store_default;
                } else {
                    // Se store_default não é UUID, é o nome da loja - buscar o ID
                    // Buscar todas as lojas ativas e fazer matching flexível
                    const { data: allStores, error: storesError } = await supabase
                        .schema("sistemaretiradas")
                        .from("stores")
                        .select("id, name")
                        .eq("active", true);

                    if (storesError) {
                        console.error("Erro ao buscar lojas:", storesError);
                        throw storesError;
                    }

                    if (allStores && allStores.length > 0) {
                        // Normalizar nomes para comparação (remover espaços, caracteres especiais, etc)
                        const normalizeName = (name: string) => {
                            return name
                                .toLowerCase()
                                .replace(/[|,]/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                        };

                        const normalizedProfileName = normalizeName(profile.store_default || '');

                        // Tentar encontrar match exato primeiro
                        let matchingStore = allStores.find(store =>
                            store.name === profile.store_default ||
                            store.name.toLowerCase() === profile.store_default?.toLowerCase()
                        );

                        // Se não encontrou, tentar match normalizado
                        if (!matchingStore) {
                            matchingStore = allStores.find(store =>
                                normalizeName(store.name) === normalizedProfileName
                            );
                        }

                        // Se ainda não encontrou, tentar match parcial
                        if (!matchingStore) {
                            matchingStore = allStores.find(store => {
                                const normalizedStoreName = normalizeName(store.name);
                                return normalizedStoreName.includes(normalizedProfileName) ||
                                    normalizedProfileName.includes(normalizedStoreName);
                            });
                        }

                        if (matchingStore) {
                            targetStoreId = matchingStore.id;
                            setStoreName(matchingStore.name);
                            console.log('[LojaDashboard] ✅ Loja encontrada!');
                            console.log('[LojaDashboard]   Nome:', matchingStore.name);
                            console.log('[LojaDashboard]   ID (UUID):', matchingStore.id);
                            console.log('[LojaDashboard]   store_default do perfil:', profile.store_default);
                        } else {
                            console.error('[LojaDashboard] ❌ Loja não encontrada com nome:', profile.store_default);
                            console.error('[LojaDashboard] Lojas disponíveis:', allStores.map(s => `${s.name} (${s.id})`));
                            toast.error(`Loja "${profile.store_default}" não encontrada no sistema`);
                            setLoading(false);
                            return;
                        }
                    } else {
                        console.error("Nenhuma loja ativa encontrada no sistema");
                        toast.error("Nenhuma loja encontrada no sistema");
                        setLoading(false);
                        return;
                    }
                }
            }

            if (targetStoreId) {
                // Buscar nome da loja se ainda não tiver
                let finalStoreName = storeName;
                if (!finalStoreName) {
                    const { data: storeData } = await supabase
                        .schema("sistemaretiradas")
                        .from("stores")
                        .select("name")
                        .eq("id", targetStoreId)
                        .single();

                    if (storeData) {
                        finalStoreName = storeData.name;
                        console.log('[LojaDashboard] Nome da loja buscado:', finalStoreName);
                        setStoreName(finalStoreName);
                    }
                }

                console.log('[LojaDashboard] 🎯 Definindo storeId:', targetStoreId);
                console.log('[LojaDashboard] 🎯 storeName:', finalStoreName || 'não definido ainda');

                // ✅ BUSCAR MÓDULOS DIRETAMENTE DO BANCO quando identificar a loja
                try {
                    const { data: modulesData, error: modulesError } = await supabase
                        .schema('sistemaretiradas')
                        .from('stores')
                        .select('cashback_ativo, crm_ativo, ponto_ativo, wishlist_ativo')
                        .eq('id', targetStoreId)
                        .maybeSingle(); // ✅ Usar maybeSingle() para evitar erro quando não encontrar

                    if (!modulesError && modulesData) {
                        console.log('[LojaDashboard] ✅ Módulos carregados diretamente:', {
                            cashback: modulesData.cashback_ativo,
                            crm: modulesData.crm_ativo,
                            ponto: modulesData.ponto_ativo,
                            wishlist: modulesData.wishlist_ativo
                        });
                        // Usar Boolean() para garantir conversão correta
                        const cashback = Boolean(modulesData.cashback_ativo) && modulesData.cashback_ativo === true;
                        const crm = Boolean(modulesData.crm_ativo) && modulesData.crm_ativo === true;
                        const ponto = Boolean(modulesData.ponto_ativo) && modulesData.ponto_ativo === true;
                        const wishlist = Boolean(modulesData.wishlist_ativo) && modulesData.wishlist_ativo === true;

                        console.log('[LojaDashboard] ✅ Valores booleanos calculados (identifyStore):', {
                            cashback,
                            crm,
                            ponto,
                            wishlist,
                            rawValues: {
                                cashback: modulesData.cashback_ativo,
                                crm: modulesData.crm_ativo,
                                ponto: modulesData.ponto_ativo,
                                wishlist: modulesData.wishlist_ativo
                            }
                        });

                        // Setar módulos IMEDIATAMENTE
                        setCashbackAtivo(cashback);
                        setCrmAtivo(crm);
                        setPontoAtivo(ponto);
                        setWishlistAtivo(wishlist);

                        console.log('[LojaDashboard] ✅ Estados setados diretamente em identifyStore');
                    } else {
                        console.error('[LojaDashboard] ❌ Erro ao buscar módulos:', modulesError);
                    }
                } catch (error) {
                    console.error('[LojaDashboard] ❌ Erro ao buscar módulos:', error);
                }

                // IMPORTANTE: Setar os estados primeiro
                setStoreId(targetStoreId);
                if (finalStoreName) {
                    setStoreName(finalStoreName);
                }

                // Aguardar o próximo ciclo de render para garantir que os estados foram atualizados
                // e então buscar os dados usando uma função que usa o targetStoreId diretamente
                await new Promise(resolve => setTimeout(resolve, 50));

                // Criar uma versão de fetchData que usa o targetStoreId diretamente
                console.log('[LojaDashboard] 📡 Buscando dados com storeId:', targetStoreId);
                console.log('[LojaDashboard] 📡 Buscando dados com storeName:', finalStoreName || storeName);
                await fetchDataWithStoreId(targetStoreId, finalStoreName || storeName || undefined);
            } else {
                console.error("[LojaDashboard] ❌ Não foi possível identificar o ID da loja");
                toast.error("Erro ao identificar loja");
                setLoading(false);
            }
        } catch (error: any) {
            console.error("Erro ao identificar loja:", error);
            toast.error("Erro ao carregar informações da loja");
            setLoading(false);
        }
    };

    // Função auxiliar para calcular meta diária dinâmica
    // FÓRMULA CORRETA:
    // 1. Calcular quanto DEVERIA ter vendido ATÉ HOJE (soma dos pesos acumulados)
    // 2. Calcular DÉFICIT = metaEsperadaAteHoje - vendidoMes
    // 3. Distribuir déficit pelos dias restantes
    // 4. Meta Dinâmica = Meta Base do Dia + (Déficit / Dias Restantes)
    const calculateDynamicDailyGoal = (
        metaMensal: number,
        vendidoMes: number,
        today: string,
        dailyWeights: Record<string, number> | null,
        daysInMonth: number
    ): number => {
        const [year, month] = today.split('-').map(Number);
        const hoje = new Date(year, month - 1, parseInt(today.split('-')[2]));
        const diaAtual = hoje.getDate();
        const diasRestantes = daysInMonth - diaAtual; // Dias DEPOIS de hoje

        // 1. META BASE DO DIA: Meta mínima pelo peso configurado
        let metaBaseDoDia = metaMensal / daysInMonth;
        if (dailyWeights && Object.keys(dailyWeights).length > 0) {
            const hojePeso = dailyWeights[today] || 0;
            if (hojePeso > 0) {
                metaBaseDoDia = (metaMensal * hojePeso) / 100;
            }
        }

        // 2. CALCULAR META ESPERADA ATÉ ONTEM (soma dos pesos de dia 1 até ontem - NÃO inclui hoje)
        let metaEsperadaAteOntem = 0;
        if (dailyWeights && Object.keys(dailyWeights).length > 0) {
            // Com pesos configurados: somar pesos de todos os dias até ONTEM (dia 1 até dia-1)
            for (let d = 1; d < diaAtual; d++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const peso = dailyWeights[dateStr] || 0;
                metaEsperadaAteOntem += (metaMensal * peso) / 100;
            }
        } else {
            // Sem pesos: distribuição uniforme (dias anteriores a hoje)
            metaEsperadaAteOntem = (metaMensal / daysInMonth) * (diaAtual - 1);
        }

        // 3. CALCULAR DIFERENÇA (pode ser déficit ou superávit)
        const diferenca = vendidoMes - metaEsperadaAteOntem;
        const diasRestantesComHoje = diasRestantes + 1;
        
        let metaDinamica: number;

        if (diferenca >= 0) {
            // CENÁRIO: À FRENTE DA META
            // Meta do dia = Meta base × (1 + % à frente)
            const percentualAFrente = metaEsperadaAteOntem > 0 
                ? (diferenca / metaEsperadaAteOntem) 
                : 0;
            metaDinamica = metaBaseDoDia * (1 + percentualAFrente);
            
            console.log('[calculateDynamicDailyGoal] À FRENTE da meta:', {
                today,
                metaEsperadaAteOntem: metaEsperadaAteOntem.toFixed(2),
                vendidoMes,
                percentualAFrente: (percentualAFrente * 100).toFixed(1) + '%',
                metaBaseDoDia: metaBaseDoDia.toFixed(2),
                metaDinamica: metaDinamica.toFixed(2)
            });
        } else {
            // CENÁRIO: ATRÁS DA META
            // Meta do dia = Meta base + déficit distribuído
            const deficit = Math.abs(diferenca);
            let metaAdicionalPorDia = 0;
            if (deficit > 0 && diasRestantesComHoje > 0) {
                metaAdicionalPorDia = deficit / diasRestantesComHoje;
            }
            metaDinamica = metaBaseDoDia + metaAdicionalPorDia;
            
            console.log('[calculateDynamicDailyGoal] ATRÁS da meta:', {
                today,
                metaEsperadaAteOntem: metaEsperadaAteOntem.toFixed(2),
                vendidoMes,
                deficit: deficit.toFixed(2),
                diasRestantesComHoje,
                metaAdicionalPorDia: metaAdicionalPorDia.toFixed(2),
                metaBaseDoDia: metaBaseDoDia.toFixed(2),
                metaDinamica: metaDinamica.toFixed(2)
            });
        }

        // PROTEÇÃO: Meta diária não pode ser maior que 50% da meta mensal
        const maxMetaDiaria = metaMensal * 0.5;
        if (metaDinamica > maxMetaDiaria) {
            metaDinamica = maxMetaDiaria;
        }

        // PROTEÇÃO: Meta diária nunca menor que a meta base do dia
        if (metaDinamica < metaBaseDoDia) {
            metaDinamica = metaBaseDoDia;
        }

        return metaDinamica;
    };

    const fetchGoalsWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) {
            console.error('[LojaDashboard] ❌ fetchGoalsWithStoreId chamado sem storeId');
            return;
        }

        const hoje = getBrazilNow();
        const mesAtual = format(hoje, 'yyyyMM');
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
        const today = format(hoje, 'yyyy-MM-dd');

        console.log('[LojaDashboard] 📡 Buscando meta mensal da loja...');
        console.log('[LojaDashboard]   storeId:', currentStoreId);
        console.log('[LojaDashboard]   mes_referencia:', mesAtual);
        console.log('[LojaDashboard]   tipo: MENSAL');
        console.log('[LojaDashboard]   colaboradora_id: null (IS NULL)');

        // Buscar meta mensal da loja
        const { data, error } = await supabase
            .schema("sistemaretiradas")
            .from('goals')
            .select('*')
            .eq('store_id', currentStoreId)
            .eq('mes_referencia', mesAtual)
            .eq('tipo', 'MENSAL')
            .is('colaboradora_id', null)
            .maybeSingle();

        if (error) {
            console.error('[LojaDashboard] ❌ Erro ao buscar meta mensal:', error);
            console.error('[LojaDashboard]   Erro code:', error.code);
            console.error('[LojaDashboard]   Erro message:', error.message);
            console.error('[LojaDashboard]   Erro details:', error.details);
            console.error('[LojaDashboard]   Erro hint:', error.hint);
            toast.error(`Erro ao buscar meta mensal: ${error.message}`);
            setGoals(null);
            setDailyGoal(0);
            setDailyProgress(0);
            setMonthlyRealizado(0);
            setMonthlyProgress(0);
            return;
        }

        if (data) {
            console.log('[LojaDashboard] ✅ Meta mensal encontrada:', data);
            console.log('[LojaDashboard]   meta_valor:', data.meta_valor);
            console.log('[LojaDashboard]   super_meta_valor:', data.super_meta_valor);
            console.log('[LojaDashboard]   daily_weights:', data.daily_weights);
            setGoals(data);

            // Compute monthly progress from sales data (precisamos disso para calcular meta dinâmica)
            // Incluir vendas de colaboradoras desativadas até a data de desativação
            const { data: salesMonth, error: monthErr } = await supabase
                .schema("sistemaretiradas")
                .from('sales')
                .select('valor, colaboradora_id, data_venda')
                .eq('store_id', currentStoreId)
                .gte('data_venda', `${startOfMonth}T00:00:00`);

            // Buscar informações de desativação das colaboradoras
            const { data: colaboradorasInfo } = await supabase
                .schema("sistemaretiradas")
                .from('profiles')
                .select('id, is_active, updated_at')
                .eq('role', 'COLABORADORA')
                .eq('store_id', currentStoreId);

            // Criar mapa de datas de desativação
            const deactivationMap = new Map<string, string | null>();
            colaboradorasInfo?.forEach((colab: any) => {
                if (!colab.is_active && colab.updated_at) {
                    deactivationMap.set(colab.id, format(new Date(colab.updated_at), 'yyyy-MM-dd'));
                }
            });

            // Filtrar vendas: incluir apenas vendas até a data de desativação (se desativada)
            let totalMes = 0;
            if (!monthErr && salesMonth) {
                salesMonth.forEach((sale: any) => {
                    const colabId = sale.colaboradora_id;
                    const saleDate = sale.data_venda ? sale.data_venda.split('T')[0] : null;
                    const deactivationDate = deactivationMap.get(colabId);

                    // Se colaboradora foi desativada e venda é depois do dia da desativação, não incluir
                    // (incluir vendas do próprio dia da desativação, pois ela pode ter vendido nesse dia)
                    if (deactivationDate && saleDate) {
                        // Comparar apenas a data (sem hora), então > significa dia seguinte
                        const saleDay = new Date(saleDate).setHours(0, 0, 0, 0);
                        const deactivationDay = new Date(deactivationDate).setHours(0, 0, 0, 0);
                        if (saleDay > deactivationDay) {
                            return;
                        }
                    }

                    totalMes += Number(sale.valor || 0);
                });
            }

            // Usar o valor calculado localmente apenas se não houver dados do React Query
            // O React Query (useStoreMonthlyProgress) já calcula corretamente todas as vendas
            // Mas precisamos considerar colaboradoras desativadas para o cálculo da meta dinâmica
            // Por isso mantemos o totalMes local para a meta diária dinâmica
            // Mas não sobrescrevemos o monthlyRealizado se já temos dados do React Query

            // O monthlyRealizado será atualizado pelo useEffect que observa monthlyProgressData
            // Apenas definimos aqui se não tivermos dados ainda
            if (!monthlyProgressData) {
                setMonthlyRealizado(totalMes);
                setMonthlyProgress((totalMes / Number(data.meta_valor)) * 100);
            }

            // Calcular meta diária DINÂMICA
            const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
            const dailyWeights = data.daily_weights || {};
            
            // Calcular peso acumulado até ONTEM para log (nova lógica corrigida)
            let pesoAcumuladoAteOntem = 0;
            const diaAtual = hoje.getDate();
            for (let d = 1; d < diaAtual; d++) {
                const dateStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), d), 'yyyy-MM-dd');
                pesoAcumuladoAteOntem += (dailyWeights[dateStr] || 0);
            }
            const metaEsperadaAteOntem = (Number(data.meta_valor) * pesoAcumuladoAteOntem) / 100;
            const deficit = Math.max(0, metaEsperadaAteOntem - totalMes);
            const diasRestantesComHoje = daysInMonth - diaAtual + 1;
            
            console.log('[LojaDashboard] 📊 CÁLCULO META DIÁRIA (CORRIGIDO):');
            console.log('[LojaDashboard]   Meta mensal:', Number(data.meta_valor));
            console.log('[LojaDashboard]   Vendido no mês:', totalMes);
            console.log('[LojaDashboard]   Dia atual:', diaAtual);
            console.log('[LojaDashboard]   Peso acumulado até ONTEM:', pesoAcumuladoAteOntem.toFixed(2) + '%');
            console.log('[LojaDashboard]   Meta ESPERADA até ONTEM:', metaEsperadaAteOntem.toFixed(2));
            console.log('[LojaDashboard]   DÉFICIT (atraso):', deficit.toFixed(2));
            console.log('[LojaDashboard]   Dias restantes COM hoje:', diasRestantesComHoje);
            console.log('[LojaDashboard]   Daily weights keys:', Object.keys(dailyWeights).length);
            
            const daily = calculateDynamicDailyGoal(
                Number(data.meta_valor),
                totalMes,
                today,
                Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                daysInMonth
            );

            console.log('[LojaDashboard]   ➡️ Meta diária dinâmica:', daily.toFixed(2));

            setDailyGoal(daily);

            // Compute today's progress from sales data
            // Incluir vendas de colaboradoras desativadas apenas se foram até hoje (se desativadas hoje ou antes)
            const { data: salesToday, error: salesErr } = await supabase
                .schema("sistemaretiradas")
                .from('sales')
                .select('valor, colaboradora_id, data_venda')
                .eq('store_id', currentStoreId)
                .gte('data_venda', `${today}T00:00:00`);

            let totalHoje = 0;
            if (!salesErr && salesToday) {
                salesToday.forEach((sale: any) => {
                    const colabId = sale.colaboradora_id;
                    const saleDate = sale.data_venda ? sale.data_venda.split('T')[0] : null;
                    const deactivationDate = deactivationMap.get(colabId);

                    // Se colaboradora foi desativada e venda é depois do dia da desativação, não incluir
                    // (incluir vendas do próprio dia da desativação, pois ela pode ter vendido nesse dia)
                    if (deactivationDate && saleDate) {
                        // Comparar apenas a data (sem hora), então > significa dia seguinte
                        const saleDay = new Date(saleDate).setHours(0, 0, 0, 0);
                        const deactivationDay = new Date(deactivationDate).setHours(0, 0, 0, 0);
                        if (saleDay > deactivationDay) {
                            return;
                        }
                    }

                    totalHoje += Number(sale.valor || 0);
                });
                setDailyProgress((totalHoje / daily) * 100);
            } else if (salesErr) {
                console.error('[LojaDashboard] ❌ Erro ao buscar vendas de hoje:', salesErr);
            }
        } else {
            console.error('[LojaDashboard] ❌ Meta mensal NÃO encontrada para a loja');
            console.error('[LojaDashboard]   Parâmetros da busca:');
            console.error('[LojaDashboard]     store_id =', currentStoreId);
            console.error('[LojaDashboard]     mes_referencia =', mesAtual);
            console.error('[LojaDashboard]     tipo = MENSAL');
            console.error('[LojaDashboard]     colaboradora_id IS NULL');
            console.error('[LojaDashboard]   ⚠️ Verifique se a meta está cadastrada no banco de dados');
            toast.error(`Meta mensal não encontrada para a loja no mês ${mesAtual}. Verifique se a meta está cadastrada.`);
            setGoals(null);
            setDailyGoal(0);
            setDailyProgress(0);
            setMonthlyRealizado(0);
            setMonthlyProgress(0);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    const fetch7DayHistoryWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;

        const startDate = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        const { data, error } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select('data_venda, valor, qtd_pecas')
            .eq('store_id', currentStoreId)
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
            const result = Object.entries(grouped).map(([day, info]) => ({
                day,
                ...info,
                ticketMedio: info.qtdVendas > 0 ? info.total / info.qtdVendas : 0
            }));
            setHistory7Days(result);
        }
    };

    // Função para buscar dados mensais por colaboradora/dia
    const fetchMonthlyDataByDayWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) {
            console.warn('[LojaDashboard] ⚠️ fetchMonthlyDataByDayWithStoreId chamado sem storeId');
            return;
        }

        console.log('[LojaDashboard] 📊 Buscando dados mensais por colaboradora/dia...');
        console.log('[LojaDashboard]   storeId:', currentStoreId);

        const hoje = new Date();
        const mesAtual = format(hoje, 'yyyyMM');
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
        const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        const todayStr = format(hoje, 'yyyy-MM-dd');

        // Buscar TODAS as colaboradoras da loja (ativas e desativadas) - PRIMEIRO (necessário para processar)
        console.log('[LojaDashboard] 📡 Buscando colaboradoras da loja (ativas e desativadas)...');
        const { data: colaboradorasData, error: colaboradorasError } = await supabase
            .schema("sistemaretiradas")
            .from('profiles')
            .select('id, name, is_active, updated_at')
            .eq('role', 'COLABORADORA')
            .eq('store_id', currentStoreId)
            .order('name', { ascending: true });

        // Log para debug
        if (colaboradorasData) {
            const ativas = colaboradorasData.filter(c => c.is_active).length;
            const desativadas = colaboradorasData.filter(c => !c.is_active).length;
            console.log('[LojaDashboard] 📊 Colaboradoras encontradas:', {
                total: colaboradorasData.length,
                ativas,
                desativadas,
                desativadas_lista: colaboradorasData.filter(c => !c.is_active).map(c => ({ id: c.id, name: c.name, updated_at: c.updated_at }))
            });
        }

        if (colaboradorasError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar colaboradoras:', colaboradorasError);
            return;
        }

        if (!colaboradorasData || colaboradorasData.length === 0) {
            console.warn('[LojaDashboard] ⚠️ Nenhuma colaboradora encontrada para a loja');
            setMonthlyDataByDay([]);
            return;
        }

        console.log('[LojaDashboard] ✅ Colaboradoras encontradas:', colaboradorasData.length);

        // Buscar vendas do mês
        console.log('[LojaDashboard] 📡 Buscando vendas do mês...');
        const { data: salesData, error: salesError } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select('colaboradora_id, valor, qtd_pecas, data_venda')
            .eq('store_id', currentStoreId)
            .gte('data_venda', `${startOfMonth}T00:00:00`)
            .lte('data_venda', `${todayStr}T23:59:59`);

        if (salesError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar vendas:', salesError);
            // Continuar mesmo com erro de vendas, para mostrar colaboradoras sem vendas
        }

        console.log('[LojaDashboard] ✅ Vendas encontradas:', salesData?.length || 0);
        if (salesData && salesData.length > 0) {
            console.log('[LojaDashboard]   Primeiras vendas:', salesData.slice(0, 3).map((s: any) => ({
                colaboradora_id: s.colaboradora_id,
                valor: s.valor,
                data: s.data_venda
            })));
        }

        // Buscar metas individuais
        console.log('[LojaDashboard] 📡 Buscando metas individuais...');
        const { data: goalsData, error: goalsError } = await supabase
            .schema("sistemaretiradas")
            .from('goals')
            .select('colaboradora_id, meta_valor, daily_weights')
            .eq('store_id', currentStoreId)
            .eq('mes_referencia', mesAtual)
            .eq('tipo', 'INDIVIDUAL')
            .not('colaboradora_id', 'is', null);

        if (goalsError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar metas:', goalsError);
            // Continuar mesmo com erro de metas
        }

        console.log('[LojaDashboard] ✅ Metas encontradas:', goalsData?.length || 0);

        // Processar dados (usar name direto do colaboradorasData, já que agora temos todos os campos)
        const colaboradorasMap = new Map(colaboradorasData.map(c => [c.id, c.name]));
        const goalsMap = new Map((goalsData || []).map((g: any) => [g.colaboradora_id, g]));

        // Agrupar vendas por colaboradora e por dia
        const monthlyData: Record<string, {
            colaboradoraName: string;
            dailySales: Record<string, { valor: number; qtdVendas: number; qtdPecas: number; metaDiaria: number }>;
            totalMes: number;
        }> = {};

        // Inicializar todas as colaboradoras no monthlyData (mesmo sem vendas)
        colaboradorasData.forEach(colab => {
            monthlyData[colab.id] = {
                colaboradoraName: colab.name,
                dailySales: {},
                totalMes: 0
            };
            console.log(`[LojaDashboard] 🔄 Inicializando colaboradora ${colab.is_active ? 'ATIVA' : 'DESATIVADA'} "${colab.name}" (id: ${colab.id})`);
        });

        // Criar mapa de colaboradoras com data de desativação
        const colaboradorasMapWithDeactivation = new Map(
            colaboradorasData.map(c => [
                c.id,
                {
                    name: c.name,
                    active: c.is_active,
                    deactivationDate: c.is_active ? null : (c.updated_at ? format(new Date(c.updated_at), 'yyyy-MM-dd') : null)
                }
            ])
        );

        // Processar vendas, se houver
        if (salesData && salesData.length > 0) {
            console.log('[LojaDashboard] 🔄 Processando vendas...');
            salesData.forEach(sale => {
                const colabId = sale.colaboradora_id;
                const day = sale.data_venda ? sale.data_venda.split('T')[0] : null;

                if (!day) {
                    console.warn('[LojaDashboard] ⚠️ Venda sem data_venda:', sale);
                    return;
                }

                // Verificar se colaboradora foi desativada antes desta venda
                const colabInfo: any = colaboradorasMapWithDeactivation.get(colabId);
                if (colabInfo && !colabInfo.active && colabInfo.deactivationDate) {
                    // Se a venda é depois do dia da desativação, ignorar
                    // (incluir vendas do próprio dia da desativação, pois ela pode ter vendido nesse dia)
                    const saleDay = new Date(day).setHours(0, 0, 0, 0);
                    const deactivationDay = new Date(colabInfo.deactivationDate).setHours(0, 0, 0, 0);
                    if (saleDay > deactivationDay) {
                        return;
                    }
                }

                // Se a colaboradora não estiver no monthlyData, adicionar (caso não tenha sido encontrada antes)
                if (!monthlyData[colabId]) {
                    monthlyData[colabId] = {
                        colaboradoraName: colabInfo?.name || colaboradorasMap.get(colabId) || 'Desconhecida',
                        dailySales: {},
                        totalMes: 0
                    };
                }

                // Inicializar dia se não existir
                if (!monthlyData[colabId].dailySales[day]) {
                    const goal: any = goalsMap.get(colabId);
                    let metaDiaria = 0;
                    if (goal) {
                        // Calcular vendas do mês até ONTEM para este colaborador
                        const vendasMesAteOntem = salesData
                            ?.filter((s: any) => {
                                const saleDay = s.data_venda ? s.data_venda.split('T')[0] : null;
                                return s.colaboradora_id === colabId && saleDay && saleDay < day;
                            })
                            .reduce((sum: number, s: any) => sum + Number(s.valor || 0), 0) || 0;

                        const dailyWeights = goal.daily_weights || {};
                        metaDiaria = calculateDynamicDailyGoal(
                            Number(goal.meta_valor),
                            vendasMesAteOntem,
                            day,
                            Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                            daysInMonth
                        );
                    }

                    monthlyData[colabId].dailySales[day] = {
                        valor: 0,
                        qtdVendas: 0,
                        qtdPecas: 0,
                        metaDiaria
                    };
                }

                const valorVenda = Number(sale.valor || 0);
                monthlyData[colabId].dailySales[day].valor += valorVenda;
                monthlyData[colabId].dailySales[day].qtdVendas += 1;
                monthlyData[colabId].dailySales[day].qtdPecas += Number(sale.qtd_pecas || 0);
                monthlyData[colabId].totalMes += valorVenda;

                // Log para colaboradoras desativadas (colabInfo já foi definido acima na linha 635)
                if (colabInfo && !colabInfo.active) {
                    console.log(`[LojaDashboard] ✅ Venda processada para colaboradora DESATIVADA "${colabInfo.name}": R$ ${valorVenda.toFixed(2)} no dia ${day}, totalMes agora: R$ ${monthlyData[colabId].totalMes.toFixed(2)}`);
                }
            });
        }

        // Converter para array - incluir colaboradoras
        // IMPORTANTE: Colaboradoras ATIVAS aparecem sempre
        // Colaboradoras DESATIVADAS aparecem apenas se tiverem vendas no mês
        const result = colaboradorasData.map(colab => {
            const data = monthlyData[colab.id] || {
                colaboradoraName: colab.name,
                dailySales: {},
                totalMes: 0
            };

            // Garantir que todas as metas diárias estejam calculadas mesmo sem vendas
            const goal: any = goalsMap.get(colab.id);
            if (goal) {
                // Calcular vendas do mês para este colaborador (para cálculo dinâmico do dia de hoje)
                const vendasMesColab = salesData
                    ?.filter((s: any) => {
                        const saleDay = s.data_venda ? s.data_venda.split('T')[0] : null;
                        return s.colaboradora_id === colab.id && saleDay && saleDay < todayStr;
                    })
                    .reduce((sum: number, s: any) => sum + Number(s.valor || 0), 0) || 0;

                const dailyWeights = goal.daily_weights || {};
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                    if (dayStr <= todayStr) {
                        if (!data.dailySales[dayStr]) {
                            // Calcular vendas até ONTEM (antes deste dia) para esta colaboradora
                            const vendasAteOntem = salesData
                                ?.filter((s: any) => {
                                    const saleDay = s.data_venda ? s.data_venda.split('T')[0] : null;
                                    return s.colaboradora_id === colab.id && saleDay && saleDay < dayStr;
                                })
                                .reduce((sum: number, s: any) => sum + Number(s.valor || 0), 0) || 0;

                            const metaDiaria = calculateDynamicDailyGoal(
                                Number(goal.meta_valor),
                                vendasAteOntem,
                                dayStr,
                                Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                                daysInMonth
                            );

                            data.dailySales[dayStr] = {
                                valor: 0,
                                qtdVendas: 0,
                                qtdPecas: 0,
                                metaDiaria
                            };
                        }
                    }
                }
            } else {
                // Mesmo sem meta, criar entradas para os dias até hoje (sem meta diária)
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                    if (dayStr <= todayStr) {
                        if (!data.dailySales[dayStr]) {
                            data.dailySales[dayStr] = {
                                valor: 0,
                                qtdVendas: 0,
                                qtdPecas: 0,
                                metaDiaria: 0
                            };
                        }
                    }
                }
            }

            return {
                colaboradoraId: colab.id,
                colaboradoraName: colab.name,
                active: colab.is_active,
                ...data
            };
        });

        // Filtrar resultado
        // IMPORTANTE: Colaboradoras ATIVAS aparecem sempre
        // Colaboradoras DESATIVADAS aparecem apenas se tiverem vendas REAIS (valor > 0) no mês
        const resultFiltered = result.filter(item => {
            const colab = colaboradorasData.find(c => c.id === item.colaboradoraId);
            if (!colab) {
                console.log(`[LojaDashboard] ⚠️ Colaboradora não encontrada no map para ${item.colaboradoraId}`);
                return false;
            }

            // Se for colaboradora ativa, sempre incluir
            if (colab.is_active) {
                console.log(`[LojaDashboard] ✅ Colaboradora ATIVA "${item.colaboradoraName}" incluída no calendário`);
                return true;
            }

            // Se for desativada, verificar se tem vendas reais no mês
            // Verificar se há vendas com valor > 0 em qualquer dia
            const hasRealSales = item.totalMes > 0 ||
                Object.values(item.dailySales).some((dayData: any) => dayData.valor > 0);

            if (hasRealSales) {
                console.log(`[LojaDashboard] ✅ Colaboradora DESATIVADA "${item.colaboradoraName}" com vendas no mês (R$ ${item.totalMes.toFixed(2)}), incluindo no calendário`);
                return true;
            } else {
                console.log(`[LojaDashboard] ⏭️ Colaboradora desativada "${item.colaboradoraName}" sem vendas no mês (totalMes: ${item.totalMes}, dias com vendas: ${Object.values(item.dailySales).filter((d: any) => d.valor > 0).length}), não incluindo no calendário`);
                return false;
            }
        });

        console.log('[LojaDashboard] ✅ Dados mensais processados:', resultFiltered.length, 'colaboradoras');
        console.log('[LojaDashboard] 📊 Breakdown:');
        const ativasCount = resultFiltered.filter(r => colaboradorasData.find(c => c.id === r.colaboradoraId)?.is_active).length;
        const desativadasCount = resultFiltered.filter(r => !colaboradorasData.find(c => c.id === r.colaboradoraId)?.is_active).length;
        console.log('[LojaDashboard]   - Ativas:', ativasCount);
        console.log('[LojaDashboard]   - Desativadas:', desativadasCount);
        resultFiltered.forEach((item, idx) => {
            const daysWithData = Object.keys(item.dailySales).length;
            console.log(`[LojaDashboard]   ${idx + 1}. ${item.colaboradoraName}: ${daysWithData} dias com dados, Total: R$ ${item.totalMes.toFixed(2)}`);
        });

        setMonthlyDataByDay(resultFiltered);
    };

    const fetchDataWithStoreId = async (currentStoreId: string, currentStoreName?: string) => {
        if (!currentStoreId) {
            console.error('[LojaDashboard] ❌ fetchDataWithStoreId chamado sem storeId válido');
            setLoading(false);
            return;
        }

        // Prevenir múltiplas chamadas com o mesmo storeId (but allow if forced)
        // Se lastFetchedStoreIdRef foi limpo (null), significa que queremos forçar recarregamento
        if (isFetchingDataRef.current && lastFetchedStoreIdRef.current === currentStoreId && lastFetchedStoreIdRef.current !== null) {
            console.log('[LojaDashboard] ⚠️ fetchDataWithStoreId já está sendo executado para este storeId, ignorando chamada duplicada');
            return;
        }

        // Se já foi buscado recentemente para este storeId, não buscar novamente (a menos que seja forçado)
        // Se lastFetchedStoreIdRef foi limpo (null), significa que queremos forçar recarregamento
        if (lastFetchedStoreIdRef.current === currentStoreId && storeId === currentStoreId && lastFetchedStoreIdRef.current !== null) {
            console.log('[LojaDashboard] ⚠️ Dados já foram buscados para este storeId, ignorando chamada duplicada');
            return;
        }

        isFetchingDataRef.current = true;
        lastFetchedStoreIdRef.current = currentStoreId;

        console.log('[LojaDashboard] 📡 fetchDataWithStoreId chamado com storeId:', currentStoreId);
        console.log('[LojaDashboard] 📡 fetchDataWithStoreId chamado com storeName:', currentStoreName || 'não fornecido');

        // Garantir que storeName está disponível
        if (currentStoreName && !storeName) {
            setStoreName(currentStoreName);
        }

        try {
            await Promise.all([
                fetchSalesWithStoreId(currentStoreId),
                fetchColaboradorasWithStoreId(currentStoreId, currentStoreName || storeName || undefined),
                fetchGoalsWithStoreId(currentStoreId),
                fetchMetricsWithStoreId(currentStoreId),
                fetchColaboradorasPerformanceWithStoreId(currentStoreId, currentStoreName || storeName || undefined),
                fetchRankingTop3WithStoreId(currentStoreId),
                fetchMonthlyRankingWithStoreId(currentStoreId, currentStoreName || storeName),
                fetch7DayHistoryWithStoreId(currentStoreId),
                fetchMonthlyDataByDayWithStoreId(currentStoreId)
            ]);
        } catch (error) {
            console.error("[LojaDashboard] ❌ Error fetching data:", error);
            toast.error("Erro ao carregar dados");
        } finally {
            setLoading(false);
            isFetchingDataRef.current = false;
        }
    };

    const fetchMetricsWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;

        // ✅ CORREÇÃO: Buscar benchmarks da tabela store_benchmarks (não store_metrics)
        // Benchmarks não têm mes_referencia, são configurações fixas por loja
        const { data, error } = await supabase
            .schema('sistemaretiradas')
            .from('store_benchmarks')
            .select('*')
            .eq('store_id', currentStoreId)
            .maybeSingle();

        if (!error && data) {
            // Mapear os campos do benchmark para o formato esperado pelo dashboard
            setMetrics({
                meta_ticket_medio: data.ideal_ticket_medio || 0,
                meta_pa: data.ideal_pa || 0,
                meta_preco_medio_peca: data.ideal_preco_medio || 0,
            });
        } else if (error) {
            console.error('[LojaDashboard] Erro ao buscar benchmarks:', error);
            // Se não encontrar benchmark, usar valores padrão ou null
            setMetrics({
                meta_ticket_medio: 0,
                meta_pa: 0,
                meta_preco_medio_peca: 0,
            });
        } else {
            // Nenhum benchmark encontrado para esta loja
            console.warn('[LojaDashboard] ⚠️ Nenhum benchmark encontrado para a loja. Configure em Gerenciar Benchmarks.');
            setMetrics({
                meta_ticket_medio: 0,
                meta_pa: 0,
                meta_preco_medio_peca: 0,
            });
        }
    };

    const fetchColaboradorasPerformanceWithStoreId = async (currentStoreId: string, currentStoreName?: string | null) => {
        if (!currentStoreId) return;

        const today = getBrazilDateString();
        const brazilNow = new Date(new Date().toLocaleString('en-US', { timeZone: BRAZIL_TIMEZONE }));
        const mesAtual = format(brazilNow, 'yyyyMM');
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
        const daysInMonth = new Date(brazilNow.getFullYear(), brazilNow.getMonth() + 1, 0).getDate();

        console.log('[LojaDashboard] 📡 Buscando desempenho das colaboradoras...');
        console.log('[LojaDashboard]   storeId:', currentStoreId);
        console.log('[LojaDashboard]   mes_referencia:', mesAtual);

        // Buscar colaboradoras diretamente se não estiverem no estado (evita race condition)
        let colaboradorasToUse = colaboradoras;
        if (colaboradorasToUse.length === 0) {
            console.log('[LojaDashboard] ⚠️ Colaboradoras não estão no estado ainda, buscando diretamente...');
            const { data: colabsData, error: colabsError } = await supabase
                .schema("sistemaretiradas")
                .from('profiles')
                .select('id, name, is_active, store_id, store_default')
                .eq('role', 'COLABORADORA')
                .eq('is_active', true)
                .eq('store_id', currentStoreId)
                .order('name');

            if (!colabsError && colabsData && colabsData.length > 0) {
                colaboradorasToUse = colabsData;
                console.log('[LojaDashboard] ✅ Colaboradoras encontradas diretamente:', colaboradorasToUse.length);
            } else {
                console.warn('[LojaDashboard] ⚠️ Não foi possível buscar colaboradoras diretamente');
            }
        }

        // Buscar vendas do dia por colaboradora
        console.log('[LojaDashboard] 📡 Buscando vendas de hoje com filtro data_venda >=', `${today}T00:00:00`);
        const { data: salesToday, error: salesTodayError } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select('colaboradora_id, valor, qtd_pecas, data_venda')
            .eq('store_id', currentStoreId)
            .gte('data_venda', `${today}T00:00:00`);

        console.log('[LojaDashboard] 📊 Vendas de hoje encontradas:', salesToday?.length || 0);
        if (salesToday && salesToday.length > 0) {
            console.log('[LojaDashboard] 📊 Detalhes das vendas de hoje:');
            salesToday.forEach((s, idx) => {
                console.log(`[LojaDashboard]   ${idx + 1}. valor: R$ ${s.valor}, colaboradora_id: ${s.colaboradora_id || 'NULL'}, data_venda: ${s.data_venda}`);
            });
            const vendasComColaboradora = salesToday.filter(s => s.colaboradora_id);
            const vendasSemColaboradora = salesToday.filter(s => !s.colaboradora_id);
            console.log(`[LojaDashboard] 📊 Vendas COM colaboradora_id: ${vendasComColaboradora.length}`);
            console.log(`[LojaDashboard] 📊 Vendas SEM colaboradora_id: ${vendasSemColaboradora.length}`);
        }

        // Buscar vendas do mês por colaboradora
        const { data: salesMonth, error: salesMonthError } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select('colaboradora_id, valor, qtd_pecas')
            .eq('store_id', currentStoreId)
            .gte('data_venda', `${startOfMonth}T00:00:00`);

        // Buscar metas individuais
        console.log('[LojaDashboard] 📡 Buscando metas individuais...');
        console.log('[LojaDashboard]   storeId:', currentStoreId);
        console.log('[LojaDashboard]   mes_referencia:', mesAtual);
        console.log('[LojaDashboard]   tipo: INDIVIDUAL');
        console.log('[LojaDashboard]   colaboradora_id: NOT NULL (qualquer colaboradora da loja)');

        let { data: goalsData, error: goalsError } = await supabase
            .schema("sistemaretiradas")
            .from('goals')
            .select('colaboradora_id, meta_valor, super_meta_valor, daily_weights')
            .eq('store_id', currentStoreId)
            .eq('mes_referencia', mesAtual)
            .eq('tipo', 'INDIVIDUAL')
            .not('colaboradora_id', 'is', null);

        console.log('[LojaDashboard] 📊 Resultado da busca de metas individuais:');
        console.log('[LojaDashboard]   Total encontrado:', goalsData?.length || 0);
        if (goalsError) {
            console.error('[LojaDashboard]   Erro:', goalsError);
        }

        if (salesTodayError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar vendas de hoje:', salesTodayError);
        }
        if (salesMonthError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar vendas do mês:', salesMonthError);
        }
        if (goalsError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar metas individuais:', goalsError);
            console.error('[LojaDashboard]   Erro completo:', JSON.stringify(goalsError, null, 2));
        }

        if (goalsError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar metas individuais:', goalsError);
            console.error('[LojaDashboard]   Erro code:', goalsError.code);
            console.error('[LojaDashboard]   Erro message:', goalsError.message);
            console.error('[LojaDashboard]   Erro details:', goalsError.details);
            console.error('[LojaDashboard]   Erro hint:', goalsError.hint);
        }

        // Processar performance mesmo se não houver metas individuais (para mostrar vendas)
        if (colaboradorasToUse.length > 0) {
            if (!goalsError && goalsData && goalsData.length > 0) {
                console.log('[LojaDashboard] ✅ Metas individuais encontradas:', goalsData.length);
                console.log('[LojaDashboard] 📊 Metas após redistribuição (se houver):');
                goalsData.forEach((g, idx) => {
                    console.log(`[LojaDashboard]   ${idx + 1}. colaboradora_id: ${g.colaboradora_id}, meta: R$ ${g.meta_valor}, super_meta: R$ ${g.super_meta_valor || 0}`);
                });
            } else {
                if (goalsError) {
                    console.warn('[LojaDashboard] ⚠️ Erro ao buscar metas individuais, mas continuando com processamento das vendas');
                } else {
                    console.warn('[LojaDashboard] ⚠️ Nenhuma meta individual encontrada, mas continuando com processamento das vendas');
                }
            }

            console.log('[LojaDashboard] 📊 Colaboradoras para processar:', colaboradorasToUse.length);
            colaboradorasToUse.forEach((colab, idx) => {
                console.log(`[LojaDashboard]   ${idx + 1}. ${colab.name} (id: ${colab.id})`);
            });

            const performance = colaboradorasToUse
                // Filtrar APENAS colaboradoras desativadas (não filtrar por meta)
                .filter(colab => {
                    // Garantir que colaboradora está ativa (verifica is_active ou active)
                    if (colab.is_active === false || colab.active === false) {
                        console.log(`[LojaDashboard] ⏭️ Colaboradora desativada "${colab.name}" excluída do Planejamento do Dia`);
                        return false;
                    }

                    // ✅ REMOVIDO: Não filtrar por meta - todas as colaboradoras ativas devem aparecer
                    // Mesmo sem meta, a colaboradora deve aparecer para mostrar vendas
                    return true;
                })
                .map(colab => {
                    // Vendas do dia
                    const colabSalesToday = salesToday?.filter(s => s.colaboradora_id === colab.id) || [];
                    const vendidoHoje = colabSalesToday.reduce((sum, s) => sum + Number(s.valor), 0);
                    const qtdPecasHoje = colabSalesToday.reduce((sum, s) => sum + Number(s.qtd_pecas), 0);
                    const qtdVendasHoje = colabSalesToday.length;

                    // Vendas do mês
                    const colabSalesMonth = salesMonth?.filter(s => s.colaboradora_id === colab.id) || [];
                    const vendidoMes = colabSalesMonth.reduce((sum, s) => sum + Number(s.valor), 0);
                    const qtdPecasMes = colabSalesMonth.reduce((sum, s) => sum + Number(s.qtd_pecas), 0);
                    const qtdVendasMes = colabSalesMonth.length;

                    // Ticket médio do dia
                    const ticketMedio = qtdVendasHoje > 0 ? vendidoHoje / qtdVendasHoje : 0;

                    // Meta individual (pode não existir - colaboradora pode não ter meta)
                    const goal = goalsData?.find(g => g.colaboradora_id === colab.id);

                    // Verificar se colaboradora está de folga
                    const isFolga = isOnLeave(colab.id, today);

                    if (!goal) {
                        // ✅ Colaboradora SEM meta - ainda assim deve aparecer para mostrar vendas
                        console.log(`[LojaDashboard]   ℹ️ Colaboradora ${colab.name} sem meta - será exibida com meta = 0`);
                        return {
                            id: colab.id,
                            name: colab.name,
                            vendidoHoje: vendidoHoje,
                            vendidoMes,
                            meta: 0, // Sem meta
                            metaDiaria: 0, // Sem meta diária
                            superMeta: 0,
                            percentual: 0,
                            percentualMensal: 0,
                            faltaMensal: 0,
                            qtdVendas: qtdVendasHoje,
                            qtdVendasMes,
                            qtdPecas: qtdPecasHoje,
                            qtdPecasMes,
                            ticketMedio,
                        };
                    }

                    console.log(`[LojaDashboard]   ✅ Meta encontrada para ${colab.name}: R$ ${goal.meta_valor}`);

                    if (isFolga) {
                        // Se está de folga, meta diária = 0
                        return {
                            id: colab.id,
                            name: colab.name,
                            vendidoHoje: vendidoHoje,
                            vendidoMes,
                            meta: Number(goal.meta_valor),
                            metaDiaria: 0, // Meta diária = 0 para quem está de folga
                            superMeta: Number(goal.super_meta_valor) || 0,
                            percentual: 0,
                            percentualMensal: Number(goal.meta_valor) > 0 ? (vendidoMes / Number(goal.meta_valor)) * 100 : 0,
                            faltaMensal: Math.max(0, Number(goal.meta_valor) - vendidoMes),
                            qtdVendas: qtdVendasHoje,
                            qtdVendasMes,
                            qtdPecas: qtdPecasHoje,
                            qtdPecasMes,
                            ticketMedio,
                        };
                    }

                    // Calcular meta diária DINÂMICA (apenas para colaboradoras ativas)
                    const dailyWeights = goal.daily_weights || {};
                    let metaDiaria = calculateDynamicDailyGoal(
                        Number(goal.meta_valor),
                        vendidoMes,
                        today,
                        Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                        daysInMonth
                    );

                    // Aplicar redistribuição: se há colaboradoras de folga, adicionar parte redistribuída
                    // A redistribuição já foi aplicada na meta mensal pelo hook useGoalRedistribution
                    // então a meta diária calculada já inclui a parte redistribuída

                    // Progresso do dia
                    const progressoDia = metaDiaria > 0 ? (vendidoHoje / metaDiaria) * 100 : 0;

                    // Progresso mensal
                    const progressoMensal = Number(goal.meta_valor) > 0 ? (vendidoMes / Number(goal.meta_valor)) * 100 : 0;

                    // Quanto falta para a meta mensal
                    const faltaMensal = Math.max(0, Number(goal.meta_valor) - vendidoMes);

                    return {
                        id: colab.id,
                        name: colab.name,
                        vendidoHoje: vendidoHoje,
                        vendidoMes,
                        meta: Number(goal.meta_valor),
                        metaDiaria,
                        superMeta: Number(goal.super_meta_valor) || 0,
                        percentual: progressoDia, // Percentual do dia
                        percentualMensal: progressoMensal, // Percentual do mês
                        faltaMensal,
                        qtdVendas: qtdVendasHoje,
                        qtdVendasMes,
                        qtdPecas: qtdPecasHoje,
                        qtdPecasMes,
                        ticketMedio,
                    };
                }) as Array<{
                    id: string;
                    name: string;
                    vendidoHoje: number;
                    vendidoMes: number;
                    meta: number;
                    metaDiaria: number;
                    superMeta: number;
                    percentual: number;
                    percentualMensal: number;
                    faltaMensal: number;
                    qtdVendas: number;
                    qtdVendasMes: number;
                    qtdPecas: number;
                    qtdPecasMes: number;
                    ticketMedio: number;
                }>;

            // ✅ DUAS LISTAS: 
            // 1. Performance COM meta > 0 → para Planejamento do Dia (gerentes sem meta não aparecem)
            // 2. Performance COMPLETA → para Caixa (todas que venderam aparecem)
            const performanceComMeta = performance.filter(p => p.meta > 0);
            
            console.log('[LojaDashboard] 📊 Performance COM meta (Planejamento):', performanceComMeta.length, 'colaboradoras');
            performanceComMeta.forEach((p, idx) => {
                console.log(`[LojaDashboard]   ${idx + 1}. ${p.name}: meta=R$ ${p.meta}, metaDiaria=R$ ${p.metaDiaria}, vendido hoje=R$ ${p.vendidoHoje}, vendido mês=R$ ${p.vendidoMes}`);
            });
            
            console.log('[LojaDashboard] 📊 Performance COMPLETA (Caixa):', performance.length, 'colaboradoras');
            performance.forEach((p, idx) => {
                console.log(`[LojaDashboard]   ${idx + 1}. ${p.name}: vendido hoje=R$ ${p.vendidoHoje}`);
            });
            
            // Marcar que estamos usando dados locais (do fetchDataWithStoreId)
            useLocalPerformanceRef.current = true;
            
            // ✅ Planejamento usa apenas colaboradoras COM meta
            setColaboradorasPerformance(performanceComMeta);
            
            // ✅ Caixa usa lista completa - salvar em estado separado
            setColaboradorasPerformanceCaixa(performance);
        } else {
            console.warn('[LojaDashboard] ⚠️ Nenhuma colaboradora encontrada para processar performance');
            if (goalsError) {
                console.error('[LojaDashboard] ❌ Erro ao buscar metas individuais:', goalsError);
            }
            setColaboradorasPerformance([]);
        }
    };

    const fetchRankingTop3WithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;

        const today = format(new Date(), 'yyyy-MM-dd');

        const { data: salesData, error } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select(`
                colaboradora_id,
                valor,
                profiles!sales_colaboradora_id_fkey(name)
            `)
            .eq('store_id', currentStoreId)
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

    const fetchMonthlyRankingWithStoreId = async (currentStoreId: string, currentStoreName?: string | null) => {
        if (!currentStoreId) return;

        const mesAtual = format(new Date(), 'yyyyMM');
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;

        // ✅ CORREÇÃO: Usar mesma lógica de fetchColaboradorasWithStoreId para garantir busca correta
        const storeNameToUse = currentStoreName || storeName;

        console.log('[LojaDashboard] 📊 Buscando ranking mensal...');
        console.log('[LojaDashboard]   storeId:', currentStoreId);
        console.log('[LojaDashboard]   storeName:', storeNameToUse || 'NULL');

        // Estratégia 1: Buscar colaboradoras por store_id (UUID)
        let colaboradorasQuery = supabase
            .schema("sistemaretiradas")
            .from('profiles')
            .select('id, name, store_id, store_default')
            .eq('role', 'COLABORADORA')
            .eq('is_active', true)
            .eq('store_id', currentStoreId);

        const { data: colaboradorasPorId, error: errorPorId } = await colaboradorasQuery;

        // Estratégia 2: Se não encontrou por UUID, buscar por nome (store_default)
        let colaboradorasPorNome: any[] = [];
        if ((!colaboradorasPorId || colaboradorasPorNome.length === 0) && storeNameToUse) {
            const { data: dataPorNome } = await supabase
                .schema("sistemaretiradas")
                .from('profiles')
                .select('id, name, store_id, store_default')
                .eq('role', 'COLABORADORA')
                .eq('is_active', true)
                .eq('store_default', storeNameToUse);
            colaboradorasPorNome = dataPorNome || [];
        }

        // Combinar resultados únicos
        const colaboradorasMap = new Map<string, any>();
        (colaboradorasPorId || []).forEach((colab: any) => {
            colaboradorasMap.set(colab.id, colab);
        });
        colaboradorasPorNome.forEach((colab: any) => {
            if (!colaboradorasMap.has(colab.id)) {
                colaboradorasMap.set(colab.id, colab);
            }
        });

        const colaboradoras = Array.from(colaboradorasMap.values());

        console.log('[LojaDashboard] ✅ Colaboradoras encontradas:', colaboradoras.length);
        console.log('[LojaDashboard]   IDs:', colaboradoras.map((c: any) => c.id));

        if (colaboradoras.length === 0) {
            console.warn('[LojaDashboard] ⚠️ Nenhuma colaboradora encontrada para o ranking mensal');
            setRankingMonthly([]);
            return;
        }

        // Criar mapa inicial com todas as colaboradoras (total = 0)
        const rankingMap = new Map<string, any>();
        colaboradoras.forEach((colab: any) => {
            rankingMap.set(colab.id, {
                colaboradora_id: colab.id,
                name: colab.name,
                total: 0,
                qtdVendas: 0,
                qtdPecas: 0
            });
        });

        // Buscar TODAS as vendas do mês (incluindo vendas sem colaboradora_id para debug)
        const { data: salesData, error: salesError } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select('colaboradora_id, valor, qtd_pecas')
            .eq('store_id', currentStoreId)
            .gte('data_venda', `${startOfMonth}T00:00:00`);

        if (salesError) {
            console.error('[LojaDashboard] ❌ Erro ao buscar vendas:', salesError);
            // Continuar mesmo com erro, usando apenas colaboradoras sem vendas
        }

        console.log('[LojaDashboard] 📊 Vendas encontradas:', salesData?.length || 0);
        console.log('[LojaDashboard]   Vendas com colaboradora_id:', salesData?.filter((s: any) => s.colaboradora_id).length || 0);

        // Agregar vendas às colaboradoras
        if (salesData) {
            salesData.forEach((sale: any) => {
                if (sale.colaboradora_id) {
                    if (rankingMap.has(sale.colaboradora_id)) {
                        const colab = rankingMap.get(sale.colaboradora_id)!;
                        colab.total += Number(sale.valor || 0);
                        colab.qtdVendas += 1;
                        colab.qtdPecas += Number(sale.qtd_pecas || 0);
                    } else {
                        console.warn('[LojaDashboard] ⚠️ Venda de colaboradora não encontrada no mapa:', sale.colaboradora_id);
                    }
                } else {
                    console.warn('[LojaDashboard] ⚠️ Venda sem colaboradora_id encontrada:', sale);
                }
            });
        }

        // Converter para array, ordenar por total (descendente) e incluir TODAS as colaboradoras
        const ranking = Array.from(rankingMap.values())
            .sort((a: any, b: any) => b.total - a.total);

        console.log('[LojaDashboard] ✅ Ranking mensal calculado:', ranking.length, 'colaboradoras');
        console.log('[LojaDashboard]   Top 3:', ranking.slice(0, 3).map((r: any) => ({ nome: r.name, total: r.total })));

        setRankingMonthly(ranking as any[]);
    };

    // Atualizar vendas quando o filtro de data mudar
    useEffect(() => {
        if (storeId && salesDateFilter) {
            fetchSalesWithStoreId(storeId, salesDateFilter);
        }
    }, [salesDateFilter, storeId]);

    // ✅ SUBSCRIÇÃO REAL-TIME: Escutar novas vendas e atualizar automaticamente
    useEffect(() => {
        if (!storeId) return;

        console.log('[LojaDashboard] 📡 Configurando subscription real-time para vendas...');

        // Configurar canal de real-time para escutar mudanças na tabela sales
        const channel = supabase
            .channel(`sales-${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Escutar INSERT, UPDATE, DELETE
                    schema: 'sistemaretiradas',
                    table: 'sales',
                    filter: `store_id=eq.${storeId}`,
                },
                async (payload) => {
                    console.log('[LojaDashboard] 📡 Mudança detectada na tabela sales:', payload.eventType);

                    // Se for uma inserção ou atualização, recarregar vendas
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                        console.log('[LojaDashboard] 🔄 Recarregando vendas devido a mudança real-time...');

                        // ✅ NOVO: Se for INSERT e vier do ERP (tiny_order_id não null) e CRM estiver ativo, abrir dialog
                        if (payload.eventType === 'INSERT' && payload.new) {
                            const newSale = payload.new as any;
                            // Buscar status do CRM dinamicamente para evitar stale closure
                            const { data: storeData } = await supabase
                                .schema("sistemaretiradas")
                                .from('stores')
                                .select('crm_ativo')
                                .eq('id', storeId)
                                .single();

                            if (newSale.tiny_order_id && storeData?.crm_ativo) {
                                console.log('[LojaDashboard] 🎯 Venda do ERP detectada! Abrindo dialog de pós-venda...');

                                // Aguardar um pouco para garantir que a venda foi completamente salva
                                setTimeout(() => {
                                    setLastSaleData({
                                        saleId: newSale.id,
                                        colaboradoraId: newSale.colaboradora_id,
                                        saleDate: newSale.data_venda,
                                        saleObservations: newSale.observacoes || null
                                    });
                                    setPostSaleDialogOpen(true);
                                }, 1000);
                            }
                        }

                        // Pequeno delay para garantir que a mudança foi persistida
                        setTimeout(() => {
                            fetchSalesWithStoreId(storeId, salesDateFilter);
                            // Também atualizar metas e outros dados que podem ter mudado
                            fetchGoalsWithStoreId(storeId);
                        }, 500);
                    }
                }
            )
            .subscribe();

        // Cleanup: remover subscription quando componente desmontar ou storeId mudar
        return () => {
            console.log('[LojaDashboard] 🛑 Removendo subscription real-time...');
            supabase.removeChannel(channel);
        };
    }, [storeId, salesDateFilter]);

    const fetchSalesWithStoreId = async (currentStoreId: string, filterDate?: string) => {
        if (!currentStoreId) return;

        const filterDateToUse = filterDate || salesDateFilter;
        const startOfDay = `${filterDateToUse}T00:00:00`;
        const endOfDay = `${filterDateToUse}T23:59:59`;

        console.log('[LojaDashboard] 📡 Buscando vendas...');
        console.log('[LojaDashboard]   storeId:', currentStoreId);
        console.log('[LojaDashboard]   filterDate:', filterDateToUse);
        console.log('[LojaDashboard]   startOfDay:', startOfDay);
        console.log('[LojaDashboard]   endOfDay:', endOfDay);

        const { data, error } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select(`
        *,
        colaboradora:profiles!sales_colaboradora_id_fkey(name)
      `)
            .eq('store_id', currentStoreId)
            .gte('data_venda', startOfDay)
            .lte('data_venda', endOfDay)
            .order('data_venda', { ascending: false });

        console.log('[LojaDashboard] 📊 Resultado da busca:');
        console.log('[LojaDashboard]   Total de vendas encontradas:', data?.length || 0);
        console.log('[LojaDashboard]   Vendas com tiny_order_id:', data?.filter((s: any) => s.tiny_order_id).length || 0);
        if (error) {
            console.error('[LojaDashboard] ❌ Erro:', error);
        }

        if (error) {
            console.error('[LojaDashboard] Erro ao carregar vendas:', error);
            toast.error('Erro ao carregar vendas');
        } else {
            // Remover duplicatas usando Map (chave: sale.id)
            const uniqueSalesMap = new Map<string, typeof data[0]>();
            (data || []).forEach((sale) => {
                if (!uniqueSalesMap.has(sale.id)) {
                    uniqueSalesMap.set(sale.id, sale);
                }
            });

            const uniqueSales = Array.from(uniqueSalesMap.values());

            // Ordenar vendas: primeiro por data_venda (desc), depois por created_at (desc) para ordem consistente
            const sortedSales = uniqueSales.sort((a, b) => {
                const dateA = new Date(a.data_venda).getTime();
                const dateB = new Date(b.data_venda).getTime();

                if (dateB !== dateA) {
                    return dateB - dateA; // Mais recente primeiro
                }

                // Se as datas forem iguais, ordenar por created_at (mais recente primeiro)
                const createdA = new Date(a.created_at || 0).getTime();
                const createdB = new Date(b.created_at || 0).getTime();
                return createdB - createdA;
            });

            setSales(sortedSales);
        }
    };

    const fetchColaboradorasWithStoreId = async (currentStoreId: string, currentStoreName?: string | null) => {
        if (!currentStoreId) {
            console.warn('[LojaDashboard] ⚠️ fetchColaboradorasWithStoreId chamado sem storeId');
            return;
        }

        // Usar currentStoreName se fornecido, senão usar storeName do estado
        const storeNameToUse = currentStoreName || storeName;

        try {
            console.log('[LojaDashboard] 🔍 Buscando colaboradoras...');
            console.log('[LojaDashboard]   storeId usado na busca:', currentStoreId);
            console.log('[LojaDashboard]   storeName:', storeNameToUse || 'NULL');

            // Estratégia 1: Buscar colaboradoras por store_id (UUID) - forma preferida
            console.log('[LojaDashboard] 📡 Executando query Supabase:');
            console.log('[LojaDashboard]   Schema: sistemaretiradas');
            console.log('[LojaDashboard]   Table: profiles');
            console.log('[LojaDashboard]   Filters: role=COLABORADORA, is_active=true, store_id=' + currentStoreId);

            let { data, error } = await supabase
                .schema("sistemaretiradas")
                .from('profiles')
                .select('id, name, is_active, store_id, store_default')
                .eq('role', 'COLABORADORA')
                .eq('is_active', true)
                .eq('store_id', currentStoreId)
                .order('name');

            if (error) {
                console.error('[LojaDashboard] ❌ Erro ao buscar colaboradoras por store_id:', error);
                console.error('[LojaDashboard]   Erro completo:', JSON.stringify(error, null, 2));
                console.error('[LojaDashboard]   Erro code:', error.code);
                console.error('[LojaDashboard]   Erro message:', error.message);
                console.error('[LojaDashboard]   Erro details:', error.details);
                // Continuar para tentar outras estratégias
                data = null;
            } else {
                console.log('[LojaDashboard] 📊 Resultado da query Supabase:');
                console.log('[LojaDashboard]   Total de registros retornados:', data?.length || 0);
                if (data && data.length > 0) {
                    console.log('[LojaDashboard]   Dados retornados:');
                    data.forEach((colab, idx) => {
                        console.log(`[LojaDashboard]     ${idx + 1}. ${colab.name} - store_id: ${colab.store_id}`);
                    });
                } else {
                    console.log('[LojaDashboard]   ⚠️ Query retornou 0 resultados (mas não houve erro)');
                }
            }

            // Se não encontrou por store_id, tentar buscar TODAS e filtrar no cliente
            if (!data || data.length === 0) {
                console.log('[LojaDashboard] ⚠️ Nenhuma colaboradora encontrada por store_id, tentando busca alternativa...');
                console.log('[LojaDashboard]   storeName para busca:', storeNameToUse || 'NULL');

                // Estratégia alternativa: Buscar TODAS as colaboradoras e filtrar no cliente
                console.log('[LojaDashboard] 🔄 Tentando buscar TODAS as colaboradoras e filtrar no cliente...');
                const { data: allColabs, error: allError } = await supabase
                    .schema("sistemaretiradas")
                    .from('profiles')
                    .select('id, name, is_active, store_id, store_default, role')
                    .eq('role', 'COLABORADORA')
                    .eq('is_active', true)
                    .order('name');

                if (allError) {
                    console.error('[LojaDashboard] ❌ Erro ao buscar todas as colaboradoras:', allError);
                } else if (allColabs) {
                    console.log('[LojaDashboard] 📊 Total de colaboradoras ativas no sistema:', allColabs.length);

                    // Filtrar por store_id primeiro
                    let matching = allColabs.filter((colab: any) => colab.store_id === currentStoreId);
                    console.log(`[LojaDashboard]   Colaboradoras com store_id ${currentStoreId}:`, matching.length);

                    // Se não encontrou por store_id, tentar por store_default
                    if (matching.length === 0 && storeNameToUse) {
                        // Normalizar nome para busca (remover |, vírgulas, espaços extras)
                        const normalizeName = (name: string) => {
                            return name
                                .toLowerCase()
                                .replace(/[|,]/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                        };

                        const normalizedStoreName = normalizeName(storeNameToUse);
                        console.log('[LojaDashboard]   Nome normalizado para busca:', normalizedStoreName);

                        // Primeiro, tentar match exato com store_default
                        matching = allColabs.filter((colab: any) => {
                            if (!colab.store_default) return false;
                            return colab.store_default === storeNameToUse ||
                                colab.store_default.toLowerCase() === storeNameToUse.toLowerCase();
                        });

                        // Se não encontrou, tentar match normalizado
                        if (matching.length === 0) {
                            matching = allColabs.filter((colab: any) => {
                                if (!colab.store_default) return false;
                                const normalizedColabStore = normalizeName(colab.store_default);
                                return normalizedColabStore === normalizedStoreName;
                            });
                        }

                        // Se ainda não encontrou, tentar match parcial
                        if (matching.length === 0) {
                            matching = allColabs.filter((colab: any) => {
                                if (!colab.store_default) return false;
                                const normalizedColabStore = normalizeName(colab.store_default);
                                return normalizedColabStore.includes(normalizedStoreName) ||
                                    normalizedStoreName.includes(normalizedColabStore);
                            });
                        }
                    }

                    console.log(`[LojaDashboard]   Colaboradoras que MATCHAM store_id ${currentStoreId} ou store_default "${storeNameToUse || 'N/A'}":`, matching.length);

                    if (matching.length > 0) {
                        console.log('[LojaDashboard] ✅ Encontradas colaboradoras na busca alternativa:');
                        matching.forEach((colab: any, idx: number) => {
                            console.log(`[LojaDashboard]   ${idx + 1}. ${colab.name}: store_id = ${colab.store_id || 'NULL'}, store_default = ${colab.store_default || 'NULL'}`);
                        });
                        setColaboradoras(matching);
                        return;
                    } else {
                        // Log detalhado de todas as colaboradoras para debug
                        console.log('[LojaDashboard] 🔍 Debug: Todas as colaboradoras ativas no sistema:');
                        allColabs.forEach((colab: any) => {
                            console.log(`[LojaDashboard]   - ${colab.name}: store_id = ${colab.store_id || 'NULL'}, store_default = ${colab.store_default || 'NULL'}`);
                        });
                    }
                }
            } else {
                // Encontrou por store_id - sucesso!
                console.log('[LojaDashboard] ✅ Colaboradoras encontradas por store_id:');
                data.forEach((colab, idx) => {
                    console.log(`[LojaDashboard]   ${idx + 1}. ${colab.name} (id: ${colab.id}, store_id: ${colab.store_id})`);
                });
                setColaboradoras(data);
                return;
            }

            // Se chegou aqui, não encontrou nenhuma colaboradora
            console.warn('[LojaDashboard] ⚠️ Nenhuma colaboradora encontrada para a loja');
            setColaboradoras([]);
        } catch (error: any) {
            console.error('[LojaDashboard] ❌ Erro ao carregar colaboradoras:', error);
            toast.error('Erro ao carregar colaboradoras: ' + (error.message || 'Erro desconhecido'));
            setColaboradoras([]);
        }
    };

    // getStoreId não é mais necessário - usar storeId diretamente
    // Mantido apenas para compatibilidade com código existente
    const getStoreId = () => {
        if (!storeId) {
            console.warn("storeId não identificado ainda");
        }
        return storeId || null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (submitting) return;

        if (!formData.colaboradora_id || !formData.valor || !formData.qtd_pecas) {
            toast.error('Preencha todos os campos obrigatorios');
            return;
        }

        if (!storeId) {
            toast.error('Erro: ID da loja nao identificado');
            return;
        }

        const valorVenda = parseFloat(formData.valor) || 0;

        // Validacao robusta usando o modulo de validacao
        const validacao = validateFormasPagamento(formasPagamento, valorVenda);
        if (!validacao.valid) {
            validacao.errors.forEach(err => toast.error(err));
            return;
        }

        setSubmitting(true);
        setSubmitSuccess(false);

        // Obter forma de pagamento principal (maior valor)
        const formaPrincipal = getFormaPrincipal(formasPagamento);

        // Gerar resumo textual para compatibilidade (backup legivel)
        const resumoPagamentos = formatFormasPagamentoResumo(formasPagamento);
        let observacoesComPagamento = formData.observacoes || '';
        if (resumoPagamentos && resumoPagamentos !== 'Nao informado') {
            observacoesComPagamento = observacoesComPagamento
                ? `${observacoesComPagamento} | Pagamento: ${resumoPagamentos}`
                : `Pagamento: ${resumoPagamentos}`;
        }

        try {
            const { data: insertedSale, error } = await supabase
                .schema("sistemaretiradas")
                .from('sales')
                .insert({
                    colaboradora_id: formData.colaboradora_id,
                    store_id: storeId,
                    valor: valorVenda,
                    qtd_pecas: parseInt(formData.qtd_pecas),
                    data_venda: formData.data_venda,
                    observacoes: observacoesComPagamento || null,
                    lancado_por_id: profile?.id,
                    forma_pagamento: formaPrincipal,
                    formas_pagamento_json: formasPagamento,
                    cliente_id: formData.cliente_id || null, // ID do cliente (opcional)
                    cliente_nome: formData.cliente_nome || null, // Nome do cliente (opcional)
                })
                .select()
                .single();

            if (error) {
                console.error('[Venda] Erro ao inserir:', error);
                if (error.code === '42703') {
                    toast.error('Erro: Coluna nao existe no banco. Execute o SQL de migracao.');
                } else if (error.code === '23514') {
                    toast.error('Erro: Dados invalidos. Verifique valores e formas de pagamento.');
                } else {
                    toast.error('Erro ao lancar venda: ' + (error.message || 'Erro desconhecido'));
                }
                setSubmitting(false);
                return;
            }

            // Sucesso
            setSubmitSuccess(true);
            setTimeout(() => {
                setSubmitSuccess(false);
                setSubmitting(false);
            }, 1500);
            // PRIORIDADE 1: Salvar venda (já salvo acima)
            // IMPORTANTE: Salvar dados da venda ANTES de resetar o form
            const vendaData = {
                colaboradora_id: formData.colaboradora_id,
                valor: formData.valor,
                qtd_pecas: formData.qtd_pecas,
                data_venda: formData.data_venda,
                observacoes: formData.observacoes || null,
            };

            // Salvar formas de pagamento antes de resetar (filtrar e garantir tipagem)
            const formasPagamentoData: FormaPagamentoType[] = formasPagamento
                .filter((fp): fp is FormaPagamentoType => fp.tipo !== undefined && fp.valor !== undefined);

            toast.success('Venda lançada com sucesso!');
            setDialogOpen(false);

            // ✅ ABRIR DIALOG DE AGENDAMENTO DE PÓS-VENDA (se CRM estiver ativo)
            console.log('[LojaDashboard] Verificando se deve abrir dialog de pós-venda:', {
                hasSaleId: !!insertedSale?.id,
                crmAtivo,
                insertedSaleId: insertedSale?.id
            });

            if (insertedSale?.id && crmAtivo) {
                console.log('[LojaDashboard] ✅ Abrindo dialog de pós-venda');

                // Buscar telefone do cliente se houver cliente_id
                let clienteTelefone: string | undefined = undefined;
                if (formData.cliente_id && formData.cliente_id !== 'CONSUMIDOR_FINAL') {
                    try {
                        // Buscar telefone do cliente em crm_contacts ou contacts
                        const { data: clienteData } = await supabase
                            .schema('sistemaretiradas')
                            .from('crm_contacts')
                            .select('telefone')
                            .eq('id', formData.cliente_id)
                            .maybeSingle();

                        if (clienteData?.telefone) {
                            clienteTelefone = clienteData.telefone;
                        } else {
                            // Tentar buscar em contacts
                            const { data: contactData } = await supabase
                                .schema('sistemaretiradas')
                                .from('contacts')
                                .select('telefone')
                                .eq('id', formData.cliente_id)
                                .maybeSingle();

                            if (contactData?.telefone) {
                                clienteTelefone = contactData.telefone;
                            }
                        }
                    } catch (error) {
                        console.warn('[LojaDashboard] Erro ao buscar telefone do cliente:', error);
                    }
                }

                setLastSaleData({
                    saleId: insertedSale.id,
                    colaboradoraId: formData.colaboradora_id,
                    saleDate: formData.data_venda,
                    saleObservations: formData.observacoes || null,
                    clienteId: formData.cliente_id || undefined,
                    clienteNome: formData.cliente_nome || undefined,
                    clienteTelefone: clienteTelefone,
                });
                // Usar setTimeout para garantir que o estado seja atualizado antes de abrir o dialog
                setTimeout(() => {
                    setPostSaleDialogOpen(true);
                }, 100);
            } else {
                console.log('[LojaDashboard] ❌ Não abrindo dialog:', {
                    reason: !insertedSale?.id ? 'Sem saleId' : 'CRM não está ativo'
                });
                resetForm(); // Resetar form apenas se não abrir o dialog
            }

            // PRIORIDADE 2: Enviar WhatsApp em background (não bloqueia UI)
            // Buscar dados para enviar WhatsApp para os administradores
            // Buscar nome da colaboradora e destinatários WhatsApp de todos os admins ativos
            if (vendaData.colaboradora_id) {
                console.log('📱 Iniciando processo de envio de WhatsApp...');
                console.log('📱 Dados da venda:', vendaData);

                // Executar tudo em background sem bloquear a UI
                // IMPORTANTE: Não usar await aqui para não bloquear a UI
                (async () => {
                    try {
                        console.log('📱 ✅ Função assíncrona iniciada!');
                        console.log('📱 [1/4] Iniciando busca de dados...');

                        // Primeiro: buscar nome da colaboradora e admin da loja atual
                        console.log('📱 [1/4] Buscando colaboradora e admin da loja...');
                        console.log('📱 [1/4] Store ID:', storeId);

                        const [colaboradoraResult, storeResult] = await Promise.all([
                            // Buscar nome da colaboradora
                            supabase
                                .schema('sistemaretiradas')
                                .from('profiles')
                                .select('name')
                                .eq('id', vendaData.colaboradora_id)
                                .single(),
                            // Buscar admin_id da loja atual
                            storeId ? supabase
                                .schema('sistemaretiradas')
                                .from('stores')
                                .select('admin_id, name')
                                .eq('id', storeId)
                                .single()
                                : Promise.resolve({ data: null, error: null })
                        ]);

                        console.log('📱 [1/4] Resultado da busca de colaboradora:', colaboradoraResult);
                        console.log('📱 [1/4] Resultado da busca da loja:', storeResult);

                        if (colaboradoraResult.error) {
                            console.error('❌ Erro ao buscar colaboradora:', colaboradoraResult.error);
                            return;
                        }

                        if (!storeId) {
                            console.error('❌ Store ID não identificado. Não é possível buscar admin da loja.');
                            return;
                        }

                        if (storeResult.error) {
                            console.error('❌ Erro ao buscar loja:', storeResult.error);
                            return;
                        }

                        const colaboradoraName = colaboradoraResult.data?.name || 'Desconhecida';
                        const storeAdminId = storeResult.data?.admin_id || null;
                        const storeNameFromDb = storeResult.data?.name || storeName || 'Loja';

                        console.log('📱 [2/4] Colaboradora encontrada:', colaboradoraName);
                        console.log('📱 [2/4] Loja:', storeNameFromDb);
                        console.log('📱 [2/4] Admin ID da loja:', storeAdminId);

                        // Segundo: buscar destinatários WhatsApp do admin da loja (tipo VENDA)
                        console.log('📱 [2/4] Buscando destinatários WhatsApp para notificação de VENDA...');
                        let adminPhones: string[] = [];

                        if (storeAdminId) {
                            console.log('📱 [2/4] Buscando destinatários para o admin:', storeAdminId);

                            // Buscar destinatários: store_id IS NULL (todas as lojas) OU store_id = loja atual
                            const { data: recipientsAllStores } = await supabase
                                .schema('sistemaretiradas')
                                .from('whatsapp_notification_config')
                                .select('phone')
                                .eq('admin_id', storeAdminId)
                                .eq('notification_type', 'VENDA')
                                .eq('active', true)
                                .is('store_id', null);

                            const { data: recipientsThisStore, error: recipientsError } = await supabase
                                .schema('sistemaretiradas')
                                .from('whatsapp_notification_config')
                                .select('phone')
                                .eq('admin_id', storeAdminId)
                                .eq('notification_type', 'VENDA')
                                .eq('active', true)
                                .eq('store_id', storeId);

                            // Combinar resultados e remover duplicatas
                            const recipientsData = [
                                ...(recipientsAllStores || []),
                                ...(recipientsThisStore || [])
                            ].filter((item, index, self) =>
                                index === self.findIndex(t => t.phone === item.phone)
                            );

                            console.log('📱 [2/4] Resultado da busca de destinatários:', { recipientsData, recipientsError });

                            if (recipientsError) {
                                console.error('❌ Erro ao buscar destinatários WhatsApp:', recipientsError);
                                return;
                            }

                            // Extrair lista de números dos destinatários
                            if (recipientsData && recipientsData.length > 0) {
                                recipientsData.forEach((recipient: any) => {
                                    if (recipient.phone) {
                                        // Normalizar: remover caracteres não numéricos
                                        // A função Netlify adicionará o DDI 55 se necessário
                                        const cleaned = recipient.phone.replace(/\D/g, '');
                                        if (cleaned && !adminPhones.includes(cleaned)) {
                                            adminPhones.push(cleaned);
                                        }
                                    }
                                });
                            }
                        } else {
                            console.warn('⚠️ [2/4] Loja não tem admin_id configurado!');
                            console.warn('⚠️ [2/4] Configure o admin_id da loja na tabela stores.');
                        }

                        console.log('📱 [3/4] Destinatários WhatsApp encontrados:', adminPhones.length);
                        if (adminPhones.length > 0) {
                            console.log('📱 [3/4] Números:', adminPhones);
                        } else {
                            console.warn('⚠️ [3/4] NENHUM destinatário WhatsApp encontrado!');
                            console.warn('⚠️ [3/4] Verifique se há números configurados em "Configurações > Notificações WhatsApp" para o tipo "VENDA".');
                        }

                        // Enviar mensagem WhatsApp para todos os números em background
                        if (adminPhones.length > 0) {
                            console.log('📱 [4/4] Buscando totais da loja...');

                            // ✅ CORREÇÃO: Aguardar um pequeno delay para garantir que a venda foi salva no banco
                            // e então recalcular o total incluindo a venda recém-criada
                            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms de delay

                            // Buscar total do dia (todas as vendas do dia da loja) - AGORA incluindo a venda recém-salva
                            const hoje = new Date();
                            const hojeStr = format(hoje, 'yyyy-MM-dd');
                            const valorVendaAtual = parseFloat(vendaData.valor) || 0;
                            const saleIdAtual = insertedSale?.id;

                            const { data: vendasHoje, error: vendasHojeError } = await supabase
                                .schema('sistemaretiradas')
                                .from('sales')
                                .select('id, valor')
                                .eq('store_id', storeId)
                                .gte('data_venda', `${hojeStr}T00:00:00`)
                                .lte('data_venda', `${hojeStr}T23:59:59`);

                            // ✅ CORREÇÃO: Calcular total do dia e verificar se a venda atual já está incluída
                            let totalDia = 0;
                            let vendaAtualJaIncluida = false;
                            if (!vendasHojeError && vendasHoje) {
                                totalDia = vendasHoje.reduce((sum: number, v: any) => sum + parseFloat(v.valor || 0), 0);
                                // Verificar se a venda atual já está na lista pelo ID
                                vendaAtualJaIncluida = vendasHoje.some((v: any) => v.id === saleIdAtual);
                            }
                            // ✅ Só adicionar a venda atual se ela NÃO estiver na query ainda
                            if (!vendaAtualJaIncluida) {
                                console.log('📱 [4/4] Venda atual NÃO estava na query, adicionando ao total...');
                                totalDia = totalDia + valorVendaAtual;
                            } else {
                                console.log('📱 [4/4] Venda atual JÁ estava na query, não duplicando.');
                            }

                            // ✅ CORREÇÃO: Recalcular total do mês também, verificando duplicatas
                            // Reutilizar a variável 'hoje' já declarada acima
                            const mesAtualISO = hoje.toISOString().slice(0, 7); // Formato: yyyy-MM
                            const primeiroDiaMes = `${mesAtualISO}-01T00:00:00`;
                            const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                            const ultimoDiaMesISO = format(ultimoDiaMes, 'yyyy-MM-dd');

                            const { data: vendasMes, error: vendasMesError } = await supabase
                                .schema('sistemaretiradas')
                                .from('sales')
                                .select('id, valor')
                                .eq('store_id', storeId)
                                .gte('data_venda', primeiroDiaMes)
                                .lte('data_venda', `${ultimoDiaMesISO}T23:59:59`);

                            // ✅ CORREÇÃO: Calcular total do mês e verificar se a venda atual já está incluída
                            let totalMesAtualizado = 0;
                            let vendaAtualJaIncluidaMes = false;
                            if (!vendasMesError && vendasMes) {
                                totalMesAtualizado = vendasMes.reduce((sum: number, v: any) => sum + parseFloat(v.valor || 0), 0);
                                // Verificar se a venda atual já está na lista pelo ID
                                vendaAtualJaIncluidaMes = vendasMes.some((v: any) => v.id === saleIdAtual);

                                // ✅ Só adicionar a venda atual se ela NÃO estiver na query ainda
                                if (!vendaAtualJaIncluidaMes) {
                                    console.log('📱 [4/4] Venda atual NÃO estava na query mensal, adicionando ao total...');
                                    totalMesAtualizado = totalMesAtualizado + valorVendaAtual;
                                } else {
                                    console.log('📱 [4/4] Venda atual JÁ estava na query mensal, não duplicando.');
                                }
                            } else {
                                // Se houver erro, usar o maior entre monthlyRealizado + venda atual OU total do dia
                                totalMesAtualizado = Math.max((monthlyRealizado || 0) + valorVendaAtual, totalDia);
                            }

                            console.log('📱 [4/4] === TOTAIS CALCULADOS ===');
                            console.log('📱 [4/4] Valor da venda atual:', valorVendaAtual.toFixed(2));
                            console.log('📱 [4/4] Venda já incluída na query diária:', vendaAtualJaIncluida);
                            console.log('📱 [4/4] Venda já incluída na query mensal:', vendaAtualJaIncluidaMes);
                            console.log('📱 [4/4] Total do dia FINAL:', totalDia.toFixed(2));
                            console.log('📱 [4/4] Total do mês FINAL:', totalMesAtualizado.toFixed(2));

                            console.log('📱 [4/4] Formatando mensagem...');
                            const { formatVendaMessage, sendWhatsAppMessage } = await import('@/lib/whatsapp');

                            // Usar cliente_nome do insertedSale diretamente (já vem no select)
                            let clienteNome = null;
                            if (insertedSale?.cliente_nome &&
                                insertedSale.cliente_nome !== 'Consumidor Final' &&
                                insertedSale.cliente_nome !== 'CONSUMIDOR_FINAL') {
                                clienteNome = insertedSale.cliente_nome;
                            }

                            const message = formatVendaMessage({
                                colaboradoraName,
                                valor: parseFloat(vendaData.valor),
                                qtdPecas: parseInt(vendaData.qtd_pecas),
                                storeName: storeNameFromDb || storeName || undefined,
                                dataVenda: vendaData.data_venda,
                                observacoes: vendaData.observacoes || null,
                                totalDia: totalDia,
                                totalMes: totalMesAtualizado || undefined,
                                formasPagamento: formasPagamentoData,
                                clienteNome: clienteNome,
                            });

                            console.log('📱 [4/4] Mensagem formatada:', message);
                            console.log(`📱 [4/4] Enviando WhatsApp para ${adminPhones.length} destinatário(s)...`);

                            Promise.all(
                                adminPhones.map(phone =>
                                    sendWhatsAppMessage({
                                        phone,
                                        message,
                                        store_id: storeId, // ✅ Multi-tenancy: usar WhatsApp da loja se configurado
                                    }).then(result => {
                                        if (result.success) {
                                            console.log(`✅ WhatsApp enviado com sucesso para ${phone}`);
                                        } else {
                                            console.warn(`⚠️ Falha ao enviar WhatsApp para ${phone}:`, result.error);
                                        }
                                    }).catch(err => {
                                        console.error(`❌ Erro ao enviar WhatsApp para ${phone}:`, err);
                                    })
                                )
                            ).then(() => {
                                console.log('📱 Processo de envio de WhatsApp concluído');
                            }).catch(err => {
                                console.error('❌ Erro geral ao enviar WhatsApp:', err);
                            });
                        } else {
                            console.warn('⚠️ Nenhum destinatário WhatsApp ativo encontrado. Mensagem não será enviada.');
                            console.warn('⚠️ Verifique se há números configurados em "Configurações > Notificações WhatsApp" para o tipo "VENDA".');
                        }

                        // Enviar mensagem de parabéns para a loja (tipo PARABENS)
                        // Buscar destinatários para PARABENS
                        if (storeAdminId && colaboradoraName) {
                            console.log('📱 [PARABENS] Buscando destinatários para notificação de PARABENS...');

                            const { data: parabensRecipients } = await supabase
                                .schema('sistemaretiradas')
                                .from('whatsapp_notification_config')
                                .select('phone')
                                .eq('admin_id', storeAdminId)
                                .eq('notification_type', 'PARABENS')
                                .eq('active', true)
                                .eq('store_id', storeId); // PARABENS deve ser específico da loja

                            if (parabensRecipients && parabensRecipients.length > 0) {
                                const { formatParabensMessage, sendWhatsAppMessage: sendWA } = await import('@/lib/whatsapp');

                                const parabensMessage = formatParabensMessage({
                                    colaboradoraName,
                                    valor: parseFloat(vendaData.valor),
                                    storeName: storeNameFromDb || storeName || undefined,
                                });

                                Promise.all(
                                    parabensRecipients.map((recipient: any) => {
                                        const cleanedPhone = recipient.phone.replace(/\D/g, '');
                                        return sendWA({
                                            phone: cleanedPhone,
                                            message: parabensMessage,
                                            store_id: storeId, // ✅ Multi-tenancy: usar WhatsApp da loja se configurado
                                        }).catch(err => {
                                            console.error(`❌ Erro ao enviar parabéns para ${cleanedPhone}:`, err);
                                        });
                                    })
                                ).then(() => {
                                    console.log('📱 [PARABENS] Mensagens de parabéns enviadas!');
                                });
                            } else {
                                console.log('📱 [PARABENS] Nenhum destinatário configurado para PARABENS. Mensagem não será enviada.');
                            }
                        }
                    } catch (err: any) {
                        console.error('❌ Erro ao buscar dados para WhatsApp:', err);
                        console.error('❌ Stack trace:', err?.stack);
                        console.error('❌ Mensagem:', err?.message);
                        console.error('❌ Erro completo:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                        // Não mostrar erro ao usuário, apenas log
                    }
                })().catch((err: any) => {
                    // Catch adicional para capturar erros não tratados na função assíncrona
                    console.error('❌ Erro não capturado na função assíncrona:', err);
                    console.error('❌ Stack trace:', err?.stack);
                    console.error('❌ Mensagem:', err?.message);
                });
            } else {
                console.log('⚠️ Nenhuma colaboradora selecionada. WhatsApp não será enviado.');
                console.log('⚠️ vendaData.colaboradora_id:', vendaData.colaboradora_id);
            }

            // Verificar e criar troféus automaticamente
            if (vendaData.colaboradora_id) {
                const hoje = new Date();
                const monday = startOfWeek(hoje, { weekStartsOn: 1 });
                const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
                const year = getYear(monday);
                const semanaRef = `${String(week).padStart(2, '0')}${year}`;

                // Verificar troféus mensais e semanais em background (não bloquear UI)
                (async () => {
                    try {
                        const { checkAndCreateMonthlyTrophies, checkAndCreateWeeklyTrophies } = await import('@/lib/trophies');
                        await Promise.all([
                            checkAndCreateMonthlyTrophies(vendaData.colaboradora_id, storeId),
                            checkAndCreateWeeklyTrophies(vendaData.colaboradora_id, storeId, semanaRef)
                        ]);
                    } catch (err) {
                        console.error('Erro ao verificar troféus:', err);
                    }
                })();
            }

            // Atualizar todos os dados automaticamente
            await Promise.all([
                fetchSalesWithStoreId(storeId, salesDateFilter),
                fetchColaboradorasPerformanceWithStoreId(storeId, storeName || undefined),
                fetchGoalsWithStoreId(storeId),
                fetchRankingTop3WithStoreId(storeId),
                fetchMonthlyRankingWithStoreId(storeId, storeName || undefined),
                fetch7DayHistoryWithStoreId(storeId),
                fetchMonthlyDataByDayWithStoreId(storeId)
            ]);
        } catch (error: any) {
            console.error('[Venda] Erro inesperado:', error);
            toast.error('Erro inesperado ao lancar venda: ' + (error.message || 'Erro desconhecido'));
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            colaboradora_id: "",
            valor: "",
            qtd_pecas: "",
            data_venda: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            observacoes: "",
            cliente_id: "",
            cliente_nome: "",
        });
        setSearchCliente("");
        setSelectedClienteId(null);
        setFormasPagamento([{
            tipo: 'DINHEIRO',
            valor: 0,
        }]);
        setEditingSaleId(null);
    };

    // Quando selecionar cliente
    const handleClienteSelect = (clienteId: string) => {
        setSelectedClienteId(clienteId);
        setSearchCliente("");
        const cliente = allClients.find(c => c.id === clienteId);
        if (cliente) {
            setFormData({ ...formData, cliente_id: clienteId, cliente_nome: cliente.nome });
        }
    };

    // Quando limpar seleção
    const handleClearClientSelection = () => {
        setSelectedClienteId(null);
        setSearchCliente("");
        setFormData({ ...formData, cliente_id: "", cliente_nome: "" });
    };

    // Quando novo cliente for criado
    const handleNewClientCreated = async (client: { id: string; nome: string; cpf: string | null }) => {
        console.log('[LojaDashboard] 🎉 Novo cliente criado:', client);
        console.log('[LojaDashboard] 📍 storeId atual:', storeId);

        if (client.id === 'CONSUMIDOR_FINAL') {
            // Consumidor Final: limpar campos
            setSelectedClienteId(null);
            setSearchCliente("");
            setFormData({ ...formData, cliente_id: "", cliente_nome: "" });
        } else {
            // Cliente cadastrado: selecionar
            console.log('[LojaDashboard] 🔄 Recarregando lista de clientes...');

            // Recarregar lista de clientes para incluir o novo
            refreshClients();

            // Aguardar um pouco para garantir que os dados sejam recarregados
            await new Promise(resolve => setTimeout(resolve, 500));

            // Selecionar o cliente recém-criado
            setSelectedClienteId(client.id);
            setSearchCliente(client.nome);
            setFormData({ ...formData, cliente_id: client.id, cliente_nome: client.nome });

            console.log('[LojaDashboard] ✅ Cliente selecionado e lista recarregada');
        }
    };

    const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
    const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
    const [erpSaleDetails, setErpSaleDetails] = useState<Record<string, any>>({});

    const toggleSaleExpansion = async (saleId: string, tinyOrderId: string | null) => {
        if (!tinyOrderId) return;

        const isExpanded = expandedSales.has(saleId);
        const newExpanded = new Set(expandedSales);

        if (isExpanded) {
            newExpanded.delete(saleId);
        } else {
            newExpanded.add(saleId);

            // Buscar detalhes se ainda não foram carregados
            if (!erpSaleDetails[saleId]) {
                try {
                    const { data, error } = await supabase
                        .schema("sistemaretiradas")
                        .from('tiny_orders')
                        .select('cliente_nome, itens, forma_pagamento')
                        .eq('id', tinyOrderId)
                        .single();

                    if (!error && data) {
                        setErpSaleDetails(prev => ({
                            ...prev,
                            [saleId]: data
                        }));
                    }
                } catch (error) {
                    console.error('Erro ao buscar detalhes do ERP:', error);
                }
            }
        }

        setExpandedSales(newExpanded);
    };

    const handleEdit = (sale: Sale) => {
        setFormData({
            colaboradora_id: sale.colaboradora_id,
            valor: sale.valor.toString(),
            qtd_pecas: sale.qtd_pecas.toString(),
            data_venda: format(new Date(sale.data_venda), "yyyy-MM-dd'T'HH:mm"),
            observacoes: sale.observacoes || "",
            cliente_id: sale.cliente_id || "",
            cliente_nome: sale.cliente_nome || "",
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

        // Buscar a venda para verificar se tem tiny_order_id
        const { data: sale, error: saleError } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select('id, tiny_order_id')
            .eq('id', editingSaleId!)
            .single();

        if (saleError) {
            toast.error('Erro ao buscar venda');
            console.error(saleError);
            return;
        }

        // Obter forma de pagamento principal (maior valor)
        const formaPrincipal = getFormaPrincipal(formasPagamento);

        // Gerar resumo textual para compatibilidade (backup legivel)
        const resumoPagamentos = formatFormasPagamentoResumo(formasPagamento);
        let observacoesComPagamento = formData.observacoes || '';
        if (resumoPagamentos && resumoPagamentos !== 'Nao informado') {
            observacoesComPagamento = observacoesComPagamento
                ? `${observacoesComPagamento} | Pagamento: ${resumoPagamentos}`
                : `Pagamento: ${resumoPagamentos}`;
        }

        try {
            // Atualizar a venda
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from('sales')
                .update({
                    colaboradora_id: formData.colaboradora_id,
                    valor: parseFloat(formData.valor),
                    qtd_pecas: parseInt(formData.qtd_pecas),
                    data_venda: formData.data_venda,
                    observacoes: observacoesComPagamento || null,
                    forma_pagamento: formaPrincipal,
                    formas_pagamento_json: formasPagamento,
                })
                .eq('id', editingSaleId!);

            if (error) {
                toast.error('Erro ao atualizar venda');
                console.error(error);
                return;
            }

            // Se for venda do ERP, atualizar também o tiny_orders
            if (sale.tiny_order_id) {
                const { error: orderError } = await supabase
                    .schema("sistemaretiradas")
                    .from('tiny_orders')
                    .update({
                        colaboradora_id: formData.colaboradora_id,
                        valor_total: parseFloat(formData.valor),
                        data_pedido: formData.data_venda,
                        observacoes: observacoesComPagamento || null,
                        forma_pagamento: formaPrincipal,
                        formas_pagamento_json: formasPagamento,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', sale.tiny_order_id);

                if (orderError) {
                    console.error('Erro ao atualizar pedido do Tiny:', orderError);
                    toast.warning('Venda atualizada, mas houve erro ao atualizar pedido do Tiny');
                } else {
                    toast.success('Venda e pedido do ERP atualizados com sucesso!');
                }
            } else {
                toast.success('Venda atualizada com sucesso!');
            }

            setDialogOpen(false);
            resetForm();

            // Verificar e criar troféus automaticamente
            if (formData.colaboradora_id && storeId) {
                const hoje = new Date();
                const monday = startOfWeek(hoje, { weekStartsOn: 1 });
                const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
                const year = getYear(monday);
                const semanaRef = `${String(week).padStart(2, '0')}${year}`;

                // Verificar troféus mensais e semanais em background (não bloquear UI)
                (async () => {
                    try {
                        const { checkAndCreateMonthlyTrophies, checkAndCreateWeeklyTrophies } = await import('@/lib/trophies');
                        await Promise.all([
                            checkAndCreateMonthlyTrophies(formData.colaboradora_id, storeId),
                            checkAndCreateWeeklyTrophies(formData.colaboradora_id, storeId, semanaRef)
                        ]);
                    } catch (err) {
                        console.error('Erro ao verificar troféus:', err);
                    }
                })();
            }

            // Atualizar todos os dados automaticamente
            await Promise.all([
                fetchSalesWithStoreId(storeId!, salesDateFilter),
                fetchColaboradorasPerformanceWithStoreId(storeId!, storeName || undefined),
                fetchGoalsWithStoreId(storeId!),
                fetchRankingTop3WithStoreId(storeId!),
                fetchMonthlyRankingWithStoreId(storeId!),
                fetch7DayHistoryWithStoreId(storeId!),
                fetchMonthlyDataByDayWithStoreId(storeId!)
            ]);
        } catch (error: any) {
            toast.error('Erro ao atualizar venda: ' + error.message);
            console.error(error);
        }
    };

    const handleDelete = async (saleId: string) => {
        // Buscar a venda para verificar se tem tiny_order_id
        const { data: sale, error: saleError } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select('id, tiny_order_id')
            .eq('id', saleId)
            .single();

        if (saleError) {
            toast.error('Erro ao buscar venda');
            console.error(saleError);
            return;
        }

        const isVendaERP = sale.tiny_order_id !== null;
        const confirmMessage = isVendaERP
            ? 'Tem certeza que deseja deletar esta venda do ERP? Isso excluirá a venda e o pedido do Tiny.'
            : 'Tem certeza que deseja deletar esta venda?';

        if (!confirm(confirmMessage)) return;

        try {
            // Se for venda do ERP, excluir também do tiny_orders
            if (isVendaERP && sale.tiny_order_id) {
                const { error: orderError } = await supabase
                    .schema("sistemaretiradas")
                    .from('tiny_orders')
                    .delete()
                    .eq('id', sale.tiny_order_id);

                if (orderError) {
                    console.error('Erro ao excluir pedido do Tiny:', orderError);
                    toast.error('Erro ao excluir pedido do Tiny');
                    return;
                }
            }

            // Excluir a venda
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from('sales')
                .delete()
                .eq('id', saleId);

            if (error) {
                toast.error('Erro ao deletar venda');
                console.error(error);
            } else {
                toast.success(isVendaERP ? 'Venda e pedido do ERP excluídos com sucesso!' : 'Venda excluída com sucesso!');
                if (storeId) await fetchDataWithStoreId(storeId);
            }
        } catch (error: any) {
            toast.error('Erro ao deletar: ' + error.message);
            console.error(error);
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
            if (!storeId) {
                toast.error('Erro: ID da loja não identificado');
                return;
            }

            const { error } = await supabase
                .schema("sistemaretiradas")
                .from('collaborator_off_days')
                .insert([{
                    colaboradora_id: selectedColabForOffDay,
                    off_date: offDayDate,
                    store_id: storeId
                }]);

            if (error) throw error;

            toast.success('Folga marcada com sucesso!');
            setOffDayDialog(false);
            setSelectedColabForOffDay(null);
            if (storeId) await fetchDataWithStoreId(storeId);
        } catch (error: any) {
            toast.error('Erro ao marcar folga: ' + error.message);
        }
    };

    // Função para preparar dados da tabela para exportação
    const prepareTableData = () => {
        const hoje = new Date();
        const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        const todayStr = format(hoje, 'yyyy-MM-dd');
        const days: string[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
            if (dayStr <= todayStr) {
                days.push(dayStr);
            }
        }

        // Calcular total por dia
        const totalPorDia: Record<string, number> = {};
        days.forEach(dayStr => {
            const totalDia = monthlyDataByDay.reduce((sum, data) => {
                const dayData = data.dailySales[dayStr] || { valor: 0 };
                return sum + dayData.valor;
            }, 0);
            totalPorDia[dayStr] = totalDia;
        });

        // Preparar cabeçalhos
        const headers = [
            'Vendedora',
            ...days.map(dayStr => format(new Date(dayStr + 'T00:00:00'), 'dd/MM')),
            'Total'
        ];

        // Preparar linhas de dados
        const rows: any[] = [];

        // Linhas das colaboradoras (ordenadas por total)
        [...monthlyDataByDay].sort((a, b) => b.totalMes - a.totalMes).forEach(data => {
            const row = [
                data.colaboradoraName,
                ...days.map(dayStr => {
                    const dayData = data.dailySales[dayStr] || { valor: 0 };
                    return dayData.valor > 0 ? dayData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                }),
                data.totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
            rows.push(row);
        });

        // Linha de total
        rows.push([
            'TOTAL DA LOJA',
            ...days.map(dayStr => totalPorDia[dayStr] > 0 ? totalPorDia[dayStr].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'),
            monthlyRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ]);

        return { headers, rows, days };
    };

    // Função para exportar em XLS
    const handleExportXLS = () => {
        try {
            const { headers, rows } = prepareTableData();

            // Criar workbook e worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

            // Definir larguras das colunas
            const colWidths = [
                { wch: 25 }, // Vendedora
                ...headers.slice(1, -1).map(() => ({ wch: 10 })), // Dias
                { wch: 15 } // Total
            ];
            ws['!cols'] = colWidths;

            // Aplicar bordas em todas as células
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellAddress]) {
                        ws[cellAddress] = { t: 's', v: '' };
                    }
                    if (!ws[cellAddress].s) {
                        ws[cellAddress].s = {};
                    }
                    ws[cellAddress].s.border = {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    };

                    // Estilizar cabeçalho
                    if (R === 0) {
                        ws[cellAddress].s.font = { bold: true };
                        ws[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
                    }
                }
            }

            // Estilizar linha de total (negrito e fundo)
            const lastRow = rows.length;
            for (let C = 0; C <= headers.length - 1; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: lastRow, c: C });
                if (ws[cellAddress] && ws[cellAddress].s) {
                    ws[cellAddress].s.font = { ...ws[cellAddress].s.font, bold: true };
                    ws[cellAddress].s.fill = { fgColor: { rgb: 'E0E0E0' } };
                }
            }

            XLSX.utils.book_append_sheet(wb, ws, 'Performance Mensal');

            // Nome do arquivo
            const mesAtual = format(new Date(), 'yyyy-MM');
            const nomeArquivo = `Performance_Mensal_${storeName || 'Loja'}_${mesAtual}.xlsx`;

            // Salvar arquivo
            XLSX.writeFile(wb, nomeArquivo);

            toast.success('Exportação XLS realizada com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar XLS:', error);
            toast.error('Erro ao exportar arquivo XLS');
        }
    };

    // Função para exportar em PDF
    const handleExportPDF = () => {
        try {
            const { headers, rows } = prepareTableData();

            const doc = new jsPDF('landscape', 'mm', 'a4');

            // Título
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Performance Mensal por Dia', 14, 15);

            // Subtítulo
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const mesAtual = format(new Date(), 'MM/yyyy');
            doc.text(`${storeName || 'Loja'} - ${mesAtual}`, 14, 22);

            // Preparar dados para autoTable
            const tableData = rows.map(row => row);

            // Criar tabela com bordas
            autoTable(doc, {
                head: [headers],
                body: tableData,
                startY: 28,
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                },
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                bodyStyles: {
                    halign: 'center',
                },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 50 }, // Vendedora
                    [headers.length - 1]: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }, // Total
                },
                theme: 'grid',
                didParseCell: (data) => {
                    // Estilizar linha de total
                    if (data.row.index === tableData.length - 1) {
                        data.cell.styles.fillColor = [224, 224, 224];
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
                margin: { top: 28, left: 14, right: 14 },
            });

            // Salvar arquivo
            const nomeArquivo = `Performance_Mensal_${storeName || 'Loja'}_${format(new Date(), 'yyyy-MM')}.pdf`;
            doc.save(nomeArquivo);

            toast.success('Exportação PDF realizada com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            toast.error('Erro ao exportar arquivo PDF');
        }
    };

    // Preço Médio por Peça = Valor Total / Quantidade de Peças
    const precoMedioPeca = formData.valor && formData.qtd_pecas
        ? (parseFloat(formData.valor) / parseInt(formData.qtd_pecas)).toFixed(2)
        : "0,00";

    // Estado para verificar se o admin está ativo
    const [adminBlocked, setAdminBlocked] = useState(false);

    // Verificar se o admin está ativo quando a loja for identificada
    useEffect(() => {
        if (!storeId || !profile || profile.role !== 'LOJA') return;

        const checkAdminStatus = async () => {
            try {
                const { data: storeData, error } = await supabase
                    .schema('sistemaretiradas')
                    .from('stores')
                    .select('admin_id, profiles!stores_admin_id_fkey(id, is_active, name, email)')
                    .eq('id', storeId)
                    .single();

                if (error) {
                    console.error('Erro ao verificar admin:', error);
                    return;
                }

                const adminIsActive = storeData?.profiles?.is_active !== false;
                if (!adminIsActive) {
                    setAdminBlocked(true);
                    console.warn('⚠️ Admin da loja está desativado - bloqueando acesso');
                } else {
                    setAdminBlocked(false);
                }
            } catch (error) {
                console.error('Erro ao verificar status do admin:', error);
            }
        };

        checkAdminStatus();
    }, [storeId, profile]);

    // Mostrar tela de bloqueio se o admin estiver desativado
    if (adminBlocked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl mb-2">Acesso Bloqueado</CardTitle>
                        <CardDescription>
                            Entre em contato com seu administrador. Página desativada.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                            Esta conta foi desativada pelo administrador do sistema.
                        </p>
                        <Button onClick={() => signOut()} variant="outline" className="w-full">
                            Sair
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="page-container flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center space-y-4 relative z-10"
                >
                    <div className="w-12 h-12 mx-auto border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b relative">
                <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <StoreLogo storeId={storeId || profile?.store_id} className="w-8 h-8 object-contain flex-shrink-0" />
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-semibold truncate">{storeName || profile?.name || "Loja"}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {(cashbackAtivo || crmAtivo || wishlistAtivo || pontoAtivo || ajustesCondicionaisAtivo || caixaAtivo) && (
                            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'metas' | 'cashback' | 'crm' | 'wishlist' | 'ponto' | 'ajustes' | 'caixa')}>
                                <TabsList className="flex flex-wrap h-auto gap-0.5 p-0.5">
                                    <TabsTrigger value="metas" className="text-[10px] sm:text-xs px-2 py-1 justify-center">
                                        Metas
                                    </TabsTrigger>
                                    {cashbackAtivo && (
                                        <TabsTrigger value="cashback" className="text-[10px] sm:text-xs px-2 py-1 justify-center">
                                            Cashback
                                        </TabsTrigger>
                                    )}
                                    {crmAtivo && (
                                        <TabsTrigger value="crm" className="text-[10px] sm:text-xs px-2 py-1 justify-center">
                                            CRM
                                        </TabsTrigger>
                                    )}
                                    {wishlistAtivo && (
                                        <TabsTrigger value="wishlist" className="text-[10px] sm:text-xs px-2 py-1 justify-center">
                                            Wishlist
                                        </TabsTrigger>
                                    )}
                                    {pontoAtivo && (
                                        <TabsTrigger value="ponto" className="text-[10px] sm:text-xs px-2 py-1 justify-center">
                                            Ponto
                                        </TabsTrigger>
                                    )}
                                    {ajustesCondicionaisAtivo && (
                                        <TabsTrigger value="ajustes" className="text-[10px] sm:text-xs px-2 py-1 justify-center">
                                            Ajustes
                                        </TabsTrigger>
                                    )}
                                    {caixaAtivo && (
                                        <TabsTrigger value="caixa" className="text-[10px] sm:text-xs px-2 py-1 justify-center">
                                            Caixa
                                        </TabsTrigger>
                                    )}
                                </TabsList>
                            </Tabs>
                        )}
                        {isMobile && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleReloadData}
                                disabled={isReloading}
                                title="Atualizar dados"
                                data-testid="button-mobile-reload"
                            >
                                <RefreshCw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
                            </Button>
                        )}
                        <ThemeToggle />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => signOut()}
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 sm:px-6 py-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                >

                    {/* DEBUG: Log dos estados antes de renderizar */}
                    {import.meta.env.DEV && (
                        <div className="p-2 bg-muted rounded text-xs">
                            <strong>DEBUG Módulos:</strong> cashback={String(cashbackAtivo)}, crm={String(crmAtivo)}, wishlist={String(wishlistAtivo)}, ponto={String(pontoAtivo)}, ajustes={String(ajustesCondicionaisAtivo)}, caixa={String(caixaAtivo)} | storeId={storeId || 'null'} | Condição: {(cashbackAtivo || crmAtivo || wishlistAtivo || pontoAtivo || ajustesCondicionaisAtivo || caixaAtivo) ? 'TRUE' : 'FALSE'}
                        </div>
                    )}

                    {/* Conteúdo Principal com Abas */}
                    {(cashbackAtivo || crmAtivo || wishlistAtivo || pontoAtivo || ajustesCondicionaisAtivo || caixaAtivo) ? (
                        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'metas' | 'cashback' | 'crm' | 'wishlist' | 'ponto' | 'ajustes' | 'caixa')} className="space-y-4">
                            <TabsContent value="metas" className="space-y-4 sm:space-y-6">
                                {/* Todo o conteúdo atual do dashboard de metas */}
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

                                            {/* Campo Cliente */}
                                            <div className="flex gap-2 items-start">
                                                <div className="flex-1">
                                                    <ClientSearchInput
                                                        searchTerm={searchCliente}
                                                        onSearchTermChange={(term) => {
                                                            setSearchCliente(term);
                                                            if (!term) {
                                                                handleClearClientSelection();
                                                            } else {
                                                                setFormData(prev => ({ ...prev, cliente_nome: term, cliente_id: "" }));
                                                            }
                                                        }}
                                                        selectedClientId={selectedClienteId}
                                                        onClientSelect={handleClienteSelect}
                                                        onClearSelection={handleClearClientSelection}
                                                        onNewClientClick={() => setNewClientDialogOpen(true)}
                                                        filteredClients={filteredClientsForSearchInput}
                                                        allClients={allClients}
                                                        showNewClientButton={true}
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => {
                                                        toast.info("Atualizando lista de clientes...");
                                                        refreshClients();
                                                    }}
                                                    title="Atualizar lista de clientes"
                                                    className="mt-0"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
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
                                                    💡 Preço Médio por Peça: <span className="text-primary">R$ {precoMedioPeca}</span>
                                                </p>
                                            </div>

                                            {/* Formas de Pagamento */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label>Formas de Pagamento *</Label>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setFormasPagamento([...formasPagamento, {
                                                                tipo: 'DINHEIRO',
                                                                valor: 0,
                                                            }]);
                                                        }}
                                                        className="h-7 text-xs"
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Adicionar
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    {formasPagamento.map((forma, index) => {
                                                        const totalFormas = formasPagamento.reduce((sum, f) => sum + (f.valor || 0), 0);
                                                        const valorTotal = parseFloat(formData.valor) || 0;
                                                        const diferenca = valorTotal - totalFormas;

                                                        return (
                                                            <div key={index} className="flex gap-2 items-end p-3 border rounded-lg">
                                                                <div className="flex-1 space-y-2">
                                                                    <div>
                                                                        <Label className="text-xs">Tipo</Label>
                                                                        <Select
                                                                            value={forma.tipo}
                                                                            onValueChange={(value: 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'PIX' | 'BOLETO') => {
                                                                                const novas = [...formasPagamento];
                                                                                novas[index].tipo = value;
                                                                                novas[index].parcelas = value === 'CREDITO' ? (novas[index].parcelas || 1) : undefined;
                                                                                setFormasPagamento(novas);
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-9">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="CREDITO">Crédito</SelectItem>
                                                                                <SelectItem value="DEBITO">Débito</SelectItem>
                                                                                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                                                                                <SelectItem value="PIX">Pix</SelectItem>
                                                                                <SelectItem value="BOLETO">Boleto</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    {forma.tipo === 'CREDITO' && (
                                                                        <div>
                                                                            <Label className="text-xs">Parcelas (máx. 6x)</Label>
                                                                            <Input
                                                                                type="number"
                                                                                min="1"
                                                                                max="6"
                                                                                value={forma.parcelas || 1}
                                                                                onChange={(e) => {
                                                                                    const parcelas = Math.min(6, Math.max(1, parseInt(e.target.value) || 1));
                                                                                    const novas = [...formasPagamento];
                                                                                    novas[index].parcelas = parcelas;
                                                                                    setFormasPagamento(novas);
                                                                                }}
                                                                                className="h-9"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <Label className="text-xs">Valor (R$)</Label>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={forma.valor || ''}
                                                                            onChange={(e) => {
                                                                                const novas = [...formasPagamento];
                                                                                novas[index].valor = parseFloat(e.target.value) || 0;
                                                                                setFormasPagamento(novas);
                                                                            }}
                                                                            placeholder="0,00"
                                                                            className="h-9"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {formasPagamento.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setFormasPagamento(formasPagamento.filter((_, i) => i !== index));
                                                                        }}
                                                                        className="h-9 w-9 p-0 text-status-behind"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {(() => {
                                                    const totalFormas = formasPagamento.reduce((sum, f) => sum + (f.valor || 0), 0);
                                                    const valorTotal = parseFloat(formData.valor) || 0;
                                                    const diferenca = valorTotal - totalFormas;

                                                    if (valorTotal > 0 && Math.abs(diferenca) > 0.01) {
                                                        return (
                                                            <div className={`p-2 rounded text-sm flex items-center gap-2 ${diferenca > 0 ? 'bg-status-ontrack/10 text-status-ontrack border border-status-ontrack/30' : 'bg-status-behind/10 text-status-behind border border-status-behind/30'}`}>
                                                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                                                <span>
                                                                    {diferenca > 0
                                                                        ? `Faltam ${formatBRL(diferenca)} para completar o valor total`
                                                                        : `Valor excede o total em ${formatBRL(Math.abs(diferenca))}`
                                                                    }
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
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
                                                <Textarea
                                                    id="observacoes"
                                                    value={formData.observacoes}
                                                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        // Prevenir submit do formulário ao pressionar Enter
                                                        // O textarea já adiciona nova linha automaticamente
                                                        if (e.key === 'Enter' && e.ctrlKey) {
                                                            // Ctrl+Enter = enviar formulário
                                                            return;
                                                        }
                                                        if (e.key === 'Enter') {
                                                            // Enter sozinho = apenas nova linha (não enviar)
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                    placeholder="Observações opcionais (pressione Enter para nova linha, Ctrl+Enter para enviar)"
                                                    rows={4}
                                                    className="resize-y"
                                                />
                                            </div>

                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" disabled={submitting}>
                                                    Cancelar
                                                </Button>
                                                <LoadingButton
                                                    type="submit"
                                                    className="flex-1"
                                                    isLoading={submitting}
                                                    isSuccess={submitSuccess}
                                                    loadingText="Enviando..."
                                                    successText="Venda Lancada!"
                                                >
                                                    Lancar Venda
                                                </LoadingButton>
                                            </div>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                                <Button
                                    variant="outline"
                                    onClick={handleSignOut}
                                    className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                    size="sm"
                                >
                                    <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                    Sair
                                </Button>

                                {/* KPI Cards - Metas e Métricas */}
                                {/* Primeiros 3 Cards Centralizados */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto mb-6 sm:mb-8">
                                    {/* Meta Mensal */}
                                    <Card className="flex flex-col h-full">
                                        <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
                                            <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground">Meta Mensal</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
                                            {goals ? (
                                                <div className="space-y-4 w-full">
                                                    <p className="text-2xl sm:text-4xl font-bold text-primary">R$ {goals.meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                    <p className="text-sm sm:text-base text-muted-foreground">
                                                        Realizado: R$ {monthlyRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-4 justify-between">
                                                            <Progress value={Math.min(monthlyProgress, 100)} className="h-4 flex-1" />
                                                            <span className="text-base font-semibold text-primary whitespace-nowrap min-w-[50px] text-right">
                                                                {monthlyProgress.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        {goals.super_meta_valor && (
                                                            <p className="text-sm sm:text-base text-muted-foreground flex items-center justify-center gap-1.5">
                                                                <Trophy className="h-4 w-4" />
                                                                <span>Super Meta: R$ {goals.super_meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <p className="text-2xl sm:text-3xl font-bold text-muted-foreground">N/A</p>
                                                    <p className="text-sm sm:text-base text-status-behind">
                                                        Meta não encontrada
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Meta Diária */}
                                    <Card className="flex flex-col h-full">
                                        <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
                                            <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground">Meta Diária (Hoje)</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
                                            {goals ? (
                                                <div className="space-y-4 w-full">
                                                    <p className="text-2xl sm:text-4xl font-bold text-primary">R$ {dailyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                    <div className="flex items-center gap-4 justify-between">
                                                        <Progress value={Math.min(dailyProgress, 100)} className="h-4 flex-1" />
                                                        <span className="text-base font-semibold text-primary whitespace-nowrap min-w-[50px] text-right">
                                                            {dailyProgress.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <p className="text-2xl sm:text-3xl font-bold text-muted-foreground">N/A</p>
                                                    <p className="text-sm sm:text-base text-muted-foreground">
                                                        Aguardando meta mensal
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Faturamento Hoje */}
                                    <Card className="flex flex-col h-full">
                                        <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
                                            <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground">Faturamento Hoje</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
                                            <div className="space-y-3 w-full">
                                                <p className="text-2xl sm:text-4xl font-bold text-primary">R$ {sales.reduce((sum, s) => sum + s.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                <p className="text-sm sm:text-base text-muted-foreground">{sales.length} {sales.length === 1 ? 'venda' : 'vendas'}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Cards Adicionais - Ticket Médio, PA, Preço Médio */}
                                {metrics && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
                                        {/* Ticket Médio */}
                                        <Card className="flex flex-col h-full">
                                            <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                                                <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Ticket Médio</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                                                <div className="space-y-3 w-full">
                                                    <p className="text-xl sm:text-3xl font-bold text-primary">R$ {sales.length > 0 ? (sales.reduce((sum, s) => sum + s.valor, 0) / sales.length).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</p>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3 justify-between">
                                                            <Progress
                                                                value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.valor, 0) / sales.length) / metrics.meta_ticket_medio) * 100, 100) : 0}
                                                                className="h-3 flex-1"
                                                            />
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                                            Meta: R$ {metrics.meta_ticket_medio?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* PA (Peças por Atendimento) */}
                                        <Card className="flex flex-col h-full">
                                            <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                                                <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">PA (Peças/Venda)</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                                                <div className="space-y-3 w-full">
                                                    <p className="text-xl sm:text-3xl font-bold text-primary">{sales.length > 0 ? (sales.reduce((sum, s) => sum + s.qtd_pecas, 0) / sales.length).toFixed(1) : '0,0'}</p>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3 justify-between">
                                                            <Progress
                                                                value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.qtd_pecas, 0) / sales.length) / metrics.meta_pa) * 100, 100) : 0}
                                                                className="h-3 flex-1"
                                                            />
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                                            Meta: {metrics.meta_pa?.toFixed(1)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Preço Médio por Peça */}
                                        <Card className="flex flex-col h-full">
                                            <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                                                <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Preço Médio por Peça</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                                                <div className="space-y-3 w-full">
                                                    <p className="text-xl sm:text-3xl font-bold text-primary">
                                                        R$ {sales.length > 0 ?
                                                            (sales.reduce((sum, s) => sum + s.valor, 0) / sales.reduce((sum, s) => sum + s.qtd_pecas, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                                                            '0,00'}
                                                    </p>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3 justify-between">
                                                            <Progress
                                                                value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.valor, 0) / sales.reduce((sum, s) => sum + s.qtd_pecas, 0)) / metrics.meta_preco_medio_peca) * 100, 100) : 0}
                                                                className="h-3 flex-1"
                                                            />
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                                            Meta: {formatBRL(metrics.meta_preco_medio_peca)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Planejamento do Dia - Cards por Vendedora */}
                                {redistributedPerformance.data.length > 0 && (
                                    <div className="w-full max-w-6xl mx-auto">
                                        <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-center">Planejamento do Dia</h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 justify-items-center">
                                            {redistributedPerformance.data.map((perf) => {
                                                const isFolga = perf.isOnLeave;
                                                const metaRedistribuida = perf.metaDiariaRedistribuida ?? perf.metaDiaria ?? 0;
                                                const redistribuicaoExtra = perf.redistribuicaoExtra ?? 0;

                                                const handleToggleFolga = async () => {
                                                    if (!storeId) {
                                                        toast.error('Loja não identificada');
                                                        return;
                                                    }

                                                    try {
                                                        await toggleFolga(perf.id, todayStr);
                                                    } catch (error: any) {
                                                        console.error('[LojaDashboard] Erro ao alterar folga:', error);
                                                        toast.error('Erro ao alterar folga: ' + (error.message || 'Erro desconhecido'));
                                                    }
                                                };

                                                return (
                                                    <Card key={perf.id} className={`flex flex-col w-full max-w-full sm:max-w-[380px] ${isFolga ? 'opacity-60 border-dashed' : ''}`}>
                                                        <CardHeader className="pb-4 p-5 sm:p-6 text-center border-b">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <CardTitle className={`text-lg font-semibold leading-snug min-h-[3.5rem] flex-1 ${isFolga ? 'line-through text-muted-foreground' : ''}`}>
                                                                    {perf.name}
                                                                </CardTitle>
                                                                <div className="flex items-center gap-2">
                                                                    <Label htmlFor={`folga-${perf.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                                                        {isFolga ? 'Folga' : 'Ativa'}
                                                                    </Label>
                                                                    <Switch
                                                                        id={`folga-${perf.id}`}
                                                                        checked={isFolga}
                                                                        onCheckedChange={handleToggleFolga}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="p-5 sm:p-6 pt-5 sm:pt-6 flex-1 flex flex-col justify-center space-y-3">
                                                            {isFolga ? (
                                                                <div className="text-center py-4">
                                                                    <Badge variant="destructive" className="text-sm">
                                                                        De Folga
                                                                    </Badge>
                                                                    <p className="text-xs text-muted-foreground mt-2">
                                                                        Meta redistribuida para outras colaboradoras
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {/* Meta do Dia - Redistribuida */}
                                                                    <div className="space-y-2.5">
                                                                        <div className="flex items-center justify-between text-base">
                                                                            <span className="text-muted-foreground">Meta do Dia</span>
                                                                            <span className="font-semibold">R$ {metaRedistribuida > 0 ? metaRedistribuida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</span>
                                                                        </div>
                                                                        {redistribuicaoExtra > 0 && (
                                                                            <p className="text-xs text-muted-foreground italic">
                                                                                (+R$ {redistribuicaoExtra.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cobrindo {redistributedPerformance.totalFolga} colega(s))
                                                                            </p>
                                                                        )}
                                                                        <div className="flex items-center justify-between text-base">
                                                                            <span className="text-muted-foreground">Vendido:</span>
                                                                            <span className="font-bold text-primary">R$ {perf.vendidoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        {metaRedistribuida > 0 && (
                                                                            <div className="flex items-center justify-between text-base">
                                                                                <span className="text-muted-foreground">Falta:</span>
                                                                                <span className={`font-semibold ${perf.vendidoHoje >= metaRedistribuida ? 'text-status-ahead' : 'text-status-ontrack'}`}>
                                                                                    R$ {Math.max(0, metaRedistribuida - perf.vendidoHoje).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {/* Progresso */}
                                                                        <div className="space-y-1.5 pt-2">
                                                                            <div className="flex items-center gap-3">
                                                                                <Progress
                                                                                    value={Math.min(perf.percentual, 100)}
                                                                                    className="h-3 flex-1"
                                                                                />
                                                                                <span className="text-base font-semibold whitespace-nowrap min-w-[50px] text-right">
                                                                                    {perf.percentual.toFixed(0)}%
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Meta Semanal Gamificada */}
                                {storeId && (
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        <WeeklyGoalProgress storeId={storeId} showDetails={true} />
                                    </Suspense>
                                )}

                                {/* Bônus Semanal Individual por Colaboradora */}
                                {storeId && colaboradoras.length > 0 && (
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        <WeeklyBonusProgress storeId={storeId} colaboradoras={colaboradoras.map(c => ({ id: c.id, name: c.name }))} />
                                    </Suspense>
                                )}

                                {/* Gincanas Semanais - Histórico de Resultados */}
                                {storeId && (
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        <WeeklyGincanaResults storeId={storeId} showAllResults={true} />
                                    </Suspense>
                                )}

                                {/* Galeria de Troféus */}
                                {storeId && (
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        <TrophiesGallery storeId={storeId} limit={50} />
                                    </Suspense>
                                )}

                                {/* Tabela de Performance do Dia */}
                                {colaboradorasPerformance.length > 0 ? (
                                    <Card>
                                        <CardHeader className="p-3 sm:p-6">
                                            <CardTitle className="text-base sm:text-lg">Performance do Dia</CardTitle>
                                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Desempenho diário e mensal de cada colaboradora</p>
                                        </CardHeader>
                                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-xs sm:text-sm">Vendedora</TableHead>
                                                            <TableHead className="text-xs sm:text-sm">Vendido Hoje</TableHead>
                                                            <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Meta Dia</TableHead>
                                                            <TableHead className="text-xs sm:text-sm">% Dia</TableHead>
                                                            <TableHead className="text-xs sm:text-sm hidden md:table-cell">Ticket Médio</TableHead>
                                                            <TableHead className="text-xs sm:text-sm hidden lg:table-cell">PA</TableHead>
                                                            <TableHead className="text-xs sm:text-sm">Vendas</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {colaboradorasPerformance.map((perf) => (
                                                            <TableRow key={perf.id}>
                                                                <TableCell className="font-medium text-xs sm:text-sm break-words">{perf.name}</TableCell>
                                                                <TableCell className="text-xs sm:text-sm font-medium">
                                                                    {formatBRL(perf.vendidoHoje)}
                                                                    {perf.vendidoHojeMes > 0 && (
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                            Mês: {formatBRL(perf.vendidoHojeMes)}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                                                                    {formatBRL(perf.metaDiaria)}
                                                                    {perf.meta > 0 && (
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                            Mensal: {formatBRL(perf.meta)}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-xs sm:text-sm">
                                                                    {perf.meta > 0 ? (
                                                                        <>
                                                                            <span className={
                                                                                perf.percentual >= 120 ? 'text-status-ahead font-bold' :
                                                                                    perf.percentual >= 100 ? 'text-status-ahead font-bold' :
                                                                                        perf.percentual >= 90 ? 'text-status-ontrack' :
                                                                                            'text-status-behind'
                                                                            }>
                                                                                {perf.percentual.toFixed(0)}%
                                                                                {perf.percentual >= 120 && <Trophy className="h-4 w-4 inline ml-1" />}
                                                                            </span>
                                                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                                Mês: {perf.percentualMensal.toFixed(0)}%
                                                                            </div>
                                                                            {perf.faltaMensal > 0 && (
                                                                                <div className="text-[10px] text-status-ontrack mt-0.5">
                                                                                    Falta: {formatBRL(perf.faltaMensal)}
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">Sem meta</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-xs sm:text-sm hidden md:table-cell">{formatBRL(perf.ticketMedio)}</TableCell>
                                                                <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                                                                    {perf.qtdVendas > 0 ? (perf.qtdPecas / perf.qtdVendas).toFixed(1) : '0.0'}
                                                                </TableCell>
                                                                <TableCell className="text-xs sm:text-sm">
                                                                    {perf.qtdVendas}
                                                                    {perf.qtdVendasMes > 0 && (
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                            Mês: {perf.qtdVendasMes}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : colaboradoras.length > 0 && (
                                    <Card>
                                        <CardContent className="p-6 text-center">
                                            <p className="text-sm text-muted-foreground">
                                                Nenhuma meta individual encontrada para as colaboradoras desta loja no mês atual.
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Vendas */}
                                <Card>
                                    <CardHeader className="p-3 sm:p-6">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base sm:text-lg">
                                                    Vendas
                                                </CardTitle>
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                                    <Label htmlFor="sales-date-filter" className="text-xs sm:text-sm whitespace-nowrap">
                                                        Filtrar por data:
                                                    </Label>
                                                    <Input
                                                        id="sales-date-filter"
                                                        type="date"
                                                        value={salesDateFilter}
                                                        onChange={(e) => setSalesDateFilter(e.target.value)}
                                                        className="flex-1 sm:flex-initial sm:w-auto text-xs sm:text-sm"
                                                        max={format(new Date(), 'yyyy-MM-dd')}
                                                    />
                                                </div>
                                                {salesDateFilter !== format(new Date(), 'yyyy-MM-dd') && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setSalesDateFilter(format(new Date(), 'yyyy-MM-dd'))}
                                                        className="text-xs whitespace-nowrap w-full sm:w-auto"
                                                    >
                                                        Voltar para Hoje
                                                    </Button>
                                                )}
                                                {salesDateFilter === format(new Date(), 'yyyy-MM-dd') && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Mostrando vendas de hoje
                                                    </span>
                                                )}
                                            </div>
                                        </div>
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
                                                        <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Forma Pagamento</TableHead>
                                                        <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {sales.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} className="text-center text-muted-foreground text-xs sm:text-sm py-6">
                                                                {salesDateFilter === format(new Date(), 'yyyy-MM-dd')
                                                                    ? 'Nenhuma venda lançada hoje'
                                                                    : `Nenhuma venda encontrada para ${format(new Date(salesDateFilter), 'dd/MM/yyyy')}`
                                                                }
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        sales.map((sale) => {
                                                            const isExpanded = expandedSales.has(sale.id);
                                                            const details = erpSaleDetails[sale.id];
                                                            const isErpSale = !!sale.tiny_order_id;

                                                            return (
                                                                <Fragment key={sale.id}>
                                                                    <TableRow>
                                                                        <TableCell className="text-xs sm:text-sm">
                                                                            <div className="flex items-center gap-1">
                                                                                {isErpSale && (
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="h-6 w-6 p-0 -ml-1"
                                                                                        onClick={() => toggleSaleExpansion(sale.id, sale.tiny_order_id)}
                                                                                    >
                                                                                        {isExpanded ? (
                                                                                            <ChevronDown className="h-3 w-3" />
                                                                                        ) : (
                                                                                            <ChevronRight className="h-3 w-3" />
                                                                                        )}
                                                                                    </Button>
                                                                                )}
                                                                                <span>
                                                                                    {salesDateFilter === format(new Date(), 'yyyy-MM-dd')
                                                                                        ? format(new Date(sale.data_venda), 'HH:mm')
                                                                                        : format(new Date(sale.data_venda), 'dd/MM/yyyy HH:mm')
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs sm:text-sm font-medium break-words">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span>{sale.colaboradora?.name || 'Colaboradora não encontrada'}</span>
                                                                                {isErpSale && (
                                                                                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                                                        <Database className="h-3 w-3" />
                                                                                        via ERP
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs sm:text-sm font-medium">{formatBRL(sale.valor)}</TableCell>
                                                                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{sale.qtd_pecas}</TableCell>
                                                                        <TableCell className="text-xs sm:text-sm hidden md:table-cell">{formatBRL(sale.valor)}</TableCell>
                                                                        <TableCell>
                                                                            <div className="flex gap-1 sm:gap-2">
                                                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(sale)} className="h-8 w-8 p-0">
                                                                                    <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                                </Button>
                                                                                <Button variant="ghost" size="sm" className="text-status-behind h-8 w-8 p-0" onClick={() => handleDelete(sale.id)}>
                                                                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                    {isErpSale && isExpanded && (
                                                                        <TableRow key={`${sale.id}-details`}>
                                                                            <TableCell colSpan={6} className="bg-muted/50">
                                                                                <div className="space-y-2 py-2">
                                                                                    {details ? (
                                                                                        <>
                                                                                            {details.cliente_nome && (
                                                                                                <div className="text-xs">
                                                                                                    <span className="font-medium">Cliente:</span> {details.cliente_nome}
                                                                                                </div>
                                                                                            )}
                                                                                            {details.forma_pagamento && (
                                                                                                <div className="text-xs">
                                                                                                    <span className="font-medium">Forma de Pagamento:</span> {details.forma_pagamento}
                                                                                                </div>
                                                                                            )}
                                                                                            {details.itens && Array.isArray(details.itens) && details.itens.length > 0 && (
                                                                                                <div className="text-xs">
                                                                                                    <span className="font-medium">Peças:</span>
                                                                                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                                                                                        {details.itens.map((item: any, idx: number) => (
                                                                                                            <li key={idx}>
                                                                                                                {item.quantidade || 1}x {item.descricao || item.nome || item.produto?.descricao || 'Produto sem descrição'}
                                                                                                            </li>
                                                                                                        ))}
                                                                                                    </ul>
                                                                                                </div>
                                                                                            )}
                                                                                        </>
                                                                                    ) : (
                                                                                        <div className="text-xs text-muted-foreground">Carregando detalhes...</div>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )}
                                                                </Fragment>
                                                            );
                                                        })
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Ranking Mensal com Pódio */}
                                {rankingMonthly.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2 p-3 sm:p-6">
                                            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                                                <Award className="h-4 w-4 sm:h-5 sm:w-5" />
                                                <span>Podio Mensal</span>
                                            </CardTitle>
                                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Ranking acumulado do mes</p>
                                        </CardHeader>
                                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                            <div className="space-y-2">
                                                {rankingMonthly.map((item, index) => {
                                                    const perf = colaboradorasPerformance.find(p => p.id === item.colaboradora_id);
                                                    const isOuro = index === 0;
                                                    const isPrata = index === 1;
                                                    const isBronze = index === 2;

                                                    const getRowStyle = () => {
                                                        if (isOuro) return { background: 'linear-gradient(90deg, hsl(45 80% 92%) 0%, hsl(var(--card)) 100%)' };
                                                        if (isPrata) return { background: 'linear-gradient(90deg, hsl(0 0% 88%) 0%, hsl(var(--card)) 100%)' };
                                                        if (isBronze) return { background: 'linear-gradient(90deg, hsl(30 50% 85%) 0%, hsl(var(--card)) 100%)' };
                                                        return {};
                                                    };

                                                    return (
                                                        <div
                                                            key={item.colaboradora_id}
                                                            className={`relative flex items-center justify-between p-3 rounded-md border ${isOuro ? 'border-primary/30' : isPrata ? 'border-muted-foreground/20' : isBronze ? 'border-primary/20' : 'border-border/50 bg-muted/20'
                                                                }`}
                                                            style={getRowStyle()}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 ${isOuro ? 'bg-primary text-primary-foreground' : isPrata ? 'bg-muted-foreground/40 text-foreground' : isBronze ? 'bg-primary/60 text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                                    }`}>
                                                                    {index + 1}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="font-semibold text-sm break-words block">{item.name || 'Colaboradora'}</span>
                                                                    {perf && (
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                                                                            <span>Ticket: {formatBRL(perf.ticketMedio)}</span>
                                                                            <span>PA: {(perf.qtdPecas / Math.max(perf.qtdVendasMes, 1)).toFixed(1)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex-shrink-0 ml-2">
                                                                <p className="font-bold text-base sm:text-lg">
                                                                    {formatBRL(item.total)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

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
                                                            <TableHead className="text-xs sm:text-sm hidden md:table-cell">PA</TableHead>
                                                            <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Ticket Médio</TableHead>
                                                            <TableHead className="text-xs sm:text-sm">Total</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {history7Days.map((day) => (
                                                            <TableRow key={day.day}>
                                                                <TableCell className="text-xs sm:text-sm">{format(new Date(day.day + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                                                                <TableCell className="text-xs sm:text-sm">{day.qtdVendas}</TableCell>
                                                                <TableCell className="text-xs sm:text-sm">{day.qtdPecas}</TableCell>
                                                                <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                                                                    {day.qtdVendas > 0 ? (day.qtdPecas / day.qtdVendas).toFixed(1) : '0.0'}
                                                                </TableCell>
                                                                <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                                                                    {formatBRL(day.ticketMedio || (day.qtdVendas > 0 ? day.total / day.qtdVendas : 0))}
                                                                </TableCell>
                                                                <TableCell className="text-xs sm:text-sm font-medium">{formatBRL(day.total)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Tabela Mensal por Colaboradora/Dia */}
                                {(colaboradoras.length > 0 || monthlyDataByDay.length > 0) && (
                                    <Card>
                                        <CardHeader className="p-3 sm:p-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div>
                                                    <CardTitle className="text-base sm:text-lg">Performance Mensal por Dia</CardTitle>
                                                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Vendas diárias de cada colaboradora no mês atual</p>
                                                </div>
                                                {monthlyDataByDay.length > 0 && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={handleExportXLS}
                                                            className="text-xs sm:text-sm"
                                                        >
                                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                                            Exportar XLS
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={handleExportPDF}
                                                            className="text-xs sm:text-sm"
                                                        >
                                                            <FileText className="h-4 w-4 mr-2" />
                                                            Exportar PDF
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                            {monthlyDataByDay.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="text-xs sm:text-sm sticky left-0 bg-background z-10 font-bold min-w-[100px] sm:min-w-[140px]">Vendedora</TableHead>
                                                                {(() => {
                                                                    const hoje = new Date();
                                                                    const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                                                                    const todayStr = format(hoje, 'yyyy-MM-dd');
                                                                    const days: string[] = [];
                                                                    for (let day = 1; day <= daysInMonth; day++) {
                                                                        const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                                                                        if (dayStr <= todayStr) {
                                                                            days.push(dayStr);
                                                                        }
                                                                    }
                                                                    return days.map(dayStr => (
                                                                        <TableHead key={dayStr} className="text-xs text-center min-w-[60px]">
                                                                            {format(new Date(dayStr + 'T00:00:00'), 'dd/MM')}
                                                                        </TableHead>
                                                                    ));
                                                                })()}
                                                                <TableHead className="text-xs sm:text-sm sticky right-0 bg-background z-10 font-bold text-primary min-w-[80px] sm:min-w-[120px]">Total</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {monthlyDataByDay
                                                                .sort((a, b) => b.totalMes - a.totalMes)
                                                                .map((data) => {
                                                                    const hoje = new Date();
                                                                    const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                                                                    const todayStr = format(hoje, 'yyyy-MM-dd');
                                                                    const days: string[] = [];
                                                                    for (let day = 1; day <= daysInMonth; day++) {
                                                                        const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                                                                        if (dayStr <= todayStr) {
                                                                            days.push(dayStr);
                                                                        }
                                                                    }

                                                                    return (
                                                                        <TableRow key={data.colaboradoraId}>
                                                                            <TableCell className="text-xs sm:text-sm font-medium sticky left-0 bg-background z-10 min-w-[100px] sm:min-w-[140px]">
                                                                                {data.colaboradoraName}
                                                                            </TableCell>
                                                                            {days.map(dayStr => {
                                                                                const dayData = data.dailySales[dayStr] || { valor: 0, metaDiaria: 0 };
                                                                                const bateuMeta = dayData.metaDiaria > 0 && dayData.valor >= dayData.metaDiaria;

                                                                                return (
                                                                                    <TableCell
                                                                                        key={dayStr}
                                                                                        className={`
                                                                        text-xs text-center font-medium
                                                                        ${bateuMeta
                                                                                                ? 'bg-status-ahead/20 dark:bg-status-ahead/10 text-foreground'
                                                                                                : dayData.valor > 0
                                                                                                    ? 'text-foreground'
                                                                                                    : 'text-muted-foreground'
                                                                                            }
                                                                    `}
                                                                                        title={dayData.metaDiaria > 0 ? `Meta: ${formatBRL(dayData.metaDiaria)}` : ''}
                                                                                    >
                                                                                        {dayData.valor > 0 ? (
                                                                                            <span className="font-semibold">
                                                                                                {formatBRL(dayData.valor, 0)}
                                                                                                {bateuMeta && ' '}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-muted-foreground">-</span>
                                                                                        )}
                                                                                    </TableCell>
                                                                                );
                                                                            })}
                                                                            <TableCell className="text-xs sm:text-sm font-bold text-primary sticky right-0 bg-background z-10 min-w-[80px] sm:min-w-[120px] text-right">
                                                                                {formatBRL(data.totalMes)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            {/* Linha de Total da Loja */}
                                                            <TableRow className="bg-primary/5 font-bold border-t-2 border-primary">
                                                                <TableCell className="text-xs sm:text-sm font-bold sticky left-0 bg-primary/5 z-10 min-w-[100px] sm:min-w-[140px]">
                                                                    TOTAL DA LOJA
                                                                </TableCell>
                                                                {(() => {
                                                                    const hoje = new Date();
                                                                    const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                                                                    const todayStr = format(hoje, 'yyyy-MM-dd');
                                                                    const days: string[] = [];
                                                                    for (let day = 1; day <= daysInMonth; day++) {
                                                                        const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                                                                        if (dayStr <= todayStr) {
                                                                            days.push(dayStr);
                                                                        }
                                                                    }

                                                                    // Calcular total por dia
                                                                    // IMPORTANTE: Para total geral, usar monthlyRealizado que já inclui vendas de colaboradoras desativadas
                                                                    const totalPorDia: Record<string, number> = {};

                                                                    days.forEach(dayStr => {
                                                                        const totalDia = monthlyDataByDay.reduce((sum, data) => {
                                                                            const dayData = data.dailySales[dayStr] || { valor: 0 };
                                                                            return sum + dayData.valor;
                                                                        }, 0);
                                                                        totalPorDia[dayStr] = totalDia;
                                                                    });

                                                                    return days.map(dayStr => (
                                                                        <TableCell
                                                                            key={dayStr}
                                                                            className="text-xs text-center font-bold text-primary"
                                                                        >
                                                                            {totalPorDia[dayStr] > 0 ? (
                                                                                formatBRL(totalPorDia[dayStr], 0)
                                                                            ) : (
                                                                                <span className="text-muted-foreground">-</span>
                                                                            )}
                                                                        </TableCell>
                                                                    ));
                                                                })()}
                                                                <TableCell className="text-xs sm:text-sm font-bold text-primary sticky right-0 bg-primary/5 z-10 min-w-[80px] sm:min-w-[120px] text-right">
                                                                    {/* Usar monthlyRealizado que já inclui vendas de colaboradoras desativadas até a data de desativação */}
                                                                    {formatBRL(monthlyRealizado)}
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6">
                                                    <p className="text-sm text-muted-foreground">
                                                        Carregando dados mensais...
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>

                            <TabsContent value="cashback" className="space-y-4 sm:space-y-6">
                                <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                    <CashbackLojaView storeId={storeId} />
                                </Suspense>
                            </TabsContent>
                            <TabsContent value="crm" className="space-y-4 sm:space-y-6">
                                <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                    <CRMLojaView storeId={storeId} />
                                </Suspense>
                            </TabsContent>
                            {wishlistAtivo && (
                                <TabsContent value="wishlist" className="space-y-4 sm:space-y-6">
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        <WishlistLojaView />
                                    </Suspense>
                                </TabsContent>
                            )}
                            {pontoAtivo && (
                                <TabsContent value="ponto" className="space-y-4 sm:space-y-6">
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        {storeId ? (
                                            <TimeClockLojaView storeId={storeId} />
                                        ) : (
                                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Carregando dados da loja...
                                            </div>
                                        )}
                                    </Suspense>
                                </TabsContent>
                            )}
                            {ajustesCondicionaisAtivo && (
                                <TabsContent value="ajustes" className="space-y-4 sm:space-y-6">
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        {storeId ? (
                                            <StoreConditionalsAdjustments storeId={storeId} />
                                        ) : (
                                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Carregando dados da loja...
                                            </div>
                                        )}
                                    </Suspense>
                                </TabsContent>
                            )}
                            {caixaAtivo && (
                                <TabsContent value="caixa" className="space-y-4 sm:space-y-6">
                                    <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                        {storeId ? (
                                            <CaixaLojaView
                                                storeId={storeId}
                                                storeName={storeName || 'Loja'}
                                                colaboradoras={colaboradoras}
                                                colaboradorasPerformance={redistributedPerformanceCaixa.data.map(p => ({
                                                    id: p.id,
                                                    name: p.name,
                                                    vendidoHoje: p.vendidoHoje || 0,
                                                    metaDiaria: p.metaDiariaRedistribuida || p.metaDiaria || 0,
                                                    isOnLeave: p.isOnLeave || false
                                                }))}
                                                metaMensal={goals?.meta_valor || 0}
                                                vendidoMensal={monthlyRealizado}
                                                vendidoHoje={redistributedPerformanceCaixa.data.reduce((sum, p) => sum + (p.vendidoHoje || 0), 0) || metrics?.totalVendas || 0}
                                                dailyWeights={goals?.daily_weights || null}
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                Carregando dados da loja...
                                            </div>
                                        )}
                                    </Suspense>
                                </TabsContent>
                            )}
                        </Tabs>
                    ) : (
                        // Se cashback não estiver ativo, mostrar apenas o conteúdo de metas (sem abas)
                        // Renderizar o mesmo conteúdo que está no TabsContent acima
                        <div className="space-y-4 sm:space-y-6">
                            {/* Conteúdo de Metas - Mesmo que está no TabsContent acima */}
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

                                        {/* Campo Cliente */}
                                        <div className="flex gap-2 items-start">
                                            <div className="flex-1">
                                                <ClientSearchInput
                                                    searchTerm={searchCliente}
                                                    onSearchTermChange={(term) => {
                                                        setSearchCliente(term);
                                                        if (!term) {
                                                            handleClearClientSelection();
                                                        } else {
                                                            setFormData(prev => ({ ...prev, cliente_nome: term, cliente_id: "" }));
                                                        }
                                                    }}
                                                    selectedClientId={selectedClienteId}
                                                    onClientSelect={handleClienteSelect}
                                                    onClearSelection={handleClearClientSelection}
                                                    onNewClientClick={() => setNewClientDialogOpen(true)}
                                                    filteredClients={filteredClientsForSearchInput}
                                                    allClients={allClients}
                                                    showNewClientButton={true}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                    toast.info("Atualizando lista de clientes...");
                                                    refreshClients();
                                                }}
                                                title="Atualizar lista de clientes"
                                                className="mt-0"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
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
                                                💡 Preço Médio por Peça: <span className="text-primary">R$ {precoMedioPeca}</span>
                                            </p>
                                        </div>

                                        {/* Formas de Pagamento */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label>Formas de Pagamento *</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormasPagamento([...formasPagamento, {
                                                            tipo: 'DINHEIRO',
                                                            valor: 0,
                                                        }]);
                                                    }}
                                                    className="h-7 text-xs"
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Adicionar
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                {formasPagamento.map((forma, index) => {
                                                    const totalFormas = formasPagamento.reduce((sum, f) => sum + (f.valor || 0), 0);
                                                    const valorTotal = parseFloat(formData.valor) || 0;
                                                    const diferenca = valorTotal - totalFormas;

                                                    return (
                                                        <div key={index} className="flex gap-2 items-end p-3 border rounded-lg">
                                                            <div className="flex-1 space-y-2">
                                                                <div>
                                                                    <Label className="text-xs">Tipo</Label>
                                                                    <Select
                                                                        value={forma.tipo}
                                                                        onValueChange={(value: 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'PIX' | 'BOLETO') => {
                                                                            const novas = [...formasPagamento];
                                                                            novas[index].tipo = value;
                                                                            novas[index].parcelas = value === 'CREDITO' ? (novas[index].parcelas || 1) : undefined;
                                                                            setFormasPagamento(novas);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-9">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="CREDITO">Crédito</SelectItem>
                                                                            <SelectItem value="DEBITO">Débito</SelectItem>
                                                                            <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                                                                            <SelectItem value="PIX">Pix</SelectItem>
                                                                            <SelectItem value="BOLETO">Boleto</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                {forma.tipo === 'CREDITO' && (
                                                                    <div>
                                                                        <Label className="text-xs">Parcelas (máx. 6x)</Label>
                                                                        <Input
                                                                            type="number"
                                                                            min="1"
                                                                            max="6"
                                                                            value={forma.parcelas || 1}
                                                                            onChange={(e) => {
                                                                                const parcelas = Math.min(6, Math.max(1, parseInt(e.target.value) || 1));
                                                                                const novas = [...formasPagamento];
                                                                                novas[index].parcelas = parcelas;
                                                                                setFormasPagamento(novas);
                                                                            }}
                                                                            className="h-9"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <Label className="text-xs">Valor (R$)</Label>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={forma.valor || ''}
                                                                        onChange={(e) => {
                                                                            const novas = [...formasPagamento];
                                                                            novas[index].valor = parseFloat(e.target.value) || 0;
                                                                            setFormasPagamento(novas);
                                                                        }}
                                                                        placeholder="0,00"
                                                                        className="h-9"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {formasPagamento.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setFormasPagamento(formasPagamento.filter((_, i) => i !== index));
                                                                    }}
                                                                    className="h-9 w-9 p-0 text-status-behind"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {(() => {
                                                const totalFormas = formasPagamento.reduce((sum, f) => sum + (f.valor || 0), 0);
                                                const valorTotal = parseFloat(formData.valor) || 0;
                                                const diferenca = valorTotal - totalFormas;

                                                if (valorTotal > 0 && Math.abs(diferenca) > 0.01) {
                                                    return (
                                                        <div className={`p-2 rounded text-sm flex items-center gap-2 ${diferenca > 0 ? 'bg-status-ontrack/10 text-status-ontrack border border-status-ontrack/30' : 'bg-status-behind/10 text-status-behind border border-status-behind/30'}`}>
                                                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                                            <span>
                                                                {diferenca > 0
                                                                    ? `Faltam ${formatBRL(diferenca)} para completar o valor total`
                                                                    : `Valor excede o total em ${formatBRL(Math.abs(diferenca))}`
                                                                }
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
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
                                            <Textarea
                                                id="observacoes"
                                                value={formData.observacoes}
                                                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) {
                                                        return;
                                                    }
                                                    if (e.key === 'Enter') {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                                placeholder="Observações opcionais (pressione Enter para nova linha, Ctrl+Enter para enviar)"
                                                rows={4}
                                                className="resize-y"
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1" disabled={submitting}>
                                                Cancelar
                                            </Button>
                                            <LoadingButton
                                                type="submit"
                                                className="flex-1"
                                                isLoading={submitting}
                                                isSuccess={submitSuccess}
                                                loadingText="Enviando..."
                                                successText="Venda Lancada!"
                                            >
                                                Lancar Venda
                                            </LoadingButton>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>
                            <Button
                                variant="outline"
                                onClick={handleSignOut}
                                className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                size="sm"
                            >
                                <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                Sair
                            </Button>

                            {/* KPI Cards - Metas e Métricas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto mb-6 sm:mb-8">
                                {/* Meta Mensal */}
                                <Card className="flex flex-col h-full">
                                    <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
                                        <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground">Meta Mensal</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
                                        {goals ? (
                                            <div className="space-y-4 w-full">
                                                <p className="text-2xl sm:text-4xl font-bold text-primary">R$ {goals.meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                <p className="text-sm sm:text-base text-muted-foreground">
                                                    Realizado: R$ {monthlyRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-4 justify-between">
                                                        <Progress value={Math.min(monthlyProgress, 100)} className="h-4 flex-1" />
                                                        <span className="text-base font-semibold text-primary whitespace-nowrap min-w-[50px] text-right">
                                                            {monthlyProgress.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    {goals.super_meta_valor && (
                                                        <p className="text-sm sm:text-base text-muted-foreground flex items-center justify-center gap-1.5">
                                                            <Trophy className="h-4 w-4" />
                                                            <span>Super Meta: R$ {goals.super_meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-2xl sm:text-3xl font-bold text-muted-foreground">N/A</p>
                                                <p className="text-sm sm:text-base text-status-behind">
                                                    Meta não encontrada
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Meta Diária */}
                                <Card className="flex flex-col h-full">
                                    <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
                                        <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground">Meta Diária (Hoje)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
                                        {goals ? (
                                            <div className="space-y-4 w-full">
                                                <p className="text-2xl sm:text-4xl font-bold text-primary">R$ {dailyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                <div className="flex items-center gap-4 justify-between">
                                                    <Progress value={Math.min(dailyProgress, 100)} className="h-4 flex-1" />
                                                    <span className="text-base font-semibold text-primary whitespace-nowrap min-w-[50px] text-right">
                                                        {dailyProgress.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-2xl sm:text-3xl font-bold text-muted-foreground">N/A</p>
                                                <p className="text-sm sm:text-base text-muted-foreground">
                                                    Aguardando meta mensal
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Faturamento Hoje */}
                                <Card className="flex flex-col h-full">
                                    <CardHeader className="pb-4 p-5 sm:p-8 text-center border-b">
                                        <CardTitle className="text-base sm:text-lg font-semibold text-muted-foreground">Faturamento Hoje</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 sm:p-8 pt-5 sm:pt-8 flex-1 flex flex-col items-center justify-center text-center">
                                        <div className="space-y-3 w-full">
                                            <p className="text-2xl sm:text-4xl font-bold text-primary">R$ {sales.reduce((sum, s) => sum + s.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            <p className="text-sm sm:text-base text-muted-foreground">{sales.length} {sales.length === 1 ? 'venda' : 'vendas'}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Cards Adicionais - Ticket Médio, PA, Preço Médio */}
                            {metrics && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
                                    {/* Ticket Médio */}
                                    <Card className="flex flex-col h-full">
                                        <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                                            <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Ticket Médio</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                                            <div className="space-y-3 w-full">
                                                <p className="text-xl sm:text-3xl font-bold text-primary">R$ {sales.length > 0 ? (sales.reduce((sum, s) => sum + s.valor, 0) / sales.length).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</p>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3 justify-between">
                                                        <Progress
                                                            value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.valor, 0) / sales.length) / metrics.meta_ticket_medio) * 100, 100) : 0}
                                                            className="h-3 flex-1"
                                                        />
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                        Meta: R$ {metrics.meta_ticket_medio?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* PA (Peças por Atendimento) */}
                                    <Card className="flex flex-col h-full">
                                        <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                                            <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">PA (Peças/Venda)</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                                            <div className="space-y-3 w-full">
                                                <p className="text-xl sm:text-3xl font-bold text-primary">{sales.length > 0 ? (sales.reduce((sum, s) => sum + s.qtd_pecas, 0) / sales.length).toFixed(1) : '0,0'}</p>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3 justify-between">
                                                        <Progress
                                                            value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.qtd_pecas, 0) / sales.length) / metrics.meta_pa) * 100, 100) : 0}
                                                            className="h-3 flex-1"
                                                        />
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                        Meta: {metrics.meta_pa?.toFixed(1)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Preço Médio por Peça */}
                                    <Card className="flex flex-col h-full">
                                        <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                                            <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Preço Médio por Peça</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                                            <div className="space-y-3 w-full">
                                                <p className="text-xl sm:text-3xl font-bold text-primary">
                                                    {formatBRL(sales.length > 0 ?
                                                        sales.reduce((sum, s) => sum + s.valor, 0) / sales.reduce((sum, s) => sum + s.qtd_pecas, 0) :
                                                        0)}
                                                </p>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3 justify-between">
                                                        <Progress
                                                            value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.valor, 0) / sales.reduce((sum, s) => sum + s.qtd_pecas, 0)) / metrics.meta_preco_medio_peca) * 100, 100) : 0}
                                                            className="h-3 flex-1"
                                                        />
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                        Meta: {formatBRL(metrics.meta_preco_medio_peca)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* Planejamento do Dia - Cards por Vendedora */}
                            {colaboradorasPerformance.length > 0 && (
                                <div className="w-full max-w-6xl mx-auto">
                                    <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-center">Planejamento do Dia</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 justify-items-center">
                                        {colaboradorasPerformance.map((perf) => (
                                            <Card key={perf.id} className="flex flex-col w-full max-w-full sm:max-w-[380px] h-[280px]">
                                                <CardHeader className="pb-4 p-5 sm:p-6 text-center border-b">
                                                    <CardTitle className="text-lg font-semibold leading-snug min-h-[3.5rem]">{perf.name}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-5 sm:p-6 pt-5 sm:pt-6 flex-1 flex flex-col justify-center space-y-3">
                                                    <div className="space-y-2.5">
                                                        <div className="flex items-center justify-between text-base">
                                                            <span className="text-muted-foreground">Meta do Dia</span>
                                                            <span className="font-semibold">{formatBRL(perf.metaDiaria)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-base">
                                                            <span className="text-muted-foreground">Vendido:</span>
                                                            <span className="font-bold text-primary">{formatBRL(perf.vendidoHoje)}</span>
                                                        </div>
                                                        {perf.metaDiaria > 0 && (
                                                            <div className="flex items-center justify-between text-base">
                                                                <span className="text-muted-foreground">Falta:</span>
                                                                <span className={`font-semibold ${perf.vendidoHoje >= perf.metaDiaria ? 'text-status-ahead' : 'text-status-ontrack'}`}>
                                                                    {formatBRL(Math.max(0, perf.metaDiaria - perf.vendidoHoje))}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="space-y-1.5 pt-2">
                                                            <div className="flex items-center gap-3">
                                                                <Progress
                                                                    value={Math.min(perf.percentual, 100)}
                                                                    className="h-3 flex-1"
                                                                />
                                                                <span className="text-base font-semibold whitespace-nowrap min-w-[50px] text-right">
                                                                    {perf.percentual.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Meta Semanal Gamificada */}
                            {storeId && (
                                <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                    <WeeklyGoalProgress storeId={storeId} showDetails={true} />
                                </Suspense>
                            )}

                            {/* Bônus Semanal Individual por Colaboradora */}
                            {storeId && colaboradoras.length > 0 && (
                                <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                    <WeeklyBonusProgress storeId={storeId} colaboradoras={colaboradoras.map(c => ({ id: c.id, name: c.name }))} />
                                </Suspense>
                            )}

                            {/* Galeria de Troféus */}
                            {storeId && (
                                <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                                    <TrophiesGallery storeId={storeId} limit={50} />
                                </Suspense>
                            )}

                            {/* Tabela de Performance do Dia */}
                            {colaboradorasPerformance.length > 0 ? (
                                <Card>
                                    <CardHeader className="p-3 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Performance do Dia</CardTitle>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Desempenho diário e mensal de cada colaboradora</p>
                                    </CardHeader>
                                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-xs sm:text-sm">Vendedora</TableHead>
                                                        <TableHead className="text-xs sm:text-sm">Vendido Hoje</TableHead>
                                                        <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Meta Dia</TableHead>
                                                        <TableHead className="text-xs sm:text-sm">% Dia</TableHead>
                                                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Ticket Médio</TableHead>
                                                        <TableHead className="text-xs sm:text-sm hidden lg:table-cell">PA</TableHead>
                                                        <TableHead className="text-xs sm:text-sm">Vendas</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {colaboradorasPerformance.map((perf) => (
                                                        <TableRow key={perf.id}>
                                                            <TableCell className="font-medium text-xs sm:text-sm break-words">{perf.name}</TableCell>
                                                            <TableCell className="text-xs sm:text-sm font-medium">
                                                                {formatBRL(perf.vendidoHoje)}
                                                                {perf.vendidoHojeMes > 0 && (
                                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                        Mês: {formatBRL(perf.vendidoHojeMes)}
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                                                                {formatBRL(perf.metaDiaria)}
                                                                {perf.meta > 0 && (
                                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                        Mensal: {formatBRL(perf.meta)}
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs sm:text-sm">
                                                                {perf.meta > 0 ? (
                                                                    <>
                                                                        <span className={
                                                                            perf.percentual >= 120 ? 'text-status-ahead font-bold' :
                                                                                perf.percentual >= 100 ? 'text-status-ahead font-bold' :
                                                                                    perf.percentual >= 90 ? 'text-status-ontrack' :
                                                                                        'text-status-behind'
                                                                        }>
                                                                            {perf.percentual.toFixed(0)}%
                                                                        </span>
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                            Mês: {perf.percentualMensal.toFixed(0)}%
                                                                        </div>
                                                                        {perf.faltaMensal > 0 && (
                                                                            <div className="text-[10px] text-status-ontrack mt-0.5">
                                                                                Falta: {formatBRL(perf.faltaMensal)}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-muted-foreground">Sem meta</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">{formatBRL(perf.ticketMedio)}</TableCell>
                                                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                                                                {perf.qtdVendas > 0 ? (perf.qtdPecas / perf.qtdVendas).toFixed(1) : '0.0'}
                                                            </TableCell>
                                                            <TableCell className="text-xs sm:text-sm">
                                                                {perf.qtdVendas}
                                                                {perf.qtdVendasMes > 0 && (
                                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                        Mês: {perf.qtdVendasMes}
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : colaboradoras.length > 0 && (
                                <Card>
                                    <CardContent className="p-6 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            Nenhuma meta individual encontrada para as colaboradoras desta loja no mês atual.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Vendas */}
                            <Card>
                                <CardHeader className="p-3 sm:p-6">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base sm:text-lg">
                                                Vendas
                                            </CardTitle>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <Label htmlFor="sales-date-filter" className="text-xs sm:text-sm whitespace-nowrap">
                                                    Filtrar por data:
                                                </Label>
                                                <Input
                                                    id="sales-date-filter"
                                                    type="date"
                                                    value={salesDateFilter}
                                                    onChange={(e) => setSalesDateFilter(e.target.value)}
                                                    className="flex-1 sm:flex-initial sm:w-auto text-xs sm:text-sm"
                                                    max={format(new Date(), 'yyyy-MM-dd')}
                                                />
                                            </div>
                                            {salesDateFilter !== format(new Date(), 'yyyy-MM-dd') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSalesDateFilter(format(new Date(), 'yyyy-MM-dd'))}
                                                    className="text-xs whitespace-nowrap w-full sm:w-auto"
                                                >
                                                    Voltar para Hoje
                                                </Button>
                                            )}
                                            {salesDateFilter === format(new Date(), 'yyyy-MM-dd') && (
                                                <span className="text-xs text-muted-foreground">
                                                    Mostrando vendas de hoje
                                                </span>
                                            )}
                                        </div>
                                    </div>
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
                                                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Valor/Venda</TableHead>
                                                    <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sales.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center text-muted-foreground text-xs sm:text-sm py-6">
                                                            {salesDateFilter === format(new Date(), 'yyyy-MM-dd')
                                                                ? 'Nenhuma venda lançada hoje'
                                                                : `Nenhuma venda encontrada para ${format(new Date(salesDateFilter), 'dd/MM/yyyy')}`
                                                            }
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    sales.map((sale) => {
                                                        const isExpanded = expandedSales.has(sale.id);
                                                        const details = erpSaleDetails[sale.id];
                                                        const isErpSale = !!sale.tiny_order_id;

                                                        return (
                                                            <Fragment key={sale.id}>
                                                                <TableRow>
                                                                    <TableCell className="text-xs sm:text-sm">
                                                                        <div className="flex items-center gap-1">
                                                                            {isErpSale && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-6 w-6 p-0 -ml-1"
                                                                                    onClick={() => toggleSaleExpansion(sale.id, sale.tiny_order_id)}
                                                                                >
                                                                                    {isExpanded ? (
                                                                                        <ChevronDown className="h-3 w-3" />
                                                                                    ) : (
                                                                                        <ChevronRight className="h-3 w-3" />
                                                                                    )}
                                                                                </Button>
                                                                            )}
                                                                            <span>
                                                                                {salesDateFilter === format(new Date(), 'yyyy-MM-dd')
                                                                                    ? format(new Date(sale.data_venda), 'HH:mm')
                                                                                    : format(new Date(sale.data_venda), 'dd/MM/yyyy HH:mm')
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs sm:text-sm font-medium break-words">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span>{sale.colaboradora?.name || 'Colaboradora não encontrada'}</span>
                                                                            {isErpSale && (
                                                                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                                                    <Database className="h-3 w-3" />
                                                                                    via ERP
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs sm:text-sm font-medium">{formatBRL(sale.valor)}</TableCell>
                                                                    <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{sale.qtd_pecas}</TableCell>
                                                                    <TableCell className="text-xs sm:text-sm hidden md:table-cell">{formatBRL(sale.valor)}</TableCell>
                                                                    <TableCell>
                                                                        <div className="flex gap-1 sm:gap-2">
                                                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(sale)} className="h-8 w-8 p-0">
                                                                                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="sm" className="text-status-behind h-8 w-8 p-0" onClick={() => handleDelete(sale.id)}>
                                                                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                                {isErpSale && isExpanded && (
                                                                    <TableRow key={`${sale.id}-details`}>
                                                                        <TableCell colSpan={6} className="bg-muted/50">
                                                                            <div className="space-y-2 py-2">
                                                                                {details ? (
                                                                                    <>
                                                                                        {details.cliente_nome && (
                                                                                            <div className="text-xs">
                                                                                                <span className="font-medium">Cliente:</span> {details.cliente_nome}
                                                                                            </div>
                                                                                        )}
                                                                                        {details.forma_pagamento && (
                                                                                            <div className="text-xs">
                                                                                                <span className="font-medium">Forma de Pagamento:</span> {details.forma_pagamento}
                                                                                            </div>
                                                                                        )}
                                                                                        {details.itens && Array.isArray(details.itens) && details.itens.length > 0 && (
                                                                                            <div className="text-xs">
                                                                                                <span className="font-medium">Peças:</span>
                                                                                                <ul className="list-disc list-inside mt-1 space-y-1">
                                                                                                    {details.itens.map((item: any, idx: number) => (
                                                                                                        <li key={idx}>
                                                                                                            {item.quantidade || 1}x {item.descricao || item.nome || item.produto?.descricao || 'Produto sem descrição'}
                                                                                                        </li>
                                                                                                    ))}
                                                                                                </ul>
                                                                                            </div>
                                                                                        )}
                                                                                    </>
                                                                                ) : (
                                                                                    <div className="text-xs text-muted-foreground">Carregando detalhes...</div>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </Fragment>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Ranking Mensal com Pódio */}
                            {rankingMonthly.length > 0 && (
                                <Card>
                                    <CardHeader className="pb-2 p-3 sm:p-6">
                                        <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                                            <Award className="h-4 w-4 sm:h-5 sm:w-5" />
                                            <span>Podio Mensal</span>
                                        </CardTitle>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Ranking acumulado do mes</p>
                                    </CardHeader>
                                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                        <div className="space-y-2">
                                            {rankingMonthly.map((item, index) => {
                                                const perf = colaboradorasPerformance.find(p => p.id === item.colaboradora_id);
                                                const isOuro = index === 0;
                                                const isPrata = index === 1;
                                                const isBronze = index === 2;

                                                const getRowStyle = () => {
                                                    if (isOuro) return { background: 'linear-gradient(90deg, hsl(45 80% 92%) 0%, hsl(var(--card)) 100%)' };
                                                    if (isPrata) return { background: 'linear-gradient(90deg, hsl(0 0% 88%) 0%, hsl(var(--card)) 100%)' };
                                                    if (isBronze) return { background: 'linear-gradient(90deg, hsl(30 50% 85%) 0%, hsl(var(--card)) 100%)' };
                                                    return {};
                                                };

                                                return (
                                                    <div
                                                        key={item.colaboradora_id}
                                                        className={`relative flex items-center justify-between p-3 rounded-md border ${isOuro ? 'border-primary/30' : isPrata ? 'border-muted-foreground/20' : isBronze ? 'border-primary/20' : 'border-border/50 bg-muted/20'
                                                            }`}
                                                        style={getRowStyle()}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 ${isOuro ? 'bg-primary text-primary-foreground' : isPrata ? 'bg-muted-foreground/40 text-foreground' : isBronze ? 'bg-primary/60 text-primary-foreground' : 'bg-muted text-muted-foreground'
                                                                }`}>
                                                                {index + 1}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-semibold text-sm break-words block">{item.name || 'Colaboradora'}</span>
                                                                {perf && (
                                                                    <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                                                                        <span>Ticket: {formatBRL(perf.ticketMedio)}</span>
                                                                        <span>PA: {(perf.qtdPecas / Math.max(perf.qtdVendasMes, 1)).toFixed(1)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0 ml-2">
                                                            <p className="font-bold text-base sm:text-lg">
                                                                {formatBRL(item.total)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

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
                                                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">PA</TableHead>
                                                        <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Ticket Médio</TableHead>
                                                        <TableHead className="text-xs sm:text-sm">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {history7Days.map((day) => (
                                                        <TableRow key={day.day}>
                                                            <TableCell className="text-xs sm:text-sm">{format(new Date(day.day + 'T00:00:00'), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell className="text-xs sm:text-sm">{day.qtdVendas}</TableCell>
                                                            <TableCell className="text-xs sm:text-sm">{day.qtdPecas}</TableCell>
                                                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                                                                {day.qtdVendas > 0 ? (day.qtdPecas / day.qtdVendas).toFixed(1) : '0.0'}
                                                            </TableCell>
                                                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                                                                {formatBRL(day.ticketMedio ? day.ticketMedio : (day.qtdVendas > 0 ? (day.total / day.qtdVendas) : 0))}
                                                            </TableCell>
                                                            <TableCell className="text-xs sm:text-sm font-medium">{formatBRL(day.total)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Tabela Mensal por Colaboradora/Dia */}
                            {(colaboradoras.length > 0 || monthlyDataByDay.length > 0) && (
                                <Card>
                                    <CardHeader className="p-3 sm:p-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-base sm:text-lg">Performance Mensal por Dia</CardTitle>
                                                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Vendas diárias de cada colaboradora no mês atual</p>
                                            </div>
                                            {monthlyDataByDay.length > 0 && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleExportXLS}
                                                        className="text-xs sm:text-sm"
                                                    >
                                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                                        Exportar XLS
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleExportPDF}
                                                        className="text-xs sm:text-sm"
                                                    >
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Exportar PDF
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                                        {monthlyDataByDay.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-xs sm:text-sm sticky left-0 bg-background z-10 font-bold min-w-[100px] sm:min-w-[140px]">Vendedora</TableHead>
                                                            {(() => {
                                                                const hoje = new Date();
                                                                const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                                                                const todayStr = format(hoje, 'yyyy-MM-dd');
                                                                const days: string[] = [];
                                                                for (let day = 1; day <= daysInMonth; day++) {
                                                                    const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                                                                    if (dayStr <= todayStr) {
                                                                        days.push(dayStr);
                                                                    }
                                                                }
                                                                return days.map(dayStr => (
                                                                    <TableHead key={dayStr} className="text-xs text-center min-w-[60px]">
                                                                        {format(new Date(dayStr + 'T00:00:00'), 'dd/MM')}
                                                                    </TableHead>
                                                                ));
                                                            })()}
                                                            <TableHead className="text-xs sm:text-sm sticky right-0 bg-background z-10 font-bold text-primary min-w-[80px] sm:min-w-[120px]">Total</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {monthlyDataByDay
                                                            .sort((a, b) => b.totalMes - a.totalMes)
                                                            .map((data) => {
                                                                const hoje = new Date();
                                                                const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                                                                const todayStr = format(hoje, 'yyyy-MM-dd');
                                                                const days: string[] = [];
                                                                for (let day = 1; day <= daysInMonth; day++) {
                                                                    const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                                                                    if (dayStr <= todayStr) {
                                                                        days.push(dayStr);
                                                                    }
                                                                }

                                                                return (
                                                                    <TableRow key={data.colaboradoraId}>
                                                                        <TableCell className="text-xs sm:text-sm font-medium sticky left-0 bg-background z-10 min-w-[100px] sm:min-w-[140px]">
                                                                            {data.colaboradoraName}
                                                                        </TableCell>
                                                                        {days.map(dayStr => {
                                                                            const dayData = data.dailySales[dayStr] || { valor: 0, metaDiaria: 0 };
                                                                            const bateuMeta = dayData.metaDiaria > 0 && dayData.valor >= dayData.metaDiaria;

                                                                            return (
                                                                                <TableCell
                                                                                    key={dayStr}
                                                                                    className={`
                                                                            text-xs text-center font-medium
                                                                            ${bateuMeta
                                                                                            ? 'bg-status-ahead/20 dark:bg-status-ahead/10 text-foreground'
                                                                                            : dayData.valor > 0
                                                                                                ? 'text-foreground'
                                                                                                : 'text-muted-foreground'
                                                                                        }
                                                                        `}
                                                                                    title={dayData.metaDiaria > 0 ? `Meta: ${formatBRL(dayData.metaDiaria)}` : ''}
                                                                                >
                                                                                    {dayData.valor > 0 ? (
                                                                                        <span className="font-semibold">
                                                                                            {formatBRL(dayData.valor, 0)}
                                                                                            {bateuMeta && ' ✓'}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-muted-foreground">-</span>
                                                                                    )}
                                                                                </TableCell>
                                                                            );
                                                                        })}
                                                                        <TableCell className="text-xs sm:text-sm font-bold text-primary sticky right-0 bg-background z-10 min-w-[80px] sm:min-w-[120px] text-right">
                                                                            {formatBRL(data.totalMes)}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        {/* Linha de Total da Loja */}
                                                        <TableRow className="bg-primary/5 font-bold border-t-2 border-primary">
                                                            <TableCell className="text-xs sm:text-sm font-bold sticky left-0 bg-primary/5 z-10 min-w-[100px] sm:min-w-[140px]">
                                                                TOTAL DA LOJA
                                                            </TableCell>
                                                            {(() => {
                                                                const hoje = new Date();
                                                                const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
                                                                const todayStr = format(hoje, 'yyyy-MM-dd');
                                                                const days: string[] = [];
                                                                for (let day = 1; day <= daysInMonth; day++) {
                                                                    const dayStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), day), 'yyyy-MM-dd');
                                                                    if (dayStr <= todayStr) {
                                                                        days.push(dayStr);
                                                                    }
                                                                }

                                                                const totalPorDia: Record<string, number> = {};

                                                                days.forEach(dayStr => {
                                                                    const totalDia = monthlyDataByDay.reduce((sum, data) => {
                                                                        const dayData = data.dailySales[dayStr] || { valor: 0 };
                                                                        return sum + dayData.valor;
                                                                    }, 0);
                                                                    totalPorDia[dayStr] = totalDia;
                                                                });

                                                                return days.map(dayStr => (
                                                                    <TableCell
                                                                        key={dayStr}
                                                                        className="text-xs text-center font-bold text-primary"
                                                                    >
                                                                        {totalPorDia[dayStr] > 0 ? (
                                                                            formatBRL(totalPorDia[dayStr], 0)
                                                                        ) : (
                                                                            <span className="text-muted-foreground">-</span>
                                                                        )}
                                                                    </TableCell>
                                                                ));
                                                            })()}
                                                            <TableCell className="text-xs sm:text-sm font-bold text-primary sticky right-0 bg-primary/5 z-10 min-w-[80px] sm:min-w-[120px] text-right">
                                                                R$ {monthlyRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-6">
                                                <p className="text-sm text-muted-foreground">
                                                    Carregando dados mensais...
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </motion.div>
            </main>

            {lastSaleData && storeId && (
                <Suspense fallback={null}>
                    <PostSaleSchedulerDialog
                        open={postSaleDialogOpen}
                        onOpenChange={(open) => {
                            setPostSaleDialogOpen(open);
                            if (!open) {
                                resetForm();
                                setLastSaleData(null);
                            }
                        }}
                        saleId={lastSaleData.saleId}
                        storeId={storeId}
                        colaboradoraId={lastSaleData.colaboradoraId}
                        saleDate={lastSaleData.saleDate}
                        saleObservations={lastSaleData.saleObservations}
                        clienteId={lastSaleData.clienteId}
                        clienteNome={lastSaleData.clienteNome}
                        clienteTelefone={lastSaleData.clienteTelefone}
                        onSuccess={() => {
                            if (storeId) {
                                fetchSalesWithStoreId(storeId, salesDateFilter);
                            }
                            resetForm();
                            setLastSaleData(null);
                        }}
                    />
                </Suspense>
            )}

            {/* Modal de Novo Cliente */}
            <NewClientDialog
                open={newClientDialogOpen}
                onOpenChange={setNewClientDialogOpen}
                onClientCreated={handleNewClientCreated}
                storeId={storeId || undefined}
            />
        </div>
    );
}
