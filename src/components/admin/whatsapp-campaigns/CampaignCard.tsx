import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, X, CheckCircle2, XCircle, Users, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppCampaign } from "./types";
import { CampaignActions } from "./CampaignActions";

interface CampaignCardProps {
  campaign: WhatsAppCampaign;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  stats?: {
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
  loadingStats?: boolean;
  loadingPause?: boolean;
  loadingResume?: boolean;
  loadingCancel?: boolean;
  onViewDetails?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function CampaignCard({
  campaign,
  isExpanded,
  onToggleExpand,
  onPause,
  onResume,
  onCancel,
  stats,
  loadingStats,
  loadingPause,
  loadingResume,
  loadingCancel,
  onViewDetails,
  onDuplicate,
  onDelete,
  onEdit,
}: CampaignCardProps) {
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

  const getEstimatedCompletionTime = () => {
    if (campaign.status !== 'RUNNING' && campaign.status !== 'SCHEDULED') return null;
    if (campaign.total_recipients === 0 || campaign.sent_count >= campaign.total_recipients) return null;

    const remaining = campaign.total_recipients - campaign.sent_count;
    const intervalMinutes = campaign.min_interval_minutes || 1; // Default 1 minuto se não especificado
    const estimatedMinutes = remaining * intervalMinutes;

    // Considerar janela de horário se configurada
    if (campaign.start_hour !== null && campaign.end_hour !== null) {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(campaign.start_hour, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(campaign.end_hour, 59, 59, 999);

      // Se estamos fora da janela, começar a contar do próximo dia
      if (now < todayStart) {
        // Começará hoje
        const startOfWindow = todayStart;
        const windowDuration = (campaign.end_hour - campaign.start_hour) * 60; // minutos na janela
        const messagesPerDay = Math.floor(windowDuration / intervalMinutes);
        
        if (messagesPerDay === 0) return null; // Janela muito pequena
        
        const daysNeeded = Math.ceil(remaining / messagesPerDay);
        const estimatedCompletion = addMinutes(startOfWindow, daysNeeded * windowDuration);
        return estimatedCompletion;
      } else if (now > todayEnd) {
        // Próximo dia
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(campaign.start_hour, 0, 0, 0);
        const windowDuration = (campaign.end_hour - campaign.start_hour) * 60;
        const messagesPerDay = Math.floor(windowDuration / intervalMinutes);
        
        if (messagesPerDay === 0) return null;
        
        const daysNeeded = Math.ceil(remaining / messagesPerDay);
        const estimatedCompletion = addMinutes(tomorrow, daysNeeded * windowDuration);
        return estimatedCompletion;
      } else {
        // Dentro da janela hoje
        const remainingTodayMinutes = (todayEnd.getTime() - now.getTime()) / (1000 * 60);
        const messagesToday = Math.floor(remainingTodayMinutes / intervalMinutes);
        const remainingAfterToday = Math.max(0, remaining - messagesToday);
        
        if (remainingAfterToday === 0) {
          // Concluirá hoje
          return addMinutes(now, remaining * intervalMinutes);
        } else {
          // Vai para os próximos dias
          const windowDuration = (campaign.end_hour - campaign.start_hour) * 60;
          const messagesPerDay = Math.floor(windowDuration / intervalMinutes);
          if (messagesPerDay === 0) return null;
          
          const daysNeeded = Math.ceil(remainingAfterToday / messagesPerDay);
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(campaign.start_hour, 0, 0, 0);
          const estimatedCompletion = addMinutes(tomorrow, daysNeeded * windowDuration);
          return estimatedCompletion;
        }
      }
    } else {
      // Sem janela de horário, estimativa simples
      return addMinutes(new Date(), estimatedMinutes);
    }
  };

  const estimatedCompletion = getEstimatedCompletionTime();

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onToggleExpand}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              {getStatusBadge(campaign.status)}
            </div>
            <CardDescription>
              <div className="flex items-center gap-2 flex-wrap">
                <span>{campaign.store?.name || 'Loja não encontrada'}</span>
                {campaign.category && (
                  <Badge variant="outline" className="text-xs">
                    {campaign.category}
                  </Badge>
                )}
                {campaign.scheduled_start_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Agendada para {format(new Date(campaign.scheduled_start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
            </CardDescription>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
            {onViewDetails && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails();
                }}
              >
                Detalhes
              </Button>
            )}
            <CampaignActions
              status={campaign.status}
              onPause={onPause}
              onResume={onResume}
              onCancel={onCancel}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onEdit={onEdit}
              loadingPause={loadingPause}
              loadingResume={loadingResume}
              loadingCancel={loadingCancel}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Destinatários</p>
              <p className="text-lg font-semibold">{campaign.total_recipients}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Enviadas</p>
              <p className="text-lg font-semibold">{campaign.sent_count}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Falhas</p>
              <p className="text-lg font-semibold">{campaign.failed_count}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Progresso</p>
              <p className="text-lg font-semibold">{getProgressPercentage()}%</p>
            </div>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="w-full bg-secondary rounded-full h-2 mb-4">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>

        {/* Estatísticas detalhadas (expandidas) */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            {loadingStats ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
            ) : stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-lg font-semibold">
                      {stats.pending + stats.sending}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Enviadas</p>
                    <p className="text-lg font-semibold">
                      {stats.sent}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Falhas</p>
                    <p className="text-lg font-semibold">
                      {stats.failed}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <CampaignMessages campaignId={campaign.id} />
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-2">
          Criada em {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          {campaign.started_at && (
            <span> • Iniciada em {format(new Date(campaign.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

