import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText } from "lucide-react";
import type { SiteFormData } from "../types";

interface DetailsStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

export function DetailsStep({ formData, onChange }: DetailsStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Detalhes do seu negócio</h2>
        <p className="text-muted-foreground">
          Essas informações serão usadas para gerar o conteúdo do seu site
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Nome da Empresa *</Label>
              <Input
                id="company_name"
                data-testid="input-company-name"
                placeholder="Ex: Salão de Beleza Glamour"
                value={formData.company_name}
                onChange={(e) => onChange({ company_name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_description">
                Descrição curta (será usada no hero do site)
              </Label>
              <Textarea
                id="company_description"
                data-testid="input-company-description"
                placeholder="Descreva seu negócio em 1-2 frases..."
                value={formData.company_description}
                onChange={(e) => onChange({ company_description: e.target.value })}
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_history">
                História / Sobre a Empresa
              </Label>
              <Textarea
                id="company_history"
                data-testid="input-company-history"
                placeholder="Conte um pouco da história do seu negócio, há quanto tempo existe, como começou..."
                value={formData.company_history}
                onChange={(e) => onChange({ company_history: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              O Que Você Oferece
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(formData.content_type === 'servicos' || formData.content_type === 'misto') && (
              <div className="space-y-2">
                <Label htmlFor="services_description">
                  Serviços Oferecidos
                </Label>
                <Textarea
                  id="services_description"
                  data-testid="input-services-description"
                  placeholder="Liste seus principais serviços, separados por vírgula ou em linhas..."
                  value={formData.services_description}
                  onChange={(e) => onChange({ services_description: e.target.value })}
                  rows={3}
                />
              </div>
            )}
            
            {(formData.content_type === 'produtos' || formData.content_type === 'misto') && (
              <div className="space-y-2">
                <Label htmlFor="products_description">
                  Produtos Oferecidos
                </Label>
                <Textarea
                  id="products_description"
                  data-testid="input-products-description"
                  placeholder="Liste seus principais produtos ou categorias..."
                  value={formData.products_description}
                  onChange={(e) => onChange({ products_description: e.target.value })}
                  rows={3}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="differentials">
                Diferenciais (por que escolher você?)
              </Label>
              <Textarea
                id="differentials"
                data-testid="input-differentials"
                placeholder="O que torna seu negócio especial? Qualidade, preço, atendimento, localização..."
                value={formData.differentials}
                onChange={(e) => onChange({ differentials: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
