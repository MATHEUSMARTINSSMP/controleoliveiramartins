import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { SiteOnboarding, SiteEditor, useSiteData } from "@/components/admin/site-builder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface SiteBuilderProps {
  embedded?: boolean;
}

export default function SiteBuilder({ embedded = false }: SiteBuilderProps) {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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
  const tenantId = embedded 
    ? selectedStoreId 
    : (profile as any)?.store_id || (profile as any)?.store_default;
  const { hasSite, isLoading } = useSiteData({ tenantId });

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  if (!profile || profile.role !== "ADMIN") {
    if (!embedded) {
      navigate("/");
    }
    return null;
  }

  // Se está embedded (dentro de tabs), não mostra header mas adiciona título
  if (embedded) {
    // Se não há lojas ou não há loja selecionada, mostrar seletor
    if (stores.length === 0 || !selectedStoreId) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Gestão de Site</h2>
            <p className="text-sm text-muted-foreground">
              Selecione uma loja para gerenciar o site institucional
            </p>
          </div>
          {stores.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Selecione a Loja</label>
                <Select value={selectedStoreId || ""} onValueChange={setSelectedStoreId}>
                  <SelectTrigger className="w-full max-w-md">
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
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Carregando lojas...</p>
            </div>
          )}
        </div>
      );
    }

    // Se há loja selecionada, mostrar conteúdo
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Gestão de Site</h2>
            <p className="text-sm text-muted-foreground">
              {hasSite 
                ? 'Gerencie seu site institucional'
                : 'Crie seu site institucional em minutos'
              }
            </p>
          </div>
          {stores.length > 1 && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
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
        {isLoading ? (
          <PageLoader />
        ) : hasSite ? (
          <SiteEditor tenantId={tenantId} />
        ) : (
          <SiteOnboarding tenantId={tenantId} />
        )}
      </div>
    );
  }

  // Versão standalone (rota direta)
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Meu Site
          </h1>
          <p className="text-muted-foreground">
            {hasSite 
              ? 'Gerencie seu site institucional'
              : 'Crie seu site institucional em minutos'
            }
          </p>
        </div>
      </div>

      {hasSite ? <SiteEditor tenantId={tenantId} /> : <SiteOnboarding tenantId={tenantId} />}
    </div>
  );
}
