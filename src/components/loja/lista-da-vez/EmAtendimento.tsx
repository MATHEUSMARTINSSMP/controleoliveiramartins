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
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                    Em Atendimento
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 max-h-[500px] overflow-y-auto pt-3">
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
                                className={`p-3 border rounded-lg transition-all hover:shadow-sm ${
                                    isMe 
                                        ? 'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50' 
                                        : 'bg-muted/20 border-border/50 hover:border-blue-200'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-medium ${
                                            isMe ? 'text-blue-900 dark:text-blue-100' : 'text-foreground'
                                        }`}>
                                            {attendance.profile_name}
                                        </p>
                                        {attendance.cliente_nome && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {attendance.cliente_nome}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge 
                                            variant="outline" 
                                            className="text-xs font-medium h-5"
                                        >
                                            {duration}min
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => onStopAttendance(attendance.id)}
                                            disabled={loading}
                                            className="h-8 text-xs"
                                        >
                                            <Square className="h-3 w-3 mr-1" />
                                            Finalizar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
