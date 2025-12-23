import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseImageUploadOptions {
  bucket?: string;
  folder?: string;
  maxSizeMB?: number;
  allowedTypes?: string[];
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
}

interface UploadResult {
  url: string;
  path: string;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const {
    bucket = "site-images",
    folder = "uploads",
    maxSizeMB = 5,
    allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    onSuccess,
    onError
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const validateFile = useCallback((file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `Tipo de arquivo não permitido. Use: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`;
    }
    
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Arquivo muito grande. Máximo: ${maxSizeMB}MB`;
    }
    
    return null;
  }, [allowedTypes, maxSizeMB]);

  const generateFileName = useCallback((file: File): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'jpg';
    return `${folder}/${timestamp}-${randomStr}.${extension}`;
  }, [folder]);

  const uploadImage = useCallback(async (file: File): Promise<UploadResult | null> => {
    const validationError = validateFile(file);
    if (validationError) {
      const error = new Error(validationError);
      setError(error);
      onError?.(error);
      toast({
        title: "Erro no upload",
        description: validationError,
        variant: "destructive"
      });
      return null;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      const filePath = generateFileName(file);
      setProgress(30);

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setProgress(80);

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      const result: UploadResult = {
        url: urlData.publicUrl,
        path: data.path
      };

      setProgress(100);
      onSuccess?.(result.url);
      
      toast({
        title: "Upload concluído",
        description: "Imagem enviada com sucesso!"
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Erro no upload");
      setError(error);
      onError?.(error);
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive"
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [bucket, validateFile, generateFileName, onSuccess, onError, toast]);

  const deleteImage = useCallback(async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (err) {
      console.error('Error deleting image:', err);
      return false;
    }
  }, [bucket]);

  return {
    uploadImage,
    deleteImage,
    isUploading,
    progress,
    error
  };
}
