import { LoadingSpinner } from "@/components/ui/skeleton-loaders";

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="flex flex-col items-center gap-4">
        <img src="/elevea.png" alt="EleveaOne" className="h-12 w-auto animate-pulse" />
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );
}
