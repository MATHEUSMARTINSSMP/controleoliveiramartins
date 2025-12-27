import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GoogleLocation {
  id: number;
  account_id: string;
  location_id: string;
  location_name: string;
  location_address: string;
  location_phone: string;
  location_website: string;
  location_category: string;
}

interface Store {
  id: string;
  name: string;
  slug: string;
}

interface LocationMappingProps {
  customerId: string;
  siteSlug: string;
  onMappingComplete: () => void;
}

/**
 * Componente para mapear locations do Google para lojas
 * Usado quando 1 conta Google tem múltiplas locations e queremos associar cada uma a uma loja diferente
 */
export function LocationMapping({ customerId, siteSlug, onMappingComplete }: LocationMappingProps) {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({}); // location_id -> store_id
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [customerId, siteSlug, profile?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar todas as locations desta conta Google (usando customer_id, agrupando por account_id)
      // Pode haver locations em diferentes site_slugs após mapeamento, então buscamos todas
      const { data: locationsData, error: locError } = await supabase
        .schema("sistemaretiradas")
        .from("google_business_accounts")
        .select("id, account_id, location_id, location_name, location_address, location_phone, location_website, location_category")
        .eq("customer_id", customerId)
        .not("location_id", "is", null);

      // Remover duplicatas por location_id (caso esteja em múltiplos site_slugs)
      const uniqueLocations = new Map();
      locationsData?.forEach((loc) => {
        if (loc.location_id && !uniqueLocations.has(loc.location_id)) {
          uniqueLocations.set(loc.location_id, loc);
        }
      });
      const uniqueLocationsArray = Array.from(uniqueLocations.values());

      if (locError) throw locError;

      // Buscar todas as lojas do admin
      if (!profile?.id) {
        throw new Error("Perfil não encontrado");
      }

      const { data: storesData, error: storesError } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name, site_slug")
        .eq("admin_id", profile.id)
        .eq("active", true)
        .order("name");

      if (storesError) throw storesError;

      // Mapear site_slug para slug para manter compatibilidade
      const mappedStores = (storesData || []).map(store => ({
        id: store.id,
        name: store.name,
        slug: store.site_slug || store.id,
      }));

      setLocations(uniqueLocationsArray);
      setStores(mappedStores);

      // Buscar mapeamentos existentes (credenciais que já têm location_id definido)
      const { data: credentials, error: credError } = await supabase
        .schema("sistemaretiradas")
        .from("google_credentials")
        .select("site_slug, location_id")
        .eq("customer_id", customerId)
        .not("location_id", "is", null);

      if (!credError && credentials && mappedStores) {
        const existingMappings: Record<string, string> = {};
        credentials.forEach((cred) => {
          // Encontrar store_id pelo site_slug (comparar com slug mapeado)
          const store = mappedStores.find((s) => s.slug === cred.site_slug);
          if (store && cred.location_id) {
            existingMappings[cred.location_id] = store.id;
          }
        });
        setMappings(existingMappings);
      }
    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar locations e lojas");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (locationId: string, storeId: string) => {
    setMappings((prev) => ({
      ...prev,
      [locationId]: storeId,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Para cada location mapeada, criar/atualizar credencial com location_id
      for (const [locationId, storeId] of Object.entries(mappings)) {
        if (!storeId) continue;

        const store = stores.find((s) => s.id === storeId);
        if (!store) continue;

        const location = locations.find((l) => l.location_id === locationId);
        if (!location) continue;

        // Buscar credencial existente ou criar nova
        const { data: existingCred, error: fetchError } = await supabase
          .schema("sistemaretiradas")
          .from("google_credentials")
          .select("*")
          .eq("customer_id", customerId)
          .eq("site_slug", store.slug)
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

        // Se não existe credencial para esta loja, buscar a principal (sem location_id) de qualquer site_slug
        if (!existingCred) {
          const { data: mainCred, error: mainCredError } = await supabase
            .schema("sistemaretiradas")
            .from("google_credentials")
            .select("*")
            .eq("customer_id", customerId)
            .is("location_id", null)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();

          if (mainCredError && mainCredError.code !== "PGRST116") {
            throw mainCredError;
          }

          if (mainCred) {
            // Criar nova credencial para esta loja usando os dados da principal + location_id
            const { error: createError } = await supabase
              .schema("sistemaretiradas")
              .from("google_credentials")
              .upsert({
                customer_id: customerId,
                site_slug: store.slug,
                location_id: locationId,
                access_token: mainCred.access_token,
                refresh_token: mainCred.refresh_token,
                token_type: mainCred.token_type,
                scopes: mainCred.scopes,
                status: mainCred.status,
                expires_at: mainCred.expires_at,
              }, {
                onConflict: "customer_id,site_slug",
              });

            if (createError) throw createError;
          }
        } else {
          // Atualizar credencial existente com location_id
          const { error: updateError } = await supabase
            .schema("sistemaretiradas")
            .from("google_credentials")
            .update({ location_id: locationId })
            .eq("customer_id", customerId)
            .eq("site_slug", store.slug);

          if (updateError) throw updateError;
        }
      }

      toast.success("Mapeamento salvo com sucesso!");
      onMappingComplete();
    } catch (error: any) {
      console.error("Erro ao salvar mapeamento:", error);
      toast.error("Erro ao salvar mapeamento: " + (error.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Carregando locations...</div>
        </CardContent>
      </Card>
    );
  }

  if (locations.length <= 1) {
    return null; // Não precisa de mapeamento se há apenas 1 location
  }

  const allMapped = locations.every((loc) => mappings[loc.location_id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Mapear Locations para Lojas
        </CardTitle>
        <CardDescription>
          Sua conta Google tem múltiplas locations. Associe cada location a uma loja para gerenciar reviews separadamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Cada location do Google será associada a uma loja. Reviews e estatísticas serão filtrados por location.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {locations.map((location) => (
            <div key={location.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold">{location.location_name}</h4>
                  {location.location_address && (
                    <p className="text-sm text-muted-foreground">{location.location_address}</p>
                  )}
                  {location.location_category && (
                    <p className="text-xs text-muted-foreground mt-1">Categoria: {location.location_category}</p>
                  )}
                </div>
                {mappings[location.location_id] && (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`location-${location.id}`}>Associar à loja:</Label>
                <Select
                  value={mappings[location.location_id] || ""}
                  onValueChange={(value) => handleMappingChange(location.location_id, value)}
                >
                  <SelectTrigger id={`location-${location.id}`}>
                    <SelectValue placeholder="Selecione uma loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma (não mapear)</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={fetchData} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !allMapped}>
            {saving ? "Salvando..." : "Salvar Mapeamento"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

