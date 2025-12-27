import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, ThumbsUp, User, Calendar, Search, Plus, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useGoogleQuestions, GoogleQuestion } from "@/hooks/use-google-questions";
import { useGoogleLocations } from "@/hooks/use-google-locations";

interface QuestionsManagerProps {
    siteSlug: string;
}

export function QuestionsManager({ siteSlug }: QuestionsManagerProps) {
    const { questions, loading, fetchQuestions } = useGoogleQuestions();
    const { locations } = useGoogleLocations();
    const [replyText, setReplyText] = useState("");
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (siteSlug && locations.length > 0) {
            const primaryLocation = locations.find(l => l.is_primary) || locations[0];
            if (primaryLocation?.location_id) {
                fetchQuestions(siteSlug, primaryLocation.location_id);
            }
        }
    }, [siteSlug, locations]);

    const handleReply = (questionId: string) => {
        toast.error("Funcionalidade de resposta ainda não implementada");
    };

    const filteredQuestions = questions.filter(q => 
        q.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.authorName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && questions.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <p className="text-muted-foreground">Carregando perguntas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar perguntas..." 
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Nenhuma pergunta encontrada</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                        Não há perguntas cadastradas no Google My Business para esta location.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredQuestions.map((question) => (
                    <Card key={question.id}>
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                                <Avatar>
                                    <AvatarImage src={question.authorPhoto} />
                                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-sm">{question.authorName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(question.createTime), { addSuffix: true, locale: ptBR })}
                                            </p>
                                        </div>
                                        {question.answer ? (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800">Respondida</Badge>
                                        ) : (
                                            <Badge variant="outline">Aguardando resposta</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm">{question.text}</p>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                                        <span className="flex items-center gap-1">
                                            <ThumbsUp className="h-3 w-3" /> {question.upvoteCount} votos úteis
                                        </span>
                                        {question.answerCount > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                {question.answerCount} resposta{question.answerCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>

                                    {question.topAnswer && (
                                        <div className="mt-4 bg-muted/50 p-3 rounded-md border-l-2 border-primary">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs font-medium text-primary">
                                                    {question.topAnswer.authorType === 'OWNER' ? 'Resposta do proprietário' : 'Resposta'}
                                                </p>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(question.topAnswer.createTime), { addSuffix: true, locale: ptBR })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{question.topAnswer.text}</p>
                                        </div>
                                    )}

                                    {!question.topAnswer && (
                                        <div className="mt-4">
                                            <Button variant="outline" size="sm" onClick={() => handleReply(question.id)}>
                                                <MessageCircle className="h-4 w-4 mr-2" />
                                                Responder
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
