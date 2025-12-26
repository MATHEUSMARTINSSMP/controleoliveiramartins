import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Loader2, ExternalLink, Star } from "lucide-react";
import type { GoogleReview } from "@/hooks/use-google-reviews";
import { useGoogleReviews } from "@/hooks/use-google-reviews";
import { toast } from "sonner";
import { useGoogleAI } from "@/hooks/use-google-ai";

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

const PROHIBITED_WORDS = ["palavrão", "ofensa", "spam", "idiota", "estúpido"];

export function ReviewReplyDialog({ review, siteSlug }: ReviewReplyDialogProps) {
  const [replyText, setReplyText] = useState(review.reply || "");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [replying, setReplying] = useState(false);
  const [aiTone, setAiTone] = useState<"formal" | "friendly" | "funny">("friendly");
  const { respondToReview } = useGoogleReviews();
  const { generateReply, generating: aiGenerating } = useGoogleAI();

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
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

    // Validação de palavras proibidas
    const foundProhibited = PROHIBITED_WORDS.find(word => replyText.toLowerCase().includes(word));
    if (foundProhibited) {
      toast.error(`Sua resposta contém palavras não permitidas: ${foundProhibited}`);
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
    // Reset apenas se não estiver editando (ou manter estado se quiser persistir rascunho)
    if (!review.reply) {
      setReplyText("");
      setSelectedTemplate("");
    }
    setShowPreview(false);
  };

  const generateAiSuggestion = () => {
    // Simulação de IA baseada na nota
    let templateId = "";
    if (review.rating === 5) templateId = "thank_you_5";
    else if (review.rating === 4) templateId = "thank_you_4";
    else if (review.rating === 3) templateId = "apology_3";
    else templateId = "apology_1_2";

    const template = replyTemplates.find(t => t.id === templateId);
    if (template) {
      setReplyText(template.text);
      setSelectedTemplate(templateId);
      toast.success("Sugestão gerada com sucesso!");
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && handleClose()}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setReplyText(review.reply || "");
            setSelectedTemplate("");
            setShowPreview(false);
          }}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          {review.reply ? "Editar Resposta" : "Responder"}
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
              <div className="flex flex-col gap-2 mt-2 p-3 bg-purple-50 rounded-md border border-purple-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-purple-700">Assistente de IA</span>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value as any)}
                    className="px-2 py-1 text-xs border rounded-md bg-white"
                  >
                    <option value="formal">Formal</option>
                    <option value="friendly">Amigável</option>
                    <option value="funny">Descontraído</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-purple-600 border-purple-200 hover:bg-purple-100 justify-start"
                    onClick={async () => {
                      const text = await generateReply(review.comment || "", review.rating, aiTone);
                      setReplyText(text);
                    }}
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : "✨ Gerar Resposta"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-purple-600 border-purple-200 hover:bg-purple-100 justify-start"
                    onClick={async () => {
                      const text = await generateReply(review.comment || "", review.rating, aiTone);
                      setReplyText(`Olá ${review.author_name || "Cliente"}, \n\n${text}`);
                    }}
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : "👤 Personalizada"}
                  </Button>
                </div>
              </div>
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
                review.reply ? "Atualizar Resposta" : "Enviar Resposta"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


