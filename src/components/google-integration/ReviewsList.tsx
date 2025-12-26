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
  onMarkAsRead: (siteSlug: string, reviewId: string) => Promise<void>;
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
      <Card>
        <CardContent className="py-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {reviews.length === 0
              ? "Nenhum review encontrado"
              : "Nenhum review corresponde aos filtros selecionados"}
          </p>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={onClearFilters}
            >
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>
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


