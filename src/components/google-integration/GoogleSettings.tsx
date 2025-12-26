import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface GoogleSettingsProps {
    siteSlug: string;
}

export function GoogleSettings({ siteSlug }: GoogleSettingsProps) {
    const [notifications, setNotifications] = useState({
        newReview: true,
        negativeReview: true,
        emailAlerts: false,
    });

    const [syncFrequency, setSyncFrequency] = useState("24h");

    const [templates, setTemplates] = useState([
        { id: 1, name: "Agradecimento Padrão", content: "Obrigado pela sua avaliação! Ficamos felizes em saber que gostou." },
        { id: 2, name: "Pedido de Desculpas", content: "Lamentamos o ocorrido. Por favor, entre em contato conosco para resolvermos." },
    ]);

    const [newTemplate, setNewTemplate] = useState({ name: "", content: "" });

    const handleSaveNotifications = () => {
        // Simulação de salvamento
        toast.success("Preferências de notificação salvas!");
    };

    const handleAddTemplate = () => {
        if (!newTemplate.name || !newTemplate.content) {
            toast.error("Preencha nome e conteúdo do template");
            return;
        }
        setTemplates([...templates, { id: Date.now(), ...newTemplate }]);
        setNewTemplate({ name: "", content: "" });
        toast.success("Template adicionado!");
    };

    const handleDeleteTemplate = (id: number) => {
        setTemplates(templates.filter(t => t.id !== id));
        toast.success("Template removido!");
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Preferências de Notificação</CardTitle>
                    <CardDescription>Gerencie como você deseja ser notificado sobre novos reviews.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="new-review">Notificar novos reviews</Label>
                        <Switch
                            id="new-review"
                            checked={notifications.newReview}
                            onCheckedChange={(c) => setNotifications({ ...notifications, newReview: c })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="negative-review">Alerta de reviews negativos (1-2 estrelas)</Label>
                        <Switch
                            id="negative-review"
                            checked={notifications.negativeReview}
                            onCheckedChange={(c) => setNotifications({ ...notifications, negativeReview: c })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="email-alerts">Receber alertas por e-mail</Label>
                        <Switch
                            id="email-alerts"
                            checked={notifications.emailAlerts}
                            onCheckedChange={(c) => setNotifications({ ...notifications, emailAlerts: c })}
                        />
                    </div>
                    <Button onClick={handleSaveNotifications}>Salvar Preferências</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sincronização</CardTitle>
                    <CardDescription>Configure a frequência de atualização dos dados.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Frequência de Sincronização Automática</Label>
                        <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="6h">A cada 6 horas</SelectItem>
                                <SelectItem value="12h">A cada 12 horas</SelectItem>
                                <SelectItem value="24h">A cada 24 horas</SelectItem>
                                <SelectItem value="weekly">Semanalmente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={() => toast.success("Frequência atualizada!")}>Salvar Configuração</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Templates de Resposta</CardTitle>
                    <CardDescription>Crie templates para responder reviews mais rapidamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                        <h4 className="font-medium text-sm">Novo Template</h4>
                        <div className="space-y-2">
                            <Label>Nome do Template</Label>
                            <Input
                                value={newTemplate.name}
                                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                placeholder="Ex: Agradecimento Especial"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Conteúdo</Label>
                            <Textarea
                                value={newTemplate.content}
                                onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                placeholder="Escreva o texto padrão..."
                                rows={3}
                            />
                        </div>
                        <Button size="sm" onClick={handleAddTemplate}>
                            <Plus className="h-4 w-4 mr-2" /> Adicionar Template
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-medium text-sm">Templates Existentes</h4>
                        {templates.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum template cadastrado.</p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {templates.map(template => (
                                    <div key={template.id} className="border rounded-md p-3 relative group">
                                        <h5 className="font-medium text-sm mb-1">{template.name}</h5>
                                        <p className="text-xs text-muted-foreground line-clamp-3">{template.content}</p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDeleteTemplate(template.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
