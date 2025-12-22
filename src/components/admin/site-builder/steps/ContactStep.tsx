import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MapPin, Clock, Map, ExternalLink } from "lucide-react";
import type { SiteFormData } from "../types";
import { BRAZILIAN_STATES, WEEKDAYS } from "../types";

interface ContactStepProps {
  formData: SiteFormData;
  onChange: (data: Partial<SiteFormData>) => void;
}

export function ContactStep({ formData, onChange }: ContactStepProps) {
  const updateBusinessHour = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    const newHours = { ...formData.business_hours };
    if (field === 'closed') {
      newHours[day] = { ...newHours[day], closed: value as boolean };
    } else {
      newHours[day] = { ...newHours[day], [field]: value as string };
    }
    onChange({ business_hours: newHours });
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Informações de Contato</h2>
        <p className="text-muted-foreground">
          Como seus clientes podem encontrar e falar com você
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contato e Redes Sociais
            </CardTitle>
            <CardDescription>
              Preencha todos os canais pelos quais os clientes podem te contatar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  data-testid="input-whatsapp"
                  placeholder="(11) 99999-9999"
                  value={formData.whatsapp}
                  onChange={(e) => onChange({ whatsapp: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Principal canal de contato - aparecerá em destaque no site
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone Fixo</Label>
                <Input
                  id="phone"
                  data-testid="input-phone"
                  placeholder="(11) 3333-3333"
                  value={formData.phone}
                  onChange={(e) => onChange({ phone: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                placeholder="contato@empresa.com.br"
                value={formData.email}
                onChange={(e) => onChange({ email: e.target.value })}
              />
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  data-testid="input-instagram"
                  placeholder="@seuinstagram"
                  value={formData.instagram}
                  onChange={(e) => onChange({ instagram: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Apenas o @ do perfil, ex: @lojamoda
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  data-testid="input-facebook"
                  placeholder="facebook.com/suapagina"
                  value={formData.facebook}
                  onChange={(e) => onChange({ facebook: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {formData.business_type === 'fisico' && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
                <CardDescription>
                  Onde seus clientes podem te encontrar fisicamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address_street">Rua / Avenida</Label>
                    <Input
                      id="address_street"
                      data-testid="input-address-street"
                      placeholder="Rua das Flores"
                      value={formData.address_street}
                      onChange={(e) => onChange({ address_street: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_number">Número</Label>
                    <Input
                      id="address_number"
                      data-testid="input-address-number"
                      placeholder="123"
                      value={formData.address_number}
                      onChange={(e) => onChange({ address_number: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address_complement">Complemento</Label>
                    <Input
                      id="address_complement"
                      data-testid="input-address-complement"
                      placeholder="Sala 101, Bloco A"
                      value={formData.address_complement}
                      onChange={(e) => onChange({ address_complement: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_neighborhood">Bairro</Label>
                    <Input
                      id="address_neighborhood"
                      data-testid="input-address-neighborhood"
                      placeholder="Centro"
                      value={formData.address_neighborhood}
                      onChange={(e) => onChange({ address_neighborhood: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address_city">Cidade</Label>
                    <Input
                      id="address_city"
                      data-testid="input-address-city"
                      placeholder="São Paulo"
                      value={formData.address_city}
                      onChange={(e) => onChange({ address_city: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_state">Estado</Label>
                    <Select
                      value={formData.address_state}
                      onValueChange={(value) => onChange({ address_state: value })}
                    >
                      <SelectTrigger data-testid="select-address-state">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address_zip">CEP</Label>
                  <Input
                    id="address_zip"
                    data-testid="input-address-zip"
                    placeholder="01234-567"
                    value={formData.address_zip}
                    onChange={(e) => onChange({ address_zip: e.target.value })}
                    className="max-w-[150px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Mapa do Google
                </CardTitle>
                <CardDescription>
                  Adicione um mapa interativo no seu site para facilitar que os clientes encontrem você
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="google_maps_embed">Código de Incorporação do Google Maps</Label>
                  <Textarea
                    id="google_maps_embed"
                    data-testid="input-google-maps-embed"
                    placeholder='Cole aqui o código iframe do Google Maps (começa com <iframe...)'
                    value={formData.google_maps_embed}
                    onChange={(e) => onChange({ google_maps_embed: e.target.value })}
                    rows={3}
                    className="font-mono text-xs"
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Como obter o código:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Abra o Google Maps e pesquise seu endereço</li>
                      <li>Clique no botão "Compartilhar"</li>
                      <li>Vá na aba "Incorporar um mapa"</li>
                      <li>Copie todo o código que começa com {"<iframe"}</li>
                    </ol>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude (opcional)</Label>
                    <Input
                      id="latitude"
                      data-testid="input-latitude"
                      placeholder="-23.5505199"
                      value={formData.latitude}
                      onChange={(e) => onChange({ latitude: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude (opcional)</Label>
                    <Input
                      id="longitude"
                      data-testid="input-longitude"
                      placeholder="-46.6333094"
                      value={formData.longitude}
                      onChange={(e) => onChange({ longitude: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Coordenadas exatas ajudam a IA a gerar links de navegação mais precisos. Você pode encontrar essas coordenadas clicando com o botão direito em qualquer ponto no Google Maps.
                </p>
              </CardContent>
            </Card>
          </>
        )}
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horário de Funcionamento
            </CardTitle>
            <CardDescription>
              Informe quando sua empresa está aberta para atendimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {WEEKDAYS.map((day) => {
                const hours = formData.business_hours[day.id] || { open: '08:00', close: '18:00' };
                const isClosed = hours.closed;
                
                return (
                  <div key={day.id} className="flex items-center gap-4 flex-wrap">
                    <span className="w-32 text-sm font-medium">{day.label}</span>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        data-testid={`switch-${day.id}-open`}
                        checked={!isClosed}
                        onCheckedChange={(checked) => updateBusinessHour(day.id, 'closed', !checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {isClosed ? 'Fechado' : 'Aberto'}
                      </span>
                    </div>
                    
                    {!isClosed && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          data-testid={`input-${day.id}-open`}
                          value={hours.open}
                          onChange={(e) => updateBusinessHour(day.id, 'open', e.target.value)}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">às</span>
                        <Input
                          type="time"
                          data-testid={`input-${day.id}-close`}
                          value={hours.close}
                          onChange={(e) => updateBusinessHour(day.id, 'close', e.target.value)}
                          className="w-28"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              O horário de funcionamento aparecerá na seção de contato do seu site
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
