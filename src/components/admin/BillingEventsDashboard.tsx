import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Eye, AlertCircle, CheckCircle, XCircle, Clock, Filter, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BillingEvent {
  id: string;
  payment_gateway: string;
  external_event_id: string;
  event_type: string;
  processed: boolean;
  error_message: string | null;
  created_at: string;
  event_data: any;
  retry_count?: number;
}

export const BillingEventsDashboard = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<BillingEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<BillingEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    gateway: "ALL",
    status: "ALL",
    eventType: "ALL",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    if (profile?.id) {
      fetchEvents();
    }
  }, [profile?.id]);

  useEffect(() => {
    applyFilters();
  }, [events, filters]);

  const fetchEvents = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("billing_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setEvents(data || []);
    } catch (error: any) {
      console.error("Error fetching billing events:", error);
      toast.error("Erro ao carregar eventos de billing");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...events];

    if (filters.gateway !== "ALL") {
      filtered = filtered.filter((e) => e.payment_gateway === filters.gateway);
    }

    if (filters.status !== "ALL") {
      if (filters.status === "PROCESSED") {
        filtered = filtered.filter((e) => e.processed);
      } else if (filters.status === "PENDING") {
        filtered = filtered.filter((e) => !e.processed && !e.error_message);
      } else if (filters.status === "ERROR") {
        filtered = filtered.filter((e) => e.error_message);
      }
    }

    if (filters.eventType !== "ALL") {
      filtered = filtered.filter((e) => e.event_type === filters.eventType);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter((e) => new Date(e.created_at) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((e) => new Date(e.created_at) <= toDate);
    }

    setFilteredEvents(filtered);
  };

  const handleReprocessEvent = async (eventId: string) => {
    try {
      const { error } = await supabase.rpc("reprocess_billing_event", {
        p_event_id: eventId,
      });

      if (error) throw error;

      toast.success("Evento enviado para reprocessamento");
      await fetchEvents();
    } catch (error: any) {
      console.error("Error reprocessing event:", error);
      toast.error("Erro ao reprocessar evento: " + error.message);
    }
  };

  const getStatusBadge = (event: BillingEvent) => {
    if (event.processed) {
      return <Badge variant="default" className="bg-green-500">Processado</Badge>;
    }
    if (event.error_message) {
      return <Badge variant="destructive">Erro</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const getGatewayBadge = (gateway: string) => {
    const colors: Record<string, string> = {
      STRIPE: "bg-purple-500",
      MERCADO_PAGO: "bg-blue-500",
      ASAAS: "bg-green-500",
      CAKTO: "bg-orange-500",
      PAGSEGURO: "bg-yellow-500",
    };
    return (
      <Badge className={colors[gateway] || "bg-gray-500"}>{gateway}</Badge>
    );
  };

  const getUniqueGateways = () => {
    return Array.from(new Set(events.map((e) => e.payment_gateway)));
  };

  const getUniqueEventTypes = () => {
    return Array.from(new Set(events.map((e) => e.event_type)));
  };

  const stats = {
    total: events.length,
    processed: events.filter((e) => e.processed).length,
    pending: events.filter((e) => !e.processed && !e.error_message).length,
    errors: events.filter((e) => e.error_message).length,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Eventos de Billing</CardTitle>
              <CardDescription>
                Monitoramento e gerenciamento de eventos de webhook de pagamento
              </CardDescription>
            </div>
            <Button onClick={fetchEvents} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total de Eventos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
                <p className="text-xs text-muted-foreground">Processados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
                <p className="text-xs text-muted-foreground">Com Erro</p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div>
              <Label>Gateway</Label>
              <Select
                value={filters.gateway}
                onValueChange={(value) => setFilters({ ...filters, gateway: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {getUniqueGateways().map((gw) => (
                    <SelectItem key={gw} value={gw}>
                      {gw}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PROCESSED">Processados</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="ERROR">Com Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Evento</Label>
              <Select
                value={filters.eventType}
                onValueChange={(value) => setFilters({ ...filters, eventType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {getUniqueEventTypes().map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>

          {/* Tabela de Eventos */}
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>ID Externo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-xs">
                        {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{getGatewayBadge(event.payment_gateway)}</TableCell>
                      <TableCell className="text-xs font-mono">{event.event_type}</TableCell>
                      <TableCell className="text-xs font-mono max-w-xs truncate">
                        {event.external_event_id}
                      </TableCell>
                      <TableCell>{getStatusBadge(event)}</TableCell>
                      <TableCell className="text-xs text-red-600 max-w-xs truncate">
                        {event.error_message || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedEvent(event);
                              setEventDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!event.processed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReprocessEvent(event.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes do Evento */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Evento</DialogTitle>
            <DialogDescription>
              Dados completos do evento de webhook
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gateway</Label>
                  <p className="text-sm">{selectedEvent.payment_gateway}</p>
                </div>
                <div>
                  <Label>Tipo de Evento</Label>
                  <p className="text-sm font-mono">{selectedEvent.event_type}</p>
                </div>
                <div>
                  <Label>ID Externo</Label>
                  <p className="text-sm font-mono">{selectedEvent.external_event_id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(selectedEvent)}</div>
                </div>
                <div>
                  <Label>Data/Hora</Label>
                  <p className="text-sm">
                    {format(new Date(selectedEvent.created_at), "dd/MM/yyyy HH:mm:ss", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                {selectedEvent.error_message && (
                  <div>
                    <Label>Erro</Label>
                    <p className="text-sm text-red-600">{selectedEvent.error_message}</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Dados do Evento (JSON)</Label>
                <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(selectedEvent.event_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

