import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CampaignCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-2 w-full mb-4" />
        <Skeleton className="h-4 w-32" />
      </CardContent>
    </Card>
  );
}

export function CampaignListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MessageItemSkeleton() {
  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function MessageListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MessageItemSkeleton key={i} />
      ))}
    </div>
  );
}

