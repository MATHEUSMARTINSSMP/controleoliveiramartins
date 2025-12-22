import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Loader2, Rocket } from "lucide-react";
import { BusinessTypeStep } from "./steps/BusinessTypeStep";
import { SegmentStep } from "./steps/SegmentStep";
import { AreaStep } from "./steps/AreaStep";
import { DetailsStep } from "./steps/DetailsStep";
import { ContactStep } from "./steps/ContactStep";
import { VisualStep } from "./steps/VisualStep";
import { ReviewStep } from "./steps/ReviewStep";
import { ONBOARDING_STEPS, DEFAULT_FORM_DATA, type SiteFormData } from "./types";
import { useSiteData } from "./useSiteData";

export function SiteOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SiteFormData>(DEFAULT_FORM_DATA);
  const { createSite, triggerDeploy, isCreating, isDeploying } = useSiteData();
  
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
      const site = await createSite(formData);
      if (site) {
        await triggerDeploy();
      }
    } catch (error) {
      console.error('Erro ao criar site:', error);
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
        return <ReviewStep formData={formData} />;
      default:
        return null;
    }
  };
  
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const isLoading = isCreating || isDeploying;
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Passo {currentStep + 1} de {ONBOARDING_STEPS.length}</span>
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
              data-testid="button-create-site"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isCreating ? 'Criando...' : 'Configurando...'}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Criar Site
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
