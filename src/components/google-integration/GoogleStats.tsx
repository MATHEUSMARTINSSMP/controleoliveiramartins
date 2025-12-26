import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleReviews } from "@/hooks/use-google-reviews";
import { Loader2 } from "lucide-react";
import { StatsInsights } from "./stats/StatsInsights";
import { StatsSentiment } from "./stats/StatsSentiment";
import { StatsWordCloud } from "./stats/StatsWordCloud";
import { AdvancedInsights } from "./stats/AdvancedInsights";
import { ReviewsAnalytics } from "./stats/ReviewsAnalytics";
import { PostsAnalytics } from "./stats/PostsAnalytics";
import { CategoryAnalytics } from "./stats/CategoryAnalytics";
import { KeywordManager } from "./stats/KeywordManager";
import { PerformanceReport } from "./reports/PerformanceReport";
import { CategorySearch } from "./categories/CategorySearch";

interface GoogleStatsProps {
    siteSlug: string;
}

export function GoogleStats({ siteSlug }: GoogleStatsProps) {
    const { stats, fetchStats, loading, reviews, fetchReviews } = useGoogleReviews();
    const [period, setPeriod] = useState("30d");
    const [locationFilter, setLocationFilter] = useState("all");

    useEffect(() => {
        fetchStats(siteSlug, period);
        if (reviews.length === 0) {
            fetchReviews(siteSlug);
        }
    }, [siteSlug, period]);

    // Simulação de dados de Insights (já que não temos API de Performance real ainda)
    const insightsData = {
        views: { total: 1250, change: 15 },
        clicks: { total: 450, change: 8 },
        calls: { total: 85, change: -2 },
        directions: { total: 120, change: 5 },
    };

    // Análise de Sentimento (Simulada baseada em keywords)
    const sentimentData = [
        { name: "Positivo", value: reviews.filter(r => r.rating >= 4).length, color: "#22c55e" },
        { name: "Neutro", value: reviews.filter(r => r.rating === 3).length, color: "#eab308" },
        { name: "Negativo", value: reviews.filter(r => r.rating <= 2).length, color: "#ef4444" },
    ];

    // Nuvem de Palavras (Simulada - Top keywords)
    const topKeywords = [
        { text: "atendimento", value: 45 },
        { text: "qualidade", value: 38 },
        { text: "rápido", value: 30 },
        { text: "preço", value: 25 },
        { text: "ambiente", value: 20 },
        { text: "comida", value: 18 },
        { text: "limpeza", value: 15 },
        { text: "estacionamento", value: 12 },
    ];

    if (loading && !stats) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <div className="col-span-4 h-[300px] rounded-lg bg-muted/50 animate-pulse" />
                    <div className="col-span-3 h-[300px] rounded-lg bg-muted/50 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Estatísticas e Insights</h2>
                <div className="flex gap-2">
                    <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Todas as Locations" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Locations</SelectItem>
                            {/* Locations seriam listadas aqui dinamicamente */}
                            <SelectItem value="loc1">Matriz</SelectItem>
                            <SelectItem value="loc2">Filial Centro</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">7 dias</SelectItem>
                            <SelectItem value="30d">30 dias</SelectItem>
                            <SelectItem value="90d">90 dias</SelectItem>
                            <SelectItem value="1y">1 ano</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Cards de Insights */}
            <StatsInsights data={insightsData} />

            {/* Insights Avançados (Novo) */}
            <AdvancedInsights />

            {/* Análise Detalhada de Reviews (Novo) */}
            <ReviewsAnalytics />

            {/* Análise de Postagens (Novo) */}
            <PostsAnalytics />

            <div className="grid gap-4 md:grid-cols-2">
                {/* Análise de Categorias (Novo) */}
                <CategoryAnalytics />

                {/* Gerenciador de Palavras-chave (Novo) */}
                <KeywordManager />
            </div>

            {/* Pesquisa de Categorias (Novo) */}
            <CategorySearch />

            {/* Relatório de Performance (Novo) */}
            <PerformanceReport />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Análise de Sentimento */}
                <StatsSentiment data={sentimentData} />

                {/* Nuvem de Palavras */}
                <StatsWordCloud keywords={topKeywords} />
            </div>
        </div>
    );
}
