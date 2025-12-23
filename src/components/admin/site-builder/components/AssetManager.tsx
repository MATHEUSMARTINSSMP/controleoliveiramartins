import { useState } from "react";
import { Plus, Trash2, GripVertical, Image, Package, Building2, ImagePlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "./ImageUploadField";
import type { SiteAsset, AssetType, ProductMetadata, AmbientMetadata, GalleryMetadata } from "../types";
import { ASSET_TYPE_LABELS, ASSET_TYPE_LIMITS } from "../types";

interface AssetManagerProps {
  assets: SiteAsset[];
  onChange: (assets: SiteAsset[]) => void;
}

const ASSET_TYPE_ICONS: Record<AssetType, typeof Image> = {
  logo: Crown,
  hero: ImagePlus,
  product: Package,
  ambient: Building2,
  gallery: Image
};

const generateId = () => Math.random().toString(36).substring(2, 11);

export function AssetManager({ assets, onChange }: AssetManagerProps) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const getAssetCountByType = (type: AssetType) => {
    return assets.filter(a => a.type === type).length;
  };

  const canAddAssetType = (type: AssetType) => {
    return getAssetCountByType(type) < ASSET_TYPE_LIMITS[type];
  };

  const handleAddAsset = (type: AssetType) => {
    if (!canAddAssetType(type)) return;

    const newAsset: SiteAsset = {
      id: generateId(),
      type,
      url: "",
      base64: undefined,
      filename: undefined,
      displayOrder: assets.length,
      metadata: type === "product" 
        ? { name: "", price: "", commission: "", collection: "", description: "" }
        : type === "ambient"
        ? { description: "", location: "" }
        : type === "gallery"
        ? { caption: "" }
        : null
    };

    onChange([...assets, newAsset]);
    setExpandedAsset(newAsset.id);
  };

  const handleRemoveAsset = (id: string) => {
    onChange(assets.filter(a => a.id !== id));
    if (expandedAsset === id) {
      setExpandedAsset(null);
    }
  };

  const handleUpdateAsset = (id: string, updates: Partial<SiteAsset>) => {
    onChange(assets.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleImageChange = (id: string, url: string, base64?: string) => {
    handleUpdateAsset(id, { 
      url, 
      base64: base64 || undefined,
      filename: base64 ? `asset-${id}.jpg` : undefined
    });
  };

  const handleMetadataChange = (id: string, field: string, value: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    const updatedMetadata = { ...asset.metadata, [field]: value };
    handleUpdateAsset(id, { metadata: updatedMetadata });
  };

  const renderMetadataFields = (asset: SiteAsset) => {
    switch (asset.type) {
      case "product":
        const productMeta = asset.metadata as ProductMetadata || {};
        return (
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground">Informacoes do Produto:</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Produto *</Label>
                <Input
                  placeholder="Ex: Camiseta Premium"
                  value={productMeta.name || ""}
                  onChange={(e) => handleMetadataChange(asset.id, "name", e.target.value)}
                  data-testid={`input-product-name-${asset.id}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preco</Label>
                <Input
                  placeholder="Ex: R$ 99,90"
                  value={productMeta.price || ""}
                  onChange={(e) => handleMetadataChange(asset.id, "price", e.target.value)}
                  data-testid={`input-product-price-${asset.id}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Comissao</Label>
                <Input
                  placeholder="Ex: 10%"
                  value={productMeta.commission || ""}
                  onChange={(e) => handleMetadataChange(asset.id, "commission", e.target.value)}
                  data-testid={`input-product-commission-${asset.id}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Colecao</Label>
                <Input
                  placeholder="Ex: Verao 2025"
                  value={productMeta.collection || ""}
                  onChange={(e) => handleMetadataChange(asset.id, "collection", e.target.value)}
                  data-testid={`input-product-collection-${asset.id}`}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descricao</Label>
              <Textarea
                placeholder="Informacoes adicionais sobre o produto..."
                value={productMeta.description || ""}
                onChange={(e) => handleMetadataChange(asset.id, "description", e.target.value)}
                className="min-h-[60px]"
                data-testid={`input-product-description-${asset.id}`}
              />
            </div>
          </div>
        );

      case "ambient":
        const ambientMeta = asset.metadata as AmbientMetadata || {};
        return (
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground">Informacoes do Ambiente:</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Local/Area</Label>
                <Input
                  placeholder="Ex: Sala de Atendimento"
                  value={ambientMeta.location || ""}
                  onChange={(e) => handleMetadataChange(asset.id, "location", e.target.value)}
                  data-testid={`input-ambient-location-${asset.id}`}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descricao</Label>
              <Textarea
                placeholder="Descreva o ambiente..."
                value={ambientMeta.description || ""}
                onChange={(e) => handleMetadataChange(asset.id, "description", e.target.value)}
                className="min-h-[60px]"
                data-testid={`input-ambient-description-${asset.id}`}
              />
            </div>
          </div>
        );

      case "gallery":
        const galleryMeta = asset.metadata as GalleryMetadata || {};
        return (
          <div className="space-y-3 pt-3 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Legenda (opcional)</Label>
              <Input
                placeholder="Legenda da imagem..."
                value={galleryMeta.caption || ""}
                onChange={(e) => handleMetadataChange(asset.id, "caption", e.target.value)}
                data-testid={`input-gallery-caption-${asset.id}`}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const groupedAssets = {
    logo: assets.filter(a => a.type === "logo"),
    hero: assets.filter(a => a.type === "hero"),
    product: assets.filter(a => a.type === "product"),
    ambient: assets.filter(a => a.type === "ambient"),
    gallery: assets.filter(a => a.type === "gallery")
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ImagePlus className="h-5 w-5" />
            Adicionar Imagem
          </CardTitle>
          <CardDescription>
            Selecione o tipo de imagem que deseja adicionar ao seu site
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-5">
            {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((type) => {
              const Icon = ASSET_TYPE_ICONS[type];
              const count = getAssetCountByType(type);
              const limit = ASSET_TYPE_LIMITS[type];
              const canAdd = canAddAssetType(type);

              return (
                <Button
                  key={type}
                  variant={canAdd ? "outline" : "ghost"}
                  className="flex flex-col h-auto py-3 gap-1"
                  onClick={() => handleAddAsset(type)}
                  disabled={!canAdd}
                  data-testid={`button-add-${type}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{ASSET_TYPE_LABELS[type]}</span>
                  <Badge variant={count >= limit ? "secondary" : "outline"} className="text-[10px]">
                    {count}/{limit}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma imagem adicionada ainda.</p>
            <p className="text-xs">Clique em um dos botoes acima para adicionar sua primeira imagem.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(Object.keys(groupedAssets) as AssetType[]).map((type) => {
            const typeAssets = groupedAssets[type];
            if (typeAssets.length === 0) return null;

            const Icon = ASSET_TYPE_ICONS[type];

            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {ASSET_TYPE_LABELS[type]}
                    <Badge variant="outline" className="ml-auto">
                      {typeAssets.length}/{ASSET_TYPE_LIMITS[type]}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {typeAssets.map((asset, index) => (
                    <div 
                      key={asset.id}
                      className="p-4 rounded-lg bg-muted/30 space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 pt-1">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <ImageUploadField
                            label={`${ASSET_TYPE_LABELS[type]} ${typeAssets.length > 1 ? index + 1 : ""}`}
                            value={asset.url}
                            onChange={(url, base64) => handleImageChange(asset.id, url, base64)}
                            placeholder="Cole uma URL ou faca upload"
                            aspectRatio={type === "logo" ? "square" : "landscape"}
                          />
                          {renderMetadataFields(asset)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAsset(asset.id)}
                          className="flex-shrink-0 text-destructive"
                          data-testid={`button-remove-${asset.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-lg bg-muted/50 space-y-3">
        <p className="text-sm font-medium">Dicas para links externos:</p>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><span className="font-semibold text-foreground">Imgur:</span> imgur.com - Hospedagem gratuita e permanente</p>
          <p><span className="font-semibold text-foreground">Imgbox:</span> imgbox.com - Sem compressao, qualidade original</p>
          <p><span className="font-semibold text-foreground">PostImage:</span> postimage.org - Facil e rapido</p>
        </div>
      </div>
    </div>
  );
}
