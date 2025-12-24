import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface LossReason {
    id: string;
    name: string;
}

interface FinalizarAtendimentoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attendanceId: string;
    colaboradoraId: string;
    colaboradoraName: string;
    lossReasons: LossReason[];
    onConfirm: (
        attendanceId: string,
        result: 'venda' | 'perda',
        saleValue: number | null,
        lossReasonId: string | null
    ) => void;
    onOpenNewSale?: (attendanceId: string, colaboradoraId: string, saleValue: number) => void;
    loading?: boolean;
}

export function FinalizarAtendimentoDialog({
    open,
    onOpenChange,
    attendanceId,
    colaboradoraId,
    colaboradoraName,
    lossReasons,
    onConfirm,
    onOpenNewSale,
    loading = false
}: FinalizarAtendimentoDialogProps) {
    const [result, setResult] = useState<'venda' | 'perda' | ''>('');
    const [saleValue, setSaleValue] = useState('');
    const [lossReasonId, setLossReasonId] = useState('');

    const handleConfirm = () => {
        if (!result) return;
        if (result === 'venda' && !saleValue) return;
        if (result === 'perda' && !lossReasonId) return;

        // Se for venda, abrir dialog de Nova Venda
        if (result === 'venda' && onOpenNewSale) {
            onOpenNewSale(attendanceId, colaboradoraId, parseFloat(saleValue));
            // Limpar formulário
            setResult('');
            setSaleValue('');
            setLossReasonId('');
            onOpenChange(false);
            return;
        }

        // Se for perda, confirmar diretamente
        onConfirm(
            attendanceId,
            result,
            null, // saleValue será null para perda
            result === 'perda' ? lossReasonId : null
        );

        // Limpar formulário
        setResult('');
        setSaleValue('');
        setLossReasonId('');
    };

    const handleCancel = () => {
        setResult('');
        setSaleValue('');
        setLossReasonId('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Finalizar Atendimento</DialogTitle>
                    <DialogDescription>
                        Registre o resultado do atendimento de {colaboradoraName}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>Resultado do Atendimento *</Label>
                        <Select
                            value={result}
                            onValueChange={(v: any) => setResult(v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o resultado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="venda">Venda Realizada</SelectItem>
                                <SelectItem value="perda">Venda Perdida</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {result === 'venda' && (
                        <div>
                            <Label>Valor da Venda (R$) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={saleValue}
                                onChange={(e) => setSaleValue(e.target.value)}
                            />
                        </div>
                    )}

                    {result === 'perda' && (
                        <div>
                            <Label>Motivo da Perda *</Label>
                            <Select
                                value={lossReasonId}
                                onValueChange={setLossReasonId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o motivo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lossReasons.map(reason => (
                                        <SelectItem key={reason.id} value={reason.id}>
                                            {reason.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={loading}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={
                                loading ||
                                !result ||
                                (result === 'venda' && !saleValue) ||
                                (result === 'perda' && !lossReasonId)
                            }
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

