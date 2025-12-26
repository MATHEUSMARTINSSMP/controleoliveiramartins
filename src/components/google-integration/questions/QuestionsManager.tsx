import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, ThumbsUp, User, Calendar, Search, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Question {
    id: string;
    authorName: string;
    authorPhoto?: string;
    text: string;
    createTime: string;
    upvoteCount: number;
    answer?: {
        text: string;
        createTime: string;
        authorType: "OWNER" | "USER";
    };
}

export function QuestionsManager() {
    // Simulação de perguntas
    const [questions, setQuestions] = useState<Question[]>([
        {
            id: "1",
            authorName: "Maria Silva",
            text: "Vocês têm opções vegetarianas no cardápio?",
            createTime: new Date(Date.now() - 86400000 * 2).toISOString(),
            upvoteCount: 3,
            answer: {
                text: "Sim, Maria! Temos várias opções de massas e saladas vegetarianas.",
                createTime: new Date(Date.now() - 86400000).toISOString(),
                authorType: "OWNER"
            }
        },
        {
            id: "2",
            authorName: "João Souza",
            text: "Aceitam reservas para grupos grandes?",
            createTime: new Date(Date.now() - 86400000 * 5).toISOString(),
            upvoteCount: 1,
        },
        {
            id: "3",
            authorName: "Ana Costa",
            text: "Qual o horário de funcionamento aos domingos?",
            createTime: new Date(Date.now() - 86400000 * 10).toISOString(),
            upvoteCount: 5,
            answer: {
                text: "Olá Ana! Aos domingos abrimos das 12h às 22h.",
                createTime: new Date(Date.now() - 86400000 * 9).toISOString(),
                authorType: "OWNER"
            }
        }
    ]);

    const [replyText, setReplyText] = useState("");
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
    const [newQuestionText, setNewQuestionText] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const handleReply = (questionId: string) => {
        if (!replyText.trim()) return;

        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                return {
                    ...q,
                    answer: {
                        text: replyText,
                        createTime: new Date().toISOString(),
                        authorType: "OWNER"
                    }
                };
            }
            return q;
        }));

        setReplyText("");
        setSelectedQuestion(null);
        toast.success("Resposta enviada com sucesso!");
    };

    const handleCreateQuestion = () => {
        if (!newQuestionText.trim()) return;

        const newQuestion: Question = {
            id: Date.now().toString(),
            authorName: "Proprietário",
            text: newQuestionText,
            createTime: new Date().toISOString(),
            upvoteCount: 0,
        };

        setQuestions([newQuestion, ...questions]);
        setNewQuestionText("");
        setIsCreateOpen(false);
        toast.success("Pergunta frequente adicionada!");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar perguntas..." className="pl-8" />
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Pergunta (FAQ)
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Pergunta Frequente</DialogTitle>
                            <DialogDescription>
                                Crie perguntas e respostas para ajudar seus clientes.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Pergunta</label>
                                <Textarea
                                    value={newQuestionText}
                                    onChange={(e) => setNewQuestionText(e.target.value)}
                                    placeholder="Ex: Vocês fazem entregas?"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreateQuestion}>Adicionar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {questions.map((question) => (
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
                                    </div>

                                    {question.answer && (
                                        <div className="mt-4 bg-muted/50 p-3 rounded-md border-l-2 border-primary">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs font-medium text-primary">Resposta do proprietário</p>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(question.answer.createTime), { addSuffix: true, locale: ptBR })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{question.answer.text}</p>
                                        </div>
                                    )}

                                    {!question.answer && (
                                        <div className="mt-4">
                                            {selectedQuestion === question.id ? (
                                                <div className="space-y-2">
                                                    <Textarea
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        placeholder="Escreva sua resposta..."
                                                        className="min-h-[100px]"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedQuestion(null)}>Cancelar</Button>
                                                        <Button size="sm" onClick={() => handleReply(question.id)}>Enviar Resposta</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={() => setSelectedQuestion(question.id)}>
                                                    <MessageCircle className="h-4 w-4 mr-2" />
                                                    Responder
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
