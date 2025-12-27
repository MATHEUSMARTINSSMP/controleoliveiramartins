import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Image as ImageIcon, MoreVertical, Star, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useGoogleMedia, GoogleMediaItem } from "@/hooks/use-google-media";
import { useGoogleLocations } from "@/hooks/use-google-locations";

interface MediaManagerProps {
    siteSlug: string;
}

// Remover interface MediaItem antiga - agora usando GoogleMediaItem do hook

export function MediaManager({ siteSlug }: MediaManagerProps) {
    const { mediaItems, loading, fetchMedia } = useGoogleMedia();
    const { locations } = useGoogleLocations();
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>();

    useEffect(() => {
        if (siteSlug && locations.length > 0) {
            const primaryLocation = locations.find(l => l.is_primary) || locations[0];
            if (primaryLocation) {
                setSelectedLocationId(primaryLocation.location_id);
                fetchMedia(siteSlug, primaryLocation.location_id);
            }
        }
    }, [siteSlug, locations]);

    const handleDelete = (id: string) => {
        toast.error("Exclusão de mídias ainda não implementada");
    };

    const handleSetProfile = (id: string) => {
        toast.error("Definir como foto de perfil ainda não implementado");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Galeria de Mídias</h2>
                    <p className="text-muted-foreground">Gerencie as fotos e vídeos do seu negócio.</p>
                </div>
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Mídia
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload de Mídia</DialogTitle>
                            <DialogDescription>Adicione fotos ou vídeos ao seu perfil.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="border-2 border-dashed rounded-md p-10 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
                                <ImageIcon className="h-10 w-10 mb-2" />
                                <span className="font-medium">Arraste e solte ou clique para selecionar</span>
                                <span className="text-xs mt-1">JPG ou PNG até 5MB</span>
                            </div>
                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <option value="INTERIOR">Interior</option>
                                    <option value="EXTERIOR">Exterior</option>
                                    <option value="PRODUCT">Produto</option>
                                    <option value="FOOD">Comida e Bebida</option>
                                    <option value="TEAM">Equipe</option>
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
                            <Button onClick={() => {
                                setIsUploadOpen(false);
                                toast.success("Upload realizado com sucesso! (Simulado)");
                            }}>Enviar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList>
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="interior">Interior</TabsTrigger>
                    <TabsTrigger value="exterior">Exterior</TabsTrigger>
                    <TabsTrigger value="food">Produtos</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                            <p className="text-muted-foreground">Carregando mídias...</p>
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium mb-2">Nenhuma mídia encontrada</p>
                            <p className="text-sm text-muted-foreground text-center max-w-md">
                                Não há fotos ou vídeos cadastrados no Google My Business para esta location.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {mediaItems.map((item) => (
                                <div key={item.id} className="group relative aspect-square bg-muted rounded-lg overflow-hidden border">
                                    <img
                                        src={item.thumbnailUrl || item.url}
                                        alt={item.description || "Media item"}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = item.url; // Fallback para URL original
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="secondary" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleSetProfile(item.id)}>
                                                    <Star className="h-4 w-4 mr-2" /> Definir como Perfil
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent text-white text-xs font-medium">
                                        {item.views > 0 ? `${item.views} visualizações` : "Sem visualizações"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
                {/* Outras tabs seriam similares, filtrando o array */}
            </Tabs>
        </div>
    );
}
