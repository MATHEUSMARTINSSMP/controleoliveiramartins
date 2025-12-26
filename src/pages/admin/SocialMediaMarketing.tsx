import { useState, useEffect, useRef } from "react";
import { useMarketingJobStatus } from "@/hooks/use-marketing-job-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Video, Sparkles, ImageIcon, VideoIcon, Loader2, X, CheckCircle2, XCircle, Clock, Download, AlertCircle, ArrowLeft, RefreshCw, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMarketingAssets } from "@/hooks/use-marketing-assets";
import { useMarketingJobs } from "@/hooks/use-marketing-jobs";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PromptExpander } from "@/components/marketing/PromptExpander";
import { MarketingAssetGridSkeleton } from "@/components/marketing/MarketingAssetSkeleton";
import { MarketingJobListSkeleton } from "@/components/marketing/MarketingJobSkeleton";
import { ImageUploadInput, ImageFile } from "@/components/marketing/ImageUploadInput";
import { MaskUploadInput, MaskFile } from "@/components/marketing/MaskUploadInput";
import { PromptTemplates, PromptTemplate } from "@/components/marketing/PromptTemplates";
import { MarketingAnalytics } from "@/components/marketing/MarketingAnalytics";
import { InstagramFormatSelector, getInstagramFormats, InstagramFormat } from "@/components/marketing/InstagramFormatSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PROVIDER_CONFIG, getDefaultModel, getAllowedModels } from "@/lib/config/provider-config";
import { fileToBase64 } from "@/lib/ai-providers/image-utils";
import { getStoreIdFromProfile } from "@/lib/storeLogo";
import { useNavigate } from "react-router-dom";

interface SocialMediaMarketingProps {
  embedded?: boolean;
}

