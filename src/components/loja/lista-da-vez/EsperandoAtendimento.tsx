import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play } from "lucide-react";
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
    clienteNome: string;
    onClienteNomeChange: (nome: string) => void;
    onStartAttendance: (memberId: string) => void;
}

export function EsperandoAtendimento({
    members,
    loading,
    clienteNome,
    onClienteNomeChange,
    onStartAttendance
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
                                    <div className="flex items-center gap-2">
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
                                </div>
                                {isFirst && (
                                    <div className="space-y-2 mt-2 pt-2 border-t">
                                        <Input
                                            placeholder="Nome do cliente"
                                            value={clienteNome}
                                            onChange={(e) => onClienteNomeChange(e.target.value)}
                                            className="h-8 text-xs"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && clienteNome.trim()) {
                                                    onStartAttendance(member.id);
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <Button
                                            size="sm"
                                            className="w-full"
                                            onClick={() => onStartAttendance(member.id)}
                                            disabled={!clienteNome.trim() || loading}
                                        >
                                            <Play className="h-3 w-3 mr-1" />
                                            Iniciar Atendimento
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}

