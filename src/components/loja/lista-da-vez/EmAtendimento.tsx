import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Square } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Attendance {
    id: string;
    profile_id: string;
    profile_name: string;
    cliente_nome: string | null;
    started_at: string;
    duration_seconds: number | null;
}

interface EmAtendimentoProps {
    attendances: Attendance[];
    loading: boolean;
    onStopAttendance: (attendanceId: string) => void;
}

export function EmAtendimento({
    attendances,
    loading,
    onStopAttendance
}: EmAtendimentoProps) {
    const { profile } = useAuth();

    const calculateDuration = (startedAt: string, durationSeconds: number | null): number => {
        if (durationSeconds !== null) {
            return Math.floor(durationSeconds / 60);
        }
        // Calcular duração em tempo real
        const startTime = new Date(startedAt).getTime();
        const now = Date.now();
        const diffMs = now - startTime;
        const diffMinutes = Math.floor(diffMs / 60000);
        // Não mostrar negativo
        return Math.max(0, diffMinutes);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Em Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {attendances.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum atendimento em andamento
                    </p>
                ) : (
                    attendances.map((attendance) => {
                        const isMe = attendance.profile_id === profile?.id;
                        const duration = calculateDuration(attendance.started_at, attendance.duration_seconds);

                        return (
                            <div
                                key={attendance.id}
                                className={`p-3 border rounded-lg transition-all ${
                                    isMe ? 'bg-primary/5 border-primary/30' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{attendance.profile_name}</p>
                                        {attendance.cliente_nome && (
                                            <p className="text-xs text-muted-foreground">
                                                {attendance.cliente_nome}
                                            </p>
                                        )}
                                    </div>
                                    {isMe && (
                                        <Badge variant="secondary" className="text-xs ml-2">Você</Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <p className="text-xs text-muted-foreground">
                                        {duration} min
                                    </p>
                                    {/* Botão STOP para finalizar - sempre visível */}
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => onStopAttendance(attendance.id)}
                                        disabled={loading}
                                        className="ml-auto"
                                    >
                                        <Square className="h-3 w-3 mr-1" />
                                        Finalizar
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
