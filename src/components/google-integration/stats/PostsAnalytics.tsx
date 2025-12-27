import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { GooglePost } from "@/hooks/use-google-posts";
import { format, subMonths, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PostsAnalyticsProps {
    posts: GooglePost[];
}

export function PostsAnalytics({ posts }: PostsAnalyticsProps) {
    // Calcular volume de postagens por mês
    const postsVolumeData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = subMonths(new Date(), 5 - i);
            const monthStart = startOfMonth(date);
            const monthEnd = subMonths(startOfMonth(new Date(subMonths(date, -1))), 0);
            const monthKey = format(monthStart, 'MMM', { locale: ptBR });

            const monthPosts = posts.filter(p => {
                if (!p.createTime) return false;
                const postDate = parseISO(p.createTime);
                return postDate >= monthStart && postDate < monthEnd;
            });

            return {
                month: monthKey.charAt(0).toUpperCase() + monthKey.slice(1),
                posts: monthPosts.length,
            };
        });

        return last6Months;
    }, [posts]);

    // Engajamento por tipo não está disponível na API atual
    const engagementData: Array<{ type: string; views: number; clicks: number }> = [];

    // CTA data não está disponível na API atual
    const ctaData: Array<{ name: string; value: number; color: string }> = [];

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

                {/* Engajamento por Tipo - Não disponível */}
                {engagementData.length === 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Engajamento por Tipo</CardTitle>
                            <CardDescription>Visualizações vs Cliques</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground">
                                <p className="text-sm">Dados de engajamento não estão disponíveis na API atual</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
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
                )}

                {/* Performance de CTA - Não disponível */}
                {ctaData.length === 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Performance de CTA</CardTitle>
                            <CardDescription>Botões mais clicados</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground">
                                <p className="text-sm">Dados de CTA não estão disponíveis na API atual</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
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
                )}
            </div>
        </div>
    );
}
