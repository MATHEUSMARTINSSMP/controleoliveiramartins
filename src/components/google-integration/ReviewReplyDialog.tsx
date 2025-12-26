import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Loader2, ExternalLink, Star } from "lucide-react";
import type { GoogleReview } from "@/hooks/use-google-reviews";
import { useGoogleReviews } from "@/hooks/use-google-reviews";
import { toast } from "sonner";

interface ReviewReplyDialogProps {
  review: GoogleReview;
  siteSlug: string;
}

const replyTemplates = [
  { id: "thank_you_5", label: "Agradecimento (5 estrelas)", text: "Obrigado pelo seu feedback positivo! Ficamos muito felizes em saber que você teve uma experiência excelente. Esperamos vê-lo novamente em breve!" },
  { id: "thank_you_4", label: "Agradecimento (4 estrelas)", text: "Obrigado pela sua avaliação! Ficamos contentes em saber que você gostou. Estamos sempre trabalhando para melhorar e adoraríamos ouvir suas sugestões." },
  { id: "apology_3", label: "Desculpas (3 estrelas)", text: "Lamentamos que sua experiência não tenha sido a melhor possível. Gostaríamos muito de conversar com você para entender melhor e melhorar nossos serviços. Entre em contato conosco!" },
  { id: "apology_1_2", label: "Desculpas + Contato (1-2 estrelas)", text: "Lamentamos profundamente que sua experiência não tenha sido positiva. Sua opinião é muito importante para nós. Por favor, entre em contato conosco para que possamos resolver esta situação." },
  { id: "custom", label: "Personalizado", text: "" },
];

export function ReviewReplyDialog({ review, siteSlug }: ReviewReplyDialogProps) {
  const [replyText, setReplyText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [replying, setReplying] = useState(false);
  const { respondToReview } = useGoogleReviews();

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

  const handleReply = async () => {
    if (!replyText.trim()) return;
    
    if (replyText.length > 4096) {
      toast.error("Resposta muito longa. Máximo 4096 caracteres.");
      return;
    }
    if (replyText.length < 10) {
      toast.error("Resposta muito curta. Mínimo 10 caracteres.");
      return;
    }

    setReplying(true);
    try {
      const success = await respondToReview(
        siteSlug,
        review.review_id_external,
        replyText,
        review.account_id,
        review.location_id
      );

      if (success) {
        setReplyText("");
        setSelectedTemplate("");
        setShowPreview(false);
      }
    } finally {
      setReplying(false);
    }
  };

  const handleClose = () => {
    setReplyText("");
    setSelectedTemplate("");
    setShowPreview(false);
  };

  return (
    <Dialog onOpenChange={(open) => !open && handleClose()}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setReplyText("");
            setSelectedTemplate("");
            setShowPreview(false);
          }}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Responder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Responder Review</DialogTitle>
          <DialogDescription>
            Escreva uma resposta profissional para este review. Sua resposta será pública.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Review</Label>
            <div className="mt-1 p-3 bg-muted rounded-md">
              <div className="flex items-center gap-2 mb-2">
                {renderStars(review.rating)}
                <span className="text-sm font-medium">
                  {review.author_name || "Anônimo"}
                </span>
              </div>
              {review.comment && (
                <p className="text-sm">{review.comment}</p>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="reply">Sua Resposta</Label>
              <span className={`text-xs ${replyText.length > 4096 ? 'text-red-500' : replyText.length > 3500 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {replyText.length} / 4096 caracteres
              </span>
            </div>
            <div className="mb-2">
              <Label htmlFor="template" className="text-xs text-muted-foreground">Templates rápidos:</Label>
              <select
                id="template"
                value={selectedTemplate}
                onChange={(e) => {
                  const template = replyTemplates.find(t => t.id === e.target.value);
                  if (template && template.id !== "custom") {
                    setReplyText(template.text);
                  }
                  setSelectedTemplate(e.target.value);
                }}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-md"
              >
                <option value="">Selecione um template...</option>
                {replyTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <Textarea
              id="reply"
              value={replyText}
              onChange={(e) => {
                const text = e.target.value;
                if (text.length <= 4096) {
                  setReplyText(text);
                }
              }}
              placeholder="Obrigado pelo seu feedback..."
              rows={4}
              className="mt-1"
              maxLength={4096}
            />
            {replyText.length < 10 && replyText.length > 0 && (
              <p className="text-xs text-yellow-600 mt-1">Resposta muito curta. Recomendamos pelo menos 10 caracteres.</p>
            )}
            {replyText.length > 4096 && (
              <p className="text-xs text-red-600 mt-1">Resposta muito longa. Máximo 4096 caracteres.</p>
            )}
          </div>
          {showPreview && replyText.trim() && (
            <div className="mt-4 p-4 bg-muted rounded-md border">
              <p className="text-sm font-medium mb-2">Preview da Resposta:</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(review.rating)}
                  <span className="text-sm font-medium">
                    {review.author_name || "Anônimo"}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{replyText}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {replyText.trim() && replyText.length >= 10 && replyText.length <= 4096 && (
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {showPreview ? "Ocultar Preview" : "Ver Preview"}
              </Button>
            )}
            <Button
              onClick={handleReply}
              disabled={!replyText.trim() || replying || replyText.length > 4096 || replyText.length < 10}
            >
              {replying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Resposta"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


