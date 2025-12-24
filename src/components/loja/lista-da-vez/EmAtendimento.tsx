import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Attendance {
    id: string;
    profile_id: string;
    profile_name: string;
    cliente_nome: string | null;
    started_at: string;
    duration_seconds: number | null;
}

interface LossReason {
    id: string;
    name: string;
}

interface EmAtendimentoProps {
    attendances: Attendance[];
    loading: boolean;
    lossReasons: LossReason[];
    onEndAttendance: (
        attendanceId: string,
        result: 'venda' | 'perda',
        saleValue: number | null,
        lossReasonId: string | null
    ) => void;
}

export function EmAtendimento({
    attendances,
    loading,
    lossReasons,
    onEndAttendance
}: EmAtendimentoProps) {
    const { profile } = useAuth();
    const [finalizingId, setFinalizingId] = useState<string | null>(null);
    const [result, setResult] = useState<'venda' | 'perda' | ''>('');
    const [saleValue, setSaleValue] = useState('');
    const [lossReasonId, setLossReasonId] = useState('');

    const handleFinalize = () => {
        if (!finalizingId || !result) return;
        if (result === 'venda' && !saleValue) return;
        if (result === 'perda' && !lossReasonId) return;

        onEndAttendance(
            finalizingId,
            result,
            result === 'venda' ? parseFloat(saleValue) : null,
            result === 'perda' ? lossReasonId : null
        );

        // Limpar formulário
        setFinalizingId(null);
        setResult('');
        setSaleValue('');
        setLossReasonId('');
    };

    const handleCancel = () => {
        setFinalizingId(null);
        setResult('');
        setSaleValue('');
        setLossReasonId('');
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
                        const duration = attendance.duration_seconds 
                            ? Math.floor(attendance.duration_seconds / 60)
                            : Math.floor((Date.now() - new Date(attendance.started_at).getTime()) / 60000);

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
                                        <p className="text-xs text-muted-foreground">
                                            {attendance.cliente_nome || 'Sem nome'}
                                        </p>
                                    </div>
                                    {isMe && (
                                        <Badge variant="secondary" className="text-xs ml-2">Você</Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                    {duration} min
                                </p>
                                {isMe && finalizingId !== attendance.id && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => setFinalizingId(attendance.id)}
                                        disabled={loading}
                                    >
                                        Finalizar
                                    </Button>
                                )}
                                {finalizingId === attendance.id && (
                                    <div className="space-y-2 mt-2 p-2 bg-muted rounded border">
                                        <Label className="text-xs">Resultado *</Label>
                                        <Select
                                            value={result}
                                            onValueChange={(v: any) => setResult(v)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="venda">Venda</SelectItem>
                                                <SelectItem value="perda">Perda</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {result === 'venda' && (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="Valor da venda (R$)"
                                                value={saleValue}
                                                onChange={(e) => setSaleValue(e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        )}
                                        {result === 'perda' && (
                                            <Select
                                                value={lossReasonId}
                                                onValueChange={setLossReasonId}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Motivo da perda" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {lossReasons.map(reason => (
                                                        <SelectItem key={reason.id} value={reason.id}>
                                                            {reason.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1"
                                                onClick={handleFinalize}
                                                disabled={
                                                    loading || 
                                                    !result || 
                                                    (result === 'venda' && !saleValue) || 
                                                    (result === 'perda' && !lossReasonId)
                                                }
                                            >
                                                Confirmar
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleCancel}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
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

