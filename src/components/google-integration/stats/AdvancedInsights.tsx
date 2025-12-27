import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Smartphone, Monitor, Map, Search } from "lucide-react";
import { GooglePerformanceMetrics } from "@/hooks/use-google-performance";

interface AdvancedInsightsProps {
    metrics?: GooglePerformanceMetrics | null;
}

export function AdvancedInsights({ metrics }: AdvancedInsightsProps) {
    // Usar dados reais de performance se disponíveis
    const interactionData = metrics ? [
        { name: "Visualizações", current: metrics.views.total, previous: 0 },
        { name: "Cliques no Site", current: metrics.clicks.total, previous: 0 },
        { name: "Chamadas", current: metrics.calls.total, previous: 0 },
        { name: "Rotas", current: metrics.directions.total, previous: 0 },
    ] : [
        { name: "Visualizações", current: 0, previous: 0 },
        { name: "Cliques no Site", current: 0, previous: 0 },
        { name: "Chamadas", current: 0, previous: 0 },
        { name: "Rotas", current: 0, previous: 0 },
    ];

    // Dados por dispositivo/plataforma não estão disponíveis na API atual
    // Mostrar mensagem informativa
    const deviceData = [
        { name: "Dados não disponíveis", value: 100, color: "#94a3b8" },
    ];

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Interações Comparativas */}
                <Card>
                    <CardHeader>
                        <CardTitle>Interações: Atual vs Anterior</CardTitle>
                        <CardDescription>Comparativo de ações dos clientes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={interactionData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="current" name="Período Atual" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="previous" name="Período Anterior" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Origem do Tráfego */}
                <Card>
                    <CardHeader>
                        <CardTitle>Origem do Tráfego</CardTitle>
                        <CardDescription>Onde os clientes encontram sua empresa</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={deviceData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {deviceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {!metrics && (
                            <p className="text-sm text-muted-foreground text-center mt-4">
                                Dados de origem do tráfego não estão disponíveis na API atual
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
