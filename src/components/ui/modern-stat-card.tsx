import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";

interface ModernStatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  formatAsCurrency?: boolean;
  decimals?: number;
  suffix?: string;
  className?: string;
  delay?: number;
  variant?: "default" | "gradient" | "glow";
}

export function ModernStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  formatAsCurrency = false,
  decimals = 0,
  suffix = "",
  className,
  delay = 0,
  variant = "default",
}: ModernStatCardProps) {
  const variants = {
    default: "glass-card",
    gradient: "glass-card border-gradient",
    glow: "glass-card glow-sm",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "p-6 hover:shadow-lg transition-all duration-300",
        variants[variant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground truncate">
            {title}
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <AnimatedCounter
              value={value}
              formatAsCurrency={formatAsCurrency}
              decimals={decimals}
              suffix={suffix}
              className="text-2xl font-bold tracking-tight"
            />
            {trend && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: delay + 0.3 }}
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  trend.isPositive 
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}
              >
                {trend.isPositive ? "+" : ""}{trend.value.toFixed(1)}%
              </motion.span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.2, type: "spring" }}
            className="p-3 rounded-xl gradient-primary text-white shrink-0"
          >
            <Icon className="w-5 h-5" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

interface ModernProgressCardProps {
  title: string;
  current: number;
  target: number;
  icon?: LucideIcon;
  formatAsCurrency?: boolean;
  className?: string;
  delay?: number;
}

export function ModernProgressCard({
  title,
  current,
  target,
  icon: Icon,
  formatAsCurrency = false,
  className,
  delay = 0,
}: ModernProgressCardProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isComplete = percentage >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "glass-card p-6 hover:shadow-lg transition-all duration-300",
        isComplete && "glow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <AnimatedCounter
              value={current}
              formatAsCurrency={formatAsCurrency}
              className="text-xl font-bold"
            />
            <span className="text-sm text-muted-foreground">
              / {formatAsCurrency 
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(target)
                : target}
            </span>
          </div>
        </div>
        {Icon && (
          <div className={cn(
            "p-2 rounded-lg",
            isComplete 
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span className="font-medium">{percentage.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              isComplete 
                ? "bg-green-500"
                : "gradient-primary"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
