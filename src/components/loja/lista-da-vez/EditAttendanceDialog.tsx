import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface Colaboradora {
    id: string;
    name: string;
}

interface LossReason {
    id: string;
    name: string;
}

interface Attendance {
    id: string;
    profile_id: string;
    profile_name: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    status: string;
    result?: 'venda' | 'perda' | null;
    sale_value?: number | null;
    loss_reason?: string | null;
    loss_reason_id?: string | null;
}

interface EditAttendanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attendance: Attendance | null;
    storeId: string | null;
    onUpdated?: () => void;
}

export function EditAttendanceDialog({
    open,
    onOpenChange,
    attendance,
    storeId,
    onUpdated
}: EditAttendanceDialogProps) {
    const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
    const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        profile_id: "",
        started_at: "",
        ended_at: "",
        result: "" as 'venda' | 'perda' | '',
        sale_value: "",
        loss_reason_id: "",
        cliente_nome: ""
    });

    useEffect(() => {
        if (open && storeId) {
            fetchColaboradoras();
            fetchLossReasons();
        }
    }, [open, storeId]);

    useEffect(() => {
        if (attendance && open) {
            setFormData({
                profile_id: attendance.profile_id,
                started_at: format(new Date(attendance.started_at), "yyyy-MM-dd'T'HH:mm"),
                ended_at: attendance.ended_at ? format(new Date(attendance.ended_at), "yyyy-MM-dd'T'HH:mm") : "",
                result: attendance.result || "",
                sale_value: attendance.sale_value?.toString() || "",
                loss_reason_id: attendance.loss_reason_id || "",
                cliente_nome: attendance.cliente_nome || ""
            });
        }
    }, [attendance, open]);

    const fetchColaboradoras = async () => {
        if (!storeId) return;
        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('profiles')
                .select('id, name')
                .eq('store_id', storeId)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setColaboradoras(data || []);
        } catch (error: any) {
            console.error('[EditAttendanceDialog] Erro ao buscar colaboradoras:', error);
            toast.error('Erro ao buscar colaboradoras');
        }
    };

    const fetchLossReasons = async () => {
        if (!storeId) return;
        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('loss_reasons')
                .select('id, name')
                .eq('is_active', true)
                .or(`store_id.is.null,store_id.eq.${storeId}`)
                .order('display_order');

            if (error) throw error;
            setLossReasons(data || []);
        } catch (error: any) {
            console.error('[EditAttendanceDialog] Erro ao buscar motivos de perda:', error);
        }
    };

    const handleSubmit = async () => {
        if (!attendance || !storeId || !formData.profile_id || !formData.started_at) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        if (formData.result && formData.result === 'venda' && !formData.sale_value) {
            toast.error('Informe o valor da venda');
            return;
        }

        if (formData.result && formData.result === 'perda' && !formData.loss_reason_id) {
            toast.error('Selecione o motivo da perda');
            return;
        }

        setLoading(true);
        try {
            // Se colaboradora mudou, usar função de transferência
            if (formData.profile_id !== attendance.profile_id && attendance.status === 'em_andamento') {
                const { error: transferError } = await supabase.rpc('transfer_attendance', {
                    p_attendance_id: attendance.id,
                    p_new_profile_id: formData.profile_id,
                    p_reason: 'Alteração manual via histórico'
                });

                if (transferError) throw transferError;
            }

            // Atualizar atendimento
            const { error } = await supabase.rpc('update_attendance', {
                p_attendance_id: attendance.id,
                p_profile_id: formData.profile_id !== attendance.profile_id ? formData.profile_id : null,
                p_started_at: formData.started_at !== format(new Date(attendance.started_at), "yyyy-MM-dd'T'HH:mm") ? formData.started_at : null,
                p_ended_at: formData.ended_at || null,
                p_result: formData.result || null,
                p_sale_value: formData.result === 'venda' ? parseFloat(formData.sale_value) : null,
                p_loss_reason_id: formData.result === 'perda' ? formData.loss_reason_id : null,
                p_cliente_nome: formData.cliente_nome || null
            });

            if (error) throw error;

            toast.success('Atendimento atualizado com sucesso!');
            onOpenChange(false);
            if (onUpdated) onUpdated();
        } catch (error: any) {
            console.error('[EditAttendanceDialog] Erro ao atualizar atendimento:', error);
            toast.error('Erro ao atualizar atendimento: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    if (!attendance) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Atendimento</DialogTitle>
                    <DialogDescription>
                        Atendimento de {attendance.profile_name}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label>Colaboradora *</Label>
                        <Select
                            value={formData.profile_id}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, profile_id: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a colaboradora" />
                            </SelectTrigger>
                            <SelectContent>
                                {colaboradoras.map(colab => (
                                    <SelectItem key={colab.id} value={colab.id}>
                                        {colab.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Data/Hora de Início *</Label>
                            <Input
                                type="datetime-local"
                                value={formData.started_at}
                                onChange={(e) => setFormData(prev => ({ ...prev, started_at: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Data/Hora de Fim</Label>
                            <Input
                                type="datetime-local"
                                value={formData.ended_at}
                                onChange={(e) => setFormData(prev => ({ ...prev, ended_at: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Nome do Cliente (opcional)</Label>
                        <Input
                            value={formData.cliente_nome}
                            onChange={(e) => setFormData(prev => ({ ...prev, cliente_nome: e.target.value }))}
                            placeholder="Nome do cliente"
                        />
                    </div>

                    <div>
                        <Label>Resultado</Label>
                        <Select
                            value={formData.result}
                            onValueChange={(value: any) => setFormData(prev => ({ ...prev, result: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o resultado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Sem resultado</SelectItem>
                                <SelectItem value="venda">Venda Realizada</SelectItem>
                                <SelectItem value="perda">Venda Perdida</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.result === 'venda' && (
                        <div>
                            <Label>Valor da Venda (R$) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.sale_value}
                                onChange={(e) => setFormData(prev => ({ ...prev, sale_value: e.target.value }))}
                            />
                        </div>
                    )}

                    {formData.result === 'perda' && (
                        <div>
                            <Label>Motivo da Perda *</Label>
                            <Select
                                value={formData.loss_reason_id}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, loss_reason_id: value }))}
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

                    <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !formData.profile_id || !formData.started_at}
                        >
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

