import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

interface ImageUploadInputProps {
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
  maxImages?: number;
  accept?: string;
  disabled?: boolean;
}

/**
 * Componente para upload de múltiplas imagens de referência
 */
export function ImageUploadInput({
  images,
  onImagesChange,
  maxImages = 5,
  accept = "image/*",
  disabled = false,
}: ImageUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: ImageFile[] = [];
    const remainingSlots = maxImages - images.length;

    Array.from(files)
      .slice(0, remainingSlots)
      .forEach((file) => {
        if (file.type.startsWith("image/")) {
          const id = `${Date.now()}-${Math.random()}`;
          const preview = URL.createObjectURL(file);
          newImages.push({ id, file, preview });
        }
      });

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (id: string) => {
    const imageToRemove = images.find((img) => img.id === id);
    if (imageToRemove) {
      // Revogar URL do objeto para liberar memória
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onImagesChange(images.filter((img) => img.id !== id));
  };

  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Limpar URLs quando componente desmontar ou imagens mudarem
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        URL.revokeObjectURL(img.preview);
      });
    };
  }, [images]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Imagens de Referência {images.length > 0 && `(${images.length}/${maxImages})`}
        </label>
        {images.length < maxImages && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenFileDialog}
            disabled={disabled || images.length >= maxImages}
          >
            <Upload className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || images.length >= maxImages}
      />

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image) => (
            <Card key={image.id} className="relative overflow-hidden group">
              <div className="aspect-square relative bg-muted">
                <img
                  src={image.preview}
                  alt={image.file.name}
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(image.id)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <CardContent className="p-2">
                <p className="text-xs text-muted-foreground truncate" title={image.file.name}>
                  {image.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(image.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={handleOpenFileDialog}
        >
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Clique para adicionar imagens de referência
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Máximo {maxImages} imagens
          </p>
        </div>
      )}

      {images.length >= maxImages && (
        <p className="text-xs text-muted-foreground">
          Limite de {maxImages} imagens atingido. Remova uma imagem para adicionar outra.
        </p>
      )}
    </div>
  );
}

