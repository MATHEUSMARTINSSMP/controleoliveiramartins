import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Trophy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface BonusHistoryData {
    id: string;
    nome: string;
    tipo: string;
    valor_bonus: number;
    valor_bonus_texto: string | null;
    created_at: string;
    ativo: boolean;
    winners: {
        id: string;
        name: string;
        achieved_at: string;
    }[];
}

export function BonusHistory() {
    const [bonusHistory, setBonusHistory] = useState<BonusHistoryData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBonusHistory();
    }, []);

    const fetchBonusHistory = async () => {
        try {
            // Buscar todos os bônus (ativos e inativos)
            const { data: bonusesData, error: bonusesError } = await supabase
                .from("bonuses")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(20);

            if (bonusesError) throw bonusesError;

            if (!bonusesData || bonusesData.length === 0) {
                setBonusHistory([]);
                setLoading(false);
                return;
            }

            // Para cada bônus, buscar quem conquistou
            const bonusesWithWinners = await Promise.all(
                bonusesData.map(async (bonus) => {
                    // Buscar colaboradoras que atingiram o bônus
                    // Aqui seria ideal ter uma tabela de "bonus_achievements" para registrar quando alguém conquistou
                    // Por enquanto, vamos buscar as colaboradoras vinculadas
                    const { data: colabData } = await supabase
                        .from("bonus_collaborators")
                        .select(`
              colaboradora_id,
              created_at,
              profiles!inner(id, name)
            `)
                        .eq("bonus_id", bonus.id)
                        .eq("active", true);

                    const winners = colabData?.map((c: any) => ({
                        id: c.colaboradora_id,
                        name: c.profiles.name,
                        achieved_at: c.created_at,
                    })) || [];

                    return {
                        ...bonus,
                        winners,
                    };
                })
            );

            setBonusHistory(bonusesWithWinners);
        } catch (error) {
            console.error("Error fetching bonus history:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5" />
                        Histórico de Bônus
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

    return (
        <Card className="bg-gradient-to-br from-card to-card/50 border-primary/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Gift className="h-5 w-5 text-primary" />
                    Histórico de Bônus e Gincanas
                    <Badge variant="secondary" className="ml-auto">
                        {bonusHistory.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {bonusHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum bônus registrado
                    </p>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {bonusHistory.map((bonus) => (
                            <div
                                key={bonus.id}
                                className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-sm truncate">{bonus.nome}</h4>
                                            <Badge variant={bonus.ativo ? "default" : "outline"} className="text-xs">
                                                {bonus.ativo ? "Ativo" : "Encerrado"}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {bonus.valor_bonus_texto || `R$ ${bonus.valor_bonus.toFixed(2)}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Criado em {format(new Date(bonus.created_at), "dd/MM/yyyy")}
                                        </p>
                                    </div>
                                </div>

                                {bonus.winners.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Trophy className="h-3 w-3" />
                                            <span>Participantes ({bonus.winners.length})</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {bonus.winners.slice(0, 10).map((winner) => (
                                                <Badge key={winner.id} variant="secondary" className="text-xs">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    {winner.name}
                                                </Badge>
                                            ))}
                                            {bonus.winners.length > 10 && (
                                                <Badge variant="outline" className="text-xs">
                                                    +{bonus.winners.length - 10}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