export default function SocialMediaMarketing({ embedded = false }: SocialMediaMarketingProps) {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("generate");
  const [newlyCompletedJobId, setNewlyCompletedJobId] = useState<string | null>(null);
  const [highlightAssetId, setHighlightAssetId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);

  // Buscar lojas do admin quando embedded
  useEffect(() => {
    const fetchStores = async () => {
      if (!embedded || !profile?.id || profile.role !== "ADMIN") return;

      try {
        const { data, error } = await supabase
          .schema("sistemaretiradas")
          .from("stores")
          .select("id, name")
          .eq("admin_id", profile.id)
          .eq("active", true)
          .order("name");

        if (error) throw error;
        
        const fetchedStores = data || [];
        setStores(fetchedStores);
        
        // Selecionar primeira loja por padrão se não houver seleção E há lojas disponíveis
        if (fetchedStores.length > 0 && !selectedStoreId) {
          setSelectedStoreId(fetchedStores[0].id);
        }
      } catch (error: any) {
        console.error("Erro ao buscar lojas:", error);
      }
    };

    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, profile?.id, profile?.role]);

  // Quando não está embedded, tentar obter do profile; quando embedded, usar selectedStoreId
  const storeId = embedded 
    ? selectedStoreId 
    : (profile ? getStoreIdFromProfile(profile) : null);
  const hasStoreId = !!storeId;

  return (
    <div className="space-y-6">
      {/* Alerta se loja não identificada */}
      {!authLoading && !hasStoreId && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Loja não identificada</AlertTitle>
          <AlertDescription>
            Não foi possível identificar a loja associada ao seu perfil. 
            Por favor, verifique se seu perfil possui uma loja associada ou entre em contato com o suporte.
          </AlertDescription>
        </Alert>
      )}

      {/* Mostrar conteúdo apenas se loja estiver identificada ou ainda carregando */}
      {!hasStoreId && !authLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Loja não identificada</p>
              <p className="text-sm mt-2">
                É necessário ter uma loja associada ao seu perfil para usar o módulo de marketing.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
      {/* Header */}
      {embedded ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Gestão de Redes Sociais</h2>
            <p className="text-sm text-muted-foreground">
              Gere imagens e vídeos com IA para suas redes sociais
            </p>
          </div>
          {stores.length > 0 && (
            <Select value={selectedStoreId || ""} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecione uma loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gestão de Redes Sociais</h1>
              <p className="text-muted-foreground">
                Gere imagens e vídeos com IA para suas redes sociais
              </p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Recursos Disponíveis
              </CardTitle>
              <CardDescription>
                Crie imagens e vídeos profissionais para Instagram, TikTok e outras redes sociais usando IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                    <h4 className="font-semibold">Geração de Imagens</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Crie imagens personalizadas com IA usando Gemini ou OpenAI
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <VideoIcon className="h-4 w-4 text-purple-500" />
                    <h4 className="font-semibold">Geração de Vídeos</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Produza vídeos curtos para Reels e Stories com IA
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    <h4 className="font-semibold">Prompts Inteligentes</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use IA para expandir e melhorar seus prompts antes de gerar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Gerar Conteúdo</TabsTrigger>
          <TabsTrigger value="gallery">Galeria</TabsTrigger>
          <TabsTrigger value="jobs">Processamentos</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <GenerateContentTab
            storeId={storeId}
            onJobCreated={(jobId) => {
              // Não redirecionar mais - as imagens aparecerão na mesma tela
              // setSelectedTab("jobs");
            }}
          />
        </TabsContent>

        <TabsContent value="gallery" className="space-y-4">
          <GalleryTab storeId={storeId} highlightAssetId={highlightAssetId} />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <JobsTab
            storeId={storeId}
            onJobCompleted={(jobId, assetId) => {
              setNewlyCompletedJobId(jobId);
              setHighlightAssetId(assetId);
              // Mudar para galeria quando job concluir
              setSelectedTab("gallery");
              toast.success("Conteúdo gerado com sucesso! Visualizando na galeria...");
            }}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <MarketingAnalytics storeId={storeId} />
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}

/**
 * Tab de Geração de Conteúdo
 */
function GenerateContentTab({ storeId: propStoreId, onJobCreated }: { storeId?: string | null; onJobCreated?: (jobId: string) => void }) {
  const [type, setType] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const [model, setModel] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<string>("post");
  const [inputImages, setInputImages] = useState<ImageFile[]>([]);
  const [mask, setMask] = useState<MaskFile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGeneratedPrompt, setHasGeneratedPrompt] = useState(false); // Indica se já gerou as variações de prompt
  const [generatedAssets, setGeneratedAssets] = useState<Array<{ id: string; url: string; jobId: string }>>([]);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [promptAlternatives, setPromptAlternatives] = useState<Array<{ prompt: string; reasoning?: string }>>([]);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isGeneratingAlternatives, setIsGeneratingAlternatives] = useState(false);
  const [selectedAlternativeIndex, setSelectedAlternativeIndex] = useState<number | null>(null);
  const { profile } = useAuth();
  
  // Usar storeId passado via props ou obter do profile
  const storeId = propStoreId || (profile ? getStoreIdFromProfile(profile) : null);
  const hasStoreId = !!storeId;
  
  // Usar hook de jobs para monitoramento em tempo real
  const { jobs } = useMarketingJobs(storeId || undefined);
  
  // Resetar formato quando o tipo mudar
  useEffect(() => {
    const formats = getInstagramFormats(type);
    if (formats.length > 0 && !formats.find(f => f.id === selectedFormat)) {
      setSelectedFormat(formats[0].id);
    }
  }, [type, selectedFormat]);
  
  // Monitorar jobs concluídos em tempo real e atualizar imagens geradas
  useEffect(() => {
    if (!processingJobId) return;

    const completedJob = jobs.find(j => j.id === processingJobId && j.status === "done");
    
    if (completedJob && completedJob.result) {
      console.log("[GenerateContentTab] Job concluído, result:", completedJob.result);
      
      // Parse result se for string (JSONB pode vir como string)
      let result = completedJob.result;
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result);
        } catch (e) {
          console.error("[GenerateContentTab] Erro ao parsear result:", e);
        }
      }
      
      const assetIds = result?.assetIds || (result?.assetId ? [result.assetId] : []);
      console.log("[GenerateContentTab] AssetIds extraídos:", assetIds);
      
      if (assetIds.length > 0) {
        // Verificar se já temos essas imagens
        const existingIds = new Set(generatedAssets.map(a => a.id));
        const newAssetIds = assetIds.filter(id => !existingIds.has(id));
        console.log("[GenerateContentTab] Novos assetIds:", newAssetIds);
        
        if (newAssetIds.length > 0) {
          // Buscar URLs dos novos assets com retry
          const fetchAssetsWithRetry = async (retries = 0) => {
            const maxRetries = 5;
            
            if (retries > 0) {
              // Aguardar antes de tentar novamente (exponencial backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
            
            const { data: assets, error: assetsError } = await supabase
              .schema("sistemaretiradas")
              .from("marketing_assets")
              .select("id, url, public_url, signed_url")
              .in("id", newAssetIds);
            
            console.log(`[GenerateContentTab] Tentativa ${retries + 1}/${maxRetries} - Assets buscados:`, assets, "Erro:", assetsError);
            
            if (!assetsError && assets && assets.length > 0) {
              const assetUrls = assets.map((asset) => ({
                id: asset.id,
                url: asset.url || asset.public_url || asset.signed_url || "",
                jobId: processingJobId,
              }));

              console.log("[GenerateContentTab] Adicionando assets ao estado:", assetUrls);
              setGeneratedAssets((prev) => [...prev, ...assetUrls]);
              toast.dismiss("generating");
              toast.success(`${assetUrls.length} ${type === "image" ? "imagem(ns)" : "vídeo(s)"} gerado(s) com sucesso!`);
              setProcessingJobId(null);
              setIsGenerating(false);
              
              // Scroll suave para a seção de imagens geradas após um pequeno delay
              setTimeout(() => {
                const resultsCard = document.querySelector('[data-generated-results]');
                if (resultsCard) {
                  resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 300);
            } else if (retries < maxRetries - 1) {
              // Tentar novamente
              await fetchAssetsWithRetry(retries + 1);
            } else {
              console.warn("[GenerateContentTab] Nenhum asset encontrado após todas as tentativas. Erro:", assetsError);
              if (assetsError) {
                console.error("[GenerateContentTab] Erro detalhado:", assetsError);
              }
              setProcessingJobId(null);
            }
          };
          
          fetchAssetsWithRetry();
        } else {
          console.log("[GenerateContentTab] Todos os assets já estão no estado");
          setProcessingJobId(null);
        }
      } else {
        console.warn("[GenerateContentTab] Nenhum assetId encontrado no result");
      }
    }
  }, [jobs, processingJobId, generatedAssets]);

  // Atualizar modelo quando provider ou type mudar
  useEffect(() => {
    const config = PROVIDER_CONFIG[provider];
    const availableModels = type === "image"
      ? (config.imageModels as readonly string[])
      : (config.videoModels as readonly string[]);
    
    if (availableModels.length > 0) {
      // Se modelo atual não está disponível, usar o primeiro disponível
      const currentModelExists = availableModels.includes(model);
      if (!currentModelExists || !model) {
        setModel(availableModels[0]);
      }
    } else {
      setModel("");
    }
  }, [provider, type, model]);

  const handleGeneratePrompt = async () => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt para gerar as variações");
      return;
    }

    if (!storeId) {
      toast.error("Loja não identificada");
      return;
    }

    setIsGeneratingAlternatives(true);
    setPromptAlternatives([]);
    setSelectedAlternativeIndex(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Buscar informações do formato selecionado
      const formats = getInstagramFormats(type);
      const selectedFormatInfo = formats.find(f => f.id === selectedFormat);
      
      const response = await fetch("/.netlify/functions/marketing-prompt-expand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          context: storeId 
            ? { 
                storeId, 
                type,
                format: selectedFormatInfo ? {
                  id: selectedFormatInfo.id,
                  name: selectedFormatInfo.name,
                  dimensions: selectedFormatInfo.dimensions,
                  aspectRatio: selectedFormatInfo.aspectRatio,
                  description: selectedFormatInfo.description,
                } : undefined,
              } 
            : { 
                type,
                format: selectedFormatInfo ? {
                  id: selectedFormatInfo.id,
                  name: selectedFormatInfo.name,
                  dimensions: selectedFormatInfo.dimensions,
                  aspectRatio: selectedFormatInfo.aspectRatio,
                  description: selectedFormatInfo.description,
                } : undefined,
              },
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
        
        setPromptAlternatives(formatted);
        setHasGeneratedPrompt(true);
        toast.success(`${formatted.length} alternativas geradas com sucesso!`);
        
        // Scroll suave para as alternativas
        setTimeout(() => {
          const alternativesCard = document.querySelector('[data-prompt-alternatives]');
          if (alternativesCard) {
            alternativesCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      } else {
        throw new Error("Formato de resposta inválido. Esperado: { alternatives: [...] }");
      }
    } catch (error: any) {
      console.error("Erro ao expandir prompt:", error);
      toast.error(error.message || "Erro ao expandir prompt");
    } finally {
      setIsGeneratingAlternatives(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt para gerar o conteúdo");
      return;
    }

    if (!hasGeneratedPrompt) {
      toast.error("Primeiro você precisa gerar as variações de prompt");
      return;
    }

    if (!storeId) {
      toast.error("Loja não identificada");
      return;
    }

    setIsGenerating(true);

    // Scroll para a área de processamento/resultados após um pequeno delay
    setTimeout(() => {
      const processingArea = document.querySelector('[data-processing-area]');
      if (processingArea) {
        processingArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    try {
      // Obter token de autenticação (com renovação automática se necessário)
      let { data: { session } } = await supabase.auth.getSession();
      
      // Se não tem sessão ou está expirada, tentar renovar
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now())) {
        console.log("[GenerateContentTab] Sessão expirada ou ausente, tentando renovar...");
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("[GenerateContentTab] Erro ao renovar sessão:", refreshError);
          toast.error("Sessão expirada. Por favor, faça login novamente.");
          return;
        }
        session = refreshedSession;
      }
      
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Converter imagens de entrada para base64 (se houver)
      let inputImagesBase64: string[] = [];
      if (inputImages.length > 0) {
        try {
          inputImagesBase64 = await Promise.all(
            inputImages.map(async (img) => {
              const imageInfo = await fileToBase64(img.file);
              return imageInfo.data;
            })
          );
        } catch (error: any) {
          toast.error(`Erro ao processar imagens: ${error.message}`);
          throw error;
        }
      }

      // Converter máscara para base64 (se houver e for inpainting)
      let maskBase64: string | undefined = undefined;
      if (mask && type === "image" && inputImages.length > 0) {
        try {
          const maskInfo = await fileToBase64(mask.file);
          maskBase64 = maskInfo.data;
        } catch (error: any) {
          toast.error(`Erro ao processar máscara: ${error.message}`);
          throw error;
        }
      }

      // Chamar endpoint de criação de job
      let response = await fetch("/.netlify/functions/marketing-media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type,
          provider,
          model: model || (type === "image" ? "gemini-2.5-flash-image" : "veo-2.0-generate-001"),
          prompt: prompt.trim(),
          storeId: storeId,
          inputImages: inputImagesBase64,
          mask: maskBase64,
          variations: type === "image" ? 3 : 1, // Gerar 3 alternativas para imagens
          output: (() => {
              if (type === "image") {
                // Ajustar tamanho baseado no formato do Instagram selecionado
                const formats = getInstagramFormats("image");
                const format = formats.find(f => f.id === selectedFormat);
                if (!format) {
                  // OpenAI aceita apenas: '1024x1024', '1024x1536', '1536x1024', 'auto'
                  const defaultSize = provider === "openai" ? "1024x1024" : "1080x1080";
                  return { size: defaultSize };
                }
                
                // Mapear tamanhos do Instagram para tamanhos suportados pela OpenAI
                // OpenAI aceita apenas: '1024x1024', '1024x1536', '1536x1024', 'auto'
                let size = "1080x1080"; // Padrão para Gemini
                if (provider === "openai") {
                  if (format.id === "story") {
                    size = "1024x1536"; // Vertical 9:16 (mais próximo de 1080x1920)
                  } else if (format.id === "landscape") {
                    size = "1536x1024"; // Horizontal 16:9 (mais próximo de 1080x566)
                  } else {
                    size = "1024x1024"; // Quadrado 1:1 (post, carousel)
                  }
                } else {
                  // Gemini aceita outros tamanhos
                  if (format.id === "story") {
                    size = "1080x1920"; // Vertical 9:16
                  } else if (format.id === "landscape") {
                    size = "1080x566"; // Horizontal 1.91:1
                  } else {
                    size = "1080x1080"; // Quadrado 1:1 (post, carousel)
                  }
                }
                
                return {
                  size,
                  aspectRatio: format.aspectRatio,
                  formatName: format.name,
                  formatDescription: format.description,
                  formatDimensions: format.dimensions,
                };
              } else {
                // Para vídeos, ajustar baseado no formato selecionado
                const formats = getInstagramFormats("video");
                const format = formats.find(f => f.id === selectedFormat);
                if (!format) {
                  return { size: "1280x720", seconds: 8 };
                }
                
                let size = "1280x720";
                if (format.id === "reel" || format.id === "story") {
                  size = "1080x1920"; // Vertical 9:16
                } else {
                  size = "1280x720"; // Padrão 16:9
                }
                
                return {
                  size,
                  aspectRatio: format.aspectRatio,
                  formatName: format.name,
                  formatDescription: format.description,
                  formatDimensions: format.dimensions,
                  seconds: format.id === "reel" ? 8 : 8, // Gemini aceita apenas 5-8 segundos, Stories 8s
                };
              }
            })(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar job");
      }

      const data = await response.json();
      
      if (!data.jobId) {
        throw new Error("Job não foi criado corretamente");
      }

      // Processar imediatamente
      setProcessingJobId(data.jobId);
      setIsGenerating(true);
      toast.loading(`Gerando ${type === "image" ? "imagens" : "vídeo"}...`, { id: "generating" });

      // Processar job imediatamente
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Sessão expirada");
        }

        const processResponse = await fetch(`/.netlify/functions/marketing-worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!processResponse.ok) {
          let errorMessage = "Erro ao processar job";
          try {
            const errorData = await processResponse.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`;
            }
          } catch (e) {
            const errorText = await processResponse.text();
            errorMessage = errorText || `HTTP ${processResponse.status}: ${processResponse.statusText}`;
          }
          throw new Error(errorMessage);
        }

        let processResult;
        try {
          processResult = await processResponse.json();
        } catch (e) {
          // Se não conseguir parsear JSON, tentar ler como texto
          const text = await processResponse.text();
          console.log("[GenerateContentTab] Resposta do worker (texto):", text);
          processResult = { processed: 0, message: text };
        }
        
        console.log("[GenerateContentTab] Resultado do processamento:", processResult);

        // Se não processou nenhum job, pode ser que o job ainda não esteja na fila
        // ou já foi processado. Nesse caso, apenas iniciar o polling
        if (processResult.processed === 0) {
          console.log("[GenerateContentTab] Nenhum job processado imediatamente, iniciando polling...");
          // Não é um erro - o job pode já ter sido processado ou será processado pelo worker agendado
        }

        // Polling para verificar quando o job estiver pronto
        // Usar setProcessingJobId para que o monitoramento em tempo real funcione
        setProcessingJobId(data.jobId);
        
        // Iniciar polling (não bloquear - deixar o useEffect monitorar)
        pollJobUntilComplete(data.jobId, session.access_token).catch((err) => {
          console.error("[GenerateContentTab] Erro no polling:", err);
          const errorMsg = err?.message || String(err);
          
          // Se for erro relacionado a bucket ou upload, mostrar mensagem mais clara
          if (errorMsg.includes("Bucket") || errorMsg.includes("upload") || errorMsg.includes("falhou")) {
            toast.error(
              errorMsg.includes("Bucket") 
                ? "Erro ao criar bucket de armazenamento. O sistema tentará criar automaticamente. Tente novamente em alguns segundos."
                : errorMsg,
              { 
                id: "generating",
                duration: 8000,
              }
            );
          }
          // Não mostrar erro genérico - o useEffect vai detectar quando o job estiver pronto
        });
      } catch (processError: any) {
        console.error("[GenerateContentTab] Erro ao processar job:", processError);
        console.error("[GenerateContentTab] Detalhes do erro:", {
          message: processError.message,
          stack: processError.stack,
        });
        
        // Não mostrar erro se o job foi criado - ele será processado pelo worker agendado
        toast.warning(
          processError.message || `Processamento iniciado. ${type === "image" ? "As imagens" : "O vídeo"} aparecerá automaticamente quando pronto.`,
          { id: "generating", duration: 5000 }
        );
        // Continuar mesmo se falhar o processamento imediato - o worker agendado vai processar
      }
      
      // Não limpar o prompt - deixar visível junto com as imagens geradas
      // Apenas limpar imagens de entrada e máscara
      setInputImages([]);
      setMask(null);
    } catch (error: any) {
      console.error("Erro ao gerar conteúdo:", error);
      toast.error(error.message || "Erro ao gerar conteúdo");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditAsset = (asset: any) => {
    setEditingAsset(asset);
    setEditPrompt("");
    setIsEditDialogOpen(true);
  };

  const handleGenerateEdit = async () => {
    if (!editingAsset || !editPrompt.trim()) {
      toast.error("Digite o que deseja alterar na imagem");
      return;
    }

    if (!storeId) {
      toast.error("Loja não identificada");
      return;
    }

    setIsGenerating(true);
    setIsEditDialogOpen(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Buscar a imagem original como base64
      const imageUrl = editingAsset.public_url || editingAsset.signed_url || editingAsset.url;
      if (!imageUrl) {
        toast.error("Não foi possível acessar a imagem original");
        return;
      }

      // Baixar a imagem e converter para base64
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remover o prefixo data:image/...;base64,
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      // Combinar prompt original com edição
      const originalPrompt = editingAsset.prompt || "";
      const combinedPrompt = `${originalPrompt}. ${editPrompt.trim()}`;

      // Usar o mesmo provider e modelo da imagem original
      const assetProvider = editingAsset.provider || "gemini";
      const assetModel = editingAsset.provider_model || (assetProvider === "gemini" ? "gemini-2.5-flash-image" : "gpt-image-1-mini");

      // Buscar formato original se disponível
      const formats = getInstagramFormats("image");
      const originalFormat = formats.find(f => 
        editingAsset.meta?.formatName?.includes(f.name) || 
        editingAsset.meta?.formatDimensions === f.dimensions
      ) || formats[0];

      // Chamar endpoint de criação de job com a imagem como input
      const response = await fetch("/.netlify/functions/marketing-media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: "image",
          provider: assetProvider,
          model: assetModel,
          prompt: combinedPrompt,
          storeId: storeId,
          inputImages: [imageBase64],
          variations: 1, // Gerar apenas 1 variação editada
          output: {
            size: originalFormat.id === "story" ? "1080x1920" : originalFormat.id === "landscape" ? "1080x566" : "1080x1080",
            aspectRatio: originalFormat.aspectRatio,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar job de edição");
      }

      const data = await response.json();
      toast.loading(`Gerando variação editada...`, { id: "editing" });

      // Processar job imediatamente
      try {
        const processResponse = await fetch(`/.netlify/functions/marketing-worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const processResult = await processResponse.json();
        setProcessingJobId(data.jobId);
        pollJobUntilComplete(data.jobId, session.access_token).catch(console.error);
      } catch (processError) {
        // Continuar mesmo se falhar o processamento imediato
        setProcessingJobId(data.jobId);
      }

      setEditingAsset(null);
      setEditPrompt("");
    } catch (error: any) {
      console.error("[GenerateContentTab] Erro ao editar imagem:", error);
      toast.error(`Erro ao editar imagem: ${error.message || "Erro desconhecido"}`, { id: "editing" });
      setIsGenerating(false);
      setProcessingJobId(null);
    }
  };

  const pollJobUntilComplete = async (jobId: string, token: string) => {
    const maxAttempts = 120; // 120 tentativas (10 minutos máximo)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/.netlify/functions/marketing-jobs?jobId=${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Erro ao verificar status do job");
        }

        const jobData = await response.json();
        
        if (jobData.status === "done") {
          console.log("[GenerateContentTab] Job concluído no polling, result:", jobData.result);
          
          // Parse result se for string (JSONB pode vir como string)
          let result = jobData.result;
          if (typeof result === 'string') {
            try {
              result = JSON.parse(result);
            } catch (e) {
              console.error("[GenerateContentTab] Erro ao parsear result no polling:", e);
            }
          }
          
          // Buscar assets gerados (suporta múltiplas variações)
          const assetIds = result?.assetIds || (result?.assetId ? [result.assetId] : []);
          console.log("[GenerateContentTab] AssetIds extraídos no polling:", assetIds);
          
          if (assetIds.length > 0) {
            // Buscar URLs dos assets com retry (pode haver delay na criação)
            let assets = null;
            let assetsError = null;
            let retries = 0;
            const maxRetries = 5;
            
            while (retries < maxRetries && (!assets || assets.length === 0)) {
              if (retries > 0) {
                // Aguardar antes de tentar novamente (exponencial backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
              }
              
              const result = await supabase
                .schema("sistemaretiradas")
                .from("marketing_assets")
                .select("id, url, public_url, signed_url")
                .in("id", assetIds);
              
              assets = result.data;
              assetsError = result.error;
              
              console.log(`[GenerateContentTab] Tentativa ${retries + 1}/${maxRetries} - Assets buscados no polling:`, assets, "Erro:", assetsError);
              
              if (assets && assets.length > 0) {
                break; // Encontrou os assets, sair do loop
              }
              
              retries++;
            }

            if (!assetsError && assets && assets.length > 0) {
              const assetUrls = assets.map((asset) => ({
                id: asset.id,
                url: asset.url || asset.public_url || asset.signed_url || "",
                jobId: jobId,
              }));

              console.log("[GenerateContentTab] Adicionando assets ao estado no polling:", assetUrls);
              setGeneratedAssets((prev) => [...prev, ...assetUrls]);
              toast.dismiss("generating");
              toast.success(`${assetUrls.length} ${type === "image" ? "imagem(ns)" : "vídeo(s)"} gerado(s) com sucesso!`);
              setProcessingJobId(null);
              setIsGenerating(false);
            } else {
              console.warn("[GenerateContentTab] Nenhum asset encontrado no polling após todas as tentativas. Erro:", assetsError);
              if (assetsError) {
                console.error("[GenerateContentTab] Erro detalhado:", assetsError);
              }
            }
          } else {
            console.warn("[GenerateContentTab] Nenhum assetId encontrado no result do polling");
          }

          setProcessingJobId(null);
          return;
        } else if (jobData.status === "failed") {
          setProcessingJobId(null);
          setIsGenerating(false);
          toast.dismiss("generating");
          
          // Extrair mensagem de erro (pode estar em diferentes campos)
          let errorMessage = "Job falhou sem mensagem de erro";
          if (jobData.error_message) {
            errorMessage = jobData.error_message;
          } else if (jobData.error) {
            // error pode ser string ou objeto
            if (typeof jobData.error === 'string') {
              errorMessage = jobData.error;
            } else if (jobData.error?.message) {
              errorMessage = jobData.error.message;
            } else if (typeof jobData.error === 'object') {
              errorMessage = JSON.stringify(jobData.error);
            }
          }
          
          console.error("[GenerateContentTab] Job falhou:", {
            jobId,
            status: jobData.status,
            error_message: jobData.error_message,
            error: jobData.error,
            errorString: typeof jobData.error === 'object' ? JSON.stringify(jobData.error) : jobData.error,
            progress: jobData.progress,
            result: jobData.result,
            extractedErrorMessage: errorMessage,
          });
          throw new Error(errorMessage);
        }

        // Aguardar 3 segundos antes da próxima verificação (mais rápido)
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        
        // Se o job falhou, parar polling e mostrar erro
        if (errorMsg.includes("Job falhou") || errorMsg.includes("failed") || errorMsg.includes("Bucket") || errorMsg.includes("upload")) {
          setProcessingJobId(null);
          console.error("[GenerateContentTab] Erro fatal no polling:", {
            jobId,
            error: errorMsg,
            attempts,
            stack: error.stack,
          });
          
          // Mostrar mensagem de erro mais detalhada
          let userMessage = errorMsg;
          if (errorMsg.includes("Bucket not found") || errorMsg.includes("Bucket")) {
            userMessage = "Erro ao criar bucket de armazenamento. O sistema tentará criar automaticamente. Tente novamente em alguns segundos.";
          } else if (errorMsg.includes("upload")) {
            userMessage = `Erro ao fazer upload: ${errorMsg}`;
          }
          
          toast.dismiss("generating");
          toast.error(userMessage, { duration: 8000 });
          setProcessingJobId(null);
          setIsGenerating(false);
          throw error;
        }
        
        // Continuar tentando em caso de erro de rede ou timeout
        console.warn(`[GenerateContentTab] Erro temporário no polling (tentativa ${attempts}/${maxAttempts}):`, errorMsg);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;
      }
    }

    // Timeout após 10 minutos - mas continua monitorando em background
    setProcessingJobId(null);
    setIsGenerating(false);
    toast.dismiss("generating");
    toast.warning("Processamento está demorando. Continuando monitoramento em background...");
    
    // Continuar monitorando em background usando o hook useMarketingJobs
    // As imagens aparecerão automaticamente quando prontas
  };

  const handleSelectAlternative = (index: number) => {
    const selectedPrompt = promptAlternatives[index].prompt;
    setPrompt(selectedPrompt);
    setSelectedAlternativeIndex(index);
    toast.success("Prompt selecionado! Agora você pode gerar o conteúdo.");
  };

  const handleUseOriginal = () => {
    setSelectedAlternativeIndex(null);
    toast.success("Usando prompt original! Agora você pode gerar o conteúdo.");
  };

  return (
    <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerar Conteúdo com IA</CardTitle>
              <CardDescription>
                Descreva o que você quer criar e nossa IA irá gerar para você
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
        {/* Type Selector */}
        <div className="flex gap-2">
          <Button
            variant={type === "image" ? "default" : "outline"}
            onClick={() => setType("image")}
            className="flex-1"
          >
            <Image className="h-4 w-4 mr-2" />
            Imagem
          </Button>
          <Button
            variant={type === "video" ? "default" : "outline"}
            onClick={() => setType("video")}
            className="flex-1"
          >
            <Video className="h-4 w-4 mr-2" />
            Vídeo
          </Button>
        </div>

        {/* Instagram Format Selector */}
        <InstagramFormatSelector
          type={type}
          selectedFormat={selectedFormat}
          onFormatSelect={setSelectedFormat}
        />

        {/* Provider & Model Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Select value={provider} onValueChange={(value: "gemini" | "openai") => setProvider(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Modelo</label>
            <Select value={model} onValueChange={setModel} disabled={!model}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {(type === "image"
                  ? (PROVIDER_CONFIG[provider].imageModels as readonly string[])
                  : (PROVIDER_CONFIG[provider].videoModels as readonly string[])
                ).map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Input Images */}
        <ImageUploadInput
          images={inputImages}
          onImagesChange={setInputImages}
          maxImages={5}
          disabled={isGenerating}
        />

        {/* Mask Upload (apenas para imagens e quando há imagem de entrada) */}
        {type === "image" && inputImages.length > 0 && (
          <MaskUploadInput
            mask={mask}
            onMaskChange={setMask}
            inputImage={inputImages[0]?.preview}
            disabled={isGenerating}
          />
        )}

        {/* Prompt Input */}
        <div className="space-y-2">
          <label htmlFor="prompt" className="text-sm font-medium">
            Descreva o que você quer criar
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              // Se o usuário editar o prompt após gerar, precisa gerar novamente
              if (hasGeneratedPrompt) {
                setHasGeneratedPrompt(false);
              }
            }}
            placeholder="Ex: Uma imagem minimalista de uma casa na árvore com cores suaves"
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isGenerating}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!hasGeneratedPrompt ? (
            // Se ainda não gerou o prompt, mostrar botão "Gerar Prompt"
            <Button
              onClick={handleGeneratePrompt}
              disabled={isGeneratingAlternatives || !prompt.trim() || !hasStoreId}
              className="w-full"
            >
              {isGeneratingAlternatives ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Alternativas...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Prompt
                </>
              )}
            </Button>
          ) : (
            // Se já gerou o prompt, mostrar botão "Gerar Imagem"
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || !hasStoreId}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar {type === "image" ? "Imagem" : "Vídeo"}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Alerta se não tiver store_id */}
        {!hasStoreId && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Loja não identificada</AlertTitle>
            <AlertDescription>
              Não é possível gerar conteúdo sem uma loja associada ao seu perfil.
            </AlertDescription>
          </Alert>
        )}
            </CardContent>
          </Card>

          {/* Mostrar alternativas de prompt geradas */}
          {promptAlternatives.length > 0 && (
            <Card className="mt-4" data-prompt-alternatives>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Alternativas de Prompt Geradas
                </CardTitle>
                <CardDescription>
                  Selecione uma alternativa ou mantenha o prompt original
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Opção de usar o prompt original */}
                <div
                  className={`rounded-lg border p-4 cursor-pointer transition-all ${
                    selectedAlternativeIndex === null ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  }`}
                  onClick={handleUseOriginal}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Prompt Original
                        </span>
                        {selectedAlternativeIndex === null && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{prompt}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={selectedAlternativeIndex === null ? "default" : "outline"}
                    className="w-full mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseOriginal();
                    }}
                  >
                    {selectedAlternativeIndex === null ? "Selecionado" : "Usar Este"}
                  </Button>
                </div>

                {/* Alternativas geradas */}
                {promptAlternatives.map((alt, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-4 transition-all ${
                      selectedAlternativeIndex === index ? "border-primary bg-primary/5" : "hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Alternativa {index + 1}
                          </span>
                          {selectedAlternativeIndex === index && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{alt.prompt}</p>
                        {alt.reasoning && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            💡 {alt.reasoning}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedAlternativeIndex === index ? "default" : "outline"}
                      className="w-full mt-3"
                      onClick={() => handleSelectAlternative(index)}
                    >
                      {selectedAlternativeIndex === index ? "Selecionado" : "Usar Este"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Mostrar indicador de processamento */}
          {processingJobId && generatedAssets.length === 0 && (
            <Card className="mt-4" data-processing-area>
              <CardContent className="py-8">
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Gerando {type === "image" ? "imagens" : "vídeo"}...</p>
                  <p className="text-xs text-muted-foreground">Aguarde enquanto processamos sua solicitação</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mostrar imagens geradas - Logo após o formulário */}
          {generatedAssets.length > 0 && (
            <Card className="mt-4" data-generated-results data-processing-area>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{type === "image" ? "Imagens Geradas" : "Vídeos Gerados"}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {generatedAssets.length} {type === "image" ? `imagem${generatedAssets.length > 1 ? 'ns' : ''} gerada${generatedAssets.length > 1 ? 's' : ''}` : `vídeo${generatedAssets.length > 1 ? 's' : ''} gerado${generatedAssets.length > 1 ? 's' : ''}`} com sucesso
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGeneratedAssets([]);
                      setProcessingJobId(null);
                      setHasGeneratedPrompt(false);
                      setPrompt("");
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar e Começar Novamente
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedAssets.map((asset, index) => (
                    <div
                      key={asset.id}
                      className="rounded-lg border overflow-hidden hover:shadow-lg transition-all bg-card"
                    >
                      {asset.url ? (
                        <div className="aspect-square relative bg-muted">
                          <img
                            src={asset.url}
                            alt={`${type === "image" ? "Imagem" : "Vídeo"} gerado ${index + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Variação {index + 1}</span>
                          <Badge variant="outline" className="text-xs">
                            {generatedAssets.length} de {generatedAssets.length}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => asset.url && window.open(asset.url, "_blank")}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Abrir em Nova Aba
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Templates Section */}
          <Card className="mt-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Templates de Prompt</CardTitle>
              <CardDescription className="text-xs">
                Use templates prontos para começar mais rápido
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <PromptTemplates
                type={type}
                provider={provider}
                onSelectTemplate={(template) => {
                  setPrompt(template.prompt);
                  setHasGeneratedPrompt(true); // Marcar como gerado ao selecionar template
                  if (template.provider) {
                    setProvider(template.provider);
                  }
                  if (template.model) {
                    setModel(template.model);
                  }
                  toast.success("Template aplicado!");
                }}
              />
            </CardContent>
          </Card>

      {/* Dialog de Edição de Imagem */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Imagem</DialogTitle>
            <DialogDescription>
              Descreva o que deseja alterar na imagem. A IA manterá tudo igual e fará apenas as alterações solicitadas.
            </DialogDescription>
          </DialogHeader>
          {editingAsset && (
            <div className="space-y-4">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                <img
                  src={editingAsset.public_url || editingAsset.signed_url || editingAsset.url}
                  alt="Imagem a editar"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-prompt">O que deseja alterar?</Label>
                <Textarea
                  id="edit-prompt"
                  placeholder="Ex: Troque a fonte do texto, Mude a cor do fundo para azul, Adicione mais brilho..."
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Exemplos: "Troque a fonte", "Mude a cor do texto para branco", "Adicione mais contraste"
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingAsset(null);
                    setEditPrompt("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateEdit}
                  disabled={!editPrompt.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Variação
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Tab de Galeria
 */
function GalleryTab({ storeId: propStoreId, highlightAssetId }: { storeId?: string | null; highlightAssetId?: string | null }) {
  const { profile } = useAuth();
  const storeId = propStoreId || (profile ? getStoreIdFromProfile(profile) : null);
  const [filterType, setFilterType] = useState<"image" | "video" | undefined>(undefined);
  const [filterProvider, setFilterProvider] = useState<"gemini" | "openai" | undefined>(undefined);
  // Habilitar polling automático para atualização em tempo real
  const { assets, loading, error, refetch } = useMarketingAssets(storeId || undefined, filterType, true);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Galeria de Conteúdos</CardTitle>
          <CardDescription>Visualize todos os conteúdos gerados anteriormente</CardDescription>
        </CardHeader>
        <CardContent>
          <MarketingAssetGridSkeleton count={8} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Galeria de Conteúdos</CardTitle>
          <CardDescription>Visualize todos os conteúdos gerados anteriormente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-destructive">
            <XCircle className="h-8 w-8 mx-auto mb-4" />
            <p>Erro ao carregar galeria</p>
            <p className="text-sm mt-2">{error}</p>
            <Button onClick={refetch} className="mt-4" variant="outline">
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Galeria de Conteúdos</CardTitle>
        <CardDescription>Visualize todos os conteúdos gerados anteriormente</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex gap-2">
          <Button
            variant={filterType === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(undefined)}
          >
            Todos
          </Button>
          <Button
            variant={filterType === "image" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("image")}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Imagens
          </Button>
          <Button
            variant={filterType === "video" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("video")}
          >
            <VideoIcon className="h-4 w-4 mr-2" />
            Vídeos
          </Button>
        </div>

        {/* Grid de Assets */}
        {(() => {
          // Filtrar assets por provider se necessário
          const filteredAssets = filterProvider
            ? assets.filter((asset) => asset.provider === filterProvider)
            : assets;
          
          // Agrupar assets por job_id (variações do mesmo job)
          const assetsByJob = new Map<string | null, typeof filteredAssets>();
          filteredAssets.forEach((asset) => {
            const jobId = asset.job_id || 'no-job';
            if (!assetsByJob.has(jobId)) {
              assetsByJob.set(jobId, []);
            }
            assetsByJob.get(jobId)!.push(asset);
          });

          // Separar jobs com múltiplas variações dos assets individuais
          const jobGroups: Array<{ jobId: string | null; assets: typeof filteredAssets }> = [];
          const singleAssets: typeof filteredAssets = [];

          assetsByJob.forEach((jobAssets, jobId) => {
            if (jobAssets.length > 1 && jobId !== 'no-job') {
              // Agrupar por job_id (ordenar por variação se houver metadata)
              jobAssets.sort((a, b) => {
                const aVar = a.metadata?.variation || 0;
                const bVar = b.metadata?.variation || 0;
                return aVar - bVar;
              });
              jobGroups.push({ jobId, assets: jobAssets });
            } else {
              // Asset único ou sem job_id
              singleAssets.push(...jobAssets);
            }
          });

          return filteredAssets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum conteúdo gerado ainda.</p>
            <p className="text-sm mt-2">Comece gerando uma imagem ou vídeo na aba "Gerar Conteúdo"</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grupos de variações (3 alternativas juntas) */}
            {jobGroups.map(({ jobId, assets: jobAssets }) => (
              <div key={jobId || 'group'} className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground px-1">
                  {jobAssets.length} variação{jobAssets.length > 1 ? 'ões' : ''} geradas juntas
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {jobAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isHighlighted={asset.id === highlightAssetId}
                      showVariationBadge={true}
                      variationNumber={asset.metadata?.variation || null}
                      onEdit={handleEditAsset}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Assets individuais */}
            {singleAssets.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {singleAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isHighlighted={asset.id === highlightAssetId}
                    onEdit={handleEditAsset}
                  />
                ))}
              </div>
            )}
          </div>
        );
        })()}
      </CardContent>
    </Card>
  );
}

/**
 * Card de Asset individual
 */
function AssetCard({ 
  asset, 
  isHighlighted = false,
  showVariationBadge = false,
  variationNumber = null
}: { 
  asset: any; 
  isHighlighted?: boolean;
  showVariationBadge?: boolean;
  variationNumber?: number | null;
}) {
  const mediaUrl = asset.public_url || asset.signed_url;

  return (
    <div
      className={`rounded-lg border overflow-hidden hover:shadow-lg transition-all ${
        isHighlighted ? "ring-2 ring-primary ring-offset-2 animate-pulse" : ""
      }`}
      id={isHighlighted ? `asset-${asset.id}` : undefined}
    >
      {asset.type === "image" && mediaUrl ? (
        <div className="aspect-square relative bg-muted">
          <img
            src={mediaUrl}
            alt={asset.filename}
            className="w-full h-full object-cover"
          />
        </div>
      ) : asset.type === "video" && mediaUrl ? (
        <div className="aspect-video relative bg-muted">
          <video
            src={mediaUrl}
            className="w-full h-full object-cover"
            controls
          />
        </div>
      ) : (
        <div className="aspect-square bg-muted flex items-center justify-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium capitalize">{asset.type}</span>
            {showVariationBadge && variationNumber && (
              <Badge variant="outline" className="text-xs">
                Variação {variationNumber}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate" title={asset.provider_model || ""}>
          {asset.provider} • {asset.provider_model || "N/A"}
        </p>
        <div className="flex gap-2">
          {isHighlighted && (
            <div className="flex-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-primary mr-1" />
              <span className="text-xs font-medium text-primary">Novo!</span>
            </div>
          )}
          {mediaUrl && asset.type === "image" && onEdit && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(asset);
              }}
            >
              <Pencil className="h-3 w-3 mr-2" />
              Editar
            </Button>
          )}
          {mediaUrl && (
            <Button
              size="sm"
              variant={isHighlighted ? "default" : "outline"}
              className={isHighlighted && asset.type === "image" && onEdit ? "flex-1" : "w-full"}
              onClick={() => window.open(mediaUrl, "_blank")}
            >
              <Download className="h-3 w-3 mr-2" />
              Abrir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tab de Jobs/Processamentos
 */
function JobsTab({ storeId: propStoreId, onJobCompleted }: { storeId?: string | null; onJobCompleted?: (jobId: string, assetId: string | null) => void }) {
  const { profile } = useAuth();
  const storeId = propStoreId || (profile ? getStoreIdFromProfile(profile) : null);
  
  // Log para debug
  useEffect(() => {
    console.log("[JobsTab] storeId:", storeId);
    console.log("[JobsTab] profile:", profile);
  }, [storeId, profile]);
  
  const { jobs, loading, error, refetch } = useMarketingJobs(storeId || undefined);
  const previousJobsRef = useRef<any[]>([]);

  // Detectar quando um job muda de status para done
  useEffect(() => {
    if (previousJobsRef.current.length > 0) {
      jobs.forEach((currentJob) => {
        const previousJob = previousJobsRef.current.find((j) => j.id === currentJob.id);
        
        // Se job mudou de processing/queued para done
        if (
          previousJob &&
          (previousJob.status === "processing" || previousJob.status === "queued") &&
          currentJob.status === "done" &&
          currentJob.result_asset_id
        ) {
          // Notificar componente pai
          if (onJobCompleted) {
            onJobCompleted(currentJob.id, currentJob.result_asset_id);
          }
        }
      });
    }
    
    previousJobsRef.current = [...jobs];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const handleCancelJob = async (jobId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const response = await fetch(`/.netlify/functions/marketing-jobs-cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao cancelar job");
      }

      toast.success("Job cancelado com sucesso");
      refetch();
    } catch (error: any) {
      console.error("Erro ao cancelar job:", error);
      toast.error(error.message || "Erro ao cancelar job");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processamentos</CardTitle>
          <CardDescription>Acompanhe o status das gerações em andamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-4">Carregando jobs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processamentos</CardTitle>
          <CardDescription>Acompanhe o status das gerações em andamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-destructive">
            <XCircle className="h-8 w-8 mx-auto mb-4" />
            <p>Erro ao carregar jobs</p>
            <p className="text-sm mt-2">{error}</p>
            <Button onClick={refetch} className="mt-4" variant="outline">
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const queuedJobs = jobs.filter(j => j.status === "queued");
  const processingJobs = jobs.filter(j => j.status === "processing");
  const completedJobs = jobs.filter(j => j.status === "done");
  const failedJobs = jobs.filter(j => j.status === "failed");
  const totalProcessing = queuedJobs.length + processingJobs.length;

  const handleProcessManually = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      toast.loading("Processando jobs pendentes...", { id: "process-manual" });

      const response = await fetch(`/.netlify/functions/marketing-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao processar jobs");
      }

      toast.success(
        `Processados: ${result.processed || 0} jobs (${result.successful || 0} sucesso, ${result.failed || 0} falhas)`,
        { id: "process-manual" }
      );
      
      // Recarregar jobs após processamento
      setTimeout(() => refetch(), 1000);
    } catch (error: any) {
      console.error("Erro ao processar jobs manualmente:", error);
      toast.error(error.message || "Erro ao processar jobs", { id: "process-manual" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Processamentos</CardTitle>
            <CardDescription>
              Acompanhe o status das gerações em andamento
              {totalProcessing > 0 && (
                <span className="ml-2 text-primary">
                  ({totalProcessing} em processamento)
                </span>
              )}
            </CardDescription>
          </div>
          {queuedJobs.length > 0 && (
            <Button
              onClick={handleProcessManually}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Processar Agora ({queuedJobs.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum processamento encontrado.</p>
            <p className="text-sm mt-2">Os jobs aparecerão aqui quando você gerar conteúdo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {processingJobs.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">
                  Em Processamento
                  {processingJobs.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({processingJobs.length})
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  {processingJobs.map((job) => (
                    <JobCard key={job.id} job={job} onCancel={handleCancelJob} />
                  ))}
                </div>
              </div>
            )}

            {completedJobs.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Concluídos</h3>
                <div className="space-y-2">
                  {completedJobs.map((job) => (
                    <JobCard key={job.id} job={job} onCancel={handleCancelJob} />
                  ))}
                </div>
              </div>
            )}

            {failedJobs.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-destructive flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Falhas
                  <span className="text-sm font-normal text-muted-foreground">
                    ({failedJobs.length})
                  </span>
                </h3>
                <div className="space-y-2">
                  {failedJobs.map((job) => (
                    <JobCard key={job.id} job={job} onCancel={handleCancelJob} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Card de Job individual
 */
function JobCard({ job, onCancel }: { job: any; onCancel: (jobId: string) => void }) {
  const getStatusIcon = () => {
    switch (job.status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "canceled":
        return <X className="h-4 w-4 text-muted-foreground" />;
      case "processing":
      case "queued":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = () => {
    switch (job.status) {
      case "done":
        return "Concluído";
      case "failed":
        return "Falhou";
      case "canceled":
        return "Cancelado";
      case "processing":
        return "Processando";
      case "queued":
        return "Na Fila";
      default:
        return job.status;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case "done":
        return "text-green-600";
      case "failed":
        return "text-destructive";
      case "canceled":
        return "text-muted-foreground";
      case "processing":
      case "queued":
        return "text-blue-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0 overflow-hidden">
          {getStatusIcon()}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium capitalize">
                {job.type.replace("_", " ")}
              </span>
              <span className={`text-xs font-medium ${getStatusColor()}`}>
                {getStatusLabel()}
              </span>
              {job.progress !== null && job.progress !== undefined && job.progress >= 0 && job.progress < 100 && (
                <span className="text-xs font-medium text-primary">
                  {Math.round(job.progress)}%
                </span>
              )}
            </div>
            <p 
              className="text-sm text-muted-foreground break-words line-clamp-3 overflow-hidden" 
              title={job.prompt_original || job.original_prompt || "Sem prompt"}
              style={{ 
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%'
              }}
            >
              {job.prompt_original || job.original_prompt || "Sem prompt"}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="whitespace-nowrap">{job.provider} • {job.provider_model || "N/A"}</span>
              <span className="whitespace-nowrap">{formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ptBR })}</span>
            </div>
          </div>
        </div>
        {(job.status === "queued" || job.status === "processing") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(job.id)}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {job.status === "processing" && job.progress !== null && job.progress !== undefined && job.progress >= 0 && (
        <div className="w-full space-y-1">
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso: {Math.round(job.progress)}%</span>
            {job.started_at && (
              <span>
                {formatDistanceToNow(new Date(job.started_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      )}
      {job.error_message && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-destructive mb-1">Erro no processamento</p>
              <p className="text-destructive/90 break-words">{job.error_message}</p>
              {job.error_code && (
                <p className="text-xs text-destructive/70 mt-1">Código: {job.error_code}</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Alerta para jobs que estão demorando muito */}
      {job.status === "processing" && job.started_at && (() => {
        const elapsedMinutes = (Date.now() - new Date(job.started_at).getTime()) / 1000 / 60;
        if (elapsedMinutes > 15) {
          return (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-600 dark:text-yellow-400 mb-1">
                    Processamento demorado
                  </p>
                  <p className="text-yellow-600/90 dark:text-yellow-400/90">
                    Este job está processando há mais de {Math.floor(elapsedMinutes)} minutos. 
                    Pode estar demorando mais que o normal ou pode ter travado.
                  </p>
                  <p className="text-xs text-yellow-600/70 dark:text-yellow-400/70 mt-2">
                    Se continuar sem progresso, considere cancelar e tentar novamente.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}
      {job.status === "done" && job.result_asset_id && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // Scroll para galeria e filtrar pelo asset
            // Por enquanto, apenas mostra toast
            toast.info("Conteúdo disponível na galeria");
          }}
        >
          Ver na Galeria
        </Button>
      )}
    </div>
  );
}

