import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ShimmerLoaderProps {
  className?: string;
  width?: string;
  height?: string;
}

export function ShimmerLoader({ 
  className, 
  width = "100%", 
  height = "1rem" 
}: ShimmerLoaderProps) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        className
      )}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
        }}
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

interface MetricCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className }: MetricCardSkeletonProps) {
  return (
    <div className={cn("glass-card p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <ShimmerLoader width="40%" height="1rem" />
        <ShimmerLoader width="2rem" height="2rem" className="rounded-full" />
      </div>
      <ShimmerLoader width="60%" height="2rem" />
      <ShimmerLoader width="80%" height="0.75rem" />
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  className 
}: TableSkeletonProps) {
  return (
    <div className={cn("glass-card p-6 space-y-4", className)}>
      <div className="flex gap-4 pb-4 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <ShimmerLoader key={i} width={`${100 / columns}%`} height="1rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <ShimmerLoader 
              key={colIndex} 
              width={`${100 / columns}%`} 
              height="1rem" 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface ChartSkeletonProps {
  className?: string;
  type?: "bar" | "line" | "pie";
}

export function ChartSkeleton({ className, type = "bar" }: ChartSkeletonProps) {
  if (type === "pie") {
    return (
      <div className={cn("glass-card p-6 flex items-center justify-center", className)}>
        <div className="relative w-48 h-48">
          <ShimmerLoader className="w-full h-full rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("glass-card p-6", className)}>
      <div className="flex items-end justify-between h-48 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <motion.div
            key={i}
            className="flex-1 bg-muted rounded-t-md"
            initial={{ height: "20%" }}
            animate={{ height: `${30 + Math.random() * 50}%` }}
            transition={{
              duration: 1,
              delay: i * 0.1,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary/20"
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

interface PulseDotsProps {
  className?: string;
}

export function PulseDots({ className }: PulseDotsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-primary"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            delay: i * 0.2,
            repeat: Infinity,
          }}
        />
      ))}
    </div>
  );
}
