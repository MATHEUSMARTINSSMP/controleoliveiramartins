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
        <Card className="border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-background to-muted/30">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                    Em Atendimento
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto pt-4">
                {attendances.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground">
                            Nenhum atendimento em andamento
                        </p>
                    </div>
                ) : (
                    attendances.map((attendance) => {
                        const isMe = attendance.profile_id === profile?.id;
                        const duration = calculateDuration(attendance.started_at, attendance.duration_seconds);

                        return (
                            <div
                                key={attendance.id}
                                className={`p-4 border-2 rounded-xl transition-all hover:shadow-md ${
                                    isMe 
                                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 shadow-sm' 
                                        : 'bg-card border-border hover:border-blue-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold ${
                                            isMe ? 'text-blue-900 dark:text-blue-100' : ''
                                        }`}>
                                            {attendance.profile_name}
                                        </p>
                                        {attendance.cliente_nome && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {attendance.cliente_nome}
                                            </p>
                                        )}
                                    </div>
                                    {isMe && (
                                        <Badge variant="secondary" className="text-xs ml-2 shrink-0">Você</Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                                        <p className="text-xs font-medium text-muted-foreground">
                                            {duration} min
                                        </p>
                                    </div>
                                    {/* Botão STOP para finalizar - sempre visível */}
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => onStopAttendance(attendance.id)}
                                        disabled={loading}
                                        className="font-semibold"
                                    >
                                        <Square className="h-4 w-4 mr-2" />
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
