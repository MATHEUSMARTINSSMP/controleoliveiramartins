import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

interface NotificationSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NotificationSettingsDialog({ open, onOpenChange }: NotificationSettingsDialogProps) {
    const [settings, setSettings] = useState({
        notifyNew: true,
        notifyNegative: true,
        email: "",
    });

    const handleSaveSettings = () => {
        // Simulação de salvamento
        toast.success("Configurações salvas com sucesso! (Simulação)");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Configurações de Notificação</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notify-new">Notificar novos reviews</Label>
                        <Switch
                            id="notify-new"
                            checked={settings.notifyNew}
                            onCheckedChange={(checked) => setSettings({ ...settings, notifyNew: checked })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notify-negative">Alertar reviews negativos (≤ 2 estrelas)</Label>
                        <Switch
                            id="notify-negative"
                            checked={settings.notifyNegative}
                            onCheckedChange={(checked) => setSettings({ ...settings, notifyNegative: checked })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email para alertas</Label>
                        <Input
                            id="email"
                            placeholder="seu@email.com"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSaveSettings}>Salvar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
