import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useGoogleLocations } from "@/hooks/use-google-locations";

interface CategoryAnalyticsProps {
    siteSlug: string;
}

export function CategoryAnalytics({ siteSlug }: CategoryAnalyticsProps) {
    const { locations, fetchLocations } = useGoogleLocations();
    
    useEffect(() => {
        fetchLocations(siteSlug);
    }, [siteSlug]);
    
    // Buscar categorias reais das locations
    const categoryData = locations
        .filter(loc => loc.location_category)
        .map((loc, index) => ({
            name: loc.location_category || 'Sem categoria',
            value: 100,
            color: ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"][index % 4],
        }));

    // Comparativo com concorrentes não está disponível na API
    const competitorData: Array<{ category: string; you: number; competitor: number }> = [];

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
                        {categoryData.length === 0 ? (
                            <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                                <p className="text-sm">Nenhuma categoria encontrada</p>
                            </div>
                        ) : (
                            <div className="h-[300px] w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            dataKey="value"
                                            label={({ name }) => name}
                                        >
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Comparativo com Concorrentes - Não disponível */}
                {competitorData.length === 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Comparativo de Mercado</CardTitle>
                            <CardDescription>Relevância por categoria vs Concorrentes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                                <p className="text-sm">Dados comparativos com concorrentes não estão disponíveis na API</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
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
                )}
            </div>
        </div>
    );
}
