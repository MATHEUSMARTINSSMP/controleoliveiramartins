import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { ReviewCard } from "./ReviewCard";
import { ReviewsPagination } from "./ReviewsPagination";
import type { GoogleReview } from "@/hooks/use-google-reviews";

interface ReviewsListProps {
  reviews: GoogleReview[];
  paginatedReviews: GoogleReview[];
  currentPage: number;
  totalPages: number;
  reviewsPerPage: number;
  loading: boolean;
  siteSlug: string;
  onPageChange: (page: number) => void;
  onMarkAsRead: (siteSlug: string, reviewId: string) => Promise<boolean | void>;
  hasFilters: boolean;
  onClearFilters: () => void;
}

export function ReviewsList({
  reviews,
  paginatedReviews,
  currentPage,
  totalPages,
  loading,
  siteSlug,
  onPageChange,
  onMarkAsRead,
  hasFilters,
  onClearFilters,
}: ReviewsListProps) {
  if (loading && reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paginatedReviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10 border-dashed">
        <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">
          {reviews.length === 0 ? "Nenhum review encontrado" : "Nenhum review encontrado"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
          {reviews.length === 0
            ? "Ainda não há avaliações para este local. Incentive seus clientes a deixarem feedback!"
            : "Tente ajustar seus filtros para encontrar o que procura."}
        </p>
        {hasFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {paginatedReviews.map((review) => (
          <ReviewCard
            key={review.review_id_external}
            review={review}
            siteSlug={siteSlug}
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </div>
      <ReviewsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </>
  );
}


