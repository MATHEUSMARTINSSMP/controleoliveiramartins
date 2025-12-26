import { useState, useEffect, useRef } from "react";
import { useMarketingJobStatus } from "@/hooks/use-marketing-job-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Video, Sparkles, ImageIcon, VideoIcon, Loader2, X, CheckCircle2, XCircle, Clock, Download, AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const [inputImages, setInputImages] = useState<ImageFile[]>([]);
  const [mask, setMask] = useState<MaskFile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptExpander, setShowPromptExpander] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<Array<{ id: string; url: string; jobId: string }>>([]);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const { profile } = useAuth();
  
  // Usar storeId passado via props ou obter do profile
  const storeId = propStoreId || (profile ? getStoreIdFromProfile(profile) : null);
  const hasStoreId = !!storeId;

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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt para gerar o conteúdo");
      return;
    }

    if (!storeId) {
      toast.error("Loja não identificada");
      return;
    }

    setIsGenerating(true);

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
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
      const response = await fetch("/.netlify/functions/marketing-media", {
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
          output: {
            size: type === "image" ? "1024x1024" : "1280x720",
            seconds: type === "video" ? 8 : undefined,
          },
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
      toast.loading("Gerando imagens...", { id: "generating" });

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
          const error = await processResponse.json();
          throw new Error(error.error || "Erro ao processar job");
        }

        // Polling para verificar quando o job estiver pronto
        await pollJobUntilComplete(data.jobId, session.access_token);
      } catch (processError: any) {
        console.error("Erro ao processar job:", processError);
        toast.error(processError.message || "Erro ao processar. O job foi criado e será processado em breve.", { id: "generating" });
        // Continuar mesmo se falhar o processamento imediato
      }
      
      // Limpar prompt, imagens e máscara
      setPrompt("");
      setInputImages([]);
      setMask(null);
    } catch (error: any) {
      console.error("Erro ao gerar conteúdo:", error);
      toast.error(error.message || "Erro ao gerar conteúdo");
    } finally {
      setIsGenerating(false);
    }
  };

  const pollJobUntilComplete = async (jobId: string, token: string) => {
    const maxAttempts = 60; // 60 tentativas (5 minutos máximo)
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
          // Buscar assets gerados
          const assetIds = jobData.result?.assetIds || (jobData.result?.assetId ? [jobData.result.assetId] : []);
          
          if (assetIds.length > 0) {
            // Buscar URLs dos assets
            const { data: assets, error: assetsError } = await supabase
              .schema("sistemaretiradas")
              .from("marketing_assets")
              .select("id, public_url, signed_url")
              .in("id", assetIds);

            if (!assetsError && assets) {
              const assetUrls = assets.map((asset) => ({
                id: asset.id,
                url: asset.public_url || asset.signed_url || "",
                jobId: jobId,
              }));

              setGeneratedAssets((prev) => [...prev, ...assetUrls]);
              toast.success(`${assetUrls.length} imagem(ns) gerada(s) com sucesso!`, { id: "generating" });
            }
          }

          setProcessingJobId(null);
          return;
        } else if (jobData.status === "failed") {
          throw new Error(jobData.error_message || "Job falhou");
        }

        // Aguardar 5 segundos antes da próxima verificação
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      } catch (error: any) {
        if (error.message.includes("Job falhou")) {
          throw error;
        }
        // Continuar tentando em caso de erro de rede
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    // Timeout após 5 minutos
    setProcessingJobId(null);
    toast.warning("Processamento está demorando mais que o esperado. As imagens aparecerão quando prontas.", { id: "generating" });
  };

  const handlePromptSelected = (selectedPrompt: string) => {
    setPrompt(selectedPrompt);
    setShowPromptExpander(false);
    toast.success("Prompt selecionado! Agora você pode gerar o conteúdo.");
  };

  if (showPromptExpander) {
    return (
      <PromptExpander
        originalPrompt={prompt}
        onSelectPrompt={handlePromptSelected}
        onCancel={() => setShowPromptExpander(false)}
        storeId={storeId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Gerar Conteúdo</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerar Conteúdo com IA</CardTitle>
              <CardDescription>
                Descreva o que você quer criar e nossa IA irá gerar para você
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

        {/* Provider & Model Selector */}
        <div className="grid grid-cols-2 gap-2">
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
          <div className="flex items-center justify-between">
            <label htmlFor="prompt" className="text-sm font-medium">
              Descreva o que você quer criar
            </label>
            {prompt.trim() && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPromptExpander(true)}
                className="h-auto py-1 text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Expandir Prompt
              </Button>
            )}
          </div>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Uma imagem minimalista de uma casa na árvore com cores suaves"
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isGenerating}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!prompt.trim() && (
            <Button
              variant="outline"
              onClick={() => setShowPromptExpander(true)}
              className="flex-1"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Começar com IA
            </Button>
          )}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || !hasStoreId}
            className={prompt.trim() ? "w-full" : "flex-1"}
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
        </div>

        {/* Info */}
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1">💡 Dica:</p>
          <p>
            Quanto mais detalhado for o prompt, melhor será o resultado. Use o botão "Expandir Prompt" 
            para gerar 5 alternativas profissionais automaticamente com IA.
          </p>
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
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <PromptTemplates
            type={type}
            provider={provider}
            onSelectTemplate={(template) => {
              setPrompt(template.prompt);
              if (template.provider) {
                setProvider(template.provider);
              }
              if (template.model) {
                setModel(template.model);
              }
              toast.success("Template aplicado!");
            }}
          />
        </TabsContent>
      </Tabs>
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
  const { assets, loading, error, refetch } = useMarketingAssets(storeId || undefined, filterType);

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
          {mediaUrl && (
            <Button
              size="sm"
              variant={isHighlighted ? "default" : "outline"}
              className={isHighlighted ? "flex-1" : "w-full"}
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
                <h3 className="font-semibold mb-3">Em Processamento</h3>
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
                <h3 className="font-semibold mb-3 text-destructive">Falhas</h3>
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
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium capitalize">
                            {job.type.replace("_", " ")}
                          </span>
                          <span className={`text-xs font-medium ${getStatusColor()}`}>
                            {getStatusLabel()}
                          </span>
                          {job.progress > 0 && job.progress < 100 && (
                            <span className="text-xs text-muted-foreground">
                              {job.progress}%
                            </span>
                          )}
                        </div>
            <p className="text-sm text-muted-foreground truncate" title={job.original_prompt}>
              {job.original_prompt}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>{job.provider} • {job.provider_model || "N/A"}</span>
              <span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ptBR })}</span>
            </div>
          </div>
        </div>
        {(job.status === "queued" || job.status === "processing") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(job.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {job.status === "processing" && job.progress > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}
      {job.error_message && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-sm text-destructive">
          {job.error_message}
        </div>
      )}
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

