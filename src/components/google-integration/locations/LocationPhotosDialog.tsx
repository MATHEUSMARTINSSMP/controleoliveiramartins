import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface LocationPhotosDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LocationPhotosDialog({ open, onOpenChange }: LocationPhotosDialogProps) {
    const handleUploadPhoto = () => {
        toast.success("Foto enviada com sucesso! (Simulação)");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Gerenciar Fotos</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        {/* Placeholder gallery */}
                        <div className="aspect-square bg-muted rounded-md flex items-center justify-center text-muted-foreground">Foto 1</div>
                        <div className="aspect-square bg-muted rounded-md flex items-center justify-center text-muted-foreground">Foto 2</div>
                        <div className="aspect-square bg-muted rounded-md flex items-center justify-center text-muted-foreground">Foto 3</div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleUploadPhoto}>
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Adicionar Nova Foto
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
