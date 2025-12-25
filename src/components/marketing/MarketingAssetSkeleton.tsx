import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton para card de asset na galeria
 */
export function MarketingAssetSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}

/**
 * Grid de skeletons para galeria
 */
export function MarketingAssetGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MarketingAssetSkeleton key={i} />
      ))}
    </div>
  );
}

