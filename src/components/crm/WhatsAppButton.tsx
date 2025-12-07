import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  phone: string;
  message: string;
  store_id?: string; // Multi-tenancy: usar WhatsApp da loja se configurado
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

export default function WhatsAppButton({
  phone,
  message,
  store_id,
  size = "sm",
  variant = "outline",
  className
}: WhatsAppButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!phone || !message) {
      toast.error("Telefone ou mensagem não informados");
      return;
    }

    try {
      setLoading(true);
      const result = await sendWhatsAppMessage({
        phone,
        message,
        store_id,
      });

      if (result.success) {
        toast.success("Mensagem enviada com sucesso!");
      } else {
        toast.error(result.error || "Erro ao enviar mensagem");
      }
    } catch (error: any) {
      console.error("Erro ao enviar WhatsApp:", error);
      toast.error("Erro ao enviar mensagem: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={loading || !phone || !message}
      className={cn("gap-2", className)}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando...
        </>
      ) : (
        <>
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </>
      )}
    </Button>
  );
}

