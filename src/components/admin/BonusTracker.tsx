import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Gift, TrendingUp, Users, AlertCircle, Medal, Trophy } from "lucide-react";
import { format } from "date-fns";
import { validateBonusPreRequisitos } from "@/lib/bonusValidation";

interface BonusData {
    id: string;
    nome: string;
    tipo: string;
    valor_bonus: number;
    valor_bonus_texto: string | null;
    tipo_condicao: string | null;
    meta_minima_percentual: number | null;
    ativo: boolean;
    store_id: string | null;
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

            // 2. Para cada bônus, buscar colaboradoras vinculadas e calcular progresso
            const bonusesWithProgress = await Promise.all(
                bonusesData.map(async (bonus) => {
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

                    // Calcular progresso de cada colaboradora
                    const mesAtual = format(new Date(), "yyyyMM");
                    const hoje = format(new Date(), "yyyy-MM-dd");

                    const collaboratorsWithProgress = await Promise.all(
                        colabData.map(async (colab: any) => {
                            const colabId = colab.colaboradora_id;
                            const colabName = colab.profiles.name;

                            // Buscar meta individual
                            const { data: metaData } = await supabase
                                .schema("sistemaretiradas")
                                .from("goals")
                                .select("meta_valor")
                                .eq("colaboradora_id", colabId)
                                .eq("mes_referencia", mesAtual)
                                .eq("tipo", "INDIVIDUAL")
                                .maybeSingle();

                            // Buscar vendas do mês (com quantidade de peças para calcular ticket médio, PA, etc)
                            const { data: salesData } = await supabase
                                .schema("sistemaretiradas")
                                .from("sales")
                                .select("valor, qtd_pecas")
                                .eq("colaboradora_id", colabId)
                                .gte("data_venda", `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`);

                            const totalVendido = salesData?.reduce((sum, sale) => sum + Number(sale.valor || 0), 0) || 0;
                            const qtdVendas = salesData?.length || 0;
                            const qtdPecas = salesData?.reduce((sum, sale) => sum + Number(sale.qtd_pecas || 0), 0) || 0;
                            const ticketMedio = qtdVendas > 0 ? totalVendido / qtdVendas : 0;
                            const pa = qtdVendas > 0 ? qtdPecas / qtdVendas : 0;
                            
                            const metaValor = metaData?.meta_valor || 0;
                            const progress = metaValor > 0 ? (totalVendido / metaValor) * 100 : 0;

                            // Verificar se atingiu a condição do bônus
                            let achieved = false;
                            if (bonus.tipo_condicao === "PERCENTUAL_META" && bonus.meta_minima_percentual) {
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
                            
                            // Ordenar por indicador específico quando o tipo_condicao corresponder
                            if (bonus.tipo_condicao === "TICKET_MEDIO") {
                                rankingValue = ticketMedio; // Ordenar por ticket médio (R$)
                            } else if (bonus.tipo_condicao === "PA") {
                                rankingValue = pa; // Ordenar por PA (Peças por Atendimento)
                            } else if (bonus.tipo_condicao === "NUMERO_PECAS") {
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
        if (progress >= 95) return "bg-green-500";
        if (progress >= 80) return "bg-yellow-500";
        return "bg-blue-500";
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
                                <p className="text-xs text-muted-foreground">
                                    {bonus.valor_bonus_texto || `R$ ${bonus.valor_bonus.toFixed(2)}`}
                                </p>
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
                                        const isIndicador = tipoCondicao === "TICKET_MEDIO" || 
                                                          tipoCondicao === "TICKET MÉDIO" || 
                                                          tipoCondicao === "PA" || 
                                                          tipoCondicao === "NUMERO_PECAS" || 
                                                          tipoCondicao === "NUMERO DE PEÇAS";
                                        
                                        return sorted.map((colab, index) => {
                                            const position = index + 1;
                                            const rankingValue = (colab as any).rankingValue !== undefined ? (colab as any).rankingValue : colab.progress;
                                            const colabData = colab as any;
                                            
                                            // Calcular progresso relativo ao primeiro colocado (apenas para faturamento/meta)
                                            const relativeProgress = maxValue > 0 ? (rankingValue / maxValue) * 100 : 0;

                                            // Ícone de medalha baseado na posição
                                            const getMedalIcon = () => {
                                                if (position === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
                                                if (position === 2) return <Medal className="h-5 w-5 text-gray-400" />;
                                                if (position === 3) return <Medal className="h-5 w-5 text-amber-600" />;
                                                return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{position}º</span>;
                                            };

                                            // Valor formatado baseado no tipo_condicao
                                            const getFormattedValue = () => {
                                                // Para indicadores, usar rankingValue diretamente
                                                if (tipoCondicao === "TICKET_MEDIO" || tipoCondicao === "TICKET MÉDIO") {
                                                    const ticketMedio = rankingValue > 0 ? rankingValue : (colabData.ticketMedio || 0);
                                                    return `R$ ${ticketMedio.toFixed(2)}`;
                                                } else if (tipoCondicao === "PA") {
                                                    const pa = rankingValue > 0 ? rankingValue : (colabData.pa || 0);
                                                    return `${pa.toFixed(1)} peças/venda`;
                                                } else if (tipoCondicao === "NUMERO_PECAS" || tipoCondicao === "NUMERO DE PEÇAS") {
                                                    const qtdPecas = rankingValue > 0 ? rankingValue : (colabData.qtdPecas || 0);
                                                    return `${Math.round(qtdPecas)} peças`;
                                                } else {
                                                    // Para faturamento/meta, mostrar porcentagem
                                                    return `${colab.progress.toFixed(0)}%`;
                                                }
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
                                                        <span className={`font-bold text-base ${
                                                            colab.achieved ? "text-green-600" : 
                                                            position === 1 ? "text-yellow-600" : 
                                                            position === 2 ? "text-gray-600" :
                                                            position === 3 ? "text-amber-600" :
                                                            ""
                                                        }`}>
                                                            {getFormattedValue()}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Barra de progresso APENAS para faturamento/meta (não para indicadores) */}
                                                    {!isIndicador && (
                                                        <div className="mt-2">
                                                            <Progress 
                                                                value={colab.progress} 
                                                                className={`h-2 ${getProgressColor(colab.progress)}`} 
                                                            />
                                                        </div>
                                                    )}
                                                    
                                                    {colab.progress >= (bonus.meta_minima_percentual || 0) && !colab.achieved && colab.preRequisitosReason && (
                                                        <div className="flex items-center gap-1 text-[10px] text-orange-600 mt-2">
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
