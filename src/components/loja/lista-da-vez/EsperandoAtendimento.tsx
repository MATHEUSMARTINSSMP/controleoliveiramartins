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
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    Esperando Atendimento
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-[500px] overflow-y-auto pt-3">
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
                                className={`p-3 border rounded-lg transition-all hover:shadow-sm ${
                                    isMe 
                                        ? 'bg-primary/5 border-primary/30' 
                                        : isFirst 
                                        ? 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/50' 
                                        : 'bg-muted/20 border-border/50 hover:border-primary/20'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2.5">
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <Badge 
                                            variant={isFirst ? "default" : "outline"} 
                                            className={`min-w-[38px] justify-center text-xs font-semibold h-6 ${
                                                isFirst ? 'bg-amber-500 hover:bg-amber-600 border-0' : ''
                                            }`}
                                        >
                                            {member.position}º
                                        </Badge>
                                        <span className={`text-xs font-medium truncate ${
                                            isFirst ? 'text-amber-900 dark:text-amber-100' : 'text-foreground'
                                        }`}>
                                            {member.profile_name}
                                        </span>
                                        {isMe && (
                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">Você</Badge>
                                        )}
                                    </div>
                                    {/* Botões de reorganizar */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        {onMoveToTop && !isFirst && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-primary/10"
                                                onClick={() => onMoveToTop(member.id)}
                                                disabled={loading}
                                                title="Mover para o topo"
                                            >
                                                <ArrowUp className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {onMoveToEnd && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-primary/10"
                                                onClick={() => onMoveToEnd(member.id)}
                                                disabled={loading}
                                                title="Mover para o final"
                                            >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {/* TODAS as colaboradoras têm botão PLAY */}
                                <Button
                                    size="sm"
                                    className={`w-full text-xs font-medium h-8 ${
                                        isFirst 
                                            ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                                            : 'bg-primary hover:bg-primary/90 text-white'
                                    }`}
                                    onClick={() => onStartAttendance(member.id)}
                                    disabled={loading}
                                >
                                    <Play className="h-3.5 w-3.5 mr-1.5" />
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
