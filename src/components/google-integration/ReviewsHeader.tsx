import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import { ReviewsExportPDF } from "./ReviewsExportPDF";
import type { GoogleReview } from "@/hooks/use-google-reviews";

interface ReviewsHeaderProps {
  reviewsCount: number;
  loading: boolean;
  reviews: GoogleReview[];
  onExport: () => void;
  onRefresh: () => void;
}

export function ReviewsHeader({
  reviewsCount,
  loading,
  reviews,
  onExport,
  onRefresh,
}: ReviewsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">Reviews do Google</h3>
        <p className="text-sm text-muted-foreground">
          Gerencie e responda às avaliações dos seus clientes
        </p>
      </div>
      <div className="flex items-center gap-2">
        {reviewsCount > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <ReviewsExportPDF reviews={reviews} disabled={loading} />
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

