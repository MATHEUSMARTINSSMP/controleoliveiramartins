import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ExternalLink, 
  Trash2, 
  Globe, 
  Github, 
  Clock,
  AlertTriangle,
  Loader2,
  Rocket,
  Eye,
  Settings,
  Sparkles,
  Pencil
} from "lucide-react";
import { useSiteData } from "./useSiteData";
import { SitePreview } from "./SitePreview";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { VoiceToneStyle } from "@/lib/site-builder-data";

const VOICE_TONES: { value: VoiceToneStyle; label: string }[] = [
  { value: 'elegante', label: 'Elegante' },
  { value: 'profissional', label: 'Profissional' },
  { value: 'popular', label: 'Popular' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'acolhedor', label: 'Acolhedor' },
  { value: 'dinamico', label: 'Dinâmico' },
];

interface SiteEditorProps {
  tenantId?: string | null;
}

interface EditFormData {
  voice_tone: VoiceToneStyle;
  whatsapp: string;
  email: string;
  instagram: string;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
}

export function SiteEditor({ tenantId }: SiteEditorProps = {}) {
  const [activeTab, setActiveTab] = useState('preview');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    voice_tone: 'profissional',
    whatsapp: '',
    email: '',
    instagram: '',
    color_primary: '#000000',
    color_secondary: '#666666',
    color_accent: '#0066cc',
  });
  const { 
    site, 
    canReset, 
    resetSite, 
    triggerDeploy,
    generateContent,
    updateSite,
    isResetting, 
    isDeploying,
    isGenerating,
    isUpdating,
    refetch
  } = useSiteData({ tenantId });
  
  if (!site) return null;
  
  const openEditDialog = () => {
    setEditForm({
      voice_tone: site.voice_tone || 'profissional',
      whatsapp: site.whatsapp || '',
      email: site.email || '',
      instagram: site.instagram || '',
      color_primary: site.color_primary || '#000000',
      color_secondary: site.color_secondary || '#666666',
      color_accent: site.color_accent || '#0066cc',
    });
    setEditDialogOpen(true);
  };
  
  const handleSaveEdit = async () => {
    await updateSite(editForm);
    setEditDialogOpen(false);
  };
  
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
            variant="outline"
            onClick={() => generateContent(undefined)}
            disabled={isGenerating || isDeploying}
            data-testid="button-generate-ai"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar com IA
          </Button>
          <Button
            onClick={() => triggerDeploy()}
            disabled={isDeploying || isGenerating}
            data-testid="button-deploy-header"
          >
            {isDeploying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            Publicar
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
          <div className="grid gap-4 md:grid-cols-2">
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
            
            {site.netlify_url && (
              <div className="space-y-2">
                <p className="text-sm font-medium">URL Netlify</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                    {site.netlify_url}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                  >
                    <a 
                      href={site.netlify_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="link-netlify-url"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
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
          
          {site.github_url && (
            <>
              <Separator />
              <div className="flex items-center gap-4 flex-wrap">
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={site.github_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    data-testid="link-github"
                  >
                    <Github className="h-4 w-4 mr-2" />
                    Ver no GitHub
                  </a>
                </Button>
                
                {site.netlify_admin_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href={site.netlify_admin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="link-netlify-admin"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Painel Netlify
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => triggerDeploy()}
              disabled={isDeploying}
              data-testid="button-redeploy"
            >
              {isDeploying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Republicar Site
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
          
          {!canReset.allowed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Você poderá resetar novamente em {canReset.daysRemaining} dias
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">Informações do Site</CardTitle>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={openEditDialog} data-testid="button-edit-info">
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Editar Informações do Site</DialogTitle>
                  <DialogDescription>
                    Altere as configurações do seu site. Após salvar, clique em "Gerar com IA" para aplicar as mudanças.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="voice_tone">Tom de Voz</Label>
                    <Select 
                      value={editForm.voice_tone} 
                      onValueChange={(value: VoiceToneStyle) => setEditForm(prev => ({ ...prev, voice_tone: value }))}
                    >
                      <SelectTrigger data-testid="select-voice-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_TONES.map(tone => (
                          <SelectItem key={tone.value} value={tone.value}>
                            {tone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      value={editForm.whatsapp}
                      onChange={(e) => setEditForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      data-testid="input-edit-whatsapp"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contato@empresa.com"
                      data-testid="input-edit-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      value={editForm.instagram}
                      onChange={(e) => setEditForm(prev => ({ ...prev, instagram: e.target.value }))}
                      placeholder="@suaempresa"
                      data-testid="input-edit-instagram"
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label>Cores do Site</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="color_primary" className="text-xs text-muted-foreground">Primária</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="color_primary"
                            value={editForm.color_primary}
                            onChange={(e) => setEditForm(prev => ({ ...prev, color_primary: e.target.value }))}
                            className="w-10 h-10 rounded-md border cursor-pointer"
                            data-testid="input-color-primary"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="color_secondary" className="text-xs text-muted-foreground">Secundária</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="color_secondary"
                            value={editForm.color_secondary}
                            onChange={(e) => setEditForm(prev => ({ ...prev, color_secondary: e.target.value }))}
                            className="w-10 h-10 rounded-md border cursor-pointer"
                            data-testid="input-color-secondary"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="color_accent" className="text-xs text-muted-foreground">Destaque</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="color_accent"
                            value={editForm.color_accent}
                            onChange={(e) => setEditForm(prev => ({ ...prev, color_accent: e.target.value }))}
                            className="w-10 h-10 rounded-md border cursor-pointer"
                            data-testid="input-color-accent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={isUpdating} data-testid="button-save-edit">
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
