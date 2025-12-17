import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  Copy, 
  Check,
  Loader2,
  Lightbulb,
  Variable
} from "lucide-react";
import { TemplateVariation, AVAILABLE_VARIABLES } from "../types";
import { cn } from "@/lib/utils";

interface TemplateStepProps {
  storeName: string;
  baseTemplate: string;
  onTemplateChange: (template: string) => void;
  variations: TemplateVariation[];
  onVariationsChange: (variations: TemplateVariation[]) => void;
  isGenerating: boolean;
  onGenerateVariations: () => void;
}

export function TemplateStep({
  storeName,
  baseTemplate,
  onTemplateChange,
  variations,
  onVariationsChange,
  isGenerating,
  onGenerateVariations,
}: TemplateStepProps) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const insertVariable = (varKey: string) => {
    const varText = `{${varKey}}`;
    onTemplateChange(baseTemplate + varText);
  };

  const copyVariable = (varKey: string) => {
    navigator.clipboard.writeText(`{${varKey}}`);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const toggleVariationApproval = (varId: string) => {
    const updated = variations.map(v =>
      v.id === varId ? { ...v, approved: !v.approved } : v
    );
    onVariationsChange(updated);
  };

  const approvedCount = variations.filter(v => v.approved).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Variable className="h-4 w-4" />
            Variáveis Disponíveis
          </CardTitle>
          <CardDescription className="text-xs">
            Clique para copiar e cole no template. As variáveis serão substituídas automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map(v => (
              <Badge
                key={v.key}
                variant="outline"
                className="cursor-pointer hover-elevate py-1.5 px-3"
                onClick={() => copyVariable(v.key)}
                data-testid={`var-${v.key}`}
              >
                {copiedVar === v.key ? (
                  <Check className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {`{${v.key}}`}
                <span className="text-muted-foreground ml-1 text-[10px]">
                  ex: {v.example}
                </span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Template Base</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {baseTemplate.length} caracteres
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={baseTemplate}
            onChange={(e) => onTemplateChange(e.target.value)}
            placeholder={`Olá {primeiro_nome}! 👋

Sentimos sua falta aqui na ${storeName}! 
Já faz {dias_sem_comprar} dias desde sua última visita.

Temos novidades incríveis esperando por você! 
Venha nos visitar.

Até logo! 💜`}
            className="min-h-[150px] text-sm"
            data-testid="textarea-template"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lightbulb className="h-3 w-3" />
            Dica: Use no máximo 300 caracteres para melhor legibilidade
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Variações com IA
              </CardTitle>
              <CardDescription className="text-xs">
                A IA gera variações para parecer mais natural e evitar spam
              </CardDescription>
            </div>
            <Button
              onClick={onGenerateVariations}
              disabled={baseTemplate.length < 20 || isGenerating}
              size="sm"
              data-testid="button-generate-variations"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Variações
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {variations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                Escreva seu template e clique em "Gerar Variações"
              </p>
              <p className="text-xs mt-1">
                A IA criará versões alternativas para rotacionar nos envios
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {approvedCount} de {variations.length} variações aprovadas
                </span>
                {approvedCount === 0 && (
                  <Badge variant="destructive" className="text-xs">
                    Aprove pelo menos 1 variação
                  </Badge>
                )}
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {variations.map((variation, index) => (
                    <div
                      key={variation.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        variation.approved
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => toggleVariationApproval(variation.id)}
                      data-testid={`variation-${variation.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={variation.approved}
                          onCheckedChange={() => toggleVariationApproval(variation.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              Variação {index + 1}
                            </Badge>
                            {variation.approved && (
                              <Badge className="text-xs bg-green-500">
                                <Check className="h-3 w-3 mr-1" />
                                Aprovada
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{variation.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
