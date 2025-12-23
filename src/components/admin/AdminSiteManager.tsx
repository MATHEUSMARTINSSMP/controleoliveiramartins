import { useState, useEffect } from "react";
import { SiteOnboarding, SiteEditor, useSiteData } from "@/components/admin/site-builder";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Globe } from "lucide-react";

interface AdminSiteManagerProps {
  stores: { id: string; name: string }[];
}

export function AdminSiteManager({ stores }: AdminSiteManagerProps) {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  
  useEffect(() => {
    if (stores.length === 1 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const { hasSite, isLoading } = useSiteData({ tenantId: selectedStoreId });

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhuma loja encontrada.</p>
          <p className="text-xs">Voce precisa ter pelo menos uma loja para criar um site.</p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedStoreId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Selecione a Loja
          </CardTitle>
          <CardDescription>
            Escolha qual loja deseja gerenciar o site institucional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select onValueChange={setSelectedStoreId}>
            <SelectTrigger data-testid="select-store">
              <SelectValue placeholder="Selecione uma loja..." />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id} data-testid={`store-option-${store.id}`}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          {stores.length > 1 && <Skeleton className="h-10 w-48" />}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stores.length > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Gerenciando site da loja: <strong>{stores.find(s => s.id === selectedStoreId)?.name}</strong>
          </p>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-48" data-testid="select-store-switch">
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
        </div>
      )}
      
      {hasSite ? (
        <SiteEditor tenantId={selectedStoreId} />
      ) : (
        <SiteOnboarding tenantId={selectedStoreId} />
      )}
    </div>
  );
}
