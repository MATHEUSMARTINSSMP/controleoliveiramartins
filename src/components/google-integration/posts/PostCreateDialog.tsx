import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { GooglePost } from "@/hooks/use-google-posts";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postSchema, PostFormValues } from "@/schemas/google-integration";

interface PostCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (post: Partial<GooglePost>) => Promise<any>;
}

export function PostCreateDialog({ open, onOpenChange, onSubmit }: PostCreateDialogProps) {
    const [loading, setLoading] = useState(false);

    const { control, handleSubmit, reset, formState: { errors } } = useForm<PostFormValues>({
        resolver: zodResolver(postSchema),
        defaultValues: {
            topicType: "STANDARD",
            summary: "",
            callToAction: { actionType: "LEARN_MORE", url: "" },
        }
    });

    const onFormSubmit = async (data: PostFormValues) => {
        setLoading(true);
        try {
            await onSubmit(data as Partial<GooglePost>);
            onOpenChange(false);
            reset();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Criar Nova Postagem</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Tipo de Postagem</Label>
                        <Controller
                            name="topicType"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="STANDARD">Novidade (Padrão)</SelectItem>
                                        <SelectItem value="EVENT">Evento</SelectItem>
                                        <SelectItem value="OFFER">Oferta</SelectItem>
                                        <SelectItem value="ALERT">Alerta (COVID-19/Urgente)</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Conteúdo</Label>
                        <Controller
                            name="summary"
                            control={control}
                            render={({ field }) => (
                                <Textarea
                                    {...field}
                                    placeholder="Escreva sua postagem aqui..."
                                    rows={5}
                                />
                            )}
                        />
                        {errors.summary && <p className="text-xs text-red-500">{errors.summary.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Botão de Ação (Opcional)</Label>
                        <div className="flex gap-2">
                            <Controller
                                name="callToAction.actionType"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LEARN_MORE">Saiba mais</SelectItem>
                                            <SelectItem value="BOOK">Reservar</SelectItem>
                                            <SelectItem value="ORDER">Pedir online</SelectItem>
                                            <SelectItem value="SHOP">Comprar</SelectItem>
                                            <SelectItem value="SIGN_UP">Cadastre-se</SelectItem>
                                            <SelectItem value="CALL">Ligar agora</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            <Controller
                                name="callToAction.url"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        placeholder="URL de destino"
                                    />
                                )}
                            />
                        </div>
                        {errors.callToAction?.url && <p className="text-xs text-red-500">{errors.callToAction.url.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Mídia (Simulado)</Label>
                        <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50">
                            <ImageIcon className="h-8 w-8 mb-2" />
                            <span className="text-sm">Clique para adicionar foto/vídeo</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Agendamento (Opcional)</Label>
                            <Input type="datetime-local" />
                            <p className="text-[10px] text-muted-foreground">Deixe em branco para publicar agora.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Template</Label>
                            <Select onValueChange={(val) => {
                                if (val === "promo") {
                                    // Simulação de preenchimento
                                }
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Usar modelo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="promo">Promoção Relâmpago</SelectItem>
                                    <SelectItem value="event">Evento Especial</SelectItem>
                                    <SelectItem value="news">Novidade no Cardápio</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Agendar / Publicar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
