import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Colaboradora {
    id: string;
    name: string;
    enabled: boolean;
    memberId?: string;
}

interface ColaboradorasDisponiveisProps {
    colaboradoras: Colaboradora[];
    loading: boolean;
    onToggle: (colaboradoraId: string, enabled: boolean) => void;
}

export function ColaboradorasDisponiveis({
    colaboradoras,
    loading,
    onToggle
}: ColaboradorasDisponiveisProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Colaboradoras Disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {loading && colaboradoras.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : colaboradoras.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma colaboradora cadastrada
                    </p>
                ) : (
                    colaboradoras.map((colab) => (
                        <div
                            key={colab.id}
                            className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <span className="text-sm font-medium">{colab.name}</span>
                            <Switch
                                checked={colab.enabled}
                                onCheckedChange={(checked) => onToggle(colab.id, checked)}
                                disabled={loading}
                            />
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

