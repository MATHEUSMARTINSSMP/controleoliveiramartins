import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Image, MousePointer } from "lucide-react";
import type { SiteFormData } from "../types";

interface VisualStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

const PRESET_COLORS = [
  { name: 'Roxo Moderno', primary: '#8B5CF6', secondary: '#1F2937', accent: '#10B981', background: '#FFFFFF' },
  { name: 'Azul Corporativo', primary: '#3B82F6', secondary: '#1E3A5F', accent: '#F59E0B', background: '#FFFFFF' },
  { name: 'Rosa Elegante', primary: '#EC4899', secondary: '#4A1942', accent: '#14B8A6', background: '#FFF5F8' },
  { name: 'Verde Natural', primary: '#10B981', secondary: '#1F2937', accent: '#8B5CF6', background: '#F0FDF4' },
  { name: 'Laranja Vibrante', primary: '#F97316', secondary: '#1F2937', accent: '#06B6D4', background: '#FFFBEB' },
  { name: 'Vermelho Impactante', primary: '#EF4444', secondary: '#1F2937', accent: '#22C55E', background: '#FFFFFF' },
  { name: 'Dourado Premium', primary: '#B8860B', secondary: '#2C2C2C', accent: '#C9A227', background: '#FFFEF5' },
  { name: 'Preto e Branco', primary: '#171717', secondary: '#404040', accent: '#737373', background: '#FFFFFF' },
];

export function VisualStep({ formData, onChange }: VisualStepProps) {
  const applyPreset = (preset: typeof PRESET_COLORS[0]) => {
    onChange({
      color_primary: preset.primary,
      color_secondary: preset.secondary,
      color_accent: preset.accent,
      color_background: preset.background
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Personalização Visual</h2>
        <p className="text-muted-foreground">
          Defina a identidade visual do seu site - cores, logo e imagens
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Paleta de Cores
            </CardTitle>
            <CardDescription>
              Escolha uma paleta pronta ou personalize as cores da sua marca
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-3 block">Paletas Sugeridas:</Label>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    data-testid={`button-preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => applyPreset(preset)}
                    className={`p-3 rounded-md border hover-elevate transition-all ${
                      formData.color_primary === preset.primary 
                        ? 'ring-2 ring-primary' 
                        : ''
                    }`}
                  >
                    <div className="flex gap-1 mb-2 justify-center">
                      <div 
                        className="w-6 h-6 rounded-full border" 
                        style={{ backgroundColor: preset.primary }}
                      />
                      <div 
                        className="w-6 h-6 rounded-full border" 
                        style={{ backgroundColor: preset.secondary }}
                      />
                      <div 
                        className="w-6 h-6 rounded-full border" 
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <span className="text-xs font-medium">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">Cores Personalizadas:</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="color_primary" className="text-xs">Cor Principal</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_primary"
                      data-testid="input-color-primary"
                      value={formData.color_primary}
                      onChange={(e) => onChange({ color_primary: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color_primary}
                      onChange={(e) => onChange({ color_primary: e.target.value })}
                      className="flex-1"
                      placeholder="#8B5CF6"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usada em títulos e botões principais
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color_secondary" className="text-xs">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_secondary"
                      data-testid="input-color-secondary"
                      value={formData.color_secondary}
                      onChange={(e) => onChange({ color_secondary: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color_secondary}
                      onChange={(e) => onChange({ color_secondary: e.target.value })}
                      className="flex-1"
                      placeholder="#1F2937"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usada em textos e fundos escuros
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color_accent" className="text-xs">Cor de Destaque</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_accent"
                      data-testid="input-color-accent"
                      value={formData.color_accent}
                      onChange={(e) => onChange({ color_accent: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color_accent}
                      onChange={(e) => onChange({ color_accent: e.target.value })}
                      className="flex-1"
                      placeholder="#10B981"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usada em detalhes e chamadas para ação
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color_background" className="text-xs">Cor de Fundo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_background"
                      data-testid="input-color-background"
                      value={formData.color_background}
                      onChange={(e) => onChange({ color_background: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color_background}
                      onChange={(e) => onChange({ color_background: e.target.value })}
                      className="flex-1"
                      placeholder="#FFFFFF"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fundo geral do site (geralmente branco ou bem claro)
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-md border bg-muted/30">
              <p className="text-sm text-muted-foreground mb-3">Preview das cores:</p>
              <div className="grid gap-2 md:grid-cols-4">
                <div 
                  className="p-3 rounded-md text-white text-center text-xs font-medium"
                  style={{ backgroundColor: formData.color_primary }}
                >
                  Principal
                </div>
                <div 
                  className="p-3 rounded-md text-white text-center text-xs font-medium"
                  style={{ backgroundColor: formData.color_secondary }}
                >
                  Secundária
                </div>
                <div 
                  className="p-3 rounded-md text-white text-center text-xs font-medium"
                  style={{ backgroundColor: formData.color_accent }}
                >
                  Destaque
                </div>
                <div 
                  className="p-3 rounded-md text-center text-xs font-medium border"
                  style={{ backgroundColor: formData.color_background, color: formData.color_secondary }}
                >
                  Fundo
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="h-5 w-5" />
              Imagens do Site
            </CardTitle>
            <CardDescription>
              Adicione sua logo e imagem de destaque para personalizar o site
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">URL da Logo</Label>
              <Input
                id="logo_url"
                data-testid="input-logo-url"
                placeholder="https://exemplo.com/sua-logo.png"
                value={formData.logo_url}
                onChange={(e) => onChange({ logo_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Cole o link de uma imagem da sua logo (hospedada no Google Drive, Imgur, ou outro serviço). Formatos: PNG, JPG, SVG.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero_image_url">Imagem de Destaque (Banner Principal)</Label>
              <Input
                id="hero_image_url"
                data-testid="input-hero-image-url"
                placeholder="https://exemplo.com/imagem-destaque.jpg"
                value={formData.hero_image_url}
                onChange={(e) => onChange({ hero_image_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Uma foto bonita do seu negócio, equipe ou produto principal. Aparecerá no topo do site. Recomendamos imagens largas (1920x1080 ou maior).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MousePointer className="h-5 w-5" />
              Botão de Ação (CTA)
            </CardTitle>
            <CardDescription>
              Configure o botão principal que aparece no topo do site
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cta_button_text">Texto do Botão</Label>
              <Input
                id="cta_button_text"
                data-testid="input-cta-button-text"
                placeholder="Ex: Fale Conosco, Agende Agora, Peça Orçamento"
                value={formData.cta_button_text}
                onChange={(e) => onChange({ cta_button_text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                O texto que aparece no botão principal do site. Seja direto e convidativo!
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta_whatsapp_message">Mensagem Pré-definida do WhatsApp</Label>
              <Textarea
                id="cta_whatsapp_message"
                data-testid="input-cta-whatsapp-message"
                placeholder="Ex: Olá! Vi o site de vocês e gostaria de mais informações."
                value={formData.cta_whatsapp_message}
                onChange={(e) => onChange({ cta_whatsapp_message: e.target.value })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Quando o cliente clicar no botão de WhatsApp, essa mensagem já estará escrita para ele enviar. Facilita o contato!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
