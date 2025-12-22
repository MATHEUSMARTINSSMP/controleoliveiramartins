import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Target } from "lucide-react";
import { getSegmentById, searchAreas } from "@/lib/site-builder-data";
import type { SiteFormData } from "../types";

interface AreaStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

export function AreaStep({ formData, onChange }: AreaStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const segment = useMemo(() => {
    return getSegmentById(formData.segment_id);
  }, [formData.segment_id]);
  
  const filteredAreas = useMemo(() => {
    if (!segment) return [];
    if (!searchQuery.trim()) return segment.areas;
    return searchAreas(segment.id, searchQuery);
  }, [segment, searchQuery]);
  
  const handleSelect = (area: { id: string; name: string }) => {
    onChange({
      area_id: area.id,
      area_name: area.name,
      custom_area: ''
    });
  };
  
  if (!segment) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Por favor, selecione um segmento primeiro.
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Badge variant="secondary" className="mb-2">
          {segment.name}
        </Badge>
        <h2 className="text-2xl font-bold">Qual é sua área de atuação?</h2>
        <p className="text-muted-foreground">
          Especifique a área dentro do segmento escolhido
        </p>
      </div>
      
      <div className="max-w-md mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-area-search"
          placeholder="Buscar área..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <ScrollArea className="h-[350px]">
        <div className="grid gap-3 md:grid-cols-2 px-1">
          {filteredAreas.map((area) => {
            const isSelected = formData.area_id === area.id;
            
            return (
              <Card
                key={area.id}
                data-testid={`card-area-${area.id}`}
                className={`cursor-pointer transition-all hover-elevate ${
                  isSelected 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : ''
                }`}
                onClick={() => handleSelect(area)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm">{area.name}</h3>
                    {area.keywords.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {area.keywords.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
      
      <div className="max-w-md mx-auto space-y-2">
        <p className="text-sm text-muted-foreground text-center">
          Ou especifique uma área personalizada:
        </p>
        <Input
          data-testid="input-custom-area"
          placeholder="Ex: Moda Sustentável, Doces Gourmet..."
          value={formData.custom_area}
          onChange={(e) => onChange({ 
            custom_area: e.target.value,
            area_id: 'custom',
            area_name: e.target.value
          })}
        />
      </div>
    </div>
  );
}
