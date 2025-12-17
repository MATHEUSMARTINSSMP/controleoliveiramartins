import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  Users, 
  MessageSquare, 
  Clock,
  AlertTriangle,
  Shield,
  Sparkles
} from "lucide-react";
import { Campaign, CustomerStats, TemplateVariation, ImportedContact, AudienceSource, PreparedContact, PrepareWebhookResponse } from "../types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Eye } from "lucide-react";

interface ReviewStepProps {
  campaignData: Partial<Campaign>;
  selectedContacts: CustomerStats[];
  baseTemplate: string;
  variations: TemplateVariation[];
  storeName: string;
  audienceSource?: AudienceSource;
  importedContacts?: ImportedContact[];
  preparedContacts?: PreparedContact[];
  isPreparing?: boolean;
  onPrepareCampaign?: () => void;
  prepareResponse?: PrepareWebhookResponse | null;
}

export function ReviewStep({ 
  campaignData, 
  selectedContacts, 
  baseTemplate, 
  variations,
  storeName,
  audienceSource = 'CRM',
  importedContacts = [],
  preparedContacts = [],
  isPreparing = false,
  onPrepareCampaign,
  prepareResponse
}: ReviewStepProps) {
  const approvedVariations = variations.filter(v => v.approved);
  const activeDays = campaignData.active_days || [];
  
  const totalRecipients = audienceSource === 'IMPORT' 
    ? importedContacts.length 
    : selectedContacts.length;
  
  const estimatedDays = Math.ceil(totalRecipients / (campaignData.daily_limit || 50));

  const getRiskColor = (level: string | undefined) => {
    switch (level) {
      case 'LOW': return 'bg-green-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'HIGH': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const formatDays = (days: string[]) => {
    const dayNames: Record<string, string> = {
      'MON': 'Seg', 'TUE': 'Ter', 'WED': 'Qua',
      'THU': 'Qui', 'FRI': 'Sex', 'SAT': 'Sáb', 'SUN': 'Dom'
    };
    return days.map(d => dayNames[d] || d).join(', ');
  };

  const calculateRisk = () => {
    let score = 0;
    const interval = campaignData.min_interval_minutes || 5;
    const daily = campaignData.daily_limit || 50;
    
    if (interval <= 1) score += 3;
    else if (interval <= 3) score += 2;
    else score += 1;
    
    if (daily > 100) score += 3;
    else if (daily > 50) score += 2;
    else score += 1;
    
    if (campaignData.use_rotation) score -= 1;
    
    if (score >= 5) return 'HIGH';
    if (score >= 3) return 'MEDIUM';
    return 'LOW';
  };

  const riskLevel = calculateRisk();

  return (
    <div className="space-y-4">
      <Alert className={cn(
        "border-2",
        riskLevel === 'LOW' && "border-green-500",
        riskLevel === 'MEDIUM' && "border-yellow-500",
        riskLevel === 'HIGH' && "border-red-500"
      )}>
        <Shield className="h-5 w-5" />
        <AlertTitle>Confirmação de Campanha</AlertTitle>
        <AlertDescription>
          Revise todas as informações antes de iniciar o envio.
          Uma vez iniciada, a campanha pode ser pausada ou cancelada.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Destinatários
              {audienceSource === 'IMPORT' && (
                <Badge variant="outline" className="text-xs">Lista Importada</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total selecionados</span>
              <span className="font-bold text-lg">{totalRecipients}</span>
            </div>
            {audienceSource === 'CRM' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Faturamento total</span>
                  <span className="font-medium">
                    {formatCurrency(selectedContacts.reduce((acc, c) => acc + c.total_compras, 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ticket médio</span>
                  <span className="font-medium">
                    {formatCurrency(
                      selectedContacts.reduce((acc, c) => acc + c.ticket_medio, 0) / selectedContacts.length || 0
                    )}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Categorias:</p>
                  <div className="flex flex-wrap gap-1">
                    {['BLACK', 'PLATINUM', 'VIP', 'REGULAR'].map(cat => {
                      const count = selectedContacts.filter(c => c.categoria === cat).length;
                      if (count === 0) return null;
                      return (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}: {count}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Contatos importados via planilha</p>
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {'{primeiro_nome}'}, {'{telefone}'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Agendamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Limite diário</span>
              <span className="font-medium">{campaignData.daily_limit} msgs/dia</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Horário</span>
              <span className="font-medium">
                {String(campaignData.start_hour).padStart(2, '0')}:00 - {String(campaignData.end_hour).padStart(2, '0')}:00
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Intervalo</span>
              <span className="font-medium">{campaignData.min_interval_minutes} min entre msgs</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dias ativos</span>
              <span className="font-medium text-xs">{formatDays(activeDays)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rotação</span>
              <Badge variant={campaignData.use_rotation ? "default" : "secondary"}>
                {campaignData.use_rotation ? "Ativa" : "Desativada"}
              </Badge>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Duração estimada</span>
              <span className="font-bold text-lg">{estimatedDays} dias</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Template base:</p>
            <div className="p-3 rounded-lg bg-muted text-sm whitespace-pre-wrap">
              {baseTemplate}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {approvedVariations.length} variações aprovadas para rotação
            </p>
            <ScrollArea className="h-[100px]">
              <div className="space-y-2 pr-4">
                {approvedVariations.map((v, i) => (
                  <div key={v.id} className="p-2 rounded border text-xs">
                    <Badge variant="outline" className="mb-1">Variação {i + 1}</Badge>
                    <p className="whitespace-pre-wrap">{v.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Preparar Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!prepareResponse ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Clique para buscar os contatos e gerar as variações de mensagem.
                Você poderá revisar antes de enviar.
              </p>
              <Button 
                onClick={onPrepareCampaign}
                disabled={isPreparing}
                size="lg"
                data-testid="button-prepare-campaign"
              >
                {isPreparing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preparar e Visualizar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert className="border-green-500">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <AlertTitle>Campanha Preparada</AlertTitle>
                <AlertDescription>
                  {prepareResponse.total_contacts} contatos encontrados e prontos para envio.
                </AlertDescription>
              </Alert>
              
              {preparedContacts.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Preview ({Math.min(5, preparedContacts.length)} de {prepareResponse.total_contacts}):
                  </p>
                  <ScrollArea className="h-[120px]">
                    <div className="space-y-2 pr-4">
                      {preparedContacts.slice(0, 5).map((contact, i) => (
                        <div key={i} className="p-2 rounded border text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{contact.contact_name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              V{contact.variation_index}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground truncate">
                            {contact.message_variation.substring(0, 80)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn(
        "border-2",
        riskLevel === 'LOW' && "border-green-500",
        riskLevel === 'MEDIUM' && "border-yellow-500",
        riskLevel === 'HIGH' && "border-red-500"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                riskLevel === 'LOW' && "bg-green-100 dark:bg-green-900/30",
                riskLevel === 'MEDIUM' && "bg-yellow-100 dark:bg-yellow-900/30",
                riskLevel === 'HIGH' && "bg-red-100 dark:bg-red-900/30"
              )}>
                {riskLevel === 'LOW' ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertTriangle className={cn(
                    "h-6 w-6",
                    riskLevel === 'MEDIUM' ? "text-yellow-600" : "text-red-600"
                  )} />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {riskLevel === 'LOW' && "Campanha Segura"}
                  {riskLevel === 'MEDIUM' && "Atenção Recomendada"}
                  {riskLevel === 'HIGH' && "Alto Risco de Banimento"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {riskLevel === 'LOW' && "Configurações dentro dos limites seguros"}
                  {riskLevel === 'MEDIUM' && "Considere ajustar volume ou intervalo"}
                  {riskLevel === 'HIGH' && "Recomendamos reduzir volume e aumentar intervalo"}
                </p>
              </div>
            </div>
            <Badge className={getRiskColor(riskLevel)}>
              {riskLevel === 'LOW' && "BAIXO"}
              {riskLevel === 'MEDIUM' && "MÉDIO"}
              {riskLevel === 'HIGH' && "ALTO"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
