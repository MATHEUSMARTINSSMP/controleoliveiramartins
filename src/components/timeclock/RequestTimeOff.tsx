import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Plus, Clock, Check, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface TimeOffRequest {
  id: string;
  data: string;
  tipo: string;
  motivo: string | null;
  status: string;
  motivo_rejeicao: string | null;
  aprovado_em: string | null;
}

interface RequestTimeOffProps {
  storeId: string;
  colaboradoraId: string;
}

export function RequestTimeOff({ storeId, colaboradoraId }: RequestTimeOffProps) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    data: '',
    motivo: '',
  });

  useEffect(() => {
    fetchRequests();
  }, [colaboradoraId]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema('sistemaretiradas')
      .from('timeclock_occurrences')
      .select('id, data, tipo, motivo, status, motivo_rejeicao, aprovado_em')
      .eq('colaboradora_id', colaboradoraId)
      .eq('solicitado_por', colaboradoraId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRequests(data as TimeOffRequest[]);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.data) {
      toast.error('Selecione a data da folga');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('timeclock_occurrences')
        .insert({
          colaboradora_id: colaboradoraId,
          store_id: storeId,
          data: formData.data,
          tipo: 'FOLGA',
          motivo: formData.motivo || null,
          solicitado_por: colaboradoraId,
          status: 'pendente',
          created_by: colaboradoraId,
        });

      if (error) throw error;

      toast.success('Solicitação enviada! Aguarde aprovação do administrador.');
      setDialogOpen(false);
      setFormData({ data: '', motivo: '' });
      fetchRequests();
    } catch (err: any) {
      console.error('[RequestTimeOff] Erro:', err);
      if (err.message?.includes('duplicate')) {
        toast.error('Já existe uma solicitação para esta data');
      } else {
        toast.error('Erro ao enviar solicitação: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>;
      case 'aprovado':
        return <Badge className="bg-emerald-500">Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const minDate = format(new Date(), 'yyyy-MM-dd');

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Solicitar Folga
            </CardTitle>
            <CardDescription>
              Envie solicitações de folga para aprovação
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-solicitar-folga">
                <Plus className="mr-2 h-4 w-4" />
                Nova Solicitação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Folga</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Data da Folga *</Label>
                  <Input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                    min={minDate}
                    data-testid="input-data-folga"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea
                    value={formData.motivo}
                    onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                    placeholder="Descreva o motivo da folga (opcional)..."
                    data-testid="input-motivo-folga"
                  />
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Sua solicitação será enviada para aprovação do administrador.
                    Você receberá uma notificação quando for aprovada ou rejeitada.
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} data-testid="button-enviar-solicitacao">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Solicitação
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Você ainda não fez nenhuma solicitação de folga
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                data-testid={`row-solicitacao-${req.id}`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">
                      {format(new Date(req.data + 'T12:00:00'), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                    </div>
                    {req.motivo && (
                      <div className="text-xs text-muted-foreground">{req.motivo}</div>
                    )}
                    {req.status === 'rejeitado' && req.motivo_rejeicao && (
                      <div className="text-xs text-rose-600 mt-1">
                        Motivo: {req.motivo_rejeicao}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(req.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
