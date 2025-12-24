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
        <Card className="border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-background to-muted/30">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    Colaboradoras Disponíveis
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pt-4">
                {loading && colaboradoras.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : colaboradoras.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground">
                            Nenhuma colaboradora cadastrada
                        </p>
                    </div>
                ) : (
                    colaboradoras.map((colab) => (
                        <div
                            key={colab.id}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                                colab.enabled 
                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 shadow-sm' 
                                    : 'bg-muted/30 border-border hover:bg-muted/50'
                            }`}
                        >
                            <span className={`text-sm font-medium ${colab.enabled ? 'text-emerald-900 dark:text-emerald-100' : 'text-muted-foreground'}`}>
                                {colab.name}
                            </span>
                            <Switch
                                checked={colab.enabled}
                                onCheckedChange={(checked) => onToggle(colab.id, checked)}
                                disabled={loading}
                                className="data-[state=checked]:bg-emerald-600"
                            />
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

