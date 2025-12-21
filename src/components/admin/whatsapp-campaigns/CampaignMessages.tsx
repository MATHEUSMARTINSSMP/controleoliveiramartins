import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, AlertCircle, ChevronDown, Search, Calendar, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageDetailsModal } from "./MessageDetailsModal";
import { EmptyState } from "./EmptyState";
import { MessageListSkeleton } from "./LoadingSkeleton";

interface CampaignMessagesProps {
  campaignId: string;
}

export function CampaignMessages({ campaignId }: CampaignMessagesProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchPhone, setSearchPhone] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchMessages(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, filterStatus, searchPhone, filterDateFrom, filterDateTo]);

  const fetchMessages = async (pageNum: number) => {
    try {
      setLoading(true);

      let query = supabase
        .schema("sistemaretiradas")
        .from("whatsapp_message_queue")
        .select("id, phone, message, status, sent_at, error_message, created_at, retry_count", { count: 'exact' })
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      // Aplicar filtros
      if (filterStatus !== 'all') {
        query = query.eq("status", filterStatus);
      }

      if (searchPhone.trim()) {
        query = query.ilike("phone", `%${searchPhone.trim()}%`);
      }

      if (filterDateFrom) {
        query = query.gte("created_at", `${filterDateFrom}T00:00:00`);
      }

      if (filterDateTo) {
        query = query.lte("created_at", `${filterDateTo}T23:59:59`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      if (pageNum === 0) {
        setMessages(data || []);
      } else {
        setMessages(prev => [...prev, ...(data || [])]);
      }
      
      setHasMore((data?.length || 0) === pageSize);
    } catch (error: any) {
      console.error("Erro ao buscar mensagens:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  if (loading && page === 0) {
    return <MessageListSkeleton count={5} />;
  }

  const handleRetryMessage = async (messageId: string) => {
    setRetryingMessageId(messageId);
    try {
      // Resetar status da mensagem para PENDING para que seja reprocessada
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_message_queue")
        .update({ 
          status: 'PENDING',
          error_message: null,
          retry_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", messageId);

      if (error) throw error;

      toast.success("Mensagem será reenviada em breve");
      
      // Recarregar mensagens após um breve delay
      setTimeout(() => {
        fetchMessages(page);
      }, 1000);
    } catch (error: any) {
      console.error("Erro ao reenviar mensagem:", error);
      toast.error("Erro ao reenviar mensagem: " + error.message);
    } finally {
      setRetryingMessageId(null);
    }
  };

  return (
    <div className="w-full mt-4" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4">
          {/* Filtros Avançados */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros Avançados</span>
            </div>
            
            {/* Busca por telefone */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="pl-9"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Filtros de data */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de (criação)</label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>

          {/* Filtros de Status */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={(e) => {
                e.stopPropagation();
                setFilterStatus('all');
              }}
            >
              Todas ({messages.length})
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'SENT' ? 'default' : 'outline'}
              onClick={(e) => {
                e.stopPropagation();
                setFilterStatus('SENT');
              }}
            >
              Enviadas
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'FAILED' ? 'default' : 'outline'}
              onClick={(e) => {
                e.stopPropagation();
                setFilterStatus('FAILED');
              }}
            >
              Erros
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'PENDING' ? 'default' : 'outline'}
              onClick={(e) => {
                e.stopPropagation();
                setFilterStatus('PENDING');
              }}
            >
              Pendentes
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'SCHEDULED' ? 'default' : 'outline'}
              onClick={(e) => {
                e.stopPropagation();
                setFilterStatus('SCHEDULED');
              }}
            >
              Agendadas
            </Button>
            <Button
              size="sm"
              variant={filterStatus === 'CANCELLED' ? 'default' : 'outline'}
              onClick={(e) => {
                e.stopPropagation();
                setFilterStatus('CANCELLED');
              }}
            >
              Canceladas
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.length === 0 && !loading ? (
              <EmptyState type="no-messages" />
            ) : (
              <>
                {              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-3 border rounded-lg text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMessage(msg);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium">{msg.phone}</div>
                    <Badge
                      variant={
                        msg.status === 'SENT' ? 'default' :
                        msg.status === 'FAILED' ? 'destructive' :
                        msg.status === 'PENDING' || msg.status === 'SCHEDULED' ? 'secondary' :
                        'outline'
                      }
                    >
                      {msg.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mb-2 line-clamp-2">
                    {msg.message}
                  </div>
                  {msg.error_message && (
                    <div className="text-red-500 text-xs mb-1">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      {msg.error_message}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {msg.sent_at
                      ? `Enviada em ${format(new Date(msg.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                      : `Criada em ${format(new Date(msg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                    }
                  </div>
                  {msg.status === 'FAILED' && (
                    <div className="mt-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryMessage(msg.id);
                        }}
                        disabled={retryingMessageId === msg.id}
                      >
                        {retryingMessageId === msg.id ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Reenviando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Reenviar
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextPage = page + 1;
                        setPage(nextPage);
                        fetchMessages(nextPage);
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      )}
                      Carregar mais
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal de detalhes da mensagem */}
        <MessageDetailsModal
          message={selectedMessage}
          open={!!selectedMessage}
          onOpenChange={(open) => !open && setSelectedMessage(null)}
          onRetry={selectedMessage?.status === 'FAILED' ? handleRetryMessage : undefined}
          retrying={retryingMessageId === selectedMessage?.id}
        />
    </div>
  );
}

