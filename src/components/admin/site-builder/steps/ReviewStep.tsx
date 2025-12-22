import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Tags, 
  Target, 
  FileText, 
  Phone, 
  MapPin, 
  Palette,
  CheckCircle
} from "lucide-react";
import { getSegmentById } from "@/lib/site-builder-data";
import type { SiteFormData } from "../types";

interface ReviewStepProps {
  formData: SiteFormData;
}

export function ReviewStep({ formData }: ReviewStepProps) {
  const segment = getSegmentById(formData.segment_id);
  
  const sections = [
    {
      title: 'Tipo de Negócio',
      icon: Building2,
      items: [
        { label: 'Tipo', value: formData.business_type === 'fisico' ? 'Negócio Físico' : 'Negócio Digital' }
      ]
    },
    {
      title: 'Segmento',
      icon: Tags,
      items: [
        { label: 'Segmento', value: formData.segment_name },
        { label: 'Tom de Voz', value: formData.voice_tone },
        { label: 'Tipo de Conteúdo', value: formData.content_type }
      ]
    },
    {
      title: 'Área de Atuação',
      icon: Target,
      items: [
        { label: 'Área', value: formData.area_name || formData.custom_area || 'Não especificada' }
      ]
    },
    {
      title: 'Informações da Empresa',
      icon: FileText,
      items: [
        { label: 'Nome', value: formData.company_name },
        { label: 'Descrição', value: formData.company_description || 'Não informada' }
      ]
    },
    {
      title: 'Contato',
      icon: Phone,
      items: [
        { label: 'WhatsApp', value: formData.whatsapp || 'Não informado' },
        { label: 'E-mail', value: formData.email || 'Não informado' },
        { label: 'Instagram', value: formData.instagram || 'Não informado' }
      ]
    }
  ];
  
  if (formData.business_type === 'fisico') {
    sections.push({
      title: 'Endereço',
      icon: MapPin,
      items: [
        { 
          label: 'Local', 
          value: formData.address_street 
            ? `${formData.address_street}, ${formData.address_number} - ${formData.address_neighborhood}, ${formData.address_city}/${formData.address_state}`
            : 'Não informado'
        }
      ]
    });
  }
  
  sections.push({
    title: 'Visual',
    icon: Palette,
    items: [
      { label: 'Cor Primária', value: formData.color_primary },
      { label: 'Cor Secundária', value: formData.color_secondary },
      { label: 'Cor de Destaque', value: formData.color_accent }
    ]
  });
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Revisar e Confirmar</h2>
        <p className="text-muted-foreground">
          Confira as informações antes de criar seu site
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-4">
        {sections.map((section, index) => {
          const Icon = section.icon;
          
          return (
            <Card key={section.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      {item.label.includes('Cor') ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-md border"
                            style={{ backgroundColor: item.value }}
                          />
                          <span className="font-mono text-xs">{item.value}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-right max-w-[60%] truncate">
                          {item.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {segment && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Tags className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Tom de Voz: {segment.voiceTone.style}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {segment.voiceTone.description}
                  </p>
                  <div className="mt-2 space-y-1">
                    <Badge variant="outline" className="text-xs">
                      Hero: "{segment.voiceTone.examples.hero}"
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Separator />
        
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Ao clicar em "Criar Site", você confirma que as informações estão corretas
            e autoriza a geração automática do conteúdo.
          </p>
        </div>
      </div>
    </div>
  );
}
