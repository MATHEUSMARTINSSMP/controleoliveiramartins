import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  Phone, 
  Palette, 
  MapPin,
  Save,
  Loader2,
  FileText,
  Image,
  Clock,
  Package,
  Briefcase,
  Star,
  Award,
  Users,
  Calendar,
  Plus,
  Trash2
} from "lucide-react";
import { useSiteData } from "./useSiteData";
import { AssetManager } from "./components/AssetManager";
import type { SiteData, SiteFormData, SiteAsset, WEEKDAYS } from "./types";

const WEEKDAYS_LIST = [
  { id: 'monday', label: 'Segunda-feira' },
  { id: 'tuesday', label: 'Terça-feira' },
  { id: 'wednesday', label: 'Quarta-feira' },
  { id: 'thursday', label: 'Quinta-feira' },
  { id: 'friday', label: 'Sexta-feira' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' }
];

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
    company_history: site.company_history || '',
    slogan: site.slogan || '',
    tagline: site.tagline || '',
    mission: site.mission || '',
    vision: site.vision || '',
    company_values: site.company_values || '',
    services_description: site.services_description || '',
    products_description: site.products_description || '',
    differentials: site.differentials || '',
    founding_year: site.founding_year?.toString() || '',
    team_size: site.team_size || '',
    awards: site.awards || '',
    certifications: site.certifications || '',
    
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
    google_maps_embed: site.google_maps_embed || '',
    
    color_primary: site.color_primary || '',
    color_secondary: site.color_secondary || '',
    color_accent: site.color_accent || '',
    color_background: site.color_background || '',
    
    cta_button_text: site.cta_button_text || '',
    cta_whatsapp_message: site.cta_whatsapp_message || '',
    
    business_hours: site.business_hours || {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '08:00', close: '12:00' },
      sunday: { open: '00:00', close: '00:00', closed: true }
    },
  });
  
  const [assets, setAssets] = useState<SiteAsset[]>(site.assets || []);
  
  const [featuredProducts, setFeaturedProducts] = useState(site.featured_products || []);
  const [featuredServices, setFeaturedServices] = useState(site.featured_services || []);
  const [testimonials, setTestimonials] = useState(site.testimonials || []);
  
  const handleChange = (field: keyof SiteFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleBusinessHoursChange = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    const currentHours = formData.business_hours || {};
    const dayHours = currentHours[day] || { open: '08:00', close: '18:00' };
    
    setFormData(prev => ({
      ...prev,
      business_hours: {
        ...currentHours,
        [day]: {
          ...dayHours,
          [field]: value
        }
      }
    }));
  };
  
  const handleAssetsChange = (newAssets: SiteAsset[]) => {
    setAssets(newAssets);
  };
  
  const addProduct = () => {
    setFeaturedProducts([...featuredProducts, { name: '', description: '', price: '' }]);
  };
  
  const removeProduct = (index: number) => {
    setFeaturedProducts(featuredProducts.filter((_, i) => i !== index));
  };
  
  const updateProduct = (index: number, field: string, value: string) => {
    const updated = [...featuredProducts];
    updated[index] = { ...updated[index], [field]: value };
    setFeaturedProducts(updated);
  };
  
  const addService = () => {
    setFeaturedServices([...featuredServices, { name: '', description: '', price: '' }]);
  };
  
  const removeService = (index: number) => {
    setFeaturedServices(featuredServices.filter((_, i) => i !== index));
  };
  
  const updateService = (index: number, field: string, value: string) => {
    const updated = [...featuredServices];
    updated[index] = { ...updated[index], [field]: value };
    setFeaturedServices(updated);
  };
  
  const addTestimonial = () => {
    setTestimonials([...testimonials, { name: '', text: '', role: '' }]);
  };
  
  const removeTestimonial = (index: number) => {
    setTestimonials(testimonials.filter((_, i) => i !== index));
  };
  
  const updateTestimonial = (index: number, field: string, value: string | number) => {
    const updated = [...testimonials];
    updated[index] = { ...updated[index], [field]: value };
    setTestimonials(updated);
  };
  
  const handleSave = async () => {
    if (isUpdating) return;
    await updateSite({ 
      ...formData, 
      assets,
      featured_products: featuredProducts,
      featured_services: featuredServices,
      testimonials: testimonials
    });
    await refetch();
    onClose();
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap sticky top-0 bg-background z-10 py-2">
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
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="empresa" data-testid="tab-empresa">
            <Building2 className="h-4 w-4 mr-2" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="produtos" data-testid="tab-produtos">
            <Package className="h-4 w-4 mr-2" />
            Produtos/Serviços
          </TabsTrigger>
          <TabsTrigger value="contato" data-testid="tab-contato">
            <Phone className="h-4 w-4 mr-2" />
            Contato
          </TabsTrigger>
          <TabsTrigger value="endereco" data-testid="tab-endereco">
            <MapPin className="h-4 w-4 mr-2" />
            Endereço
          </TabsTrigger>
          <TabsTrigger value="horarios" data-testid="tab-horarios">
            <Clock className="h-4 w-4 mr-2" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="imagens" data-testid="tab-imagens">
            <Image className="h-4 w-4 mr-2" />
            Imagens
          </TabsTrigger>
          <TabsTrigger value="visual" data-testid="tab-visual">
            <Palette className="h-4 w-4 mr-2" />
            Visual
          </TabsTrigger>
        </TabsList>
        
        <ScrollArea className="h-[calc(100vh-220px)]">
          <TabsContent value="empresa" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Informações Básicas
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
                    rows={3}
                    placeholder="Descreva sua empresa"
                    data-testid="input-company-description"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company_history">História da Empresa</Label>
                  <Textarea
                    id="company_history"
                    value={formData.company_history}
                    onChange={(e) => handleChange('company_history', e.target.value)}
                    rows={3}
                    placeholder="Conte a história da sua empresa"
                    data-testid="input-company-history"
                  />
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="founding_year">Ano de Fundação</Label>
                    <Input
                      id="founding_year"
                      value={formData.founding_year}
                      onChange={(e) => handleChange('founding_year', e.target.value)}
                      placeholder="Ex: 2010"
                      data-testid="input-founding-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team_size">Tamanho da Equipe</Label>
                    <Input
                      id="team_size"
                      value={formData.team_size}
                      onChange={(e) => handleChange('team_size', e.target.value)}
                      placeholder="Ex: 10-20 funcionários"
                      data-testid="input-team-size"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Missão, Visão e Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Prêmios e Certificações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="awards">Prêmios</Label>
                  <Textarea
                    id="awards"
                    value={formData.awards}
                    onChange={(e) => handleChange('awards', e.target.value)}
                    rows={2}
                    placeholder="Liste os prêmios recebidos"
                    data-testid="input-awards"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certifications">Certificações</Label>
                  <Textarea
                    id="certifications"
                    value={formData.certifications}
                    onChange={(e) => handleChange('certifications', e.target.value)}
                    rows={2}
                    placeholder="Liste as certificações da empresa"
                    data-testid="input-certifications"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="produtos" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Descrições Gerais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Produtos em Destaque
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addProduct} data-testid="button-add-product">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {featuredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum produto adicionado. Clique em "Adicionar" para incluir produtos.
                  </p>
                ) : (
                  featuredProducts.map((product, index) => (
                    <div key={index} className="p-3 border rounded-md space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">Produto {index + 1}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => removeProduct(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input
                          placeholder="Nome do produto"
                          value={product.name}
                          onChange={(e) => updateProduct(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Preço"
                          value={product.price || ''}
                          onChange={(e) => updateProduct(index, 'price', e.target.value)}
                        />
                        <Input
                          placeholder="Descrição"
                          value={product.description}
                          onChange={(e) => updateProduct(index, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Serviços em Destaque
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addService} data-testid="button-add-service">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {featuredServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum serviço adicionado. Clique em "Adicionar" para incluir serviços.
                  </p>
                ) : (
                  featuredServices.map((service, index) => (
                    <div key={index} className="p-3 border rounded-md space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">Serviço {index + 1}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => removeService(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input
                          placeholder="Nome do serviço"
                          value={service.name}
                          onChange={(e) => updateService(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Preço"
                          value={service.price || ''}
                          onChange={(e) => updateService(index, 'price', e.target.value)}
                        />
                        <Input
                          placeholder="Descrição"
                          value={service.description}
                          onChange={(e) => updateService(index, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Depoimentos
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addTestimonial} data-testid="button-add-testimonial">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {testimonials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum depoimento adicionado. Clique em "Adicionar" para incluir depoimentos.
                  </p>
                ) : (
                  testimonials.map((testimonial, index) => (
                    <div key={index} className="p-3 border rounded-md space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">Depoimento {index + 1}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => removeTestimonial(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          placeholder="Nome do cliente"
                          value={testimonial.name}
                          onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Cargo/Empresa"
                          value={testimonial.role || ''}
                          onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                        />
                      </div>
                      <Textarea
                        placeholder="Texto do depoimento"
                        value={testimonial.text}
                        onChange={(e) => updateTestimonial(index, 'text', e.target.value)}
                        rows={2}
                      />
                    </div>
                  ))
                )}
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
                      placeholder="@usuario"
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
                
                <div className="space-y-2">
                  <Label htmlFor="google_maps_embed">Google Maps (Embed)</Label>
                  <Textarea
                    id="google_maps_embed"
                    value={formData.google_maps_embed}
                    onChange={(e) => handleChange('google_maps_embed', e.target.value)}
                    rows={2}
                    placeholder="Cole o código embed do Google Maps"
                    data-testid="input-google-maps-embed"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="horarios" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Horário de Funcionamento
                </CardTitle>
                <CardDescription>
                  Configure os horários de atendimento da sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {WEEKDAYS_LIST.map((day) => {
                  const hours = formData.business_hours?.[day.id] || { open: '08:00', close: '18:00', closed: false };
                  return (
                    <div key={day.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <div className="w-32">
                        <span className="font-medium text-sm">{day.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!hours.closed}
                          onCheckedChange={(checked) => handleBusinessHoursChange(day.id, 'closed', !checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {hours.closed ? 'Fechado' : 'Aberto'}
                        </span>
                      </div>
                      {!hours.closed && (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={hours.open}
                            onChange={(e) => handleBusinessHoursChange(day.id, 'open', e.target.value)}
                            className="w-28"
                          />
                          <span className="text-muted-foreground">às</span>
                          <Input
                            type="time"
                            value={hours.close}
                            onChange={(e) => handleBusinessHoursChange(day.id, 'close', e.target.value)}
                            className="w-28"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="imagens" className="mt-4">
            <AssetManager assets={assets} onChange={handleAssetsChange} />
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
                        value={formData.color_primary || '#8B5CF6'}
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
                        value={formData.color_secondary || '#1F2937'}
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
                        value={formData.color_accent || '#10B981'}
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
                        value={formData.color_background || '#FFFFFF'}
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
                      style={{ backgroundColor: formData.color_primary || '#8B5CF6' }}
                    >
                      Principal
                    </div>
                    <div 
                      className="p-3 rounded-md text-white text-center text-xs font-medium"
                      style={{ backgroundColor: formData.color_secondary || '#1F2937' }}
                    >
                      Secundária
                    </div>
                    <div 
                      className="p-3 rounded-md text-white text-center text-xs font-medium"
                      style={{ backgroundColor: formData.color_accent || '#10B981' }}
                    >
                      Destaque
                    </div>
                    <div 
                      className="p-3 rounded-md text-center text-xs font-medium border"
                      style={{ backgroundColor: formData.color_background || '#FFFFFF', color: formData.color_secondary || '#1F2937' }}
                    >
                      Fundo
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
