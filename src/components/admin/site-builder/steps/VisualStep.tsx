import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Palette } from "lucide-react";
import type { SiteFormData } from "../types";

interface VisualStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

const PRESET_COLORS = [
  { name: 'Roxo', primary: '#8B5CF6', secondary: '#1F2937', accent: '#10B981' },
  { name: 'Azul', primary: '#3B82F6', secondary: '#1E3A5F', accent: '#F59E0B' },
  { name: 'Rosa', primary: '#EC4899', secondary: '#4A1942', accent: '#14B8A6' },
  { name: 'Verde', primary: '#10B981', secondary: '#1F2937', accent: '#8B5CF6' },
  { name: 'Laranja', primary: '#F97316', secondary: '#1F2937', accent: '#06B6D4' },
  { name: 'Vermelho', primary: '#EF4444', secondary: '#1F2937', accent: '#22C55E' },
];

export function VisualStep({ formData, onChange }: VisualStepProps) {
  const applyPreset = (preset: typeof PRESET_COLORS[0]) => {
    onChange({
      color_primary: preset.primary,
      color_secondary: preset.secondary,
      color_accent: preset.accent
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Personalização Visual</h2>
        <p className="text-muted-foreground">
          Escolha as cores que representam sua marca
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Paletas Prontas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  data-testid={`button-preset-${preset.name.toLowerCase()}`}
                  onClick={() => applyPreset(preset)}
                  className={`p-3 rounded-md border hover-elevate transition-all ${
                    formData.color_primary === preset.primary 
                      ? 'ring-2 ring-primary' 
                      : ''
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    <div 
                      className="w-8 h-8 rounded-md" 
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-8 h-8 rounded-md" 
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <div 
                      className="w-8 h-8 rounded-md" 
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <span className="text-sm font-medium">{preset.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Cores Personalizadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="color_primary">Cor Primária</Label>
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
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="color_secondary">Cor Secundária</Label>
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
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="color_accent">Cor de Destaque</Label>
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
              </div>
            </div>
            
            <div className="mt-6 p-4 rounded-md border">
              <p className="text-sm text-muted-foreground mb-3">Preview:</p>
              <div className="space-y-2">
                <div 
                  className="p-4 rounded-md text-white"
                  style={{ backgroundColor: formData.color_primary }}
                >
                  <span className="font-semibold">Cor Primária</span> - Títulos, botões principais
                </div>
                <div 
                  className="p-4 rounded-md text-white"
                  style={{ backgroundColor: formData.color_secondary }}
                >
                  <span className="font-semibold">Cor Secundária</span> - Textos, backgrounds
                </div>
                <div 
                  className="p-4 rounded-md text-white"
                  style={{ backgroundColor: formData.color_accent }}
                >
                  <span className="font-semibold">Cor de Destaque</span> - CTAs, destaques
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
