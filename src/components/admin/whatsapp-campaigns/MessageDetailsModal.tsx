import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

interface MessageDetailsModalProps {
  message: {
    id: string;
    phone: string;
    message: string;
    status: string;
    sent_at: string | null;
    error_message: string | null;
    created_at: string;
    retry_count?: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (messageId: string) => void;
  retrying?: boolean;
}

export function MessageDetailsModal({ 
  message, 
  open, 
  onOpenChange,
  onRetry,
  retrying = false 
}: MessageDetailsModalProps) {
  if (!message) return null;

  const getStatusIcon = () => {
    switch (message.status) {
      case 'SENT':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'PENDING':
      case 'SCHEDULED':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'SENDING':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'SENT': 'default',
      'FAILED': 'destructive',
      'PENDING': 'secondary',
      'SCHEDULED': 'secondary',
      'SENDING': 'outline',
      'CANCELLED': 'outline',
      'SKIPPED': 'outline',
    };

    return (
      <Badge variant={variants[message.status] || 'outline'}>
        {message.status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes da Mensagem</DialogTitle>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              {getStatusBadge()}
            </div>
          </div>
          <DialogDescription>
            Informações completas sobre o envio desta mensagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Telefone */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Telefone</label>
            <p className="text-base font-medium">{message.phone}</p>
          </div>

          {/* Mensagem */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Mensagem</label>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{message.message}</p>
            </div>
          </div>

          {/* Status e Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Criada em</label>
              <p className="text-base">
                {format(new Date(message.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </p>
            </div>
            {message.sent_at && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Enviada em</label>
                <p className="text-base">
                  {format(new Date(message.sent_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>

          {/* Retry Count */}
          {message.retry_count !== undefined && message.retry_count > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tentativas</label>
              <p className="text-base">{message.retry_count} tentativa(s)</p>
            </div>
          )}

          {/* Erro */}
          {message.error_message && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-destructive mb-1 block">Erro</label>
                  <p className="text-sm text-destructive">{message.error_message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Ação de Retry para mensagens falhas */}
          {message.status === 'FAILED' && onRetry && (
            <div className="pt-4 border-t">
              <Button
                onClick={() => onRetry(message.id)}
                disabled={retrying}
                className="w-full"
                variant="outline"
              >
                {retrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reenviar Mensagem
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

