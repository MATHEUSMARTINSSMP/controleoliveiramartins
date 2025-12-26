/**
 * Seletor de Formatos do Instagram
 * Mostra os formatos disponíveis com ilustrações visuais
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Instagram, Square, RectangleHorizontal, RectangleVertical } from 'lucide-react';

export interface InstagramFormat {
  id: string;
  name: string;
  description: string;
  dimensions: string;
  aspectRatio: string;
  icon: React.ReactNode;
  color: string;
  examples: string[];
}

export const INSTAGRAM_FORMATS: InstagramFormat[] = [
  {
    id: 'post',
    name: 'Post Quadrado',
    description: 'Formato clássico do feed',
    dimensions: '1080 x 1080 px',
    aspectRatio: '1:1',
    icon: <Square className="h-6 w-6" />,
    color: 'bg-blue-500',
    examples: ['Feed principal', 'Melhor para produtos', 'Mais visualizado'],
  },
  {
    id: 'story',
    name: 'Stories',
    description: 'Conteúdo vertical temporário',
    dimensions: '1080 x 1920 px',
    aspectRatio: '9:16',
    icon: <RectangleVertical className="h-6 w-6" />,
    color: 'bg-purple-500',
    examples: ['24 horas de duração', 'Ideal para promoções', 'Alta interação'],
  },
  {
    id: 'reel',
    name: 'Reels',
    description: 'Vídeos curtos verticais',
    dimensions: '1080 x 1920 px',
    aspectRatio: '9:16',
    icon: <RectangleVertical className="h-6 w-6" />,
    color: 'bg-pink-500',
    examples: ['Até 90 segundos', 'Algoritmo prioriza', 'Máximo engajamento'],
  },
  {
    id: 'carousel',
    name: 'Carrossel',
    description: 'Múltiplas imagens em um post',
    dimensions: '1080 x 1080 px (cada)',
    aspectRatio: '1:1',
    icon: <Square className="h-6 w-6" />,
    color: 'bg-green-500',
    examples: ['Até 10 imagens', 'Conta histórias', 'Mais informações'],
  },
  {
    id: 'landscape',
    name: 'Post Horizontal',
    description: 'Formato paisagem',
    dimensions: '1080 x 566 px',
    aspectRatio: '1.91:1',
    icon: <RectangleHorizontal className="h-6 w-6" />,
    color: 'bg-orange-500',
    examples: ['Feed principal', 'Boa para paisagens', 'Menos comum'],
  },
];

interface InstagramFormatSelectorProps {
  selectedFormat?: string;
  onFormatSelect: (formatId: string) => void;
}

export function InstagramFormatSelector({ selectedFormat, onFormatSelect }: InstagramFormatSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Instagram className="h-5 w-5" />
          Formatos do Instagram
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Escolha o formato ideal para seu conteúdo. Cada formato tem características específicas de tamanho e uso.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INSTAGRAM_FORMATS.map((format) => (
          <Card
            key={format.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedFormat === format.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onFormatSelect(format.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${format.color} text-white`}>
                    {format.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{format.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {format.description}
                    </CardDescription>
                  </div>
                </div>
                {selectedFormat === format.id && (
                  <Badge variant="default">Selecionado</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Ilustração do formato */}
              <div className="flex items-center justify-center bg-muted rounded-lg p-4">
                <div
                  className={`${format.color} rounded shadow-lg`}
                  style={{
                    width:
                      format.aspectRatio === '1:1'
                        ? '80px'
                        : format.aspectRatio === '9:16'
                        ? '45px'
                        : '120px',
                    height:
                      format.aspectRatio === '1:1'
                        ? '80px'
                        : format.aspectRatio === '9:16'
                        ? '80px'
                        : '63px',
                  }}
                >
                  <div className="h-full w-full flex items-center justify-center text-white text-xs font-bold">
                    {format.aspectRatio}
                  </div>
                </div>
              </div>

              {/* Dimensões */}
              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  {format.dimensions}
                </Badge>
              </div>

              {/* Exemplos de uso */}
              <div className="space-y-1">
                {format.examples.map((example, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                    {example}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

