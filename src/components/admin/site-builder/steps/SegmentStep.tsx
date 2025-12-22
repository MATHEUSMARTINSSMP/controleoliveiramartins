import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, HelpCircle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { SEGMENTS, searchSegments } from "@/lib/site-builder-data";
import type { SiteFormData } from "../types";
import type { LucideIcon } from "lucide-react";

interface SegmentStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

export function SegmentStep({ formData, onChange }: SegmentStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return SEGMENTS;
    return searchSegments(searchQuery);
  }, [searchQuery]);
  
  const getIcon = (iconName: string): LucideIcon => {
    const icons = LucideIcons as unknown as Record<string, LucideIcon>;
    return icons[iconName] || HelpCircle;
  };
  
  const handleSelect = (segment: typeof SEGMENTS[0]) => {
    onChange({
      segment_id: segment.id,
      segment_name: segment.name,
      content_type: segment.contentType,
      voice_tone: segment.voiceTone.style,
      area_id: '',
      area_name: '',
      custom_area: ''
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Qual é o segmento do seu negócio?</h2>
        <p className="text-muted-foreground">
          Selecione o segmento que mais se aproxima da sua atividade
        </p>
      </div>
      
      <div className="max-w-md mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-segment-search"
          placeholder="Buscar segmento..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 px-1">
          {filteredSegments.map((segment) => {
            const Icon = getIcon(segment.icon);
            const isSelected = formData.segment_id === segment.id;
            
            return (
              <Card
                key={segment.id}
                data-testid={`card-segment-${segment.id}`}
                className={`cursor-pointer transition-all hover-elevate ${
                  isSelected 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : ''
                }`}
                onClick={() => handleSelect(segment)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate">{segment.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {segment.areas.length} áreas
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
      
      {filteredSegments.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum segmento encontrado para "{searchQuery}"
        </div>
      )}
    </div>
  );
}
