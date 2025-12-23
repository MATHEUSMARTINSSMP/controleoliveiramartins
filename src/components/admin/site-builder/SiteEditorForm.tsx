import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Phone, 
  Palette, 
  MapPin,
  Save,
  Loader2,
  FileText
} from "lucide-react";
import { useSiteData } from "./useSiteData";
import type { SiteData, SiteFormData } from "./types";

interface SiteEditorFormProps {
  site: SiteData;
  tenantId?: string | null;
  onClose: () => void;
}

export function SiteEditorForm({ site, tenantId, onClose }: SiteEditorFormProps) {
  const { updateSite, isUpdating, refetch } = useSiteData({ tenantId });
  
  const [formData, setFormData] = useState<Partial<SiteFormData>>({
    company_name: site.company_name || '',
    company_description: site.company_description || '',
    slogan: site.slogan || '',
    tagline: site.tagline || '',
    mission: site.mission || '',
    vision: site.vision || '',
    company_values: site.company_values || '',
    services_description: site.services_description || '',
    products_description: site.products_description || '',
    differentials: site.differentials || '',
    
    whatsapp: site.whatsapp || '',
    phone: site.phone || '',
    email: site.email || '',
    instagram: site.instagram || '',
    facebook: site.facebook || '',
    
    address_street: site.address_street || '',
    address_number: site.address_number || '',
    address_complement: site.address_complement || '',
    address_neighborhood: site.address_neighborhood || '',
    address_city: site.address_city || '',
    address_state: site.address_state || '',
    address_zip: site.address_zip || '',
    
    color_primary: site.color_primary || '',
    color_secondary: site.color_secondary || '',
    color_accent: site.color_accent || '',
    color_background: site.color_background || '',
    
    cta_button_text: site.cta_button_text || '',
    cta_whatsapp_message: site.cta_whatsapp_message || '',
  });
  
  const handleChange = (field: keyof SiteFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSave = async () => {
    if (isUpdating) return;
    await updateSite(formData);
    await refetch();
    onClose();
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Editar: {site.name}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isUpdating} data-testid="button-save-edit">
            {isUpdating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="empresa" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="empresa" data-testid="tab-empresa">
            <Building2 className="h-4 w-4 mr-2" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="contato" data-testid="tab-contato">
            <Phone className="h-4 w-4 mr-2" />
            Contato
          </TabsTrigger>
          <TabsTrigger value="endereco" data-testid="tab-endereco">
            <MapPin className="h-4 w-4 mr-2" />
            Endereço
          </TabsTrigger>
          <TabsTrigger value="visual" data-testid="tab-visual">
            <Palette className="h-4 w-4 mr-2" />
            Visual
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="empresa" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informações da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slogan">Slogan</Label>
                  <Input
                    id="slogan"
                    value={formData.slogan}
                    onChange={(e) => handleChange('slogan', e.target.value)}
                    placeholder="Frase curta que define a empresa"
                    data-testid="input-slogan"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={formData.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="Frase de impacto para o hero do site"
                  data-testid="input-tagline"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company_description">Descrição da Empresa</Label>
                <Textarea
                  id="company_description"
                  value={formData.company_description}
                  onChange={(e) => handleChange('company_description', e.target.value)}
                  rows={4}
                  placeholder="Descreva sua empresa, o que ela faz e seus principais diferenciais"
                  data-testid="input-company-description"
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mission">Missão</Label>
                  <Textarea
                    id="mission"
                    value={formData.mission}
                    onChange={(e) => handleChange('mission', e.target.value)}
                    rows={2}
                    placeholder="A razão de existir da empresa"
                    data-testid="input-mission"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vision">Visão</Label>
                  <Textarea
                    id="vision"
                    value={formData.vision}
                    onChange={(e) => handleChange('vision', e.target.value)}
                    rows={2}
                    placeholder="Onde a empresa quer chegar"
                    data-testid="input-vision"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company_values">Valores</Label>
                <Textarea
                  id="company_values"
                  value={formData.company_values}
                  onChange={(e) => handleChange('company_values', e.target.value)}
                  rows={2}
                  placeholder="Os princípios que guiam a empresa"
                  data-testid="input-company-values"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="differentials">Diferenciais</Label>
                <Textarea
                  id="differentials"
                  value={formData.differentials}
                  onChange={(e) => handleChange('differentials', e.target.value)}
                  rows={2}
                  placeholder="O que torna sua empresa única"
                  data-testid="input-differentials"
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="services_description">Descrição dos Serviços</Label>
                  <Textarea
                    id="services_description"
                    value={formData.services_description}
                    onChange={(e) => handleChange('services_description', e.target.value)}
                    rows={3}
                    placeholder="Descreva os serviços oferecidos"
                    data-testid="input-services-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="products_description">Descrição dos Produtos</Label>
                  <Textarea
                    id="products_description"
                    value={formData.products_description}
                    onChange={(e) => handleChange('products_description', e.target.value)}
                    rows={3}
                    placeholder="Descreva os produtos oferecidos"
                    data-testid="input-products-description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="contato" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Informações de Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    placeholder="(00) 00000-0000"
                    data-testid="input-whatsapp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="(00) 0000-0000"
                    data-testid="input-phone"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contato@empresa.com.br"
                  data-testid="input-email"
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={formData.instagram}
                    onChange={(e) => handleChange('instagram', e.target.value)}
                    placeholder="@usuario ou URL completa"
                    data-testid="input-instagram"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    value={formData.facebook}
                    onChange={(e) => handleChange('facebook', e.target.value)}
                    placeholder="URL da página"
                    data-testid="input-facebook"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Botão de Ação (CTA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cta_button_text">Texto do Botão</Label>
                <Input
                  id="cta_button_text"
                  value={formData.cta_button_text}
                  onChange={(e) => handleChange('cta_button_text', e.target.value)}
                  placeholder="Ex: Fale Conosco, Agende Agora"
                  data-testid="input-cta-button-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cta_whatsapp_message">Mensagem pré-definida do WhatsApp</Label>
                <Textarea
                  id="cta_whatsapp_message"
                  value={formData.cta_whatsapp_message}
                  onChange={(e) => handleChange('cta_whatsapp_message', e.target.value)}
                  rows={2}
                  placeholder="Mensagem que o cliente envia automaticamente"
                  data-testid="input-cta-whatsapp-message"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="endereco" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço
              </CardTitle>
              <CardDescription>
                Preencha apenas se seu negócio é físico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address_street">Rua/Avenida</Label>
                  <Input
                    id="address_street"
                    value={formData.address_street}
                    onChange={(e) => handleChange('address_street', e.target.value)}
                    data-testid="input-address-street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_number">Número</Label>
                  <Input
                    id="address_number"
                    value={formData.address_number}
                    onChange={(e) => handleChange('address_number', e.target.value)}
                    data-testid="input-address-number"
                  />
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="address_complement">Complemento</Label>
                  <Input
                    id="address_complement"
                    value={formData.address_complement}
                    onChange={(e) => handleChange('address_complement', e.target.value)}
                    placeholder="Sala, Loja, etc."
                    data-testid="input-address-complement"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_neighborhood">Bairro</Label>
                  <Input
                    id="address_neighborhood"
                    value={formData.address_neighborhood}
                    onChange={(e) => handleChange('address_neighborhood', e.target.value)}
                    data-testid="input-address-neighborhood"
                  />
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="address_city">Cidade</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) => handleChange('address_city', e.target.value)}
                    data-testid="input-address-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_state">Estado</Label>
                  <Input
                    id="address_state"
                    value={formData.address_state}
                    onChange={(e) => handleChange('address_state', e.target.value)}
                    placeholder="UF"
                    maxLength={2}
                    data-testid="input-address-state"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_zip">CEP</Label>
                  <Input
                    id="address_zip"
                    value={formData.address_zip}
                    onChange={(e) => handleChange('address_zip', e.target.value)}
                    placeholder="00000-000"
                    data-testid="input-address-zip"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="visual" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Cores do Site
              </CardTitle>
              <CardDescription>
                Personalize as cores da sua marca
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="color_primary">Cor Principal</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_primary"
                      value={formData.color_primary}
                      onChange={(e) => handleChange('color_primary', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                      data-testid="input-color-primary"
                    />
                    <Input
                      type="text"
                      value={formData.color_primary}
                      onChange={(e) => handleChange('color_primary', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color_secondary">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_secondary"
                      value={formData.color_secondary}
                      onChange={(e) => handleChange('color_secondary', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                      data-testid="input-color-secondary"
                    />
                    <Input
                      type="text"
                      value={formData.color_secondary}
                      onChange={(e) => handleChange('color_secondary', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color_accent">Cor de Destaque</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_accent"
                      value={formData.color_accent}
                      onChange={(e) => handleChange('color_accent', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                      data-testid="input-color-accent"
                    />
                    <Input
                      type="text"
                      value={formData.color_accent}
                      onChange={(e) => handleChange('color_accent', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color_background">Cor de Fundo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="color_background"
                      value={formData.color_background}
                      onChange={(e) => handleChange('color_background', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                      data-testid="input-color-background"
                    />
                    <Input
                      type="text"
                      value={formData.color_background}
                      onChange={(e) => handleChange('color_background', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-md border bg-muted/30">
                <p className="text-sm text-muted-foreground mb-3">Preview das cores:</p>
                <div className="grid gap-2 md:grid-cols-4">
                  <div 
                    className="p-3 rounded-md text-white text-center text-xs font-medium"
                    style={{ backgroundColor: formData.color_primary }}
                  >
                    Principal
                  </div>
                  <div 
                    className="p-3 rounded-md text-white text-center text-xs font-medium"
                    style={{ backgroundColor: formData.color_secondary }}
                  >
                    Secundária
                  </div>
                  <div 
                    className="p-3 rounded-md text-white text-center text-xs font-medium"
                    style={{ backgroundColor: formData.color_accent }}
                  >
                    Destaque
                  </div>
                  <div 
                    className="p-3 rounded-md text-center text-xs font-medium border"
                    style={{ backgroundColor: formData.color_background, color: formData.color_secondary }}
                  >
                    Fundo
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
