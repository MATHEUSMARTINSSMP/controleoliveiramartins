import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { GoogleReview } from "@/hooks/use-google-reviews";
import { format, subMonths, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReviewsAnalyticsProps {
    reviews: GoogleReview[];
}

export function ReviewsAnalytics({ reviews }: ReviewsAnalyticsProps) {
    // Calcular dados reais baseados em reviews
    const volumeData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = subMonths(new Date(), 5 - i);
            const monthStart = startOfMonth(date);
            const monthEnd = subMonths(startOfMonth(new Date(subMonths(date, -1))), 0);
            const monthKey = format(monthStart, 'MMM', { locale: ptBR });

            const monthReviews = reviews.filter(r => {
                if (!r.review_date) return false;
                const reviewDate = parseISO(r.review_date);
                return reviewDate >= monthStart && reviewDate < monthEnd;
            });

            const totalRating = monthReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
            const avgRating = monthReviews.length > 0 ? totalRating / monthReviews.length : 0;

            return {
                month: monthKey.charAt(0).toUpperCase() + monthKey.slice(1),
                reviews: monthReviews.length,
                rating: avgRating,
            };
        });

        return last6Months;
    }, [reviews]);

    // Calcular taxa de resposta baseada em reviews reais
    const responseRateData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const date = subMonths(new Date(), 5 - i);
            const monthStart = startOfMonth(date);
            const monthEnd = subMonths(startOfMonth(new Date(subMonths(date, -1))), 0);
            const monthKey = format(monthStart, 'MMM', { locale: ptBR });

            const monthReviews = reviews.filter(r => {
                if (!r.review_date) return false;
                const reviewDate = parseISO(r.review_date);
                return reviewDate >= monthStart && reviewDate < monthEnd;
            });

            const reviewsWithReply = monthReviews.filter(r => r.reply && r.reply.trim().length > 0);
            const rate = monthReviews.length > 0 ? Math.round((reviewsWithReply.length / monthReviews.length) * 100) : 0;

            return {
                month: monthKey.charAt(0).toUpperCase() + monthKey.slice(1),
                rate,
            };
        });

        return last6Months;
    }, [reviews]);

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
