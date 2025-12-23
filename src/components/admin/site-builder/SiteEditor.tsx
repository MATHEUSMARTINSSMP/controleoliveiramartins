import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ExternalLink, 
  Trash2, 
  Globe, 
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
  Settings,
  Sparkles,
  Pencil,
  ArrowLeft,
  Wand2
} from "lucide-react";
import { useSiteData } from "./useSiteData";
import { SitePreview } from "./SitePreview";
import { SiteOnboarding } from "./SiteOnboarding";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SiteEditorProps {
  tenantId?: string | null;
}

export function SiteEditor({ tenantId }: SiteEditorProps = {}) {
  const [activeTab, setActiveTab] = useState('preview');
  const [isEditMode, setIsEditMode] = useState(false);
  const [aiEditDialogOpen, setAiEditDialogOpen] = useState(false);
  const [aiEditCommand, setAiEditCommand] = useState('');
  const { 
    site, 
    canReset, 
    resetSite, 
    generateContent,
    editSite,
    isResetting, 
    isGenerating,
    isEditing,
    refetch
  } = useSiteData({ tenantId });
  
  if (!site) return null;
  
  // Se está no modo de edição, mostra o wizard de onboarding
  if (isEditMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)} data-testid="button-exit-edit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <span className="text-sm text-muted-foreground">Editando: {site.name}</span>
        </div>
        <SiteOnboarding tenantId={tenantId} />
      </div>
    );
  }
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Rascunho' },
      generating: { variant: 'outline', label: 'Gerando...' },
      published: { variant: 'default', label: 'Publicado' },
      error: { variant: 'destructive', label: 'Erro' },
      archived: { variant: 'secondary', label: 'Arquivado' }
    };
    
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  
  const customDomain = `${site.slug}.eleveaone.com.br`;
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">{site.name}</h2>
            <p className="text-sm text-muted-foreground">
              {site.segment_name} {site.area_name && `- ${site.area_name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(site.status)}
          <Button
            onClick={() => generateContent(undefined)}
            disabled={isGenerating}
            data-testid="button-generate-ai"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar com IA
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="preview" data-testid="tab-preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="preview" className="flex-1 min-h-0 mt-4">
          <SitePreview site={site} onRefresh={refetch} />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-4">
          <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {site.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {site.segment_name} {site.area_name && `- ${site.area_name}`}
              </CardDescription>
            </div>
            {getStatusBadge(site.status)}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">URL do Site</p>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                https://{customDomain}
              </code>
              <Button
                variant="outline"
                size="icon"
                asChild
              >
                <a 
                  href={`https://${customDomain}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-testid="link-site-url"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Criado em</p>
              <p className="text-sm font-medium">
                {format(new Date(site.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            
            {site.last_published_at && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Última publicação</p>
                <p className="text-sm font-medium">
                  {format(new Date(site.last_published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
            
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Versão</p>
              <p className="text-sm font-medium">v{site.current_version}</p>
            </div>
          </div>
          
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline"
              onClick={() => setAiEditDialogOpen(true)}
              disabled={isEditing || site.status !== 'published'}
              data-testid="button-edit-ai"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Editar com IA
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={!canReset.allowed || isResetting}
                  data-testid="button-reset"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Resetar Site
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Confirmar Reset
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá apagar completamente seu site atual. 
                    Você só pode resetar uma vez a cada 30 dias.
                    <br /><br />
                    Tem certeza que deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetSite()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sim, resetar site
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          {site.status !== 'published' && (
            <p className="text-sm text-muted-foreground">
              O site precisa estar publicado para usar a edição com IA.
            </p>
          )}
          
          {!canReset.allowed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Você poderá resetar novamente em {canReset.daysRemaining} dias
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={aiEditDialogOpen} onOpenChange={setAiEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Editar Site com IA
            </DialogTitle>
            <DialogDescription>
              Descreva as alterações que deseja fazer no seu site. A IA irá interpretar seu comando e aplicar as mudanças automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Ex: Mude a cor do botão principal para vermelho, adicione uma seção de depoimentos, altere o texto do hero para destacar promoções..."
              value={aiEditCommand}
              onChange={(e) => setAiEditCommand(e.target.value)}
              className="min-h-[120px]"
              data-testid="input-ai-command"
            />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">Exemplos de comandos:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Altere a cor de fundo do header para preto</li>
                <li>Adicione o telefone (96) 99999-9999 no rodapé</li>
                <li>Mude o texto do botão de WhatsApp para "Fale Conosco"</li>
                <li>Adicione uma nova seção de serviços com 3 cards</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={async () => {
                if (!aiEditCommand.trim()) return;
                await editSite({ command: aiEditCommand });
                setAiEditCommand('');
                setAiEditDialogOpen(false);
              }}
              disabled={isEditing || !aiEditCommand.trim()}
              data-testid="button-submit-ai-edit"
            >
              {isEditing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Aplicar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">Informações do Site</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} data-testid="button-edit-info">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Negócio</p>
                <p className="font-medium">
                  {site.business_type === 'fisico' ? 'Negócio Físico' : 'Negócio Digital'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Segmento</p>
                <p className="font-medium">{site.segment_name}</p>
              </div>
              {site.area_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Área</p>
                  <p className="font-medium">{site.area_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Tom de Voz</p>
                <p className="font-medium capitalize">{site.voice_tone}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {site.whatsapp && (
                <div>
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{site.whatsapp}</p>
                </div>
              )}
              {site.email && (
                <div>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{site.email}</p>
                </div>
              )}
              {site.instagram && (
                <div>
                  <p className="text-sm text-muted-foreground">Instagram</p>
                  <p className="font-medium">{site.instagram}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-muted-foreground">Cores</p>
                <div className="flex gap-2 mt-1">
                  <div 
                    className="w-8 h-8 rounded-md border"
                    style={{ backgroundColor: site.color_primary }}
                    title="Primária"
                  />
                  <div 
                    className="w-8 h-8 rounded-md border"
                    style={{ backgroundColor: site.color_secondary }}
                    title="Secundária"
                  />
                  <div 
                    className="w-8 h-8 rounded-md border"
                    style={{ backgroundColor: site.color_accent }}
                    title="Destaque"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
