import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Gift, TrendingUp, Users, AlertCircle, Medal, Trophy } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getWeek, getYear, addWeeks } from "date-fns";
import { validateBonusPreRequisitos } from "@/lib/bonusValidation";
import { formatBRL } from "@/lib/utils";

interface BonusData {
    id: string;
    nome: string;
    tipo: string;
    valor_bonus: number;
    valor_bonus_texto: string | null;
    valor_bonus_1?: number | null;
    valor_bonus_2?: number | null;
    valor_bonus_3?: number | null;
    valor_bonus_texto_1?: string | null;
    valor_bonus_texto_2?: string | null;
    valor_bonus_texto_3?: string | null;
    tipo_condicao: string | null;
    meta_minima_percentual: number | null;
    ativo: boolean;
    store_id: string | null;
    periodo_data_inicio?: string | null;
    periodo_data_fim?: string | null;
    created_at?: string;
    collaborators: {
        id: string;
        name: string;
        progress: number;
        achieved: boolean;
        preRequisitosValidos?: boolean;
        preRequisitosReason?: string;
        rankingValue?: number;
        ticketMedio?: number;
        pa?: number;
        qtdPecas?: number;
    }[];
}

export function BonusTracker() {
    const [bonuses, setBonuses] = useState<BonusData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActiveBonuses();
        const interval = setInterval(fetchActiveBonuses, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchActiveBonuses = async () => {
        try {
            // 1. Buscar bônus ativos
            const { data: bonusesData, error: bonusesError } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .select("*")
                .eq("ativo", true)
                .order("created_at", { ascending: false });

            if (bonusesError) throw bonusesError;

            if (!bonusesData || bonusesData.length === 0) {
                setBonuses([]);
                setLoading(false);
                return;
            }

            // Filtrar bônus de gincana semanal - não devem aparecer aqui, apenas na seção de Gincana Semanal
            const bonusesFiltrados = bonusesData.filter((bonus: any) => {
                const condicaoMetaTipo = bonus.condicao_meta_tipo;
                return condicaoMetaTipo !== "GINCANA_SEMANAL" && condicaoMetaTipo !== "SUPER_GINCANA_SEMANAL";
            });

            if (bonusesFiltrados.length === 0) {
                setBonuses([]);
                setLoading(false);
                return;
            }

            // 2. Para cada bônus, buscar colaboradoras vinculadas e calcular progresso
            const bonusesWithProgress = await Promise.all(
                bonusesFiltrados.map(async (bonus) => {
                    // Buscar colaboradoras vinculadas
                    const { data: colabData } = await supabase
                        .schema("sistemaretiradas")
                        .from("bonus_collaborators")
                        .select(`
              colaboradora_id,
              profiles!inner(id, name, store_id)
            `)
                        .eq("bonus_id", bonus.id)
                        .eq("active", true);

                    if (!colabData || colabData.length === 0) {
                        return {
                            ...bonus,
                            collaborators: [],
                        };
                    }

                    // ✅ Determinar período do bônus (data de lançamento até data de encerramento)
                    // PRIORIDADE: periodo_data_inicio/periodo_data_fim > periodo_mes > periodo_semana > created_at > mês atual
                    let dataInicio: string;
                    let dataFim: string;
                    
                    if (bonus.periodo_data_inicio) {
                        // ✅ PRIORIDADE 1: Usar data de início exata do bônus
                        dataInicio = bonus.periodo_data_inicio;
                    } else if ((bonus as any).periodo_mes) {
                        // ✅ PRIORIDADE 2: Converter periodo_mes (YYYYMM) para início do mês
                        const periodoMes = (bonus as any).periodo_mes;
                        const ano = periodoMes.slice(0, 4);
                        const mes = periodoMes.slice(4, 6);
                        const primeiroDiaMes = new Date(parseInt(ano), parseInt(mes) - 1, 1);
                        dataInicio = format(startOfMonth(primeiroDiaMes), "yyyy-MM-dd");
                    } else if ((bonus as any).periodo_semana) {
                        // ✅ PRIORIDADE 3: Converter periodo_semana (WWYYYY) para início da semana
                        const periodoSemana = (bonus as any).periodo_semana;
                        try {
                            // Formato: WWYYYY
                            const semana = parseInt(periodoSemana.slice(0, 2));
                            const ano = parseInt(periodoSemana.slice(2, 6));
                            const jan1 = new Date(ano, 0, 1);
                            const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
                            const weekStart = addWeeks(firstMonday, semana - 1);
                            dataInicio = format(weekStart, "yyyy-MM-dd");
                        } catch (error) {
                            console.error(`[BonusTracker] Erro ao converter periodo_semana: ${periodoSemana}`, error);
                            // Fallback
                            if (bonus.created_at) {
                                const createdDate = new Date(bonus.created_at);
                                dataInicio = format(createdDate, "yyyy-MM-dd");
                            } else {
                                const mesAtual = format(new Date(), "yyyyMM");
                                dataInicio = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
                            }
                        }
                    } else if (bonus.created_at) {
                        // ✅ PRIORIDADE 4: Fallback: usar created_at como data de início
                        const createdDate = new Date(bonus.created_at);
                        dataInicio = format(createdDate, "yyyy-MM-dd");
                    } else {
                        // ✅ PRIORIDADE 5: Fallback: início do mês atual
                        const mesAtual = format(new Date(), "yyyyMM");
                        dataInicio = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01`;
                    }
                    
                    if (bonus.periodo_data_fim) {
                        // ✅ PRIORIDADE 1: Usar data de fim exata do bônus
                        dataFim = bonus.periodo_data_fim;
                    } else if ((bonus as any).periodo_mes) {
                        // ✅ PRIORIDADE 2: Converter periodo_mes (YYYYMM) para fim do mês
                        const periodoMes = (bonus as any).periodo_mes;
                        const ano = parseInt(periodoMes.slice(0, 4));
                        const mes = parseInt(periodoMes.slice(4, 6));
                        const primeiroDiaMes = new Date(ano, mes - 1, 1);
                        const ultimoDiaMes = endOfMonth(primeiroDiaMes);
                        dataFim = format(ultimoDiaMes, "yyyy-MM-dd");
                    } else if ((bonus as any).periodo_semana) {
                        // ✅ PRIORIDADE 3: Converter periodo_semana (WWYYYY) para fim da semana
                        const periodoSemana = (bonus as any).periodo_semana;
                        try {
                            // Formato: WWYYYY
                            const semana = parseInt(periodoSemana.slice(0, 2));
                            const ano = parseInt(periodoSemana.slice(2, 6));
                            const jan1 = new Date(ano, 0, 1);
                            const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
                            const weekStart = addWeeks(firstMonday, semana - 1);
                            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                            dataFim = format(weekEnd, "yyyy-MM-dd");
                        } catch (error) {
                            console.error(`[BonusTracker] Erro ao converter periodo_semana: ${periodoSemana}`, error);
                            // Fallback: data atual
                            dataFim = format(new Date(), "yyyy-MM-dd");
                        }
                    } else {
                        // ✅ PRIORIDADE 4: Se não tiver data de fim, usar data atual (bônus ainda ativo)
                        dataFim = format(new Date(), "yyyy-MM-dd");
                    }
                    
                    // Garantir que dataFim seja até o final do dia
                    const dataFimCompleta = `${dataFim}T23:59:59`;
                    const dataInicioCompleta = `${dataInicio}T00:00:00`;
                    
                    console.log(`[BonusTracker] 📅 Período do bônus "${bonus.nome}": ${dataInicio} até ${dataFim}`);
                    console.log(`[BonusTracker] 📅 periodo_data_inicio: ${bonus.periodo_data_inicio}, periodo_data_fim: ${bonus.periodo_data_fim}`);
                    console.log(`[BonusTracker] 📅 periodo_mes: ${(bonus as any).periodo_mes}, periodo_semana: ${(bonus as any).periodo_semana}`);

                    const collaboratorsWithProgress = await Promise.all(
                        colabData.map(async (colab: any) => {
                            const colabId = colab.colaboradora_id;
                            const colabName = colab.profiles.name;

                            // Buscar meta individual (para cálculo de progresso de faturamento)
                            const mesAtual = format(new Date(), "yyyyMM");
                            const { data: metaData } = await supabase
                                .schema("sistemaretiradas")
                                .from("goals")
                                .select("meta_valor")
                                .eq("colaboradora_id", colabId)
                                .eq("mes_referencia", mesAtual)
                                .eq("tipo", "INDIVIDUAL")
                                .maybeSingle();

                            // ✅ Buscar vendas do PERÍODO DO BÔNUS (não do mês inteiro)
                            // Isso garante que o cálculo seja baseado apenas nas vendas durante o período do bônus
                            const { data: salesData } = await supabase
                                .schema("sistemaretiradas")
                                .from("sales")
                                .select("valor, qtd_pecas, data_venda")
                                .eq("colaboradora_id", colabId)
                                .gte("data_venda", dataInicioCompleta)
                                .lte("data_venda", dataFimCompleta);

                            const totalVendido = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
                            const qtdVendas = salesData?.length || 0;
                            const qtdPecas = salesData?.reduce((sum, sale) => sum + Number(sale.qtd_pecas || 0), 0) || 0;
                            const ticketMedio = qtdVendas > 0 ? totalVendido / qtdVendas : 0;
                            const pa = qtdVendas > 0 ? qtdPecas / qtdVendas : 0;
                            
                            // Debug: log dos cálculos com período
                            if (bonus.tipo_condicao && (bonus.tipo_condicao.toUpperCase().includes("TICKET") || bonus.tipo_condicao.toUpperCase().includes("PA") || bonus.tipo_condicao.toUpperCase().includes("PECAS"))) {
                                console.log(`[BonusTracker] 📊 Cálculo para ${colabName} (período: ${dataInicio} até ${dataFim}):`);
                                console.log(`[BonusTracker]   - Vendas encontradas: ${qtdVendas}`);
                                console.log(`[BonusTracker]   - Total vendido: R$ ${totalVendido.toFixed(2)}`);
                                console.log(`[BonusTracker]   - Ticket médio: R$ ${ticketMedio.toFixed(2)}`);
                                console.log(`[BonusTracker]   - PA: ${pa.toFixed(2)} peças/venda`);
                                console.log(`[BonusTracker]   - Total peças: ${qtdPecas}`);
                            }
                            
                            // ✅ IMPORTANTE: Se for bônus de gincana semanal, buscar meta da gincana (tipo SEMANAL)
                            // Caso contrário, usar meta mensal individual (obrigatória)
                            let metaValor = metaData?.meta_valor || 0;
                            
                            if ((bonus as any).condicao_meta_tipo === "GINCANA_SEMANAL" || (bonus as any).condicao_meta_tipo === "SUPER_GINCANA_SEMANAL") {
                                // Buscar meta da gincana semanal
                                const periodoSemana = (bonus as any).periodo_semana;
                                if (periodoSemana) {
                                    const { data: gincanaMeta } = await supabase
                                        .schema("sistemaretiradas")
                                        .from("goals")
                                        .select((bonus as any).condicao_meta_tipo === "SUPER_GINCANA_SEMANAL" ? "super_meta_valor" : "meta_valor")
                                        .eq("colaboradora_id", colabId)
                                        .eq("store_id", colab.profiles?.store_id)
                                        .eq("semana_referencia", periodoSemana)
                                        .eq("tipo", "SEMANAL")
                                        .maybeSingle();
                                    
                                    if (gincanaMeta) {
                                        metaValor = (bonus as any).condicao_meta_tipo === "SUPER_GINCANA_SEMANAL" 
                                            ? parseFloat(gincanaMeta.super_meta_valor || 0)
                                            : parseFloat(gincanaMeta.meta_valor || 0);
                                    }
                                }
                            }
                            
                            const progress = metaValor > 0 ? (totalVendido / metaValor) * 100 : 0;

                            // Verificar se atingiu a condição do bônus
                            let achieved = false;
                            if (bonus.tipo_condicao === "PERCENTUAL_META" && bonus.meta_minima_percentual) {
                                achieved = progress >= bonus.meta_minima_percentual;
                            } else if ((bonus as any).condicao_tipo === "META" && bonus.meta_minima_percentual) {
                                // Para bônus com condicao_tipo = "META" (incluindo gincanas semanais)
                                achieved = progress >= bonus.meta_minima_percentual;
                            }

                            // IMPORTANTE: Validar pré-requisitos antes de conceder o bônus
                            let preRequisitosValidos = true;
                            let preRequisitosReason = "";
                            
                            if (achieved && (bonus as any).pre_requisitos) {
                                const preReqValidation = await validateBonusPreRequisitos(
                                    (bonus as any).pre_requisitos,
                                    bonus.id,
                                    colabId,
                                    colab.profiles?.store_id
                                );
                                
                                preRequisitosValidos = preReqValidation.isValid;
                                preRequisitosReason = preReqValidation.reason || "";
                                
                                // Se os pré-requisitos não foram cumpridos, o bônus não é válido
                                if (!preRequisitosValidos) {
                                    achieved = false;
                                }
                            }

                            // ✅ Calcular valor de ranking baseado no tipo_condicao
                            // IMPORTANTE: Esta lógica garante que TODOS os rankings futuros ordenem pelo indicador correto
                            // Se o bônus for baseado em um indicador específico, ordena por esse indicador
                            // Caso contrário, ordena por progresso de faturamento (padrão)
                            let rankingValue = progress; // Padrão: progresso de faturamento (% da meta)
                            
                            // Normalizar tipo_condicao para comparação (case-insensitive)
                            const tipoCondicao = (bonus.tipo_condicao || "").toUpperCase().trim();
                            
                            // Ordenar por indicador específico quando o tipo_condicao corresponder
                            if (tipoCondicao === "TICKET_MEDIO" || tipoCondicao === "TICKET MÉDIO") {
                                rankingValue = ticketMedio; // Ordenar por ticket médio (R$)
                            } else if (tipoCondicao === "PA") {
                                rankingValue = pa; // Ordenar por PA (Peças por Atendimento)
                            } else if (tipoCondicao === "NUMERO_PECAS" || tipoCondicao === "NUMERO DE PEÇAS") {
                                rankingValue = qtdPecas; // Ordenar por número total de peças vendidas
                            }
                            // Para outros tipos (PERCENTUAL_META, RANKING, etc.), usa progress (faturamento) como padrão

                            return {
                                id: colabId,
                                name: colabName,
                                progress: Math.min(progress, 100),
                                achieved,
                                preRequisitosValidos,
                                preRequisitosReason: preRequisitosReason || undefined,
                                rankingValue, // Valor usado para ordenação
                                ticketMedio,
                                pa,
                                qtdPecas,
                            };
                        })
                    );

                    return {
                        ...bonus,
                        collaborators: collaboratorsWithProgress,
                    };
                })
            );

            setBonuses(bonusesWithProgress);
        } catch (error) {
            console.error("Error fetching bonuses:", error);
        } finally {
            setLoading(false);
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 95) return "bg-primary";
        if (progress >= 80) return "bg-primary/70";
        return "bg-primary/50";
    };

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5" />
                        Bônus Ativos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (bonuses.length === 0) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5" />
                        Bônus Ativos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum bônus ativo no momento
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-1 bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Gift className="h-5 w-5 text-primary" />
                    Bônus Ativos
                    <Badge variant="secondary" className="ml-auto">
                        {bonuses.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {bonuses.map((bonus) => (
                    <div key={bonus.id} className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm break-words">{bonus.nome}</h4>
                                {/* Verificar se há prêmios por posição */}
                                {(() => {
                                    const bonusData = bonus as any;
                                    const temPremioPorPosicao = 
                                        (bonusData.valor_bonus_1 && bonusData.valor_bonus_1 > 0) ||
                                        (bonusData.valor_bonus_2 && bonusData.valor_bonus_2 > 0) ||
                                        (bonusData.valor_bonus_3 && bonusData.valor_bonus_3 > 0) ||
                                        (bonusData.valor_bonus_texto_1 && bonusData.valor_bonus_texto_1.trim() !== '') ||
                                        (bonusData.valor_bonus_texto_2 && bonusData.valor_bonus_texto_2.trim() !== '') ||
                                        (bonusData.valor_bonus_texto_3 && bonusData.valor_bonus_texto_3.trim() !== '');
                                    
                                    // Se tem prêmio por posição mas não tem prêmio geral, não mostrar nada
                                    if (temPremioPorPosicao && (!bonus.valor_bonus || bonus.valor_bonus === 0) && (!bonus.valor_bonus_texto || bonus.valor_bonus_texto.trim() === '')) {
                                        return null;
                                    }
                                    
                                    // Mostrar prêmio geral apenas se houver um valor definido (não zero, não null, não undefined)
                                    if ((bonus.valor_bonus_texto && typeof bonus.valor_bonus_texto === 'string' && bonus.valor_bonus_texto.trim() !== '') || 
                                        (bonus.valor_bonus && typeof bonus.valor_bonus === 'number' && !isNaN(bonus.valor_bonus) && bonus.valor_bonus > 0)) {
                                        return (
                                            <p className="text-xs text-muted-foreground">
                                                {bonus.valor_bonus_texto && bonus.valor_bonus_texto.trim() !== '' 
                                                    ? bonus.valor_bonus_texto 
                                                    : (bonus.valor_bonus && bonus.valor_bonus > 0 ? formatBRL(bonus.valor_bonus) : '')}
                                            </p>
                                        );
                                    }
                                    
                                    return null;
                                })()}
                            </div>
                            <Badge variant={bonus.collaborators.some((c) => c.achieved) ? "default" : "outline"} className="text-xs">
                                {bonus.tipo_condicao === "PERCENTUAL_META" && bonus.meta_minima_percentual
                                    ? `${bonus.meta_minima_percentual}% meta`
                                    : "Ativo"}
                            </Badge>
                        </div>

                        {bonus.collaborators.length > 0 ? (
                            <div className="space-y-2 mt-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    <span>{bonus.collaborators.length} colaboradoras</span>
                                </div>
                                <div className="space-y-2">
                                    {(() => {
                                        // Ordenar colaboradoras por rankingValue
                                        const sorted = [...bonus.collaborators].sort((a, b) => {
                                            const aValue = (a as any).rankingValue !== undefined ? (a as any).rankingValue : a.progress;
                                            const bValue = (b as any).rankingValue !== undefined ? (b as any).rankingValue : b.progress;
                                            return bValue - aValue; // Ordem decrescente (maior valor primeiro)
                                        });

                                        // Pegar o maior valor para calcular progresso relativo
                                        const maxValue = sorted.length > 0 
                                            ? ((sorted[0] as any).rankingValue !== undefined ? (sorted[0] as any).rankingValue : sorted[0].progress)
                                            : 100;

                                        // Verificar se é um indicador (não faturamento/meta)
                                        const tipoCondicao = (bonus.tipo_condicao || "").toUpperCase().trim();
                                        const nomeBonusUpper = (bonus.nome || "").toUpperCase();
                                        const nomeContemTicketMedio = nomeBonusUpper.includes("TICKET") && (nomeBonusUpper.includes("MÉDIO") || nomeBonusUpper.includes("MEDIO"));
                                        
                                        // isIndicador: ticket médio, PA, número de peças (verificar também pelo nome do bônus)
                                        const isIndicador = tipoCondicao === "TICKET_MEDIO" || 
                                                          tipoCondicao === "TICKET MÉDIO" || 
                                                          tipoCondicao === "PA" || 
                                                          tipoCondicao === "NUMERO_PECAS" || 
                                                          tipoCondicao === "NUMERO DE PEÇAS" ||
                                                          nomeContemTicketMedio ||
                                                          nomeBonusUpper.includes("PA") ||
                                                          nomeBonusUpper.includes("PEÇAS");
                                        
                                        // Debug: verificar tipo_condicao do bônus
                                        console.log(`[BonusTracker] 🔍 Bonus: "${bonus.nome}", tipo_condicao original: "${bonus.tipo_condicao}", normalizado: "${tipoCondicao}", isIndicador: ${isIndicador}`);
                                        
                                        return sorted.map((colab, index) => {
                                            const position = index + 1;
                                            const rankingValue = (colab as any).rankingValue !== undefined ? (colab as any).rankingValue : colab.progress;
                                            const colabData = colab as any;
                                            
                                            // Calcular progresso relativo ao primeiro colocado (apenas para faturamento/meta)
                                            const relativeProgress = maxValue > 0 ? (rankingValue / maxValue) * 100 : 0;

                                            // Ícone de medalha baseado na posição
                                            const getMedalIcon = () => {
                                                if (position === 1) return <Trophy className="h-5 w-5 text-primary" />;
                                                if (position === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
                                                if (position === 3) return <Medal className="h-5 w-5 text-primary/70" />;
                                                return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{position}</span>;
                                            };

                                            // Valor formatado baseado no tipo_condicao
                                            const getFormattedValue = () => {
                                                // IMPORTANTE: Para indicadores, usar os valores DIRETOS do objeto colabData
                                                // NÃO usar rankingValue porque ele pode estar incorreto se tipo_condicao não foi reconhecido
                                                
                                                // Verificar se contém "TICKET" (mais flexível)
                                                const tipoUpper = tipoCondicao.replace(/[_\s-]/g, ""); // Remove underscores, espaços e hífens
                                                const isTicketMedio = tipoUpper.includes("TICKET") && (tipoUpper.includes("MEDIO") || tipoUpper.includes("MÉDIO"));
                                                
                                                // FALLBACK: Verificar pelo nome do bônus também (caso tipo_condicao esteja incorreto no banco)
                                                const nomeBonusUpper = (bonus.nome || "").toUpperCase();
                                                const nomeContemTicketMedio = nomeBonusUpper.includes("TICKET") && (nomeBonusUpper.includes("MÉDIO") || nomeBonusUpper.includes("MEDIO"));
                                                
                                                if (isTicketMedio || tipoCondicao === "TICKET_MEDIO" || tipoCondicao === "TICKET MÉDIO" || tipoCondicao.includes("TICKET") || nomeContemTicketMedio) {
                                                    // Usar ticketMedio diretamente do objeto colabData
                                                    const ticketMedio = colabData.ticketMedio || 0;
                                                    console.log(`[BonusTracker] 🎯 TICKET_MEDIO DETECTADO - Bonus: "${bonus.nome}", Colab: ${colab.name}, ticketMedio: ${ticketMedio}, tipoCondicao: "${tipoCondicao}"`);
                                                    return formatBRL(ticketMedio);
                                                } else if (tipoCondicao === "PA" || tipoUpper.includes("PA")) {
                                                    // Usar pa diretamente do objeto colabData
                                                    const pa = colabData.pa || 0;
                                                    return `${pa.toFixed(1)} peças/venda`;
                                                } else if (tipoCondicao === "NUMERO_PECAS" || tipoCondicao === "NUMERO DE PEÇAS" || tipoUpper.includes("NUMEROPECAS")) {
                                                    // Usar qtdPecas diretamente do objeto colabData
                                                    const qtdPecas = colabData.qtdPecas || 0;
                                                    return `${Math.round(qtdPecas)} peças`;
                                                } else {
                                                    // Para faturamento/meta, mostrar porcentagem
                                                    console.log(`[BonusTracker] ⚠️ Tipo não é indicador - Bonus: "${bonus.nome}", tipoCondicao: "${tipoCondicao}", usando progress: ${colab.progress.toFixed(0)}%`);
                                                    console.log(`[BonusTracker] ⚠️ ColabData disponível: ticketMedio=${colabData.ticketMedio}, pa=${colabData.pa}, qtdPecas=${colabData.qtdPecas}`);
                                                    return `${colab.progress.toFixed(0)}%`;
                                                }
                                            };

                                            // Obter prêmio baseado na posição
                                            const getPremio = () => {
                                                const bonusData = bonus as any;
                                                
                                                // Priorizar prêmio por posição (valor_bonus_1, valor_bonus_2, valor_bonus_3)
                                                if (position === 1) {
                                                    if (bonusData.valor_bonus_texto_1) {
                                                        return bonusData.valor_bonus_texto_1;
                                                    } else if (bonusData.valor_bonus_1) {
                                                        return formatBRL(bonusData.valor_bonus_1);
                                                    }
                                                } else if (position === 2) {
                                                    if (bonusData.valor_bonus_texto_2) {
                                                        return bonusData.valor_bonus_texto_2;
                                                    } else if (bonusData.valor_bonus_2) {
                                                        return formatBRL(bonusData.valor_bonus_2);
                                                    }
                                                } else if (position === 3) {
                                                    if (bonusData.valor_bonus_texto_3) {
                                                        return bonusData.valor_bonus_texto_3;
                                                    } else if (bonusData.valor_bonus_3) {
                                                        return formatBRL(bonusData.valor_bonus_3);
                                                    }
                                                }
                                                
                                                // Fallback: usar prêmio geral se não houver prêmio específico por posição
                                                if (bonus.valor_bonus_texto) {
                                                    return bonus.valor_bonus_texto;
                                                } else if (bonus.valor_bonus && bonus.valor_bonus > 0) {
                                                    return formatBRL(bonus.valor_bonus);
                                                }
                                                
                                                return null;
                                            };

                                            return (
                                                <div key={colab.id} className={`p-3 rounded-lg border border-border/50 ${
                                                    isIndicador 
                                                        ? "bg-gradient-to-r from-muted/50 to-muted/30" 
                                                        : "bg-muted/30"
                                                }`}>
                                                    <div className="flex items-center gap-3">
                                                        {/* Medalha/Posição */}
                                                        <div className="flex-shrink-0">
                                                            {getMedalIcon()}
                                                        </div>
                                                        {/* Nome */}
                                                        <span className="break-words flex-1 min-w-0 text-sm font-medium">{colab.name}</span>
                                                        {/* Valor do indicador ou progresso */}
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className={`font-bold text-base ${
                                                                colab.achieved ? "text-status-ahead" : 
                                                                position === 1 ? "text-primary" : 
                                                                position === 2 ? "text-muted-foreground" :
                                                                position === 3 ? "text-primary/70" :
                                                                ""
                                                            }`}>
                                                                {getFormattedValue()}
                                                            </span>
                                                            {/* Prêmio */}
                                                            {getPremio() && (
                                                                <span className="text-xs font-semibold text-primary">
                                                                    🎁 {getPremio()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Barra de progresso APENAS para faturamento/meta (não para indicadores) */}
                                                    {/* REMOVIDO: Para indicadores (ticket médio, PA, peças), não faz sentido mostrar barra de progresso */}
                                                    {/* Indicadores são números absolutos, não progresso em relação a uma meta */}
                                                    {!isIndicador && (
                                                        <div className="mt-2">
                                                            <Progress 
                                                                value={colab.progress} 
                                                                className={`h-2 ${getProgressColor(colab.progress)}`} 
                                                            />
                                                        </div>
                                                    )}
                                                    
                                                    {colab.progress >= (bonus.meta_minima_percentual || 0) && !colab.achieved && colab.preRequisitosReason && (
                                                        <div className="flex items-center gap-1 text-[10px] text-status-ontrack mt-2">
                                                            <AlertCircle className="h-3 w-3" />
                                                            <span className="break-words">{colab.preRequisitosReason}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                                Nenhuma colaboradora vinculada
                            </p>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
