import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function GlassCard({ 
  children, 
  className, 
  hover = true,
  glow = false,
  ...props 
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={hover ? { 
        y: -4, 
        transition: { duration: 0.2 } 
      } : undefined}
      className={cn(
        "glass-card p-6",
        hover && "hover:shadow-lg transition-shadow duration-300",
        glow && "glow",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface GlassCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCardHeader({ children, className }: GlassCardHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-1.5 pb-4", className)}>
      {children}
    </div>
  );
}

interface GlassCardTitleProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export function GlassCardTitle({ children, className, gradient }: GlassCardTitleProps) {
  return (
    <h3 className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      gradient && "gradient-text",
      className
    )}>
      {children}
    </h3>
  );
}

interface GlassCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCardContent({ children, className }: GlassCardContentProps) {
  return (
    <div className={cn("", className)}>
      {children}
    </div>
  );
}
