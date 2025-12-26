import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Smartphone, Monitor, Map, Search } from "lucide-react";

export function AdvancedInsights() {
    // Simulação de dados comparativos (Período Atual vs Anterior)
    const interactionData = [
        { name: "Chamadas", current: 120, previous: 95 },
        { name: "Rotas", current: 250, previous: 210 },
        { name: "Website", current: 180, previous: 150 },
        { name: "Mensagens", current: 45, previous: 30 },
    ];

    // Simulação de dados por dispositivo/plataforma
    const deviceData = [
        { name: "Mobile (Busca)", value: 450, color: "#3b82f6" },
        { name: "Desktop (Busca)", value: 150, color: "#93c5fd" },
        { name: "Google Maps (App)", value: 800, color: "#10b981" },
        { name: "Google Maps (Web)", value: 200, color: "#6ee7b7" },
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
                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4" /> Mobile
                            </div>
                            <div className="flex items-center gap-2">
                                <Monitor className="h-4 w-4" /> Desktop
                            </div>
                            <div className="flex items-center gap-2">
                                <Map className="h-4 w-4" /> Maps
                            </div>
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4" /> Search
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
