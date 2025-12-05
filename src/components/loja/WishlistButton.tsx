/**
 * Componente modular para botão de Lista de Desejos
 * Pode ser usado ao lado do botão "Nova Venda" de forma discreta
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Heart } from "lucide-react";
import { WishlistDialog } from "./WishlistDialog";

interface WishlistButtonProps {
  storeId: string | null;
  onSuccess?: () => void;
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function WishlistButton({ 
  storeId, 
  onSuccess,
  variant = "outline",
  size = "sm",
  className = ""
}: WishlistButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!storeId) {
    return null;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant}
          size={size}
          className={`${className} text-xs sm:text-sm`}
        >
          <Heart className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          + Lista de Desejos
        </Button>
      </DialogTrigger>
      <DialogContent>
        <WishlistDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          storeId={storeId}
          onSuccess={() => {
            if (onSuccess) onSuccess();
            setDialogOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}


