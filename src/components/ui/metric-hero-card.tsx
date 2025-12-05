import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";

interface MetricHeroCardProps {
  title: string;
  value: number;
  previousValue?: number;
  icon?: LucideIcon;
  formatAsCurrency?: boolean;
  decimals?: number;
  suffix?: string;
  description?: string;
  className?: string;
  delay?: number;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
}

export function MetricHeroCard({
  title,
  value,
  previousValue,
  icon: Icon,
  formatAsCurrency = false,
  decimals = 0,
  suffix = "",
  description,
  className,
  delay = 0,
  variant = "default",
  size = "md",
}: MetricHeroCardProps) {
  const trend = previousValue !== undefined && previousValue > 0
    ? ((value - previousValue) / previousValue) * 100
    : undefined;

  const isPositive = trend !== undefined && trend >= 0;

  const variantStyles = {
    default: "from-slate-500/10 to-slate-600/5 dark:from-slate-400/10 dark:to-slate-500/5",
    primary: "from-primary/15 to-primary/5",
    success: "from-green-500/15 to-green-600/5",
    warning: "from-yellow-500/15 to-yellow-600/5",
    danger: "from-red-500/15 to-red-600/5",
  };

  const iconStyles = {
    default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    primary: "gradient-primary text-white",
    success: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
    danger: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  const sizeStyles = {
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  const valueSizes = {
    sm: "text-xl",
    md: "text-2xl md:text-3xl",
    lg: "text-3xl md:text-4xl",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      whileHover={{ 
        y: -4, 
        transition: { duration: 0.2 } 
      }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50",
        "bg-gradient-to-br backdrop-blur-sm",
        "hover:shadow-lg hover:border-border transition-all duration-300",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8">
        <div className={cn(
          "w-full h-full rounded-full opacity-20 blur-2xl",
          variant === "primary" ? "bg-primary" : 
          variant === "success" ? "bg-green-500" :
          variant === "warning" ? "bg-yellow-500" :
          variant === "danger" ? "bg-red-500" : "bg-slate-500"
        )} />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-3">
          <p className="text-sm font-medium text-muted-foreground line-clamp-2">
            {title}
          </p>
          {Icon && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay + 0.2, type: "spring", stiffness: 200 }}
              className={cn(
                "p-2 rounded-lg shrink-0",
                iconStyles[variant]
              )}
            >
              <Icon className="w-4 h-4" />
            </motion.div>
          )}
        </div>

        <div className="flex items-end justify-between gap-2 flex-wrap">
          <div className="space-y-1 min-w-0 flex-1">
            <AnimatedCounter
              value={value}
              formatAsCurrency={formatAsCurrency}
              decimals={decimals}
              suffix={suffix}
              className={cn("font-bold tracking-tight", valueSizes[size])}
            />
            {description && (
              <p className="text-xs text-muted-foreground truncate">
                {description}
              </p>
            )}
          </div>

          {trend !== undefined && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.4 }}
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full shrink-0",
                isPositive 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface ProgressMetricCardProps {
  title: string;
  current: number;
  target: number;
  icon?: LucideIcon;
  formatAsCurrency?: boolean;
  className?: string;
  delay?: number;
  showPercentage?: boolean;
}

export function ProgressMetricCard({
  title,
  current,
  target,
  icon: Icon,
  formatAsCurrency = false,
  className,
  delay = 0,
  showPercentage = true,
}: ProgressMetricCardProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isComplete = percentage >= 100;

  const getProgressColor = () => {
    if (percentage >= 100) return "from-green-500 to-emerald-500";
    if (percentage >= 75) return "from-primary to-violet-500";
    if (percentage >= 50) return "from-yellow-500 to-orange-500";
    return "from-red-500 to-rose-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 p-5",
        "bg-card/80 backdrop-blur-sm",
        "hover:shadow-lg hover:border-border transition-all duration-300",
        isComplete && "ring-2 ring-green-500/20",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground truncate">
            {title}
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <AnimatedCounter
              value={current}
              formatAsCurrency={formatAsCurrency}
              className="text-xl font-bold"
            />
            <span className="text-sm text-muted-foreground">
              / {formatAsCurrency 
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(target)
                : target.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
        {Icon && (
          <div className={cn(
            "p-2 rounded-lg shrink-0",
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
          {showPercentage && (
            <motion.span 
              className="font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.3 }}
            >
              {percentage.toFixed(1)}%
            </motion.span>
          )}
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full bg-gradient-to-r",
              getProgressColor()
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ 
              duration: 1, 
              delay: delay + 0.3, 
              ease: [0.25, 0.46, 0.45, 0.94] 
            }}
          />
        </div>
      </div>

      {isComplete && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.5 }}
          className="absolute top-2 right-2"
        >
          <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
            Meta atingida!
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
