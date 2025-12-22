import { Card, CardContent } from "@/components/ui/card";
import { Building2, Globe } from "lucide-react";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/site-builder-data";
import type { SiteFormData } from "../types";

interface BusinessTypeStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

export function BusinessTypeStep({ formData, onChange }: BusinessTypeStepProps) {
  const icons: Record<string, typeof Building2> = {
    fisico: Building2,
    digital: Globe
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Qual é o tipo do seu negócio?</h2>
        <p className="text-muted-foreground">
          Isso nos ajuda a personalizar o conteúdo do seu site
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        {BUSINESS_TYPES.map((type) => {
          const Icon = icons[type.id];
          const isSelected = formData.business_type === type.id;
          
          return (
            <Card
              key={type.id}
              data-testid={`card-business-type-${type.id}`}
              className={`cursor-pointer transition-all hover-elevate ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : ''
              }`}
              onClick={() => onChange({ business_type: type.id as BusinessType })}
            >
              <CardContent className="p-6 text-center space-y-4">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <Icon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{type.name}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
