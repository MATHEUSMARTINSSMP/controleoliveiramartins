import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Link, X, Image as ImageIcon, Loader2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string, base64?: string) => void;
  placeholder?: string;
  helpText?: string;
  aspectRatio?: "square" | "landscape" | "portrait";
  onBase64Change?: (base64: string, fileName: string) => void;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder = "https://exemplo.com/imagem.jpg",
  helpText,
  aspectRatio = "landscape",
  onBase64Change
}: ImageUploadFieldProps) {
  const [inputMode, setInputMode] = useState<"url" | "preview">(value ? "preview" : "url");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const aspectClasses = {
    square: "aspect-square",
    landscape: "aspect-video",
    portrait: "aspect-[3/4]"
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

  const handleUrlChange = (url: string) => {
    onChange(url);
    setError(null);
    if (url && url.startsWith("http")) {
      setInputMode("preview");
    }
  };

  const handleImageError = () => {
    setError("Nao foi possivel carregar a imagem. Verifique a URL.");
    setInputMode("url");
  };

  const handleClear = () => {
    onChange("", "");
    if (onBase64Change) {
      onBase64Change("", "");
    }
    setInputMode("url");
    setError(null);
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Tipo de arquivo nao permitido. Use: JPG, PNG, WebP ou SVG`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Arquivo muito grande. Maximo: 5MB`;
    }
    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      toast({
        title: "Erro no arquivo",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const base64 = await fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      onChange(previewUrl, base64);
      if (onBase64Change) {
        onBase64Change(base64, file.name);
      }
      setInputMode("preview");
      toast({
        title: "Imagem carregada",
        description: "A imagem sera enviada junto com os dados do site."
      });
    } catch (err) {
      setError("Erro ao processar a imagem");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {inputMode === "preview" && value ? (
        <div className="relative group">
          <div className={`relative ${aspectClasses[aspectRatio]} w-full overflow-hidden rounded-md border bg-muted`}>
            <img
              src={value}
              alt={label}
              className="w-full h-full object-cover"
              onError={handleImageError}
              onLoad={() => setIsLoading(false)}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4 mr-1" />
              Trocar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={value.startsWith("blob:") ? "" : value}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            {value && !value.startsWith("blob:") && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsLoading(true);
                  setInputMode("preview");
                }}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          
          <div
            className={`${aspectClasses[aspectRatio]} w-full rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground cursor-pointer transition-colors ${
              isDragging 
                ? "border-primary bg-primary/5" 
                : "bg-muted/30 hover:border-muted-foreground/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">Clique ou arraste uma imagem</p>
            <p className="text-xs mt-1">Ou cole uma URL no campo acima</p>
            <p className="text-xs mt-1 text-muted-foreground/70">JPG, PNG, WebP, SVG (max 5MB)</p>
          </div>
        </div>
      )}
      
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
