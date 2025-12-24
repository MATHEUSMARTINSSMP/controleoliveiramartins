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
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Esperando Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {esperando.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Ninguém aguardando
                    </p>
                ) : (
                    esperando.map((member, index) => {
                        const isFirst = index === 0;
                        const isMe = member.profile_id === profile?.id;

                        return (
                            <div
                                key={member.id}
                                className={`p-3 border rounded-lg transition-all ${
                                    isMe ? 'bg-primary/5 border-primary/30' : ''
                                } ${isFirst ? 'border-primary shadow-sm' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Badge variant={isFirst ? "default" : "outline"} className="min-w-[40px] justify-center">
                                            {member.position}º
                                        </Badge>
                                        <span className="text-sm font-medium">
                                            {member.profile_name}
                                        </span>
                                        {isMe && (
                                            <Badge variant="secondary" className="text-xs">Você</Badge>
                                        )}
                                    </div>
                                    {/* Botões de reorganizar */}
                                    <div className="flex items-center gap-1">
                                        {onMoveToTop && !isFirst && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => onMoveToTop(member.id)}
                                                disabled={loading}
                                                title="Mover para o topo"
                                            >
                                                <ArrowUp className="h-3 w-3" />
                                            </Button>
                                        )}
                                        {onMoveToEnd && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => onMoveToEnd(member.id)}
                                                disabled={loading}
                                                title="Mover para o final"
                                            >
                                                <ArrowDown className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {/* TODAS as colaboradoras têm botão PLAY */}
                                <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() => onStartAttendance(member.id)}
                                    disabled={loading}
                                >
                                    <Play className="h-3 w-3 mr-1" />
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
