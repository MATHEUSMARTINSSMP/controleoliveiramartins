import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export function PostsAnalytics() {
    // Simulação de volume de postagens
    const postsVolumeData = [
        { month: "Jan", posts: 4 },
        { month: "Fev", posts: 5 },
        { month: "Mar", posts: 3 },
        { month: "Abr", posts: 6 },
        { month: "Mai", posts: 8 },
        { month: "Jun", posts: 6 },
    ];

    // Simulação de engajamento por tipo
    const engagementData = [
        { type: "Oferta", views: 450, clicks: 45 },
        { type: "Evento", views: 320, clicks: 28 },
        { type: "Novidade", views: 280, clicks: 15 },
        { type: "Produto", views: 520, clicks: 60 },
    ];

    // Simulação de CTA
    const ctaData = [
        { name: "Saiba mais", value: 45, color: "#3b82f6" },
        { name: "Ligar agora", value: 30, color: "#10b981" },
        { name: "Comprar", value: 15, color: "#f59e0b" },
        { name: "Reservar", value: 10, color: "#ef4444" },
    ];

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Volume de Postagens */}
                <Card>
                    <CardHeader>
                        <CardTitle>Volume de Postagens</CardTitle>
                        <CardDescription>Postagens publicadas por mês</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={postsVolumeData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="posts" name="Postagens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Engajamento por Tipo */}
                <Card>
                    <CardHeader>
                        <CardTitle>Engajamento por Tipo</CardTitle>
                        <CardDescription>Visualizações vs Cliques</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={engagementData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="type" type="category" width={70} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="views" name="Visualizações" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="clicks" name="Cliques" fill="#2563eb" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Performance de CTA */}
                <Card>
                    <CardHeader>
                        <CardTitle>Performance de CTA</CardTitle>
                        <CardDescription>Botões mais clicados</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={ctaData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {ctaData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
