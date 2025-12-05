import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface ModernDashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  showBackground?: boolean;
}

export function ModernDashboardLayout({ 
  children, 
  className,
  showBackground = true 
}: ModernDashboardLayoutProps) {
  return (
    <div className={cn("min-h-screen relative", className)}>
      {showBackground && (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-background" />
          <motion.div 
            className="absolute top-0 right-0 w-[600px] h-[600px] bg-foreground/5 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-foreground/5 rounded-full blur-3xl"
            animate={{ 
              scale: [1.1, 1, 1.1],
              opacity: [0.15, 0.25, 0.15],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({ 
  title, 
  subtitle, 
  icon,
  actions,
  className 
}: DashboardHeaderProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <motion.div 
            className="p-3 rounded-lg bg-foreground text-background shadow-md"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            {icon}
          </motion.div>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 flex-wrap"
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}

interface HeroMetricsProps {
  children: React.ReactNode;
  className?: string;
}

export function HeroMetrics({ children, className }: HeroMetricsProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={cn(
        "grid gap-4 md:gap-6",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface SectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function DashboardSection({ 
  title, 
  description, 
  children, 
  className,
  actions 
}: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("space-y-4", className)}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </motion.section>
  );
}

interface FeatureBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "new" | "beta" | "pro";
  className?: string;
}

export function FeatureBadge({ 
  children, 
  variant = "default",
  className 
}: FeatureBadgeProps) {
  const variants = {
    default: "bg-primary/10 text-primary",
    new: "bg-green-500/10 text-green-600 dark:text-green-400",
    beta: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    pro: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {variant === "new" && <Sparkles className="w-3 h-3" />}
      {children}
    </motion.span>
  );
}
