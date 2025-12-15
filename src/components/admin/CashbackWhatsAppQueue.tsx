/**
 * Componente para visualizar e gerenciar a fila de WhatsApp de Cashback
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, MessageSquare, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface QueueItem {
  id: string;
  transaction_id: string | null;
  cliente_id: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  store_id: string | null;
  valor_cashback: number | null;
  saldo_total: number | null;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'SKIPPED';
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface CashbackWhatsAppQueueProps {
  storeId?: string;
}

export function CashbackWhatsAppQueue({ storeId }: CashbackWhatsAppQueueProps) {
  const [loading, setLoading] = useState(true);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [tableExists, setTableExists] = useState<boolean | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cashback_whatsapp_queue' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query as { data: QueueItem[] | null; error: any };

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          setTableExists(false);
          setQueueItems([]);
        } else {
          console.error('Erro ao buscar fila:', error);
          toast.error('Erro ao carregar fila de WhatsApp');
        }
        return;
      }

      setTableExists(true);
      setQueueItems(data || []);

      const statsObj = (data || []).reduce((acc: Record<string, number>, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});
      setStats(statsObj);
    } catch (err) {
      console.error('Erro ao carregar fila:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [storeId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'PROCESSING':
        return <Badge variant="default"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processando</Badge>;
      case 'SENT':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      case 'SKIPPED':
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando fila...</span>
        </CardContent>
      </Card>
    );
  }

  if (tableExists === false) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Fila de WhatsApp de Cashback
          </CardTitle>
          <CardDescription>Notificações de cashback via WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            <p className="text-lg font-medium mb-2">Tabela não encontrada</p>
            <p className="text-muted-foreground mb-4">
              A tabela de fila de WhatsApp de cashback ainda não foi criada no banco de dados.
            </p>
            <p className="text-sm text-muted-foreground">
              Execute a migração <code className="bg-muted px-1 rounded">20251215000002_fix_cashback_whatsapp_queue.sql</code> no Supabase.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Fila de WhatsApp de Cashback
          </CardTitle>
          <CardDescription>
            {queueItems.length} itens na fila
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadQueue} data-testid="button-refresh-queue">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {Object.keys(stats).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {stats.PENDING && (
              <Badge variant="secondary">
                <Clock className="w-3 h-3 mr-1" />
                {stats.PENDING} Pendentes
              </Badge>
            )}
            {stats.PROCESSING && (
              <Badge variant="default">
                <Loader2 className="w-3 h-3 mr-1" />
                {stats.PROCESSING} Processando
              </Badge>
            )}
            {stats.SENT && (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle className="w-3 h-3 mr-1" />
                {stats.SENT} Enviados
              </Badge>
            )}
            {stats.FAILED && (
              <Badge variant="destructive">
                <XCircle className="w-3 h-3 mr-1" />
                {stats.FAILED} Falhas
              </Badge>
            )}
            {stats.SKIPPED && (
              <Badge variant="outline">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {stats.SKIPPED} Ignorados
              </Badge>
            )}
          </div>
        )}

        {queueItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
            <p className="text-lg font-medium mb-2">Fila vazia</p>
            <p className="text-muted-foreground">
              Nenhum WhatsApp de cashback pendente no momento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Cashback</TableHead>
                  <TableHead className="text-right">Saldo Total</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-queue-${item.id}`}>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="font-medium">
                      {item.cliente_nome || item.cliente_id?.substring(0, 8) || '-'}
                    </TableCell>
                    <TableCell>{item.cliente_telefone || '-'}</TableCell>
                    <TableCell className="text-right">
                      {item.valor_cashback ? formatCurrency(item.valor_cashback) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.saldo_total ? formatCurrency(item.saldo_total) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.attempts}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-destructive">
                      {item.error_message || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
