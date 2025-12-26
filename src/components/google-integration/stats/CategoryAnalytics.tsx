import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export function CategoryAnalytics() {
    // Simulação de distribuição de categorias
    const categoryData = [
        { name: "Restaurante", value: 100, color: "#2563eb" },
        { name: "Delivery", value: 60, color: "#3b82f6" },
        { name: "Bar", value: 30, color: "#60a5fa" },
    ];

    // Simulação de comparação com concorrentes
    const competitorData = [
        { category: "Restaurante", you: 85, competitor: 70 },
        { category: "Delivery", you: 65, competitor: 80 },
        { category: "Bar", you: 40, competitor: 50 },
        { category: "Café", you: 10, competitor: 30 },
    ];

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Categorias Principais */}
                <Card>
                    <CardHeader>
                        <CardTitle>Categorias do Perfil</CardTitle>
                        <CardDescription>Categorias que definem seu negócio</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Comparativo com Concorrentes */}
                <Card>
                    <CardHeader>
                        <CardTitle>Comparativo de Mercado</CardTitle>
                        <CardDescription>Relevância por categoria vs Concorrentes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={competitorData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="category" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="you" name="Você" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="competitor" name="Média do Mercado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
