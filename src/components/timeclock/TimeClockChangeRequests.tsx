/**
 * Componente para gestao de solicitacoes de alteracao de ponto
 * Admin/Loja pode aprovar ou rejeitar solicitacoes de colaboradoras
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, X, Clock, AlertCircle, FileEdit } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ChangeRequest {
  id: string;
  store_id: string;
  colaboradora_id: string;
  registro_original_id: string;
  tipo_registro_original: string;
  horario_original: string;
  horario_solicitado: string;
  motivo: string;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  analisado_por?: string;
  analisado_em?: string;
  justificativa_analise?: string;
  created_at: string;
  profiles?: { name: string };
}

interface TimeClockChangeRequestsProps {
  storeId: string;
  isAdmin?: boolean;
  onCountChange?: () => void;
}

export function TimeClockChangeRequests({ storeId, isAdmin = false, onCountChange }: TimeClockChangeRequestsProps) {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pendentes');

  useEffect(() => {
    if (storeId) {
      fetchRequests();
    }
  }, [storeId, activeTab]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .schema('sistemaretiradas')
        .from('time_clock_change_requests')
        .select(`
          *,
          profiles:colaboradora_id (name)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (activeTab === 'pendentes') {
        query = query.eq('status', 'PENDENTE');
      } else if (activeTab === 'aprovados') {
        query = query.eq('status', 'APROVADO');
      } else if (activeTab === 'rejeitados') {
        query = query.eq('status', 'REJEITADO');
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.error('[TimeClockChangeRequests] Erro ao buscar solicitacoes:', err);
      toast.error('Erro ao carregar solicitacoes');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = (request: ChangeRequest) => {
    setSelectedRequest(request);
    setJustificativa('');
    setDialogOpen(true);
  };

  const handleDecision = async (approved: boolean) => {
    if (!selectedRequest || !profile) return;

    try {
      setProcessing(true);

      const { error: updateError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_change_requests')
        .update({
          status: approved ? 'APROVADO' : 'REJEITADO',
          analisado_por: profile.id,
          analisado_em: new Date().toISOString(),
          justificativa_analise: justificativa || null,
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      if (approved) {
        const { error: recordError } = await supabase
          .schema('sistemaretiradas')
          .from('time_clock_records')
          .update({
            horario: selectedRequest.horario_solicitado,
            alterado_em: new Date().toISOString(),
            alterado_por: profile.id,
            justificativa_admin: `Alteracao aprovada: ${justificativa || 'Sem justificativa'}`,
          })
          .eq('id', selectedRequest.registro_original_id);

        if (recordError) throw recordError;
      }

      toast.success(approved ? 'Solicitacao aprovada com sucesso' : 'Solicitacao rejeitada');
      setDialogOpen(false);
      setSelectedRequest(null);
      fetchRequests();
      onCountChange?.();
    } catch (err: any) {
      console.error('[TimeClockChangeRequests] Erro ao processar:', err);
      toast.error('Erro ao processar solicitacao');
    } finally {
      setProcessing(false);
    }
  };

  const getRecordTypeLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      ENTRADA: 'Entrada',
      SAIDA_INTERVALO: 'Saida Intervalo',
      ENTRADA_INTERVALO: 'Retorno Intervalo',
      SAIDA: 'Saida',
    };
    return labels[tipo] || tipo;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PENDENTE') {
      return <Badge variant="outline" className="text-amber-600 border-amber-600">Pendente</Badge>;
    } else if (status === 'APROVADO') {
      return <Badge variant="default" className="bg-emerald-600">Aprovado</Badge>;
    } else {
      return <Badge variant="destructive">Rejeitado</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'PENDENTE').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            <CardTitle className="text-lg">Solicitacoes de Alteracao</CardTitle>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CardDescription>
          Gerencie solicitacoes de alteracao de registro de ponto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
            <TabsTrigger value="pendentes" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="aprovados" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] flex items-center justify-center gap-1">
              <Check className="h-3 w-3" />
              Aprovados
            </TabsTrigger>
            <TabsTrigger value="rejeitados" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] flex items-center justify-center gap-1">
              <X className="h-3 w-3" />
              Rejeitados
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma solicitacao {activeTab === 'pendentes' ? 'pendente' : activeTab === 'aprovados' ? 'aprovada' : 'rejeitada'}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaboradora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                    {activeTab === 'pendentes' && <TableHead>Acoes</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.profiles?.name || 'N/A'}
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getRecordTypeLabel(request.tipo_registro_original)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(request.horario_original), 'dd/MM HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-primary font-medium">
                          <Clock className="h-3 w-3" />
                          {format(new Date(request.horario_solicitado), 'dd/MM HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={request.motivo}>
                        {request.motivo}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status)}
                      </TableCell>
                      {activeTab === 'pendentes' && (
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleAnalyze(request)}
                            data-testid={`button-analyze-${request.id}`}
                          >
                            Analisar
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Analisar Solicitacao</DialogTitle>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Colaboradora</p>
                    <p className="font-medium">{selectedRequest.profiles?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium">{getRecordTypeLabel(selectedRequest.tipo_registro_original)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horario Original</p>
                    <p className="font-medium text-destructive">
                      {format(new Date(selectedRequest.horario_original), 'dd/MM/yyyy HH:mm:ss')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horario Solicitado</p>
                    <p className="font-medium text-primary">
                      {format(new Date(selectedRequest.horario_solicitado), 'dd/MM/yyyy HH:mm:ss')}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Motivo da Solicitacao:</p>
                  <p className="text-sm p-3 bg-muted rounded-lg">{selectedRequest.motivo}</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Justificativa (opcional):</label>
                  <Textarea
                    placeholder="Adicione uma justificativa para sua decisao..."
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="destructive"
                onClick={() => handleDecision(false)}
                disabled={processing}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                Rejeitar
              </Button>
              <Button
                onClick={() => handleDecision(true)}
                disabled={processing}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Aprovar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
