import { SiteOnboarding, SiteEditor, useSiteData } from "@/components/admin/site-builder";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminSiteManager() {
  const { hasSite, isLoading } = useSiteData();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return hasSite ? <SiteEditor /> : <SiteOnboarding />;
}
