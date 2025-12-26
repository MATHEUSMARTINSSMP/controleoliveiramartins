import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";
import { toast } from "sonner";
import { GoogleLocation } from "@/hooks/use-google-locations";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { locationSchema, LocationFormValues } from "@/schemas/google-integration";

interface LocationEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    location: GoogleLocation;
}

export function LocationEditDialog({ open, onOpenChange, location }: LocationEditDialogProps) {
    const { control, handleSubmit, reset, formState: { errors } } = useForm<LocationFormValues>({
        resolver: zodResolver(locationSchema),
        defaultValues: {
            title: "",
            phone: "",
            website: "",
        }
    });

    useEffect(() => {
        if (location) {
            reset({
                title: location.location_name || "",
                phone: location.location_phone || "",
                website: location.location_website || "",
            });
        }
    }, [location, reset]);

    const onFormSubmit = (data: LocationFormValues) => {
        // Simulação de salvamento
        console.log("Saving location data:", data);
        toast.success("Informações atualizadas com sucesso! (Simulação)");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Local</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nome do Local</Label>
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <Input {...field} />
                            )}
                        />
                        {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Controller
                            name="phone"
                            control={control}
                            render={({ field }) => (
                                <Input {...field} />
                            )}
                        />
                        {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Website</Label>
                        <Controller
                            name="website"
                            control={control}
                            render={({ field }) => (
                                <Input {...field} />
                            )}
                        />
                        {errors.website && <p className="text-xs text-red-500">{errors.website.message}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Alterações</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
