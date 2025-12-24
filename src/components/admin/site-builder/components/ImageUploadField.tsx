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
  const MAX_OUTPUT_SIZE = 500 * 1024; // 500KB max after conversion
  const MAX_DIMENSION = 1920; // Max width/height
  const WEBP_QUALITY = 0.8;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

  // Check if browser supports WebP encoding
  const supportsWebP = (): boolean => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  };

  // Convert image to WebP with resize and compression
  const convertToWebP = async (file: File): Promise<{ blob: Blob; base64: string; format: string }> => {
    return new Promise((resolve, reject) => {
      // SVG doesn't need conversion
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ blob: file, base64, format: 'svg+xml' });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        // Calculate new dimensions (max 1920px)
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Determine output format
        const useWebP = supportsWebP();
        const format = useWebP ? 'webp' : 'jpeg';
        const mimeType = useWebP ? 'image/webp' : 'image/jpeg';
        
        // Try different quality levels to stay under 500KB
        let quality = WEBP_QUALITY;
        const tryConvert = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to convert image'));
                return;
              }
              
              // If still too large, reduce quality and try again
              if (blob.size > MAX_OUTPUT_SIZE && quality > 0.3) {
                quality -= 0.1;
                tryConvert();
                return;
              }
              
              // Convert blob to base64
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve({ blob, base64, format });
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            },
            mimeType,
            quality
          );
        };
        
        tryConvert();
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      
      img.src = objectUrl;
    });
  };

  // Converts common image hosting page URLs to direct image URLs
  const normalizeImageUrl = (url: string): string => {
    // imgbox.com page URL to direct image URL
    // Example: https://imgbox.com/DjxMm3Hf -> need to fetch the actual image URL
    // For now, show a helpful message
    if (url.match(/^https?:\/\/(www\.)?imgbox\.com\/[a-zA-Z0-9]+$/)) {
      setError("Use a URL direta da imagem (images2.imgbox.com/.../_o.png). Clique em 'Full Size' no imgbox e copie o link da imagem.");
      return url;
    }
    
    // Google Drive sharing URL to direct download
    // Example: https://drive.google.com/file/d/FILE_ID/view -> https://drive.google.com/uc?export=view&id=FILE_ID
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) {
      return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    }
    
    // Dropbox sharing URL to direct download
    // Example: https://www.dropbox.com/s/xxx/file.jpg?dl=0 -> https://www.dropbox.com/s/xxx/file.jpg?raw=1
    if (url.includes('dropbox.com')) {
      return url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
    }
    
    return url;
  };

  const handleUrlChange = (url: string) => {
    const normalizedUrl = normalizeImageUrl(url);
    onChange(normalizedUrl);
    
    // Only show preview if URL wasn't flagged with an error
    if (normalizedUrl && normalizedUrl.startsWith("http") && !error) {
      setError(null);
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

  const [isConverting, setIsConverting] = useState(false);

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
    setIsConverting(true);
    setError(null);

    try {
      // Convert to WebP with resize
      const { blob, base64, format } = await convertToWebP(file);
      const previewUrl = URL.createObjectURL(blob);
      
      // Calculate size reduction
      const originalSize = file.size;
      const newSize = blob.size;
      const reduction = Math.round((1 - newSize / originalSize) * 100);
      
      onChange(previewUrl, base64);
      if (onBase64Change) {
        const newFileName = file.name.replace(/\.[^.]+$/, `.${format}`);
        onBase64Change(base64, newFileName);
      }
      setInputMode("preview");
      
      const sizeKB = Math.round(newSize / 1024);
      toast({
        title: "Imagem otimizada",
        description: format === 'svg+xml' 
          ? "SVG carregado sem alteracoes."
          : `Convertida para ${format.toUpperCase()} (${sizeKB}KB, ${reduction}% menor)`
      });
    } catch (err) {
      console.error('Image conversion error:', err);
      setError("Erro ao processar a imagem");
      toast({
        title: "Erro",
        description: "Nao foi possivel converter a imagem",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsConverting(false);
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
            {(isLoading || isConverting) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50">
                <Loader2 className="h-6 w-6 animate-spin" />
                {isConverting && <span className="text-xs mt-2">Otimizando...</span>}
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
