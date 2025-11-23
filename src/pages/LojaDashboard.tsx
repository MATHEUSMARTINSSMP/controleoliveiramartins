import { useState, useEffect, useRef } from "react";
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
import { Plus, Edit, Trash2, UserCheck, Calendar, ClipboardList, Check, Trophy, LogOut, Medal, Award } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, getWeek, getYear } from "date-fns";
import WeeklyGoalProgress from "@/components/WeeklyGoalProgress";
import WeeklyBonusProgress from "@/components/WeeklyBonusProgress";
import { TrophiesGallery } from "@/components/loja/TrophiesGallery";
import { StoreLogo } from "@/lib/storeLogo";
import { sendWhatsAppMessage, formatVendaMessage } from "@/lib/whatsapp";
import { checkAndCreateMonthlyTrophies, checkAndCreateWeeklyTrophies } from "@/lib/trophies";

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
    const { profile, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();

    const [sales, setSales] = useState<Sale[]>([]);
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [storeId, setStoreId] = useState<string | null>(null);
    const [storeName, setStoreName] = useState<string | null>(null);

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
    const [monthlyProgress, setMonthlyProgress] = useState<number>(0);
    const [monthlyRealizado, setMonthlyRealizado] = useState<number>(0);
    const [history7Days, setHistory7Days] = useState<any[]>([]);
    const [monthlyDataByDay, setMonthlyDataByDay] = useState<{
        colaboradoraId: string;
        colaboradoraName: string;
        dailySales: Record<string, { valor: number; qtdVendas: number; qtdPecas: number; metaDiaria: number }>;
        totalMes: number;
    }[]>([]);

    // Refs para prevenir múltiplas chamadas
    const isIdentifyingStoreRef = useRef(false);
    const isFetchingDataRef = useRef(false);
    const lastFetchedStoreIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (authLoading) {
            // Still loading auth, wait
            return;
        }

        if (!profile || (profile.role !== 'LOJA' && profile.role !== 'ADMIN')) {
            navigate('/');
            return;
        }

        // Se for LOJA, precisa identificar o store_id correto (apenas uma vez)
        if (profile.role === 'LOJA' && !isIdentifyingStoreRef.current) {
            isIdentifyingStoreRef.current = true;
            identifyStore();
        } else if (profile.role === 'ADMIN') {
            // ADMIN não precisa carregar dados de loja específica aqui
            setLoading(false);
        }
    }, [profile, authLoading, navigate]);

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

    const fetchGoals = async () => {
        if (!storeId) return;
        return fetchGoalsWithStoreId(storeId);
    };

    // Função auxiliar para calcular meta diária dinâmica
    const calculateDynamicDailyGoal = (
        metaMensal: number,
        vendidoMes: number,
        today: string,
        dailyWeights: Record<string, number> | null,
        daysInMonth: number
    ): number => {
        // Calcular dias restantes do mês (incluindo o dia de hoje)
        const hoje = new Date(today);
        const daysRemaining = daysInMonth - hoje.getDate() + 1; // +1 para incluir hoje
        
        // Meta fixa (baseada em daily_weights ou proporcional)
        let metaFixa = metaMensal / daysInMonth;
        if (dailyWeights && Object.keys(dailyWeights).length > 0) {
            const hojePeso = dailyWeights[today] || 0;
            if (hojePeso > 0) {
                metaFixa = (metaMensal * hojePeso) / 100;
            }
        }
        
        // Meta dinâmica: (o que falta) / dias restantes
        const faltaParaMeta = Math.max(0, metaMensal - vendidoMes);
        const metaDinamica = daysRemaining > 0 ? faltaParaMeta / daysRemaining : 0;
        
        // A meta diária é o maior entre a meta dinâmica e a meta fixa (piso)
        return Math.max(metaDinamica, metaFixa);
    };

    const fetchGoalsWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) {
            console.error('[LojaDashboard] ❌ fetchGoalsWithStoreId chamado sem storeId');
            return;
        }
        
        const mesAtual = format(new Date(), 'yyyyMM');
        const hoje = new Date();
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
        const today = format(hoje, 'yyyy-MM-dd');

        console.log('[LojaDashboard] 📡 Buscando meta mensal da loja...');
        console.log('[LojaDashboard]   storeId:', currentStoreId);
        console.log('[LojaDashboard]   mes_referencia:', mesAtual);
        console.log('[LojaDashboard]   tipo: MENSAL');
        console.log('[LojaDashboard]   colaboradora_id: null (IS NULL)');

        // Tentar buscar com schema explícito primeiro
        let { data, error } = await supabase
            .schema("sistemaretiradas")
            .from('goals')
            .select('*')
            .eq('store_id', currentStoreId)
            .eq('mes_referencia', mesAtual)
            .eq('tipo', 'MENSAL')
            .is('colaboradora_id', null)
            .maybeSingle();

        // Se não encontrar com schema explícito, tentar sem schema
        if (!data && !error) {
            console.log('[LojaDashboard] ⚠️ Não encontrou com schema explícito, tentando sem schema...');
            const result = await supabase
                .from('goals')
                .select('*')
                .eq('store_id', currentStoreId)
                .eq('mes_referencia', mesAtual)
                .eq('tipo', 'MENSAL')
                .is('colaboradora_id', null)
                .maybeSingle();
            data = result.data;
            error = result.error;
        }

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
                .select('id, active, updated_at')
                .eq('role', 'COLABORADORA')
                .eq('store_id', currentStoreId);
            
            // Criar mapa de datas de desativação
            const deactivationMap = new Map<string, string | null>();
            colaboradorasInfo?.forEach((colab: any) => {
                if (!colab.active && colab.updated_at) {
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
            setMonthlyRealizado(totalMes);
            setMonthlyProgress((totalMes / Number(data.meta_valor)) * 100);
            
            // Calcular meta diária DINÂMICA
            const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
            const dailyWeights = data.daily_weights || {};
            const daily = calculateDynamicDailyGoal(
                Number(data.meta_valor),
                totalMes,
                today,
                Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                daysInMonth
            );
            
            console.log('[LojaDashboard] 📊 Meta diária calculada dinamicamente:');
            console.log('[LojaDashboard]   Meta mensal:', Number(data.meta_valor));
            console.log('[LojaDashboard]   Vendido no mês:', totalMes);
            console.log('[LojaDashboard]   Faltando:', Math.max(0, Number(data.meta_valor) - totalMes));
            console.log('[LojaDashboard]   Dias restantes:', daysInMonth - hoje.getDate() + 1);
            console.log('[LojaDashboard]   Meta diária dinâmica:', daily);
            
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

    const fetch7DayHistory = async () => {
        if (!storeId) return;
        return fetch7DayHistoryWithStoreId(storeId);
    };

    const fetch7DayHistoryWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;
        
        const startDate = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        const { data, error } = await supabase
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
            .select('id, name, active, updated_at')
            .eq('role', 'COLABORADORA')
            .eq('store_id', currentStoreId)
            .order('name', { ascending: true });
        
        // Log para debug
        if (colaboradorasData) {
            const ativas = colaboradorasData.filter(c => c.active).length;
            const desativadas = colaboradorasData.filter(c => !c.active).length;
            console.log('[LojaDashboard] 📊 Colaboradoras encontradas:', {
                total: colaboradorasData.length,
                ativas,
                desativadas,
                desativadas_lista: colaboradorasData.filter(c => !c.active).map(c => ({ id: c.id, name: c.name, updated_at: c.updated_at }))
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
            console.log(`[LojaDashboard] 🔄 Inicializando colaboradora ${colab.active ? 'ATIVA' : 'DESATIVADA'} "${colab.name}" (id: ${colab.id})`);
        });

        // Criar mapa de colaboradoras com data de desativação
        const colaboradorasMapWithDeactivation = new Map(
            colaboradorasData.map(c => [
                c.id, 
                {
                    name: c.name,
                    active: c.active,
                    deactivationDate: c.active ? null : (c.updated_at ? format(new Date(c.updated_at), 'yyyy-MM-dd') : null)
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
                        // Para o dia de hoje, usar cálculo dinâmico. Para dias passados, usar meta fixa.
                        if (day === todayStr) {
                            // Calcular vendas do mês até ontem para este colaborador
                            const vendasMesAteOntem = salesData
                                ?.filter((s: any) => {
                                    const saleDay = s.data_venda ? s.data_venda.split('T')[0] : null;
                                    return s.colaboradora_id === colabId && saleDay && saleDay < todayStr;
                                })
                                .reduce((sum: number, s: any) => sum + Number(s.valor || 0), 0) || 0;
                            
                            const dailyWeights = goal.daily_weights || {};
                            metaDiaria = calculateDynamicDailyGoal(
                                Number(goal.meta_valor),
                                vendasMesAteOntem,
                                todayStr,
                                Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                                daysInMonth
                            );
                        } else {
                            // Para dias passados, usar meta fixa (daily_weights ou proporcional)
                            const dailyWeights = goal.daily_weights || {};
                            if (Object.keys(dailyWeights).length > 0) {
                                const dayWeight = dailyWeights[day] || 0;
                                metaDiaria = (Number(goal.meta_valor) * dayWeight) / 100;
                            } else {
                                metaDiaria = Number(goal.meta_valor) / daysInMonth;
                            }
                        }
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
                            let metaDiaria = 0;
                            
                            // Para o dia de hoje, usar cálculo dinâmico. Para dias passados, usar meta fixa.
                            if (dayStr === todayStr) {
                                metaDiaria = calculateDynamicDailyGoal(
                                    Number(goal.meta_valor),
                                    vendasMesColab,
                                    todayStr,
                                    Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                                    daysInMonth
                                );
                            } else {
                                // Para dias passados, usar meta fixa (daily_weights ou proporcional)
                                if (Object.keys(dailyWeights).length > 0) {
                                    const dayWeight = dailyWeights[dayStr] || 0;
                                    metaDiaria = (Number(goal.meta_valor) * dayWeight) / 100;
                                } else {
                                    metaDiaria = Number(goal.meta_valor) / daysInMonth;
                                }
                            }
                            
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
                active: colab.active,
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
            if (colab.active) {
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
        const ativasCount = resultFiltered.filter(r => colaboradorasData.find(c => c.id === r.colaboradoraId)?.active).length;
        const desativadasCount = resultFiltered.filter(r => !colaboradorasData.find(c => c.id === r.colaboradoraId)?.active).length;
        console.log('[LojaDashboard]   - Ativas:', ativasCount);
        console.log('[LojaDashboard]   - Desativadas:', desativadasCount);
        resultFiltered.forEach((item, idx) => {
            const daysWithData = Object.keys(item.dailySales).length;
            console.log(`[LojaDashboard]   ${idx + 1}. ${item.colaboradoraName}: ${daysWithData} dias com dados, Total: R$ ${item.totalMes.toFixed(2)}`);
        });

        setMonthlyDataByDay(resultFiltered);
    };

    const fetchData = async () => {
        if (!storeId) {
            console.warn('[LojaDashboard] ⚠️ fetchData chamado mas storeId não está definido ainda');
            return;
        }
        await fetchDataWithStoreId(storeId);
    };

    const fetchDataWithStoreId = async (currentStoreId: string, currentStoreName?: string) => {
        if (!currentStoreId) {
            console.error('[LojaDashboard] ❌ fetchDataWithStoreId chamado sem storeId válido');
            setLoading(false);
            return;
        }

        // Prevenir múltiplas chamadas com o mesmo storeId
        if (isFetchingDataRef.current && lastFetchedStoreIdRef.current === currentStoreId) {
            console.log('[LojaDashboard] ⚠️ fetchDataWithStoreId já está sendo executado para este storeId, ignorando chamada duplicada');
            return;
        }

        // Se já foi buscado recentemente para este storeId, não buscar novamente
        if (lastFetchedStoreIdRef.current === currentStoreId && storeId === currentStoreId) {
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
                fetchMonthlyRankingWithStoreId(currentStoreId),
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

    const fetchMetrics = async () => {
        if (!storeId) return;
        return fetchMetricsWithStoreId(storeId);
    };

    const fetchMetricsWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;
        
        const mesAtual = format(new Date(), 'yyyyMM');

        const { data, error } = await supabase
            .from('store_metrics')
            .select('*')
            .eq('store_id', currentStoreId)
            .eq('mes_referencia', mesAtual)
            .single();

        if (!error && data) {
            setMetrics(data);
        }
    };

    const fetchColaboradorasPerformance = async () => {
        if (!storeId) return;
        return fetchColaboradorasPerformanceWithStoreId(storeId, storeName || undefined);
    };

    const fetchColaboradorasPerformanceWithStoreId = async (currentStoreId: string, currentStoreName?: string | null) => {
        if (!currentStoreId) return;

        const hoje = new Date();
        const today = format(hoje, 'yyyy-MM-dd');
        const mesAtual = format(hoje, 'yyyyMM');
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
        const daysInMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

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
                .select('id, name, active, store_id, store_default')
                .eq('role', 'COLABORADORA')
                .eq('active', true)
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
        const { data: salesToday, error: salesTodayError } = await supabase
            .from('sales')
            .select('colaboradora_id, valor, qtd_pecas')
            .eq('store_id', currentStoreId)
            .gte('data_venda', `${today}T00:00:00`);

        // Buscar vendas do mês por colaboradora
        const { data: salesMonth, error: salesMonthError } = await supabase
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

        // Se não encontrar com schema explícito, tentar sem schema
        if ((!goalsData || goalsData.length === 0) && !goalsError) {
            console.log('[LojaDashboard] ⚠️ Não encontrou com schema explícito, tentando sem schema...');
            const result = await supabase
                .from('goals')
                .select('colaboradora_id, meta_valor, super_meta_valor, daily_weights')
                .eq('store_id', currentStoreId)
                .eq('mes_referencia', mesAtual)
                .eq('tipo', 'INDIVIDUAL')
                .not('colaboradora_id', 'is', null);
            goalsData = result.data;
            goalsError = result.error;
            console.log('[LojaDashboard] 📊 Resultado sem schema:', goalsData?.length || 0);
            if (goalsError) {
                console.error('[LojaDashboard]   Erro sem schema:', goalsError);
            }
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
                // Filtrar colaboradoras desativadas e sem meta ANTES de processar
                .filter(colab => {
                    // Garantir que colaboradora está ativa
                    if (!colab.active) {
                        console.log(`[LojaDashboard] ⏭️ Colaboradora desativada "${colab.name}" excluída do Planejamento do Dia`);
                        return false;
                    }
                    
                    // Verificar se tem meta lançada
                    const goal = goalsData?.find(g => g.colaboradora_id === colab.id);
                    if (!goal) {
                        console.log(`[LojaDashboard] ⏭️ Colaboradora "${colab.name}" sem meta lançada, excluída do Planejamento do Dia`);
                        return false;
                    }
                    
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

                // Meta individual (já verificamos que existe no filter acima)
                const goal = goalsData?.find(g => g.colaboradora_id === colab.id);
                
                if (goal) {
                    console.log(`[LojaDashboard]   ✅ Meta encontrada para ${colab.name}: R$ ${goal.meta_valor}`);
                } else {
                    // Não deve chegar aqui devido ao filter, mas mantemos para segurança
                    console.log(`[LojaDashboard]   ⚠️ Nenhuma meta encontrada para ${colab.name} (id: ${colab.id})`);
                    if (goalsData && goalsData.length > 0) {
                        console.log(`[LojaDashboard]     IDs de metas disponíveis:`, goalsData.map(g => g.colaboradora_id));
                    }
                    return null; // Retornar null para ser filtrado depois
                }
                
                if (goal) {
                    // Calcular meta diária DINÂMICA
                    const dailyWeights = goal.daily_weights || {};
                    const metaDiaria = calculateDynamicDailyGoal(
                        Number(goal.meta_valor),
                        vendidoMes,
                        today,
                        Object.keys(dailyWeights).length > 0 ? dailyWeights : null,
                        daysInMonth
                    );
                    
                    // Progresso do dia
                    const progressoDia = metaDiaria > 0 ? (vendidoHoje / metaDiaria) * 100 : 0;
                    
                    // Progresso mensal
                    const progressoMensal = Number(goal.meta_valor) > 0 ? (vendidoMes / Number(goal.meta_valor)) * 100 : 0;
                    
                    // Quanto falta para a meta mensal
                    const faltaMensal = Math.max(0, Number(goal.meta_valor) - vendidoMes);

                return {
                    id: colab.id,
                    name: colab.name,
                        vendido: vendidoHoje,
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
                } else {
                    // Sem meta individual - não deve chegar aqui devido ao filter, mas retorna null para ser filtrado
                    return null;
                }
            })
            // Filtrar nulls (colaboradoras sem meta ou desativadas)
            .filter(p => p !== null) as Array<{
                id: string;
                name: string;
                vendido: number;
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

            // Filtro adicional: apenas colaboradoras com meta lançada (dupla verificação)
            const performanceFiltered = performance.filter(p => p.meta > 0 && p.metaDiaria > 0);
            console.log('[LojaDashboard] 📊 Performance filtrada:', performanceFiltered.length, 'colaboradoras');
            performanceFiltered.forEach((p, idx) => {
                console.log(`[LojaDashboard]   ${idx + 1}. ${p.name}: meta=R$ ${p.meta}, vendido hoje=R$ ${p.vendido}, vendido mês=R$ ${p.vendidoMes}`);
            });
            setColaboradorasPerformance(performanceFiltered);
        } else {
            console.warn('[LojaDashboard] ⚠️ Nenhuma colaboradora encontrada para processar performance');
            if (goalsError) {
                console.error('[LojaDashboard] ❌ Erro ao buscar metas individuais:', goalsError);
            }
            setColaboradorasPerformance([]);
        }
    };

    const fetchRankingTop3 = async () => {
        if (!storeId) return;
        return fetchRankingTop3WithStoreId(storeId);
    };

    const fetchRankingTop3WithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;
        
        const today = format(new Date(), 'yyyy-MM-dd');

        const { data: salesData, error } = await supabase
            .from('sales')
            .select(`
                colaboradora_id,
                valor,
                profiles!inner(name)
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

    const fetchMonthlyRanking = async () => {
        if (!storeId) return;
        return fetchMonthlyRankingWithStoreId(storeId);
    };

    const fetchMonthlyRankingWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;
        
        const mesAtual = format(new Date(), 'yyyyMM');
        const startOfMonth = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;

        const { data: salesData, error } = await supabase
            .from('sales')
            .select(`
                colaboradora_id,
                valor,
                qtd_pecas,
                profiles!inner(name)
            `)
            .eq('store_id', currentStoreId)
            .gte('data_venda', `${startOfMonth}T00:00:00`);

        if (!error && salesData) {
            const grouped = salesData.reduce((acc: any, sale: any) => {
                const id = sale.colaboradora_id;
                if (!acc[id]) {
                    acc[id] = {
                        colaboradora_id: id,
                        name: sale.profiles.name,
                        total: 0,
                        qtdVendas: 0,
                        qtdPecas: 0
                    };
                }
                acc[id].total += Number(sale.valor);
                acc[id].qtdVendas += 1;
                acc[id].qtdPecas += Number(sale.qtd_pecas);
                return acc;
            }, {});

            const ranking = Object.values(grouped)
                .sort((a: any, b: any) => b.total - a.total)
                .slice(0, 2); // Apenas Top 2 para Ouro e Prata

            setRankingMonthly(ranking as any[]);
        }
    };

    const fetchSales = async () => {
        if (!storeId) return;
        return fetchSalesWithStoreId(storeId);
    };

    const fetchSalesWithStoreId = async (currentStoreId: string) => {
        if (!currentStoreId) return;

        const today = format(new Date(), 'yyyy-MM-dd');

        const { data, error } = await supabase
            .schema("sistemaretiradas")
            .from('sales')
            .select(`
        *,
        colaboradora:profiles!colaboradora_id(name)
      `)
            .eq('store_id', currentStoreId)
            .gte('data_venda', `${today}T00:00:00`)
            .order('data_venda', { ascending: false });

        if (error) {
            console.error('[LojaDashboard] Erro ao carregar vendas:', error);
            toast.error('Erro ao carregar vendas');
        } else {
            setSales(data || []);
        }
    };

    const fetchColaboradoras = async () => {
        if (!storeId) {
            console.warn('[LojaDashboard] ⚠️ storeId não definido, não é possível buscar colaboradoras');
            return;
        }
        return fetchColaboradorasWithStoreId(storeId);
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
            console.log('[LojaDashboard]   Filters: role=COLABORADORA, active=true, store_id=' + currentStoreId);
            
            let { data, error } = await supabase
                .schema("sistemaretiradas")
            .from('profiles')
                .select('id, name, active, store_id, store_default')
            .eq('role', 'COLABORADORA')
            .eq('active', true)
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
                    .select('id, name, active, store_id, store_default, role')
                    .eq('role', 'COLABORADORA')
                    .eq('active', true)
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

        if (!formData.colaboradora_id || !formData.valor || !formData.qtd_pecas) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        if (!storeId) {
            toast.error('Erro: ID da loja não identificado');
            return;
        }

        const { error } = await supabase.from('sales').insert({
            colaboradora_id: formData.colaboradora_id,
            store_id: storeId,
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
            // PRIORIDADE 1: Salvar venda (já salvo acima)
            // IMPORTANTE: Salvar dados da venda ANTES de resetar o form
            const vendaData = {
                colaboradora_id: formData.colaboradora_id,
                valor: formData.valor,
                qtd_pecas: formData.qtd_pecas,
                data_venda: formData.data_venda,
                observacoes: formData.observacoes || null,
            };

            toast.success('Venda lançada com sucesso!');
            setDialogOpen(false);
            resetForm(); // Resetar form após salvar os dados
            
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
                        
                        // Segundo: buscar destinatários WhatsApp do admin da loja
                        console.log('📱 [2/4] Buscando destinatários WhatsApp...');
                        let adminPhones: string[] = [];
                        
                        if (storeAdminId) {
                            console.log('📱 [2/4] Buscando destinatários para o admin:', storeAdminId);
                            
                            const { data: recipientsData, error: recipientsError } = await supabase
                                .schema('sistemaretiradas')
                                .from('whatsapp_recipients')
                                .select('phone')
                                .eq('active', true)
                                .eq('admin_id', storeAdminId);

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
                            console.warn('⚠️ [3/4] Verifique se há registros na tabela whatsapp_recipients para os admins ativos.');
                        }

                        // Enviar mensagem WhatsApp para todos os números em background
                        if (adminPhones.length > 0) {
                            console.log('📱 [4/4] Buscando totais da loja...');
                            
                            // Buscar total do dia (todas as vendas do dia da loja)
                            const hoje = new Date();
                            const hojeStr = format(hoje, 'yyyy-MM-dd');
                            
                            const { data: vendasHoje, error: vendasHojeError } = await supabase
                                .schema('sistemaretiradas')
                                .from('sales')
                                .select('valor')
                                .eq('store_id', storeId)
                                .gte('data_venda', `${hojeStr}T00:00:00`)
                                .lte('data_venda', `${hojeStr}T23:59:59`);
                            
                            let totalDia = 0;
                            if (!vendasHojeError && vendasHoje) {
                                totalDia = vendasHoje.reduce((sum: number, v: any) => sum + parseFloat(v.valor || 0), 0);
                            }
                            
                            // Usar monthlyRealizado do estado (já calculado anteriormente)
                            console.log('📱 [4/4] Total do dia:', totalDia);
                            console.log('📱 [4/4] Total do mês:', monthlyRealizado);
                            
                            console.log('📱 [4/4] Formatando mensagem...');
                            const message = formatVendaMessage({
                                colaboradoraName,
                                valor: parseFloat(vendaData.valor),
                                qtdPecas: parseInt(vendaData.qtd_pecas),
                                storeName: storeNameFromDb || storeName || undefined,
                                dataVenda: vendaData.data_venda,
                                observacoes: vendaData.observacoes || null,
                                totalDia: totalDia,
                                totalMes: monthlyRealizado || undefined,
                            });

                            console.log('📱 [4/4] Mensagem formatada:', message);
                            console.log(`📱 [4/4] Enviando WhatsApp para ${adminPhones.length} destinatário(s)...`);

                            // Enviar para todos os números em paralelo (não bloqueia)
                            Promise.all(
                                adminPhones.map(phone => 
                                    sendWhatsAppMessage({
                                        phone,
                                        message,
                                    }).then(result => {
                                        if (result.success) {
                                            console.log(`✅ WhatsApp enviado com sucesso para ${phone}`);
                                        } else {
                                            console.warn(`⚠️ Falha ao enviar WhatsApp para ${phone}:`, result.error);
                                        }
                                    }).catch(err => {
                                        console.error(`❌ Erro ao enviar WhatsApp para ${phone}:`, err);
                                        // Não mostrar erro ao usuário, apenas log
                                    })
                                )
                            ).then(() => {
                                console.log('📱 Processo de envio de WhatsApp concluído');
                            }).catch(err => {
                                console.error('❌ Erro geral ao enviar WhatsApp:', err);
                            });
                        } else {
                            console.warn('⚠️ Nenhum destinatário WhatsApp ativo encontrado. Mensagem não será enviada.');
                            console.warn('⚠️ Verifique se há destinatários cadastrados na tabela whatsapp_recipients para os admins ativos.');
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
                Promise.all([
                    checkAndCreateMonthlyTrophies(vendaData.colaboradora_id, storeId),
                    checkAndCreateWeeklyTrophies(vendaData.colaboradora_id, storeId, semanaRef)
                ]).catch(err => console.error('Erro ao verificar troféus:', err));
            }
            
            // Atualizar todos os dados automaticamente
            await Promise.all([
                fetchSalesWithStoreId(storeId),
                fetchColaboradorasPerformanceWithStoreId(storeId, storeName || undefined),
                fetchGoalsWithStoreId(storeId),
                fetchRankingTop3WithStoreId(storeId),
                fetchMonthlyRankingWithStoreId(storeId),
                fetch7DayHistoryWithStoreId(storeId),
                fetchMonthlyDataByDayWithStoreId(storeId)
            ]);
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
            
            // Verificar e criar troféus automaticamente
            if (formData.colaboradora_id && storeId) {
                const hoje = new Date();
                const monday = startOfWeek(hoje, { weekStartsOn: 1 });
                const week = getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
                const year = getYear(monday);
                const semanaRef = `${String(week).padStart(2, '0')}${year}`;
                
                // Verificar troféus mensais e semanais em background (não bloquear UI)
                Promise.all([
                    checkAndCreateMonthlyTrophies(formData.colaboradora_id, storeId),
                    checkAndCreateWeeklyTrophies(formData.colaboradora_id, storeId, semanaRef)
                ]).catch(err => console.error('Erro ao verificar troféus:', err));
            }
            
            // Atualizar todos os dados automaticamente
            await Promise.all([
                fetchSalesWithStoreId(storeId!),
                fetchColaboradorasPerformanceWithStoreId(storeId!, storeName || undefined),
                fetchGoalsWithStoreId(storeId!),
                fetchRankingTop3WithStoreId(storeId!),
                fetchMonthlyRankingWithStoreId(storeId!),
                fetch7DayHistoryWithStoreId(storeId!),
                fetchMonthlyDataByDayWithStoreId(storeId!)
            ]);
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
            if (!storeId) {
                toast.error('Erro: ID da loja não identificado');
                return;
            }

            const { error } = await supabase
                .from('collaborator_off_days')
                .insert([{
                    colaboradora_id: selectedColabForOffDay,
                    data_folga: offDayDate,
                    store_id: storeId
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

    // Preço Médio por Peça = Valor Total / Quantidade de Peças
    const precoMedioPeca = formData.valor && formData.qtd_pecas
        ? (parseFloat(formData.valor) / parseInt(formData.qtd_pecas)).toFixed(2)
        : "0,00";

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
                <div className="mb-6 flex justify-center">
                    <img src="/elevea.png" alt="EleveaOne" className="h-16 w-auto animate-pulse max-w-[200px]" />
                </div>
                <p className="text-muted-foreground">Carregando...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StoreLogo storeId={storeId || profile?.store_id} className="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{storeName || profile?.name || "Loja"}</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Gestão de Vendas</p>
                </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
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
                                    💡 Preço Médio por Peça: <span className="text-primary">R$ {precoMedioPeca}</span>
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
                    <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="border-primary/20 hover:bg-primary/10 text-xs sm:text-sm flex-1 sm:flex-initial"
                        size="sm"
                    >
                        <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Sair
                    </Button>
                </div>
            </div>

            {/* KPI Cards - Metas e Métricas */}
            {/* Primeiros 3 Cards Centralizados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mb-4 sm:mb-6">
                {/* Meta Mensal */}
                <Card className="flex flex-col h-full">
                    <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                        <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Meta Mensal</CardTitle>
                        </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                        {goals ? (
                            <div className="space-y-3 w-full">
                                <p className="text-xl sm:text-3xl font-bold text-primary">R$ {goals.meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    Realizado: R$ {monthlyRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            <div className="space-y-2">
                                    <div className="flex items-center gap-3 justify-between">
                                        <Progress value={Math.min(monthlyProgress, 100)} className="h-3 flex-1" />
                                        <span className="text-sm font-semibold text-primary whitespace-nowrap min-w-[45px] text-right">
                                            {monthlyProgress.toFixed(0)}%
                                        </span>
                                    </div>
                                {goals.super_meta_valor && (
                                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
                                            <span>🏆</span>
                                            <span>Super Meta: R$ {goals.super_meta_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </p>
                                )}
                            </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xl sm:text-2xl font-bold text-muted-foreground">N/A</p>
                                <p className="text-xs sm:text-sm text-destructive">
                                    Meta não encontrada
                                </p>
                            </div>
                        )}
                        </CardContent>
                    </Card>

                {/* Meta Diária */}
                <Card className="flex flex-col h-full">
                    <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                        <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Meta Diária (Hoje)</CardTitle>
                        </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                        {goals ? (
                            <div className="space-y-3 w-full">
                                <p className="text-xl sm:text-3xl font-bold text-primary">R$ {dailyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <div className="flex items-center gap-3 justify-between">
                                    <Progress value={Math.min(dailyProgress, 100)} className="h-3 flex-1" />
                                    <span className="text-sm font-semibold text-primary whitespace-nowrap min-w-[45px] text-right">
                                        {dailyProgress.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xl sm:text-2xl font-bold text-muted-foreground">N/A</p>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    Aguardando meta mensal
                                </p>
                            </div>
                        )}
                        </CardContent>
                    </Card>

                {/* Faturamento Hoje */}
                <Card className="flex flex-col h-full">
                    <CardHeader className="pb-3 p-4 sm:p-6 text-center border-b">
                        <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Faturamento Hoje</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6 flex-1 flex flex-col items-center justify-center text-center">
                        <div className="space-y-2 w-full">
                            <p className="text-xl sm:text-3xl font-bold text-primary">R$ {sales.reduce((sum, s) => sum + s.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">{sales.length} {sales.length === 1 ? 'venda' : 'vendas'}</p>
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
                                <p className="text-xl sm:text-3xl font-bold text-primary">R$ {sales.length > 0 ? (sales.reduce((sum, s) => sum + s.valor, 0) / sales.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</p>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3 justify-between">
                                        <Progress
                                            value={sales.length > 0 ? Math.min(((sales.reduce((sum, s) => sum + s.valor, 0) / sales.length) / metrics.meta_ticket_medio) * 100, 100) : 0}
                                            className="h-3 flex-1"
                                        />
                                    </div>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        Meta: R$ {metrics.meta_ticket_medio?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                        (sales.reduce((sum, s) => sum + s.valor, 0) / sales.reduce((sum, s) => sum + s.qtd_pecas, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) :
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
                                        Meta: R$ {metrics.meta_preco_medio_peca?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Planejamento do Dia - Cards por Vendedora */}
            {colaboradorasPerformance.length > 0 && (
                <div className="w-full max-w-[1080px] mx-auto">
                    <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-center">Planejamento do Dia</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 justify-items-center">
                        {colaboradorasPerformance.map((perf) => (
                            <Card key={perf.id} className="flex flex-col w-full max-w-[320px] h-[240px]">
                                <CardHeader className="pb-3 p-4 text-center border-b">
                                    <CardTitle className="text-sm font-semibold line-clamp-2 leading-tight min-h-[3rem]">{perf.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-center space-y-2.5">
                                    {/* Meta do Dia */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Meta do Dia</span>
                                            <span className="font-semibold">R$ {perf.metaDiaria > 0 ? perf.metaDiaria.toFixed(2) : '0.00'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Vendido:</span>
                                            <span className="font-bold text-primary">R$ {perf.vendido.toFixed(2)}</span>
                                        </div>
                                        {perf.metaDiaria > 0 && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Falta:</span>
                                                <span className={`font-semibold ${perf.vendido >= perf.metaDiaria ? 'text-green-600' : 'text-orange-600'}`}>
                                                    R$ {Math.max(0, perf.metaDiaria - perf.vendido).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        {/* Progresso */}
                                        <div className="space-y-1 pt-1.5">
                                            <div className="flex items-center gap-2">
                                                <Progress 
                                                    value={Math.min(perf.percentual, 100)} 
                                                    className="h-2.5 flex-1"
                                                />
                                                <span className="text-sm font-semibold whitespace-nowrap min-w-[45px] text-right">
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
                <WeeklyGoalProgress storeId={storeId} showDetails={true} />
            )}

            {/* Bônus Semanal Individual por Colaboradora */}
            {storeId && colaboradoras.length > 0 && (
                <WeeklyBonusProgress storeId={storeId} colaboradoras={colaboradoras.map(c => ({ id: c.id, name: c.name }))} />
            )}

            {/* Galeria de Troféus */}
            {storeId && (
                <TrophiesGallery storeId={storeId} limit={50} />
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
                                            <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[120px]">{perf.name}</TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium">
                                                R$ {perf.vendido.toFixed(2)}
                                                {perf.vendidoMes > 0 && (
                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                        Mês: R$ {perf.vendidoMes.toFixed(2)}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                                                R$ {perf.metaDiaria > 0 ? perf.metaDiaria.toFixed(2) : '0.00'}
                                                {perf.meta > 0 && (
                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                        Mensal: R$ {perf.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm">
                                                {perf.meta > 0 ? (
                                                    <>
                                            <span className={
                                                            perf.percentual >= 120 ? 'text-yellow-600 font-bold' :
                                                                perf.percentual >= 100 ? 'text-green-600 font-bold' :
                                                                    perf.percentual >= 90 ? 'text-yellow-500' :
                                                                        'text-red-600'
                                            }>
                                                {perf.percentual.toFixed(0)}%
                                                {perf.percentual >= 120 && ' 🏆'}
                                            </span>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                                            Mês: {perf.percentualMensal.toFixed(0)}%
                                                        </div>
                                                        {perf.faltaMensal > 0 && (
                                                            <div className="text-[10px] text-orange-600 mt-0.5">
                                                                Falta: R$ {perf.faltaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">Sem meta</span>
                                                )}
                                        </TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">R$ {perf.ticketMedio.toFixed(2)}</TableCell>
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

            {/* Vendas de Hoje */}
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
                                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Valor/Venda</TableHead>
                                    <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sales.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground text-xs sm:text-sm py-6">
                                            Nenhuma venda lançada hoje
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sales.map((sale) => (
                                        <TableRow key={sale.id}>
                                            <TableCell className="text-xs sm:text-sm">{format(new Date(sale.data_venda), 'HH:mm')}</TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium truncate max-w-[100px]">
                                                {sale.colaboradora?.name || 'Colaboradora não encontrada'}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium">R$ {sale.valor.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{sale.qtd_pecas}</TableCell>
                                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">R$ {sale.valor.toFixed(2)}</TableCell>
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

            {/* Ranking Mensal com Pódio (Ouro e Prata) */}
                {rankingMonthly.length > 0 && (
                <Card className="bg-gradient-to-br from-card to-muted/50 border-primary/10 overflow-hidden">
                    <CardHeader className="pb-2 p-3 sm:p-6 bg-gradient-to-r from-primary/5 to-accent/5">
                        <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                            <Award className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                            <span>Pódio Mensal</span>
                            </CardTitle>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Ranking acumulado do mês - Top 2</p>
                        </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        <div className="space-y-3 sm:space-y-4">
                            {rankingMonthly.slice(0, 2).map((item, index) => {
                                const perf = colaboradorasPerformance.find(p => p.id === item.colaboradora_id);
                                const isOuro = index === 0;
                                const isPrata = index === 1;
                                
                                return (
                                    <div 
                                        key={item.colaboradora_id} 
                                        className={`
                                            relative flex items-center justify-between p-3 sm:p-4 rounded-lg border-2
                                            ${isOuro 
                                                ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/20 border-yellow-400 shadow-lg shadow-yellow-500/20' 
                                                : isPrata
                                                    ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/20 border-gray-300 shadow-lg shadow-gray-400/20'
                                                    : 'bg-background/50 border-border/50'
                                            }
                                        `}
                                        style={isOuro ? { 
                                            boxShadow: '0 0 20px rgba(234, 179, 8, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1)',
                                            borderColor: 'rgba(234, 179, 8, 0.6)'
                                        } : isPrata ? {
                                            boxShadow: '0 0 20px rgba(156, 163, 175, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1)',
                                            borderColor: 'rgba(156, 163, 175, 0.6)'
                                        } : {}}
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                            <div className={`
                                                w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0
                                                ${isOuro 
                                                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-950 shadow-lg' 
                                                    : isPrata
                                                        ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900 shadow-lg'
                                                        : 'bg-amber-700 text-amber-100'
                                                }
                                            `}>
                                                {isOuro ? '🥇' : isPrata ? '🥈' : index + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="font-bold text-sm sm:text-base truncate block">{item.name}</span>
                                                {perf && (
                                                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                                        <div className="flex gap-2">
                                                            <span>Ticket: R$ {perf.ticketMedio.toFixed(2)}</span>
                                                            <span>PA: {(perf.qtdPecas / Math.max(perf.qtdVendasMes, 1)).toFixed(1)}</span>
                                        </div>
                                                        <div>Vendas: {item.qtdVendas}</div>
                                        </div>
                                                )}
                                    </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className={`font-bold text-lg sm:text-xl ${isOuro ? 'text-yellow-700' : isPrata ? 'text-gray-700' : 'text-primary'}`}>
                                                R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                            {perf && perf.percentualMensal > 0 && (
                                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                                    {perf.percentualMensal.toFixed(0)}% da meta
                                                </p>
                                            )}
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
                                                R$ {day.ticketMedio ? day.ticketMedio.toFixed(2) : (day.qtdVendas > 0 ? (day.total / day.qtdVendas).toFixed(2) : '0.00')}
                                            </TableCell>
                                            <TableCell className="text-xs sm:text-sm font-medium">R$ {day.total.toFixed(2)}</TableCell>
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
                        <CardTitle className="text-base sm:text-lg">Performance Mensal por Dia</CardTitle>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Vendas diárias de cada colaboradora no mês atual</p>
                </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                        {monthlyDataByDay.length > 0 ? (
                            <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                            <TableHead className="text-xs sm:text-sm sticky left-0 bg-background z-10 font-bold min-w-[140px]">Vendedora</TableHead>
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
                                            <TableHead className="text-xs sm:text-sm sticky right-0 bg-background z-10 font-bold text-primary min-w-[120px]">Total</TableHead>
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
                                                        <TableCell className="text-xs sm:text-sm font-medium sticky left-0 bg-background z-10 min-w-[140px]">
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
                                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100' 
                                                                            : dayData.valor > 0 
                                                                                ? 'text-foreground' 
                                                                                : 'text-muted-foreground'
                                                                        }
                                                                    `}
                                                                    title={dayData.metaDiaria > 0 ? `Meta: R$ ${dayData.metaDiaria.toFixed(2)}` : ''}
                                                                >
                                                                    {dayData.valor > 0 ? (
                                                                        <span className="font-semibold">
                                                                            R$ {dayData.valor.toFixed(0)}
                                                                            {bateuMeta && ' ✓'}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">-</span>
                                                                    )}
                                                                </TableCell>
                                                            );
                                                        })}
                                                        <TableCell className="text-xs sm:text-sm font-bold text-primary sticky right-0 bg-background z-10 min-w-[120px] text-right">
                                                            R$ {data.totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                                );
                                            })}
                                            {/* Linha de Total da Loja */}
                                            <TableRow className="bg-primary/5 font-bold border-t-2 border-primary">
                                                <TableCell className="text-xs sm:text-sm font-bold sticky left-0 bg-primary/5 z-10 min-w-[140px]">
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
                                                                `R$ ${totalPorDia[dayStr].toFixed(0)}`
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                    ));
                                                })()}
                                                <TableCell className="text-xs sm:text-sm font-bold text-primary sticky right-0 bg-primary/5 z-10 min-w-[120px] text-right">
                                                    {/* Usar monthlyRealizado que já inclui vendas de colaboradoras desativadas até a data de desativação */}
                                                    R$ {monthlyRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
    );
}
