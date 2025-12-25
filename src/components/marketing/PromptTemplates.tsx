import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Save, Trash2, Star, StarOff, Sparkles, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string | null;
  prompt: string;
  type: "image" | "video";
  provider?: "gemini" | "openai" | null;
  model?: string | null;
  tags?: string[] | null;
  is_favorite: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface PromptTemplatesProps {
  type: "image" | "video";
  provider?: "gemini" | "openai";
  onSelectTemplate: (template: PromptTemplate) => void;
}

/**
 * Componente para gerenciar templates de prompts
 */
export function PromptTemplates({ type, provider, onSelectTemplate }: PromptTemplatesProps) {
  const { profile } = useAuth();
  const storeId = profile ? getStoreIdFromProfile(profile) : null;
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFavorite, setFilterFavorite] = useState<boolean | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    prompt: "",
    tags: "",
  });

  // Carregar templates
  useEffect(() => {
    if (storeId) {
      loadTemplates();
    }
  }, [storeId, type, provider]);

  const loadTemplates = async () => {
    if (!storeId) return;

    try {
      setLoading(true);
      let query = supabase
        .schema("sistemaretiradas")
        .from("marketing_templates")
        .select("*")
        .eq("store_id", profile.store_id)
        .eq("type", type)
        .order("is_favorite", { ascending: false })
        .order("usage_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (provider) {
        query = query.or(`provider.is.null,provider.eq.${provider}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTemplates((data || []) as PromptTemplate[]);
    } catch (error: any) {
      console.error("Erro ao carregar templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!profile?.store_id) {
      toast.error("Loja não identificada");
      return;
    }

    if (!newTemplate.name.trim() || !newTemplate.prompt.trim()) {
      toast.error("Nome e prompt são obrigatórios");
      return;
    }

    try {
      const tagsArray = newTemplate.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_templates")
        .insert({
          store_id: profile.store_id,
          user_id: profile.id,
          name: newTemplate.name.trim(),
          description: newTemplate.description.trim() || null,
          prompt: newTemplate.prompt.trim(),
          type,
          provider: provider || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          is_favorite: false,
          usage_count: 0,
        });

      if (error) throw error;

      toast.success("Template salvo com sucesso!");
      setShowSaveDialog(false);
      setNewTemplate({ name: "", description: "", prompt: "", tags: "" });
      loadTemplates();
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template: " + error.message);
    }
  };

  const handleToggleFavorite = async (templateId: string, currentFavorite: boolean) => {
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_templates")
        .update({ is_favorite: !currentFavorite })
        .eq("id", templateId);

      if (error) throw error;

      toast.success(currentFavorite ? "Removido dos favoritos" : "Adicionado aos favoritos");
      loadTemplates();
    } catch (error: any) {
      console.error("Erro ao atualizar favorito:", error);
      toast.error("Erro ao atualizar favorito");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;

    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("marketing_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast.success("Template excluído com sucesso!");
      loadTemplates();
    } catch (error: any) {
      console.error("Erro ao excluir template:", error);
      toast.error("Erro ao excluir template");
    }
  };

  const handleUseTemplate = (template: PromptTemplate) => {
    // Incrementar contador de uso
    supabase
      .schema("sistemaretiradas")
      .from("marketing_templates")
      .update({ usage_count: template.usage_count + 1 })
      .eq("id", template.id)
      .then(() => {
        loadTemplates();
      });

    onSelectTemplate(template);
    toast.success("Template aplicado!");
  };

  // Filtrar templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchTerm ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFavorite = filterFavorite === null || template.is_favorite === filterFavorite;

    return matchesSearch && matchesFavorite;
  });

  // Templates pré-definidos (biblioteca padrão)
  const defaultTemplates: PromptTemplate[] = [
    {
      id: "default-1",
      name: "Post Instagram Minimalista",
      description: "Imagem limpa e moderna para feed",
      prompt: "Uma imagem minimalista e moderna, cores suaves e neutras, composição equilibrada, estilo clean, alta qualidade, adequada para Instagram feed",
      type: "image",
      is_favorite: false,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "default-2",
      name: "Story Colorido",
      description: "Visual vibrante para stories",
      prompt: "Uma imagem vibrante e colorida, alto contraste, elementos gráficos modernos, formato vertical, estilo dinâmico, perfeito para stories",
      type: "image",
      is_favorite: false,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "default-3",
      name: "Reels TikTok",
      description: "Vídeo curto e dinâmico",
      prompt: "Um vídeo curto e dinâmico, ritmo acelerado, transições suaves, cores vibrantes, música envolvente, formato vertical, duração 15-30 segundos",
      type: "video",
      is_favorite: false,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const allTemplates = [...defaultTemplates.filter((t) => t.type === type), ...filteredTemplates];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Templates de Prompts
            </CardTitle>
            <CardDescription>
              Use templates salvos ou escolha da biblioteca padrão
            </CardDescription>
          </div>
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Salvar Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Salvar Template</DialogTitle>
                <DialogDescription>
                  Salve este prompt como template para usar depois
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome *</label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Ex: Post Instagram Minimalista"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Breve descrição do template"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prompt *</label>
                  <Textarea
                    value={newTemplate.prompt}
                    onChange={(e) => setNewTemplate({ ...newTemplate, prompt: e.target.value })}
                    placeholder="Cole o prompt aqui"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tags (separadas por vírgula)</label>
                  <Input
                    value={newTemplate.tags}
                    onChange={(e) => setNewTemplate({ ...newTemplate, tags: e.target.value })}
                    placeholder="Ex: instagram, minimalista, feed"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTemplate}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterFavorite === null ? "all" : filterFavorite ? "favorite" : "not-favorite"}
            onValueChange={(value) => {
              if (value === "all") setFilterFavorite(null);
              else if (value === "favorite") setFilterFavorite(true);
              else setFilterFavorite(false);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="favorite">Favoritos</SelectItem>
              <SelectItem value="not-favorite">Não Favoritos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Templates */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Carregando templates...</p>
          </div>
        ) : allTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum template encontrado</p>
            <p className="text-sm mt-2">Salve um template para começar</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {allTemplates.map((template) => (
              <Card key={template.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold truncate">{template.name}</h4>
                        {template.is_favorite && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                        {template.id.startsWith("default-") && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Padrão
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {template.prompt}
                      </p>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {template.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-muted px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Usado {template.usage_count}x</span>
                        {template.provider && <span>• {template.provider}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUseTemplate(template)}
                      >
                        Usar
                      </Button>
                      {!template.id.startsWith("default-") && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleFavorite(template.id, template.is_favorite)}
                          >
                            {template.is_favorite ? (
                              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                            ) : (
                              <StarOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

