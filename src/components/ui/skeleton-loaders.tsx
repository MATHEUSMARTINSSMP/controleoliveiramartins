import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/60",
        className
      )}
    />
  );
}

export function SkeletonText({ className, lines = 1 }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

export function SkeletonKPICard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 sm:p-6", className)}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
      <div className="mt-4">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-muted/30 p-4 border-b">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4 flex gap-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn("h-4 flex-1", colIndex === 0 && "w-1/4")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="h-64 flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.random() * 60 + 20}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboardHeader() {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonDashboardKPIs({ count = 3 }: { count?: number }) {
  return (
    <div className={cn(
      "grid gap-4 mb-6",
      count === 2 && "grid-cols-1 sm:grid-cols-2",
      count === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      count === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      count >= 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKPICard key={i} />
      ))}
    </div>
  );
}

export function SkeletonLojaDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <header className="bg-card/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 space-y-6">
        <SkeletonDashboardKPIs count={3} />
        
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonKPICard />
          <SkeletonKPICard />
          <SkeletonKPICard />
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonTable rows={5} cols={3} />
        </div>
      </main>
    </div>
  );
}

export function SkeletonColaboradoraDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <header className="bg-card/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </header>
      
      <main className="container mx-auto p-4 space-y-6">
        <SkeletonDashboardKPIs count={4} />
        
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <SkeletonTable rows={6} cols={5} />
        </div>
      </main>
    </div>
  );
}

export function SkeletonAdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <header className="bg-card/80 backdrop-blur-lg border-b border-primary/10 sticky top-0 z-50 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 space-y-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 flex-shrink-0" />
          ))}
        </div>
        
        <SkeletonDashboardKPIs count={4} />
        
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </main>
    </div>
  );
}

export function SkeletonSection({ title }: { title?: string }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        {title ? (
          <h3 className="font-semibold">{title}</h3>
        ) : (
          <Skeleton className="h-5 w-32" />
        )}
      </div>
      <div className="p-4 space-y-3">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = "default", className }: { size?: "sm" | "default" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-primary border-t-transparent",
          sizeClasses[size]
        )}
      />
    </div>
  );
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
}

export function SuspenseFallback({ type = "section" }: { type?: "page" | "section" | "component" }) {
  if (type === "page") {
    return <SkeletonLojaDashboard />;
  }

  if (type === "component") {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return <SkeletonSection />;
}
