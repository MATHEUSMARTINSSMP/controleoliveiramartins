import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatAsCurrency?: boolean;
}

export function AnimatedCounter({
  value,
  duration = 1,
  className,
  prefix = "",
  suffix = "",
  decimals = 0,
  formatAsCurrency = false,
}: AnimatedCounterProps) {
  const spring = useSpring(0, { 
    duration: duration * 1000,
    bounce: 0,
  });
  
  const display = useTransform(spring, (current) => {
    if (formatAsCurrency) {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(current);
    }
    return current.toFixed(decimals);
  });

  const [displayValue, setDisplayValue] = useState(prefix + "0" + suffix);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = display.on("change", (latest) => {
      if (formatAsCurrency) {
        setDisplayValue(latest);
      } else {
        setDisplayValue(prefix + latest + suffix);
      }
    });
    return () => unsubscribe();
  }, [display, prefix, suffix, formatAsCurrency]);

  return (
    <motion.span
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {displayValue}
    </motion.span>
  );
}

interface AnimatedPercentageProps {
  value: number;
  className?: string;
  showBar?: boolean;
  barClassName?: string;
  size?: "sm" | "md" | "lg";
}

export function AnimatedPercentage({
  value,
  className,
  showBar = false,
  barClassName,
  size = "md",
}: AnimatedPercentageProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  
  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className="space-y-1">
      <AnimatedCounter
        value={clampedValue}
        decimals={1}
        suffix="%"
        className={className}
      />
      {showBar && (
        <div className={cn(
          "w-full bg-muted rounded-full overflow-hidden",
          sizeClasses[size]
        )}>
          <motion.div
            className={cn(
              "h-full gradient-primary rounded-full",
              barClassName
            )}
            initial={{ width: 0 }}
            animate={{ width: `${clampedValue}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}
