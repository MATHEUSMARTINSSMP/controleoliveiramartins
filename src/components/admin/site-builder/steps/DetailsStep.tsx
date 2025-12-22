import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, FileText, Star, Award, Sparkles, Plus, Trash2, MessageSquareQuote, Tag, Users } from "lucide-react";
import type { SiteFormData } from "../types";

interface DetailsStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

export function DetailsStep({ formData, onChange }: DetailsStepProps) {
  const addFeaturedProduct = () => {
    const newProducts = [...formData.featured_products, { name: '', description: '', price: '' }];
    onChange({ featured_products: newProducts });
  };

  const updateFeaturedProduct = (index: number, field: string, value: string) => {
    const newProducts = [...formData.featured_products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    onChange({ featured_products: newProducts });
  };

  const removeFeaturedProduct = (index: number) => {
    const newProducts = formData.featured_products.filter((_, i) => i !== index);
    onChange({ featured_products: newProducts });
  };

  const addFeaturedService = () => {
    const newServices = [...formData.featured_services, { name: '', description: '', price: '' }];
    onChange({ featured_services: newServices });
  };

  const updateFeaturedService = (index: number, field: string, value: string) => {
    const newServices = [...formData.featured_services];
    newServices[index] = { ...newServices[index], [field]: value };
    onChange({ featured_services: newServices });
  };

  const removeFeaturedService = (index: number) => {
    const newServices = formData.featured_services.filter((_, i) => i !== index);
    onChange({ featured_services: newServices });
  };

  const addTestimonial = () => {
    const newTestimonials = [...formData.testimonials, { name: '', text: '', role: '', rating: 5 }];
    onChange({ testimonials: newTestimonials });
  };

  const updateTestimonial = (index: number, field: string, value: string | number) => {
    const newTestimonials = [...formData.testimonials];
    newTestimonials[index] = { ...newTestimonials[index], [field]: value };
    onChange({ testimonials: newTestimonials });
  };

  const removeTestimonial = (index: number) => {
    const newTestimonials = formData.testimonials.filter((_, i) => i !== index);
    onChange({ testimonials: newTestimonials });
  };

  const addSpecialOffer = () => {
    const newOffers = [...formData.special_offers, { title: '', description: '', discount: '' }];
    onChange({ special_offers: newOffers });
  };

  const updateSpecialOffer = (index: number, field: string, value: string) => {
    const newOffers = [...formData.special_offers];
    newOffers[index] = { ...newOffers[index], [field]: value };
    onChange({ special_offers: newOffers });
  };

  const removeSpecialOffer = (index: number) => {
    const newOffers = formData.special_offers.filter((_, i) => i !== index);
    onChange({ special_offers: newOffers });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Detalhes do seu negócio</h2>
        <p className="text-muted-foreground">
          Quanto mais informações você preencher, mais personalizado e completo ficará seu site
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
            <CardDescription>
              Dados principais que aparecem no topo do seu site
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Nome da Empresa *</Label>
              <Input
                id="company_name"
                data-testid="input-company-name"
                placeholder="Ex: Salão de Beleza Glamour"
                value={formData.company_name}
                onChange={(e) => onChange({ company_name: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                O nome que aparecerá no cabeçalho e título do site
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slogan">
                Slogan / Frase de Efeito
              </Label>
              <Input
                id="slogan"
                data-testid="input-slogan"
                placeholder="Ex: Transformando vidas através da beleza"
                value={formData.slogan}
                onChange={(e) => onChange({ slogan: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Uma frase curta e marcante que define sua empresa (aparece em destaque no site)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">
                Tagline / Subtítulo
              </Label>
              <Input
                id="tagline"
                data-testid="input-tagline"
                placeholder="Ex: Há 15 anos cuidando de você"
                value={formData.tagline}
                onChange={(e) => onChange({ tagline: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Uma frase complementar ao slogan (aparece abaixo do nome da empresa)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company_description">
                Descrição Curta
              </Label>
              <Textarea
                id="company_description"
                data-testid="input-company-description"
                placeholder="Descreva seu negócio em 1-2 frases..."
                value={formData.company_description}
                onChange={(e) => onChange({ company_description: e.target.value })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Uma descrição breve que aparecerá no banner principal do site
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="founding_year">Ano de Fundação</Label>
                <Input
                  id="founding_year"
                  data-testid="input-founding-year"
                  placeholder="Ex: 2010"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={formData.founding_year}
                  onChange={(e) => onChange({ founding_year: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Mostra tradição e experiência no mercado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team_size">Tamanho da Equipe</Label>
                <Select
                  value={formData.team_size}
                  onValueChange={(value) => onChange({ team_size: value })}
                >
                  <SelectTrigger data-testid="select-team-size">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Somente eu</SelectItem>
                    <SelectItem value="2-5">2 a 5 pessoas</SelectItem>
                    <SelectItem value="6-10">6 a 10 pessoas</SelectItem>
                    <SelectItem value="11-20">11 a 20 pessoas</SelectItem>
                    <SelectItem value="21-50">21 a 50 pessoas</SelectItem>
                    <SelectItem value="50+">Mais de 50 pessoas</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Transmite solidez e capacidade de atendimento
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              História da Empresa
            </CardTitle>
            <CardDescription>
              Conte sua trajetória - isso cria conexão emocional com os clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_history">
                Como tudo começou?
              </Label>
              <Textarea
                id="company_history"
                data-testid="input-company-history"
                placeholder="Conte a história do seu negócio: como começou, quem fundou, os principais momentos, conquistas importantes..."
                value={formData.company_history}
                onChange={(e) => onChange({ company_history: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Histórias pessoais geram confiança. Conte como surgiu a ideia, os desafios superados, etc.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="mission">Missão</Label>
                <Textarea
                  id="mission"
                  data-testid="input-mission"
                  placeholder="Ex: Oferecer serviços de beleza de alta qualidade, proporcionando bem-estar e autoestima..."
                  value={formData.mission}
                  onChange={(e) => onChange({ mission: e.target.value })}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  O propósito principal do seu negócio - por que ele existe?
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vision">Visão</Label>
                <Textarea
                  id="vision"
                  data-testid="input-vision"
                  placeholder="Ex: Ser referência em beleza e bem-estar na região até 2030..."
                  value={formData.vision}
                  onChange={(e) => onChange({ vision: e.target.value })}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Onde você quer chegar - seus objetivos de longo prazo
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_values">Valores</Label>
                <Textarea
                  id="company_values"
                  data-testid="input-company-values"
                  placeholder="Ex: Qualidade, Respeito, Inovação, Compromisso com o cliente..."
                  value={formData.company_values}
                  onChange={(e) => onChange({ company_values: e.target.value })}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Os princípios que guiam sua empresa - pode separar por vírgulas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              O Que Você Oferece
            </CardTitle>
            <CardDescription>
              Descreva seus produtos e/ou serviços de forma geral
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(formData.content_type === 'servicos' || formData.content_type === 'misto') && (
              <div className="space-y-2">
                <Label htmlFor="services_description">
                  Serviços Oferecidos
                </Label>
                <Textarea
                  id="services_description"
                  data-testid="input-services-description"
                  placeholder="Liste seus principais serviços: corte de cabelo, coloração, manicure, massagem..."
                  value={formData.services_description}
                  onChange={(e) => onChange({ services_description: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Descreva todos os serviços que você oferece, separados por vírgula ou em linhas
                </p>
              </div>
            )}
            
            {(formData.content_type === 'produtos' || formData.content_type === 'misto') && (
              <div className="space-y-2">
                <Label htmlFor="products_description">
                  Produtos Oferecidos
                </Label>
                <Textarea
                  id="products_description"
                  data-testid="input-products-description"
                  placeholder="Liste seus principais produtos ou categorias: roupas femininas, acessórios, calçados..."
                  value={formData.products_description}
                  onChange={(e) => onChange({ products_description: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Descreva todos os produtos que você vende, separados por vírgula ou em linhas
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="differentials">
                Diferenciais (por que escolher você?)
              </Label>
              <Textarea
                id="differentials"
                data-testid="input-differentials"
                placeholder="Ex: Atendimento personalizado, 15 anos de experiência, produtos importados, estacionamento gratuito..."
                value={formData.differentials}
                onChange={(e) => onChange({ differentials: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                O que torna seu negócio especial? Liste os motivos para o cliente escolher você
              </p>
            </div>
          </CardContent>
        </Card>

        {(formData.content_type === 'produtos' || formData.content_type === 'misto') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Produtos em Destaque
              </CardTitle>
              <CardDescription>
                Adicione até 6 produtos que você quer mostrar em destaque no site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.featured_products.map((product, index) => (
                <div key={index} className="p-4 border rounded-md space-y-3 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">Produto {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeaturedProduct(index)}
                      data-testid={`button-remove-product-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="Nome do produto"
                      value={product.name}
                      onChange={(e) => updateFeaturedProduct(index, 'name', e.target.value)}
                      data-testid={`input-product-name-${index}`}
                    />
                    <Input
                      placeholder="Preço (ex: R$ 99,90)"
                      value={product.price || ''}
                      onChange={(e) => updateFeaturedProduct(index, 'price', e.target.value)}
                      data-testid={`input-product-price-${index}`}
                    />
                    <Input
                      placeholder="Descrição curta"
                      value={product.description}
                      onChange={(e) => updateFeaturedProduct(index, 'description', e.target.value)}
                      data-testid={`input-product-description-${index}`}
                    />
                  </div>
                </div>
              ))}
              {formData.featured_products.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addFeaturedProduct}
                  className="w-full"
                  data-testid="button-add-product"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto em Destaque
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Esses produtos aparecerão em uma seção especial do site
              </p>
            </CardContent>
          </Card>
        )}

        {(formData.content_type === 'servicos' || formData.content_type === 'misto') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Serviços em Destaque
              </CardTitle>
              <CardDescription>
                Adicione até 6 serviços que você quer mostrar em destaque no site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.featured_services.map((service, index) => (
                <div key={index} className="p-4 border rounded-md space-y-3 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">Serviço {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeaturedService(index)}
                      data-testid={`button-remove-service-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="Nome do serviço"
                      value={service.name}
                      onChange={(e) => updateFeaturedService(index, 'name', e.target.value)}
                      data-testid={`input-service-name-${index}`}
                    />
                    <Input
                      placeholder="Preço (ex: A partir de R$ 50)"
                      value={service.price || ''}
                      onChange={(e) => updateFeaturedService(index, 'price', e.target.value)}
                      data-testid={`input-service-price-${index}`}
                    />
                    <Input
                      placeholder="Descrição curta"
                      value={service.description}
                      onChange={(e) => updateFeaturedService(index, 'description', e.target.value)}
                      data-testid={`input-service-description-${index}`}
                    />
                  </div>
                </div>
              ))}
              {formData.featured_services.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addFeaturedService}
                  className="w-full"
                  data-testid="button-add-service"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Serviço em Destaque
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Esses serviços aparecerão em uma seção especial do site
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Ofertas Especiais
            </CardTitle>
            <CardDescription>
              Tem alguma promoção ou oferta que quer destacar? Adicione aqui!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.special_offers.map((offer, index) => (
              <div key={index} className="p-4 border rounded-md space-y-3 bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">Oferta {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSpecialOffer(index)}
                    data-testid={`button-remove-offer-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Nome da oferta"
                    value={offer.title}
                    onChange={(e) => updateSpecialOffer(index, 'title', e.target.value)}
                    data-testid={`input-offer-title-${index}`}
                  />
                  <Input
                    placeholder="Desconto (ex: 20% OFF)"
                    value={offer.discount || ''}
                    onChange={(e) => updateSpecialOffer(index, 'discount', e.target.value)}
                    data-testid={`input-offer-discount-${index}`}
                  />
                  <Input
                    placeholder="Descrição"
                    value={offer.description}
                    onChange={(e) => updateSpecialOffer(index, 'description', e.target.value)}
                    data-testid={`input-offer-description-${index}`}
                  />
                </div>
              </div>
            ))}
            {formData.special_offers.length < 3 && (
              <Button
                type="button"
                variant="outline"
                onClick={addSpecialOffer}
                className="w-full"
                data-testid="button-add-offer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Oferta Especial
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Ofertas aparecem em destaque e chamam atenção dos visitantes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5" />
              Depoimentos de Clientes
            </CardTitle>
            <CardDescription>
              Nada vende mais do que a opinião de quem já comprou! Adicione depoimentos reais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.testimonials.map((testimonial, index) => (
              <div key={index} className="p-4 border rounded-md space-y-3 bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">Depoimento {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTestimonial(index)}
                    data-testid={`button-remove-testimonial-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Nome do cliente"
                    value={testimonial.name}
                    onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                    data-testid={`input-testimonial-name-${index}`}
                  />
                  <Input
                    placeholder="Profissão/Cidade (opcional)"
                    value={testimonial.role || ''}
                    onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                    data-testid={`input-testimonial-role-${index}`}
                  />
                </div>
                <Textarea
                  placeholder="O que o cliente disse sobre você? Ex: 'Excelente atendimento, sempre saio satisfeita!'"
                  value={testimonial.text}
                  onChange={(e) => updateTestimonial(index, 'text', e.target.value)}
                  rows={2}
                  data-testid={`input-testimonial-text-${index}`}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Avaliação:</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => updateTestimonial(index, 'rating', star)}
                        className="p-1"
                        data-testid={`button-testimonial-star-${index}-${star}`}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            star <= (testimonial.rating || 5)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {formData.testimonials.length < 5 && (
              <Button
                type="button"
                variant="outline"
                onClick={addTestimonial}
                className="w-full"
                data-testid="button-add-testimonial"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Depoimento
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Depoimentos verdadeiros aumentam a confiança e as conversões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5" />
              Conquistas e Certificações
            </CardTitle>
            <CardDescription>
              Mostre suas credenciais - prêmios, certificados, reconhecimentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="awards">Prêmios e Reconhecimentos</Label>
              <Textarea
                id="awards"
                data-testid="input-awards"
                placeholder="Ex: Melhor salão da região 2023, Selo de Qualidade ABIHPEC, Top 10 no Reclame Aqui..."
                value={formData.awards}
                onChange={(e) => onChange({ awards: e.target.value })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Ganhou algum prêmio, apareceu em algum ranking ou recebeu reconhecimento? Liste aqui!
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="certifications">Certificações</Label>
              <Textarea
                id="certifications"
                data-testid="input-certifications"
                placeholder="Ex: ISO 9001, Sebrae, Visa Sanitária, Certificação Orgânica..."
                value={formData.certifications}
                onChange={(e) => onChange({ certifications: e.target.value })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Certificações transmitem profissionalismo e segurança para o cliente
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
