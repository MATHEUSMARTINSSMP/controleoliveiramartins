import { useEffect, useState } from "react";
import { useGoogleLocations, GoogleLocation } from "@/hooks/use-google-locations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Globe, Check, Edit, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocationEditDialog } from "./locations/LocationEditDialog";
import { LocationPhotosDialog } from "./locations/LocationPhotosDialog";

interface GoogleLocationsProps {
    siteSlug: string;
}

export function GoogleLocations({ siteSlug }: GoogleLocationsProps) {
    const { locations, loading, fetchLocations, setPrimaryLocation } = useGoogleLocations();

    useEffect(() => {
        fetchLocations(siteSlug);
    }, [siteSlug]);

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader className="h-24 bg-muted/50" />
                        <CardContent className="h-32 bg-muted/30" />
                    </Card>
                ))}
            </div>
        );
    }

    if (locations.length === 0) {
        return (
            <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum local encontrado</h3>
                <p className="text-muted-foreground mt-2">
                    Não encontramos locais associados a esta conta. Verifique se sua conta Google possui locais cadastrados.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => (
                <LocationCard
                    key={location.id}
                    location={location}
                    onSetPrimary={() => setPrimaryLocation(location.id, siteSlug)}
                />
            ))}
        </div>
    );
}

function LocationCard({
    location,
    onSetPrimary,
}: {
    location: GoogleLocation;
    onSetPrimary: () => void;
}) {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isPhotosOpen, setIsPhotosOpen] = useState(false);

    return (
        <Card className={`relative ${location.is_primary ? "border-primary shadow-sm" : ""}`}>
            {location.is_primary && (
                <div className="absolute top-2 right-2">
                    <Badge variant="default" className="bg-primary text-primary-foreground">
                        Principal
                    </Badge>
                </div>
            )}

            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold line-clamp-1" title={location.location_name}>
                    {location.location_name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{location.location_category || "Sem categoria"}</p>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                    {location.location_address && (
                        <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{location.location_address}</span>
                        </div>
                    )}

                    {location.location_phone && (
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{location.location_phone}</span>
                        </div>
                    )}

                    {location.location_website && (
                        <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                            <a
                                href={location.location_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                            >
                                Website
                            </a>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsEditOpen(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                    </Button>
                    <LocationEditDialog
                        open={isEditOpen}
                        onOpenChange={setIsEditOpen}
                        location={location}
                    />

                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsPhotosOpen(true)}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Fotos
                    </Button>
                    <LocationPhotosDialog
                        open={isPhotosOpen}
                        onOpenChange={setIsPhotosOpen}
                    />
                </div>

                <div className="pt-2 border-t">
                    {!location.is_primary ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={onSetPrimary}
                        >
                            Definir como Principal
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full cursor-default hover:bg-transparent"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Local Principal
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
