import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterStep } from "./steps/FilterStep";
import { TemplateStep } from "./steps/TemplateStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import { ReviewStep } from "./steps/ReviewStep";
import { Campaign, FilterConfig, CustomerStats, TemplateVariation, ImportedContact, AudienceSource } from "./types";

interface CampaignWizardProps {
  storeId: string;
  storeName: string;
  onComplete: (campaign: Partial<Campaign>) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 'filter', title: 'Seleção', icon: Users, description: 'Filtrar clientes' },
  { id: 'template', title: 'Mensagem', icon: MessageSquare, description: 'Template e IA' },
  { id: 'schedule', title: 'Agendamento', icon: Clock, description: 'Horários e rotação' },
  { id: 'review', title: 'Revisão', icon: CheckCircle2, description: 'Confirmar envio' },
];

export function CampaignWizard({ storeId, storeName, onComplete, onCancel }: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [campaignData, setCampaignData] = useState<Partial<Campaign>>({
    name: '',
    description: '',
    filter_config: { filters: [], combineLogic: 'AND' },
    daily_limit: 50,
    start_hour: 9,
    end_hour: 18,
    active_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    min_interval_minutes: 5,
    use_rotation: false,
    rotation_strategy: 'EQUAL',
  });
  
  const [selectedContacts, setSelectedContacts] = useState<CustomerStats[]>([]);
  const [baseTemplate, setBaseTemplate] = useState('');
  const [variations, setVariations] = useState<TemplateVariation[]>([]);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [audienceSource, setAudienceSource] = useState<AudienceSource>('CRM');
  const [importedContacts, setImportedContacts] = useState<ImportedContact[]>([]);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    onComplete({
      ...campaignData,
      store_id: storeId,
      total_recipients: getTotalRecipients(),
    });
  };

  const getTotalRecipients = () => {
    if (audienceSource === 'IMPORT') {
      return importedContacts.filter(c => c.selected).length;
    }
    return selectedContacts.length;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return getTotalRecipients() > 0;
      case 1: return baseTemplate.length > 10 && variations.some(v => v.approved);
      case 2: return (campaignData.daily_limit || 0) > 0;
      case 3: return true;
      default: return false;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Nova Campanha WhatsApp
            </CardTitle>
            <CardDescription>
              {storeName} - Envio inteligente com IA
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            Passo {currentStep + 1} de {STEPS.length}
          </Badge>
        </div>
        
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex items-center justify-between mt-4 gap-2 overflow-x-auto pb-2">
          {STEPS.map((step, index) => (
            <div 
              key={step.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors min-w-fit",
                index === currentStep 
                  ? "bg-primary text-primary-foreground" 
                  : index < currentStep 
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
              )}
            >
              <step.icon className="h-4 w-4" />
              <div className="hidden sm:block">
                <p className="text-xs font-medium">{step.title}</p>
                <p className="text-[10px] opacity-80">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="min-h-[400px]">
        {currentStep === 0 && (
          <FilterStep
            storeId={storeId}
            filterConfig={campaignData.filter_config!}
            onFilterChange={(config) => setCampaignData({ ...campaignData, filter_config: config })}
            selectedContacts={selectedContacts}
            onContactsChange={setSelectedContacts}
            audienceSource={audienceSource}
            onAudienceSourceChange={setAudienceSource}
            importedContacts={importedContacts}
            onImportedContactsChange={setImportedContacts}
          />
        )}

        {currentStep === 1 && (
          <TemplateStep
            storeName={storeName}
            baseTemplate={baseTemplate}
            onTemplateChange={setBaseTemplate}
            variations={variations}
            onVariationsChange={setVariations}
            isGenerating={isGeneratingVariations}
            onGenerateVariations={async () => {
              setIsGeneratingVariations(true);
              try {
                const n8nUrl = import.meta.env.VITE_N8N_BASE_URL;
                const response = await fetch(`${n8nUrl}/webhook/whatsapp-campaign`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'generate_variations',
                    store_id: storeId,
                    data: {
                      base_template: baseTemplate,
                      campaign_context: `Campanha de reativação para ${getTotalRecipients()} clientes da loja ${storeName}`,
                    },
                  }),
                });
                const data = await response.json();
                if (data.success && data.variations) {
                  setVariations(data.variations.map((v: any, i: number) => ({
                    id: `v${i + 1}`,
                    text: typeof v === 'string' ? v : v.text,
                    approved: false,
                    created_at: new Date().toISOString(),
                  })));
                }
              } catch (error) {
                console.error('Erro ao gerar variações:', error);
              } finally {
                setIsGeneratingVariations(false);
              }
            }}
          />
        )}

        {currentStep === 2 && (
          <ScheduleStep
            config={{
              daily_limit: campaignData.daily_limit!,
              start_hour: campaignData.start_hour!,
              end_hour: campaignData.end_hour!,
              active_days: campaignData.active_days!,
              min_interval_minutes: campaignData.min_interval_minutes!,
              use_rotation: campaignData.use_rotation!,
              rotation_strategy: campaignData.rotation_strategy!,
            }}
            totalRecipients={getTotalRecipients()}
            storeId={storeId}
            onChange={(config) => setCampaignData({ 
              ...campaignData, 
              ...config,
              rotation_strategy: (config.rotation_strategy as 'EQUAL' | 'PRIMARY_FIRST' | 'RANDOM') || campaignData.rotation_strategy
            })}
          />
        )}

        {currentStep === 3 && (
          <ReviewStep
            campaignData={campaignData}
            selectedContacts={selectedContacts}
            baseTemplate={baseTemplate}
            variations={variations}
            storeName={storeName}
            audienceSource={audienceSource}
            importedContacts={importedContacts.filter(c => c.selected)}
          />
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-4 pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={currentStep === 0 ? onCancel : handleBack}
          data-testid="button-wizard-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? 'Cancelar' : 'Voltar'}
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button 
            onClick={handleNext} 
            disabled={!canProceed()}
            data-testid="button-wizard-next"
          >
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={handleComplete}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-wizard-complete"
          >
            <Send className="h-4 w-4 mr-2" />
            Iniciar Campanha
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
