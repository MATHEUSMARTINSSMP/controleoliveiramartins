import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, CheckCircle2, Edit2, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PromptAlternative {
  prompt: string;
  reasoning?: string;
}

interface PromptExpanderProps {
  originalPrompt: string;
  onSelectPrompt: (prompt: string) => void;
  onCancel?: () => void;
  storeId?: string;
}

export function PromptExpander({
  originalPrompt,
  onSelectPrompt,
  onCancel,
  storeId,
}: PromptExpanderProps) {
  const [alternatives, setAlternatives] = useState<PromptAlternative[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<number, string>>({});

  const handleExpand = async () => {
    if (!originalPrompt.trim()) {
      toast.error("Digite um prompt para expandir");
      return;
    }

    setIsExpanding(true);
    setAlternatives([]);
    setSelectedIndex(null);
    setEditingIndex(null);
    setEditedPrompts({});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await fetch("/.netlify/functions/marketing-prompt-expand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt: originalPrompt.trim(),
          context: storeId ? { storeId } : {},
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao expandir prompt");
      }

      const data = await response.json();
      
      // O endpoint retorna { alternatives: [...] }
      if (data.alternatives && Array.isArray(data.alternatives)) {
        const formatted = data.alternatives.map((alt: any) => ({
          prompt: typeof alt === "string" ? alt : alt.prompt || alt.text || alt.message || "",
          reasoning: alt.reasoning || alt.explanation || alt.context || undefined,
        })).filter((alt: any) => alt.prompt); // Filtrar vazios
        
        if (formatted.length === 0) {
          throw new Error("Nenhuma alternativa válida foi gerada");
        }
        
        setAlternatives(formatted);
        toast.success(`${formatted.length} alternativas geradas com sucesso!`);
      } else {
        throw new Error("Formato de resposta inválido. Esperado: { alternatives: [...] }");
      }
    } catch (error: any) {
      console.error("Erro ao expandir prompt:", error);
      toast.error(error.message || "Erro ao expandir prompt");
    } finally {
      setIsExpanding(false);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    if (!editedPrompts[index]) {
      setEditedPrompts({
        ...editedPrompts,
        [index]: alternatives[index].prompt,
      });
    }
  };

  const handleSaveEdit = (index: number) => {
    setEditingIndex(null);
    // A edição já está salva em editedPrompts, então só precisamos sair do modo de edição
  };

  const handleCancelEdit = (index: number) => {
    setEditingIndex(null);
    // Remover a edição se não foi salva
    const newEdited = { ...editedPrompts };
    delete newEdited[index];
    setEditedPrompts(newEdited);
  };

  const handleCopy = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt copiado para a área de transferência!");
  };

  const handleSelect = (index: number) => {
    const promptToUse = editedPrompts[index] || alternatives[index].prompt;
    setSelectedIndex(index);
    onSelectPrompt(promptToUse);
  };

  const getPromptToDisplay = (index: number) => {
    return editedPrompts[index] || alternatives[index].prompt;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Expansão Inteligente de Prompt
        </CardTitle>
        <CardDescription>
          Use IA para gerar 5 alternativas profissionais e detalhadas do seu prompt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt Original */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Prompt Original</label>
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            {originalPrompt}
          </div>
        </div>

        {/* Botão Expandir */}
        <Button
          onClick={handleExpand}
          disabled={isExpanding || !originalPrompt.trim()}
          className="w-full"
        >
          {isExpanding ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando alternativas...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar 5 Alternativas
            </>
          )}
        </Button>

        {/* Alternativas */}
        {alternatives.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Alternativas Geradas:</h4>
            {alternatives.map((alt, index) => (
              <div
                key={index}
                className={`rounded-lg border p-4 space-y-3 ${
                  selectedIndex === index ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {editingIndex === index ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedPrompts[index] || alt.prompt}
                          onChange={(e) =>
                            setEditedPrompts({
                              ...editedPrompts,
                              [index]: e.target.value,
                            })
                          }
                          className="min-h-[100px] text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(index)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelEdit(index)}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Alternativa {index + 1}
                          </span>
                          {selectedIndex === index && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {getPromptToDisplay(index)}
                        </p>
                        {alt.reasoning && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            💡 {alt.reasoning}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {editingIndex !== index && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleSelect(index)}
                      className="flex-1"
                    >
                      {selectedIndex === index ? "Selecionado" : "Usar Este"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(index)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(getPromptToDisplay(index))}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botão Cancelar */}
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancelar
          </Button>
        )}

        {/* Info */}
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">💡 Como funciona:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Gere 5 alternativas profissionais do seu prompt</li>
            <li>Edite qualquer alternativa antes de usar</li>
            <li>Selecione a que melhor representa sua ideia</li>
            <li>O prompt selecionado será usado para gerar a imagem/vídeo</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

