import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Loader2, Rocket, Globe, Sparkles, CheckCircle2, AlertCircle, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BusinessTypeStep } from "./steps/BusinessTypeStep";
import { SegmentStep } from "./steps/SegmentStep";
import { AreaStep } from "./steps/AreaStep";
import { DetailsStep } from "./steps/DetailsStep";
import { ContactStep } from "./steps/ContactStep";
import { VisualStep } from "./steps/VisualStep";
import { ReviewStep } from "./steps/ReviewStep";
import { ONBOARDING_STEPS, DEFAULT_FORM_DATA, type SiteFormData } from "./types";
import { useSiteData } from "./useSiteData";

type SetupPhase = 'initial' | 'setting_up' | 'ready' | 'error';

interface SiteOnboardingProps {
  tenantId?: string | null;
}

export function SiteOnboarding({ tenantId }: SiteOnboardingProps = {}) {
  const [setupPhase, setSetupPhase] = useState<SetupPhase>('initial');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SiteFormData>(DEFAULT_FORM_DATA);
  const { 
    createSite, 
    updateSite, 
    triggerDeploy,
    generateContent,
    editSite,
    isCreating, 
    isDeploying,
    isGenerating,
    isEditing,
    isPublished,
    site
  } = useSiteData({ tenantId });
  
  const isEditMode = isPublished && !!site;
  
  const handleStartSetup = () => {
    if (!formData.company_name.trim()) {
      setSetupError('Por favor, informe o nome da sua empresa');
      return;
    }
    
    setSetupError(null);
    setSetupPhase('ready');
  };
  
  const handleRetrySetup = () => {
    setSetupPhase('initial');
    setSetupError(null);
  };
  
  const handleChange = (data: Partial<SiteFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };
  
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!formData.business_type;
      case 1:
        return !!formData.segment_id;
      case 2:
        return !!(formData.area_id || formData.custom_area);
      case 3:
        return !!formData.company_name.trim();
      case 4:
        return !!formData.whatsapp.trim();
      case 5:
        return !!formData.color_primary;
      case 6:
        return true;
      default:
        return false;
    }
  };
  
  const sanitizeFormData = (data: SiteFormData): SiteFormData => {
    const cleanUrl = (url: string) => url.startsWith('blob:') ? '' : url;
    return {
      ...data,
      logo_url: cleanUrl(data.logo_url),
      hero_image_url: cleanUrl(data.hero_image_url),
      gallery_image_1: cleanUrl(data.gallery_image_1),
      gallery_image_2: cleanUrl(data.gallery_image_2),
      gallery_image_3: cleanUrl(data.gallery_image_3),
      gallery_image_4: cleanUrl(data.gallery_image_4),
    };
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const handleSubmit = async () => {
    try {
      if (isEditMode) {
        await updateSite(sanitizeFormData(formData));
        await editSite({ formData });
      } else {
        const newSite = await createSite(sanitizeFormData(formData));
        if (newSite) {
          // generateContent agora faz setup automaticamente se necessário
          await generateContent(formData);
        }
      }
    } catch (error) {
      console.error('Erro ao processar site:', error);
    }
  };
  
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BusinessTypeStep formData={formData} onChange={handleChange} />;
      case 1:
        return <SegmentStep formData={formData} onChange={handleChange} />;
      case 2:
        return <AreaStep formData={formData} onChange={handleChange} />;
      case 3:
        return <DetailsStep formData={formData} onChange={handleChange} />;
      case 4:
        return <ContactStep formData={formData} onChange={handleChange} />;
      case 5:
        return <VisualStep formData={formData} onChange={handleChange} />;
      case 6:
        return <ReviewStep formData={formData} isEditMode={isEditMode} />;
      default:
        return null;
    }
  };
  
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isSettingUp = isCreating;
  const isLoading = isSettingUp || isDeploying || isGenerating || isEditing;
  
  if (setupPhase === 'initial' || setupPhase === 'setting_up' || setupPhase === 'error') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Globe className="h-10 w-10 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Crie seu Site Institucional</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Em poucos minutos você terá um site profissional para sua empresa, 
                gerado por inteligência artificial e hospedado gratuitamente.
              </p>
            </div>
            
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="text-left">
                <label className="text-sm font-medium mb-2 block">
                  Nome da sua empresa
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => handleChange({ company_name: e.target.value })}
                  placeholder="Ex: Studio Glamour, Padaria do João..."
                  className="w-full px-4 py-3 border rounded-md bg-background text-foreground"
                  disabled={setupPhase === 'setting_up'}
                  data-testid="input-company-name-initial"
                />
                {setupError && (
                  <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {setupError}
                  </p>
                )}
              </div>
              
              <Button 
                onClick={handleStartSetup}
                disabled={isSettingUp || !formData.company_name.trim()}
                className="w-full"
                size="lg"
                data-testid="button-start-setup"
              >
                {isSettingUp ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Criando seu site...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Começar Agora
                  </>
                )}
              </Button>
              
              {setupPhase === 'error' && (
                <Button 
                  variant="outline" 
                  onClick={handleRetrySetup}
                  className="w-full"
                  data-testid="button-retry-setup"
                >
                  Tentar Novamente
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-4 border-t text-center text-sm text-muted-foreground">
              <div className="space-y-1">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
                <p>Hospedagem Grátis</p>
              </div>
              <div className="space-y-1">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
                <p>Design Profissional</p>
              </div>
              <div className="space-y-1">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500" />
                <p>Pronto em Minutos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Passo {currentStep + 1} de {ONBOARDING_STEPS.length}</span>
            {isEditMode && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Pencil className="h-3 w-3" />
                Editando
              </Badge>
            )}
            {!isEditMode && site && (
              <Badge variant="outline" className="text-xs gap-1">
                <Plus className="h-3 w-3" />
                Criando
              </Badge>
            )}
          </div>
          <span>{ONBOARDING_STEPS[currentStep].title}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      <Card>
        <CardContent className="pt-6 min-h-[500px]">
          {renderStep()}
        </CardContent>
        
        <CardFooter className="flex justify-between gap-4 border-t pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || isLoading}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isLoading}
              data-testid="button-generate-site"
            >
              {isDeploying || isGenerating || isEditing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? 'Atualizando...' : isDeploying ? 'Configurando repositório...' : 'Gerando com IA...'}
                </>
              ) : (
                <>
                  {isEditMode ? (
                    <>
                      <Pencil className="h-4 w-4 mr-2" />
                      Atualizar Site
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Gerar Meu Site
                    </>
                  )}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              data-testid="button-next"
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
      
      <div className="flex justify-center gap-2">
        {ONBOARDING_STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => index < currentStep && setCurrentStep(index)}
            disabled={index > currentStep}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentStep
                ? 'bg-primary w-6'
                : index < currentStep
                  ? 'bg-primary/50 cursor-pointer'
                  : 'bg-muted'
            }`}
            data-testid={`step-indicator-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
