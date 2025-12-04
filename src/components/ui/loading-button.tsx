import { forwardRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, isLoading, loadingText, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={isLoading || disabled}
        className={cn("relative", className)}
        {...props}
      >
        {isLoading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {isLoading && loadingText ? loadingText : children}
      </Button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";

export interface AsyncButtonProps extends ButtonProps {
  onClick?: () => Promise<void> | void;
  loadingText?: string;
}

export const AsyncButton = forwardRef<HTMLButtonElement, AsyncButtonProps>(
  ({ children, onClick, loadingText, disabled, className, ...props }, ref) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
      if (isLoading || !onClick) return;
      
      const result = onClick();
      if (result instanceof Promise) {
        setIsLoading(true);
        try {
          await result;
        } finally {
          setIsLoading(false);
        }
      }
    };

    return (
      <Button
        ref={ref}
        disabled={isLoading || disabled}
        onClick={handleClick}
        className={cn("relative", className)}
        {...props}
      >
        {isLoading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {isLoading && loadingText ? loadingText : children}
      </Button>
    );
  }
);

AsyncButton.displayName = "AsyncButton";
