import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface QueueMember {
    id: string;
    profile_id: string;
    profile_name: string;
    position: number;
    status: 'disponivel' | 'em_atendimento' | 'pausado' | 'indisponivel';
}

interface EsperandoAtendimentoProps {
    members: QueueMember[];
    loading: boolean;
    onStartAttendance: (memberId: string) => void;
    onMoveToTop?: (memberId: string) => void;
    onMoveToEnd?: (memberId: string) => void;
}

export function EsperandoAtendimento({
    members,
    loading,
    onStartAttendance,
    onMoveToTop,
    onMoveToEnd
}: EsperandoAtendimentoProps) {
    const { profile } = useAuth();
    const esperando = members.filter(m => m.status === 'disponivel');

    return (
        <Card className="border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-background to-muted/30">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    Esperando Atendimento
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto pt-4">
                {esperando.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground">
                            Ninguém aguardando
                        </p>
                    </div>
                ) : (
                    esperando.map((member, index) => {
                        const isFirst = index === 0;
                        const isMe = member.profile_id === profile?.id;

                        return (
                            <div
                                key={member.id}
                                className={`p-4 border-2 rounded-xl transition-all hover:shadow-md ${
                                    isMe 
                                        ? 'bg-primary/10 border-primary/40 shadow-sm' 
                                        : isFirst 
                                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-sm' 
                                        : 'bg-card border-border hover:border-primary/30'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Badge 
                                            variant={isFirst ? "default" : "outline"} 
                                            className={`min-w-[45px] justify-center font-semibold ${
                                                isFirst ? 'bg-amber-500 hover:bg-amber-600' : ''
                                            }`}
                                        >
                                            {member.position}º
                                        </Badge>
                                        <span className={`text-sm font-semibold truncate ${
                                            isFirst ? 'text-amber-900 dark:text-amber-100' : ''
                                        }`}>
                                            {member.profile_name}
                                        </span>
                                        {isMe && (
                                            <Badge variant="secondary" className="text-xs shrink-0">Você</Badge>
                                        )}
                                    </div>
                                    {/* Botões de reorganizar */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {onMoveToTop && !isFirst && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-primary/10"
                                                onClick={() => onMoveToTop(member.id)}
                                                disabled={loading}
                                                title="Mover para o topo"
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {onMoveToEnd && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 hover:bg-primary/10"
                                                onClick={() => onMoveToEnd(member.id)}
                                                disabled={loading}
                                                title="Mover para o final"
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {/* TODAS as colaboradoras têm botão PLAY */}
                                <Button
                                    size="sm"
                                    className={`w-full font-semibold ${
                                        isFirst 
                                            ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                                            : 'bg-primary hover:bg-primary/90'
                                    }`}
                                    onClick={() => onStartAttendance(member.id)}
                                    disabled={loading}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Iniciar Atendimento
                                </Button>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
