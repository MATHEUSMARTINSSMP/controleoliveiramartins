import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

export function ReviewsAnalytics() {
    // Simulação de evolução de reviews
    const volumeData = [
        { month: "Jan", reviews: 12, rating: 4.5 },
        { month: "Fev", reviews: 15, rating: 4.6 },
        { month: "Mar", reviews: 18, rating: 4.4 },
        { month: "Abr", reviews: 22, rating: 4.7 },
        { month: "Mai", reviews: 25, rating: 4.8 },
        { month: "Jun", reviews: 30, rating: 4.9 },
    ];

    // Simulação de taxa de resposta
    const responseRateData = [
        { month: "Jan", rate: 80 },
        { month: "Fev", rate: 85 },
        { month: "Mar", rate: 90 },
        { month: "Abr", rate: 95 },
        { month: "Mai", rate: 98 },
        { month: "Jun", rate: 100 },
    ];

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Volume e Rating */}
                <Card>
                    <CardHeader>
                        <CardTitle>Volume e Qualidade</CardTitle>
                        <CardDescription>Quantidade de reviews e nota média mensal</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={volumeData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis yAxisId="left" />
                                    <YAxis yAxisId="right" orientation="right" domain={[0, 5]} />
                                    <Tooltip />
                                    <Bar dataKey="reviews" name="Qtd. Reviews" fill="#e2e8f0" yAxisId="left" barSize={20} />
                                    <Line
                                        type="monotone"
                                        dataKey="rating"
                                        name="Nota Média"
                                        stroke="#eab308"
                                        strokeWidth={2}
                                        yAxisId="right"
                                        dot={{ r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Taxa de Resposta */}
                <Card>
                    <CardHeader>
                        <CardTitle>Taxa de Resposta</CardTitle>
                        <CardDescription>Percentual de reviews respondidos no prazo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={responseRateData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Area
                                        type="monotone"
                                        dataKey="rate"
                                        name="Taxa de Resposta (%)"
                                        stroke="#10b981"
                                        fill="#d1fae5"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
