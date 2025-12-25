import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, Image as ImageIcon, Eraser } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface MaskFile {
  id: string;
  file: File;
  preview: string;
}

interface MaskUploadInputProps {
  mask: MaskFile | null;
  onMaskChange: (mask: MaskFile | null) => void;
  inputImage?: string; // URL da imagem de entrada para preview combinado
  disabled?: boolean;
}

/**
 * Componente para upload de máscara para inpainting
 * Máscara deve ser PNG com transparência (áreas transparentes = editáveis)
 */
export function MaskUploadInput({
  mask,
  onMaskChange,
  inputImage,
  disabled = false,
}: MaskUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validar que é PNG (máscaras devem ser PNG para suportar transparência)
    if (!file.type.includes("png") && !file.name.toLowerCase().endsWith(".png")) {
      alert("Máscara deve ser um arquivo PNG para suportar transparência");
      return;
    }

    const id = `${Date.now()}-${Math.random()}`;
    const preview = URL.createObjectURL(file);
    
    onMaskChange({ id, file, preview });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveMask = () => {
    if (mask) {
      URL.revokeObjectURL(mask.preview);
    }
    onMaskChange(null);
  };

  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Limpar URL quando componente desmontar ou máscara mudar
  useEffect(() => {
    return () => {
      if (mask) {
        URL.revokeObjectURL(mask.preview);
      }
    };
  }, [mask]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            Máscara para Edição (Inpainting)
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            Áreas transparentes na máscara serão editadas pela IA
          </p>
        </div>
        {!mask && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenFileDialog}
            disabled={disabled}
          >
            <Upload className="h-4 w-4 mr-2" />
            Adicionar Máscara
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {mask && (
        <Card className="relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {/* Preview da máscara */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Máscara</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleRemoveMask}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="aspect-square relative bg-muted border-2 border-dashed border-muted-foreground/20 rounded-lg overflow-hidden">
                <img
                  src={mask.preview}
                  alt={mask.file.name}
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-grid-pattern opacity-10" />
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="truncate" title={mask.file.name}>{mask.file.name}</p>
                <p>{(mask.file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>

            {/* Preview combinado (imagem + máscara) */}
            {inputImage && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Preview Combinado</span>
                <div className="aspect-square relative bg-muted border-2 border-dashed border-primary/30 rounded-lg overflow-hidden">
                  <img
                    src={inputImage}
                    alt="Imagem de entrada"
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0 mix-blend-screen opacity-50"
                    style={{
                      backgroundImage: `url(${mask.preview})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Áreas destacadas serão editadas
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {!mask && (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={handleOpenFileDialog}
        >
          <Eraser className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Clique para adicionar máscara PNG
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Use áreas transparentes para indicar o que deve ser editado
          </p>
        </div>
      )}

      {mask && !inputImage && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-600 dark:text-yellow-400">
          <p className="font-medium mb-1">⚠️ Aviso</p>
          <p>
            Para usar inpainting, você precisa ter uma imagem de entrada. 
            Adicione uma imagem de referência acima.
          </p>
        </div>
      )}
    </div>
  );
}

