import { useEffect, useState, useMemo } from "react";
import { useGoogleLocations, GoogleLocation } from "@/hooks/use-google-locations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, AlertTriangle, Download, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface ProfileHealthProps {
    siteSlug: string;
}

interface HealthItem {
    id: string;
    label: string;
    status: "success" | "warning" | "error";
    message: string;
    weight: number;
}

export function ProfileHealth({ siteSlug }: ProfileHealthProps) {
    const { locations, fetchLocations, loading } = useGoogleLocations();
    const [primaryLocation, setPrimaryLocation] = useState<GoogleLocation | null>(null);

    useEffect(() => {
        fetchLocations(siteSlug);
    }, [siteSlug]);

    useEffect(() => {
        if (locations.length > 0) {
            const primary = locations.find((l) => l.is_primary) || locations[0];
            setPrimaryLocation(primary);
        }
    }, [locations]);

    const healthAnalysis = useMemo(() => {
        if (!primaryLocation) return null;

        const items: HealthItem[] = [
            {
                id: "name",
                label: "Nome do Negócio",
                status: primaryLocation.location_name ? "success" : "error",
                message: primaryLocation.location_name ? "Nome configurado corretamente" : "Nome do negócio ausente",
                weight: 20,
            },
            {
                id: "address",
                label: "Endereço",
                status: primaryLocation.location_address ? "success" : "error",
                message: primaryLocation.location_address ? "Endereço configurado" : "Adicione um endereço físico",
                weight: 20,
            },
            {
                id: "phone",
                label: "Telefone",
                status: primaryLocation.location_phone ? "success" : "warning",
                message: primaryLocation.location_phone ? "Telefone configurado" : "Adicione um telefone para contato",
                weight: 15,
            },
            {
                id: "website",
                label: "Website",
                status: primaryLocation.location_website ? "success" : "warning",
                message: primaryLocation.location_website ? "Website configurado" : "Adicione um link para seu site",
                weight: 15,
            },
            {
                id: "category",
                label: "Categoria",
                status: primaryLocation.location_category ? "success" : "error",
                message: primaryLocation.location_category ? "Categoria definida" : "Defina a categoria do seu negócio",
                weight: 30,
            },
        ];

        const totalWeight = items.reduce((acc, item) => acc + item.weight, 0);
        const currentScore = items.reduce((acc, item) => {
            if (item.status === "success") return acc + item.weight;
            if (item.status === "warning") return acc + (item.weight / 2);
            return acc;
        }, 0);

        const score = Math.round((currentScore / totalWeight) * 100);

        return {
            score,
            items,
        };
    }, [primaryLocation]);

    // Simulação de histórico de saúde
    const historyData = [
        { month: "Jan", score: 65 },
        { month: "Fev", score: 68 },
        { month: "Mar", score: 75 },
        { month: "Abr", score: 82 },
        { month: "Mai", score: 85 },
        { month: "Jun", score: healthAnalysis?.score || 90 },
    ];

    const handleExportPDF = () => {
        toast.success("Relatório de saúde exportado com sucesso! (Simulação)");
    };

    if (loading) {
        return <div className="h-64 bg-muted/20 animate-pulse rounded-lg" />;
    }

    if (!primaryLocation || !healthAnalysis) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground">Nenhum local encontrado para análise.</p>
                </CardContent>
            </Card>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return "text-green-600";
        if (score >= 70) return "text-yellow-600";
        return "text-red-600";
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
                {/* Score Card */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Saúde do Perfil</CardTitle>
                        <CardDescription>Baseado nas informações do local principal</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-6">
                        <div className="relative flex items-center justify-center w-40 h-40 rounded-full border-8 border-muted">
                            <span className={`text-4xl font-bold ${getScoreColor(healthAnalysis.score)}`}>
                                {healthAnalysis.score}%
                            </span>
                            <div
                                className="absolute inset-0 rounded-full border-8 border-transparent border-t-primary transform -rotate-45"
                                style={{
                                    borderColor: `transparent ${getScoreColor(healthAnalysis.score).replace('text-', 'border-')} transparent transparent`,
                                    transform: `rotate(${healthAnalysis.score * 3.6 - 45}deg)`
                                }}
                            />
                        </div>
                        <p className="mt-4 text-center font-medium text-muted-foreground">
                            {healthAnalysis.score >= 90 ? "Excelente!" : healthAnalysis.score >= 70 ? "Bom, mas pode melhorar." : "Precisa de atenção."}
                        </p>
                    </CardContent>
                </Card>

                {/* Checklist Card */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Checklist de Otimização</CardTitle>
                            <CardDescription>Itens analisados para o cálculo da pontuação</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExportPDF}>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar Relatório
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {healthAnalysis.items.map((item) => (
                                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                    <div className="mt-0.5">
                                        {item.status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                        {item.status === "warning" && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                                        {item.status === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium">{item.label}</h4>
                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                Peso: {item.weight}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* History Chart */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <CardTitle>Evolução da Saúde do Perfil</CardTitle>
                    </div>
                    <CardDescription>Acompanhe a melhoria da pontuação ao longo do tempo</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#2563eb"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
