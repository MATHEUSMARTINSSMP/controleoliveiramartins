import { forwardRef, useState } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  loadingText?: string;
  successText?: string;
  errorText?: string;
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ 
    children, 
    isLoading, 
    isSuccess,
    isError,
    loadingText = "Enviando...", 
    successText = "Enviado!",
    errorText = "Erro!",
    disabled, 
    className, 
    ...props 
  }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={isLoading || isSuccess || disabled}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          isSuccess && "bg-green-600 hover:bg-green-600 dark:bg-green-600",
          isError && "bg-destructive hover:bg-destructive",
          className
        )}
        {...props}
      >
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingText}
            </motion.span>
          )}
          {isSuccess && !isLoading && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              >
                <Check className="h-4 w-4" />
              </motion.div>
              {successText}
            </motion.span>
          )}
          {isError && !isLoading && !isSuccess && (
            <motion.span
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              {errorText}
            </motion.span>
          )}
          {!isLoading && !isSuccess && !isError && (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";

export interface AsyncButtonProps extends ButtonProps {
  onClick?: () => Promise<void> | void;
  loadingText?: string;
  successText?: string;
  showSuccessState?: boolean;
  successDuration?: number;
}

export const AsyncButton = forwardRef<HTMLButtonElement, AsyncButtonProps>(
  ({ 
    children, 
    onClick, 
    loadingText = "Processando...", 
    successText = "Sucesso!",
    showSuccessState = true,
    successDuration = 2000,
    disabled, 
    className, 
    ...props 
  }, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);

    const handleClick = async () => {
      if (isLoading || isSuccess || !onClick) return;
      
      const result = onClick();
      if (result instanceof Promise) {
        setIsLoading(true);
        setIsError(false);
        try {
          await result;
          if (showSuccessState) {
            setIsSuccess(true);
            setTimeout(() => setIsSuccess(false), successDuration);
          }
        } catch {
          setIsError(true);
          setTimeout(() => setIsError(false), 3000);
        } finally {
          setIsLoading(false);
        }
      }
    };

    return (
      <LoadingButton
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        isLoading={isLoading}
        isSuccess={isSuccess}
        isError={isError}
        loadingText={loadingText}
        successText={successText}
        className={className}
        {...props}
      >
        {children}
      </LoadingButton>
    );
  }
);

AsyncButton.displayName = "AsyncButton";

export function LoadingSpinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2", 
    lg: "w-8 h-8 border-3"
  };
  
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={cn(
        "border-muted-foreground/20 border-t-primary rounded-full",
        sizeClasses[size],
        className
      )}
    />
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-primary rounded-full"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}

export function LoadingPulse({ className, text = "Carregando..." }: { className?: string; text?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <motion.div
        className="w-3 h-3 bg-primary rounded-full"
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="text-muted-foreground text-sm">{text}</span>
    </div>
  );
}

export function SubmitOverlay({ isVisible, text = "Enviando dados..." }: { isVisible: boolean; text?: string }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border rounded-lg p-8 flex flex-col items-center gap-4 shadow-lg"
          >
            <LoadingSpinner size="lg" />
            <p className="text-foreground font-medium">{text}</p>
            <p className="text-muted-foreground text-sm">Por favor, aguarde...</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SuccessAnimation({ isVisible, text = "Dados enviados com sucesso!" }: { isVisible: boolean; text?: string }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-card border rounded-lg p-8 flex flex-col items-center gap-4 shadow-lg"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center"
            >
              <Check className="w-8 h-8 text-white" />
            </motion.div>
            <p className="text-foreground font-medium">{text}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
