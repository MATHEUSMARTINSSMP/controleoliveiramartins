import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Plus, 
  Play, 
  Pause, 
  XCircle,
  BarChart3,
  Users,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  RefreshCw,
  Phone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { Campaign } from "./types";
import { CampaignWizard } from "./CampaignWizard";
import { toast } from "sonner";

interface Store {
  id: string;
  name: string;
  site_slug?: string;
  whatsapp_connected?: boolean;
}

export function WhatsAppCampaigns() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (profile?.id) {
      fetchStores();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchCampaigns();
    }
  }, [selectedStoreId]);

  const fetchStores = async () => {
    try {
      const { data: storesData, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, site_slug')
        .eq('admin_id', profile?.id)
        .order('name');

      if (error) throw error;

      const { data: credentialsData } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_credentials')
        .select('site_slug, uazapi_status')
        .eq('admin_id', profile?.id);

      const credentialsMap = new Map(
        (credentialsData || []).map(c => [c.site_slug, c.uazapi_status])
      );

      const storesWithWhatsApp: Store[] = (storesData || []).map(store => ({
        ...store,
        whatsapp_connected: credentialsMap.get(store.site_slug) === 'connected',
      }));

      setStores(storesWithWhatsApp);
      const connectedStore = storesWithWhatsApp.find(s => s.whatsapp_connected);
      if (connectedStore) {
        setSelectedStoreId(connectedStore.id);
      }
    } catch (err) {
      console.error('Erro ao buscar lojas:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_campaigns')
        .select('*')
        .eq('store_id', selectedStoreId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          console.warn('Tabela whatsapp_campaigns ainda não existe');
          setCampaigns([]);
          return;
        }
        throw error;
      }

      setCampaigns(data || []);
    } catch (err) {
      console.error('Erro ao buscar campanhas:', err);
      setCampaigns([]);
    }
  };

  const handleCampaignAction = async (campaignId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const newStatus = action === 'pause' ? 'PAUSED' : action === 'resume' ? 'RUNNING' : 'CANCELLED';
      
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_campaigns')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      if (error) throw error;

      toast.success(`Campanha ${action === 'pause' ? 'pausada' : action === 'resume' ? 'retomada' : 'cancelada'} com sucesso`);
      fetchCampaigns();
    } catch (err) {
      console.error('Erro ao atualizar campanha:', err);
      toast.error('Erro ao atualizar campanha');
    }
  };

  const handleCreateCampaign = async (campaignData: Partial<Campaign>) => {
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_campaigns')
        .insert({
          ...campaignData,
          store_id: selectedStoreId,
          created_by: profile?.id,
          status: 'SCHEDULED',
        });

      if (error) throw error;

      toast.success('Campanha criada com sucesso! Iniciando envios...');
      setShowWizard(false);
      fetchCampaigns();
    } catch (err) {
      console.error('Erro ao criar campanha:', err);
      toast.error('Erro ao criar campanha');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-500';
      case 'PAUSED': return 'bg-yellow-500';
      case 'COMPLETED': return 'bg-blue-500';
      case 'CANCELLED': return 'bg-gray-500';
      case 'FAILED': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Rascunho';
      case 'SCHEDULED': return 'Agendada';
      case 'RUNNING': return 'Em Andamento';
      case 'PAUSED': return 'Pausada';
      case 'COMPLETED': return 'Concluída';
      case 'CANCELLED': return 'Cancelada';
      case 'FAILED': return 'Falhou';
      default: return status;
    }
  };

  const selectedStore = stores.find(s => s.id === selectedStoreId);
  const activeCampaigns = campaigns.filter(c => ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(c.status));
  const historyCampaigns = campaigns.filter(c => ['COMPLETED', 'CANCELLED', 'FAILED'].includes(c.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connectedStores = stores.filter(s => s.whatsapp_connected);

  if (connectedStores.length === 0) {
    return (
      <Alert>
        <Phone className="h-4 w-4" />
        <AlertTitle>WhatsApp não conectado</AlertTitle>
        <AlertDescription>
          Para usar campanhas em massa, conecte primeiro o WhatsApp de uma loja na aba "Conexões".
          Este recurso requer WhatsApp próprio conectado.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-[200px]" data-testid="select-store-campaigns">
              <SelectValue placeholder="Selecione uma loja" />
            </SelectTrigger>
            <SelectContent>
              {connectedStores.map(store => (
                <SelectItem key={store.id} value={store.id}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {store.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            {activeCampaigns.length} ativa(s)
          </Badge>
        </div>

        <Button 
          onClick={() => setShowWizard(true)}
          disabled={!selectedStoreId}
          data-testid="button-new-campaign"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Play className="h-3 w-3" />
            Ativas ({activeCampaigns.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <BarChart3 className="h-3 w-3" />
            Histórico ({historyCampaigns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeCampaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Nenhuma campanha ativa no momento
                </p>
                <Button onClick={() => setShowWizard(true)} data-testid="button-create-first-campaign">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Campanha
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeCampaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onAction={handleCampaignAction}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {historyCampaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma campanha finalizada ainda
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {historyCampaigns.map(campaign => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onAction={handleCampaignAction}
                    isHistory
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Nova Campanha WhatsApp</DialogTitle>
          <CampaignWizard
            storeId={selectedStoreId}
            storeName={selectedStore?.name || ''}
            siteSlug={selectedStore?.site_slug || ''}
            onComplete={handleCreateCampaign}
            onCancel={() => setShowWizard(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CampaignCardProps {
  campaign: Campaign;
  onAction: (id: string, action: 'pause' | 'resume' | 'cancel') => void;
  isHistory?: boolean;
}

function CampaignCard({ campaign, onAction, isHistory }: CampaignCardProps) {
  const progress = campaign.total_recipients > 0 
    ? Math.round((campaign.sent_count / campaign.total_recipients) * 100) 
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-500';
      case 'PAUSED': return 'bg-yellow-500';
      case 'COMPLETED': return 'bg-blue-500';
      case 'CANCELLED': return 'bg-gray-500';
      case 'FAILED': return 'bg-red-500';
      case 'SCHEDULED': return 'bg-purple-500';
      default: return 'bg-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'Agendada';
      case 'RUNNING': return 'Em Andamento';
      case 'PAUSED': return 'Pausada';
      case 'COMPLETED': return 'Concluída';
      case 'CANCELLED': return 'Cancelada';
      case 'FAILED': return 'Falhou';
      default: return status;
    }
  };

  return (
    <Card data-testid={`campaign-card-${campaign.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {campaign.name || 'Campanha sem nome'}
              <Badge className={getStatusColor(campaign.status)}>
                {getStatusLabel(campaign.status)}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Criada em {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
            </CardDescription>
          </div>
          {!isHistory && (
            <div className="flex items-center gap-2">
              {campaign.status === 'RUNNING' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAction(campaign.id, 'pause')}
                  data-testid={`button-pause-${campaign.id}`}
                >
                  <Pause className="h-3 w-3 mr-1" />
                  Pausar
                </Button>
              )}
              {campaign.status === 'PAUSED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAction(campaign.id, 'resume')}
                  data-testid={`button-resume-${campaign.id}`}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Retomar
                </Button>
              )}
              {['RUNNING', 'PAUSED', 'SCHEDULED'].includes(campaign.status) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onAction(campaign.id, 'cancel')}
                  data-testid={`button-cancel-${campaign.id}`}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">
                {campaign.sent_count}/{campaign.total_recipients} ({progress}%)
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center pt-2">
            <div>
              <p className="text-lg font-bold text-green-600">{campaign.sent_count}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
            <div>
              <p className="text-lg font-bold text-muted-foreground">
                {campaign.total_recipients - campaign.sent_count - campaign.failed_count}
              </p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{campaign.failed_count}</p>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </div>
            <div>
              <Badge className={
                campaign.risk_level === 'LOW' ? 'bg-green-500' :
                campaign.risk_level === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'
              }>
                Risco {campaign.risk_level === 'LOW' ? 'Baixo' : campaign.risk_level === 'MEDIUM' ? 'Médio' : 'Alto'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
