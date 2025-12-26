import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { GoogleReview } from "@/hooks/use-google-reviews";
import { ReviewReplyDialog } from "./ReviewReplyDialog";

interface ReviewCardProps {
  review: GoogleReview;
  siteSlug: string;
  onMarkAsRead: (siteSlug: string, reviewId: string) => Promise<void>;
}

const MAX_PREVIEW_LENGTH = 200; // Caracteres para preview

export function ReviewCard({ review, siteSlug, onMarkAsRead }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`}
      />
    ));
  };

  const shouldShowExpandButton = review.comment && review.comment.length > MAX_PREVIEW_LENGTH;
  const displayComment = shouldShowExpandButton && !isExpanded
    ? `${review.comment.substring(0, MAX_PREVIEW_LENGTH)}...`
    : review.comment;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {renderStars(review.rating)}
                <span className="text-sm font-medium">
                  {review.author_name || "Anônimo"}
                </span>
                {review.review_date && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(review.review_date), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                )}
                {!review.is_read && (
                  <Badge variant="outline" className="text-xs">
                    Nova
                  </Badge>
                )}
                {review.reply && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                    Respondida
                  </Badge>
                )}
              </div>
              {displayComment && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {displayComment}
                  </p>
                  {shouldShowExpandButton && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    >
                      {isExpanded ? (
                        <>
                          Ver menos
                          <ChevronUp className="h-3 w-3 ml-1" />
                        </>
                      ) : (
                        <>
                          Ver mais
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
              {review.location_id && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(review.location_id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                >
                  <MapPin className="h-3 w-3" />
                  Ver no Google Maps
                </a>
              )}
              {review.reply && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium">Sua resposta:</p>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      Nova resposta
                    </Badge>
                  </div>
                  <p className="text-sm">{review.reply}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!review.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await onMarkAsRead(siteSlug, review.review_id_external);
                }}
              >
                Marcar como lida
              </Button>
            )}
            {!review.reply && (
              <ReviewReplyDialog review={review} siteSlug={siteSlug} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
