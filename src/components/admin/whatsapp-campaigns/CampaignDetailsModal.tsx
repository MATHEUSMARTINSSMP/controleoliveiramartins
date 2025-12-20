import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { WhatsAppCampaign } from "./types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Users, Calendar, Settings, BarChart3, Phone, Shield, Timer, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CampaignAnalyticsView } from "./CampaignAnalyticsView";

interface CampaignDetailsModalProps {
  campaign: WhatsAppCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignDetailsModal({ campaign, open, onOpenChange }: CampaignDetailsModalProps) {
  const [whatsappNumbers, setWhatsappNumbers] = useState<Array<{
    id: string;
    phone: string;
    type: 'primary' | 'backup';
    sent_count: number;
  }>>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  useEffect(() => {
    if (open && campaign) {
      fetchWhatsAppNumbers();
    }
  }, [open, campaign?.id]);

  const fetchWhatsAppNumbers = async () => {
    if (!campaign) return;

    try {
      setLoadingNumbers(true);

      // Buscar mensagens enviadas da campanha para contar por número WhatsApp
      const { data: messages, error } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_message_queue")
        .select("whatsapp_account_id, phone")
        .eq("campaign_id", campaign.id)
        .eq("status", "SENT");

      if (error) throw error;

      // Contar mensagens por número (null = principal)
      const numberCounts = new Map<string, number>();
      let primaryCount = 0;

      messages?.forEach(msg => {
        if (msg.whatsapp_account_id) {
          numberCounts.set(msg.whatsapp_account_id, (numberCounts.get(msg.whatsapp_account_id) || 0) + 1);
        } else {
          primaryCount++;
        }
      });

      // Buscar informações dos números reserva
      const backupIds = Array.from(numberCounts.keys());
      const numbers: Array<{ id: string; phone: string; type: 'primary' | 'backup'; sent_count: number }> = [];

      // Adicionar número principal
      if (primaryCount > 0) {
        const { data: primaryCred } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_credentials")
          .select("uazapi_phone_number")
          .eq("site_slug", (campaign.store?.name || '').toLowerCase().replace(/\s+/g, ''))
          .eq("is_global", false)
          .maybeSingle();

        numbers.push({
          id: 'primary',
          phone: primaryCred?.uazapi_phone_number || 'Número Principal',
          type: 'primary',
          sent_count: primaryCount,
        });
      }

      // Adicionar números reserva
      if (backupIds.length > 0) {
        const { data: backups } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_accounts")
          .select("id, phone, uazapi_phone_number")
          .in("id", backupIds);

        backups?.forEach(backup => {
          numbers.push({
            id: backup.id,
            phone: backup.uazapi_phone_number || backup.phone || 'Número Reserva',
            type: 'backup',
            sent_count: numberCounts.get(backup.id) || 0,
          });
        });
      }

      setWhatsappNumbers(numbers);
    } catch (error: any) {
      console.error("Erro ao buscar números WhatsApp:", error);
    } finally {
      setLoadingNumbers(false);
    }
  };

  if (!campaign) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'DRAFT': 'outline',
      'SCHEDULED': 'secondary',
      'RUNNING': 'default',
      'PAUSED': 'secondary',
      'COMPLETED': 'default',
      'CANCELLED': 'destructive',
      'FAILED': 'destructive',
    };

    const labels: Record<string, string> = {
      'DRAFT': 'Rascunho',
      'SCHEDULED': 'Agendada',
      'RUNNING': 'Em Andamento',
      'PAUSED': 'Pausada',
      'COMPLETED': 'Concluída',
      'CANCELLED': 'Cancelada',
      'FAILED': 'Falhou',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getProgressPercentage = () => {
    if (campaign.total_recipients === 0) return 0;
    return Math.round((campaign.sent_count / campaign.total_recipients) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{campaign.name}</DialogTitle>
            {getStatusBadge(campaign.status)}
          </div>
          <DialogDescription>
            Detalhes completos da campanha
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
            <TabsTrigger value="analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Loja</label>
                <p className="text-base">{campaign.store?.name || 'Não especificada'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">{getStatusBadge(campaign.status)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Criada em</label>
                <p className="text-base">
                  {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              {campaign.started_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Iniciada em</label>
                  <p className="text-base">
                    {format(new Date(campaign.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              {campaign.completed_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Concluída em</label>
                  <p className="text-base">
                    {format(new Date(campaign.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              {campaign.scheduled_start_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Agendada para</label>
                  <p className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(campaign.scheduled_start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Destinatários totais</label>
                <p className="text-base">{campaign.total_recipients}</p>
              </div>

              {/* Informações de Agendamento */}
              {campaign.scheduled_start_at && (
                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <label className="text-sm font-medium">Agendamento</label>
                  </div>
                  <p className="text-base">
                    Início agendado: {format(new Date(campaign.scheduled_start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {new Date(campaign.scheduled_start_at) > new Date() && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Iniciará em {Math.ceil((new Date(campaign.scheduled_start_at).getTime() - Date.now()) / (1000 * 60 * 60))} horas
                    </p>
                  )}
                </div>
              )}

              {/* Limites Configurados */}
              {(campaign.start_hour !== null || campaign.end_hour !== null || campaign.min_interval_minutes || campaign.daily_limit) && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <label className="text-sm font-medium">Limites e Configurações</label>
                  </div>
                  <div className="grid gap-2">
                    {campaign.start_hour !== null && campaign.end_hour !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Janela de horário:</span>
                        <span className="text-sm font-medium">
                          {String(campaign.start_hour).padStart(2, '0')}:00 às {String(campaign.end_hour).padStart(2, '0')}:59
                        </span>
                      </div>
                    )}
                    {campaign.min_interval_minutes && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Intervalo entre mensagens:
                        </span>
                        <span className="text-sm font-medium">{campaign.min_interval_minutes} minutos</span>
                      </div>
                    )}
                    {campaign.daily_limit && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Limite diário:</span>
                        <span className="text-sm font-medium">{campaign.daily_limit} mensagens/dia</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Números WhatsApp Usados */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Números WhatsApp Usados</label>
                </div>
                {loadingNumbers ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : whatsappNumbers.length > 0 ? (
                  <div className="space-y-2">
                    {whatsappNumbers.map(num => (
                      <div key={num.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant={num.type === 'primary' ? 'default' : 'secondary'}>
                            {num.type === 'primary' ? 'Principal' : 'Reserva'}
                          </Badge>
                          <span className="text-sm">{num.phone}</span>
                        </div>
                        <span className="text-sm font-medium">{num.sent_count} mensagens</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium text-muted-foreground">Total</label>
                </div>
                <p className="text-2xl font-bold">{campaign.total_recipients}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-green-500" />
                  <label className="text-sm font-medium text-muted-foreground">Enviadas</label>
                </div>
                <p className="text-2xl font-bold text-green-600">{campaign.sent_count}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  <label className="text-sm font-medium text-muted-foreground">Falhas</label>
                </div>
                <p className="text-2xl font-bold text-red-600">{campaign.failed_count}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Progresso</label>
              <div className="w-full bg-secondary rounded-full h-4">
                <div
                  className="bg-primary h-4 rounded-full transition-all"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">{getProgressPercentage()}% concluído</p>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 mt-4">
            <CampaignAnalyticsView
              campaignId={campaign.id}
              storeId={campaign.store_id}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

