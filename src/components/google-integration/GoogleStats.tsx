import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleReviews } from "@/hooks/use-google-reviews";
import { useGooglePerformance } from "@/hooks/use-google-performance";
import { useGoogleLocations } from "@/hooks/use-google-locations";
import { useGooglePosts } from "@/hooks/use-google-posts";
import { Loader2 } from "lucide-react";
import { StatsInsights } from "./stats/StatsInsights";
import { StatsSentiment } from "./stats/StatsSentiment";
import { StatsWordCloud } from "./stats/StatsWordCloud";
import { AdvancedInsights } from "./stats/AdvancedInsights";
import { ReviewsAnalytics } from "./stats/ReviewsAnalytics";
import { PostsAnalytics } from "./stats/PostsAnalytics";
import { CategoryAnalytics } from "./stats/CategoryAnalytics";
import { KeywordManager } from "./stats/KeywordManager";

// Importar useGoogleLocations para CategoryAnalytics
import { PerformanceReport } from "./reports/PerformanceReport";
import { CategorySearch } from "./categories/CategorySearch";

interface GoogleStatsProps {
    siteSlug: string;
}

export function GoogleStats({ siteSlug }: GoogleStatsProps) {
    const { stats, fetchStats, loading, reviews, fetchReviews } = useGoogleReviews();
    const { metrics, loading: performanceLoading, fetchPerformance } = useGooglePerformance();
    const { locations } = useGoogleLocations();
    const { posts, fetchPosts } = useGooglePosts();
    const [period, setPeriod] = useState("30d");
    const [locationFilter, setLocationFilter] = useState("all");

    useEffect(() => {
        fetchStats(siteSlug, period);
        fetchPerformance(siteSlug, period);
        if (reviews.length === 0) {
            fetchReviews(siteSlug);
        }
        
        // Buscar posts se houver location
        if (locations.length > 0 && posts.length === 0) {
            const primaryLocation = locations.find(l => l.is_primary) || locations[0];
            if (primaryLocation?.location_id) {
                // Construir locationId completo: accounts/{accountId}/locations/{locationId}
                const accountId = primaryLocation.account_id?.split('/').pop() || primaryLocation.account_id;
                const locationId = `accounts/${accountId}/locations/${primaryLocation.location_id}`;
                fetchPosts(locationId, siteSlug);
            }
        }
    }, [siteSlug, period, locations]);

    // Usar dados reais de performance se disponíveis, senão usar dados padrão
    const insightsData = metrics || {
        views: { total: 0, change: 0 },
        clicks: { total: 0, change: 0 },
        calls: { total: 0, change: 0 },
        directions: { total: 0, change: 0 },
    };

    // Análise de Sentimento baseada em reviews reais
    const sentimentData = [
        { name: "Positivo", value: reviews.filter(r => r.rating >= 4).length, color: "#22c55e" },
        { name: "Neutro", value: reviews.filter(r => r.rating === 3).length, color: "#eab308" },
        { name: "Negativo", value: reviews.filter(r => r.rating <= 2).length, color: "#ef4444" },
    ];

    // Extrair palavras-chave dos comentários dos reviews (simples - pode ser melhorado)
    const extractKeywords = () => {
        const wordCount: Record<string, number> = {};
        const stopWords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'por', 'é', 'são', 'foi', 'ser', 'que', 'quem', 'qual', 'quais', 'muito', 'mais', 'mais', 'muito', 'bom', 'boa', 'ótimo', 'ótima', 'excelente', 'péssimo', 'péssima', 'ruim', 'nao', 'não', 'sim', 'também', 'tambem']);
        
        reviews.forEach(review => {
            if (review.comment) {
                const words = review.comment.toLowerCase()
                    .replace(/[^\w\s]/g, ' ')
                    .split(/\s+/)
                    .filter(w => w.length > 3 && !stopWords.has(w));
                
                words.forEach(word => {
                    wordCount[word] = (wordCount[word] || 0) + 1;
                });
            }
        });

        return Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([text, value]) => ({ text, value }));
    };

    const topKeywords = extractKeywords();

    if ((loading || performanceLoading) && !stats && !metrics) {
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
                            {locations.map(loc => (
                                <SelectItem key={loc.location_id} value={loc.location_id}>
                                    {loc.location_name}
                                </SelectItem>
                            ))}
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
            <AdvancedInsights metrics={metrics} />

            {/* Análise Detalhada de Reviews (Novo) */}
            <ReviewsAnalytics reviews={reviews} />

            {/* Análise de Postagens (Novo) */}
            <PostsAnalytics posts={posts} />

            <div className="grid gap-4 md:grid-cols-2">
                {/* Análise de Categorias (Novo) */}
                <CategoryAnalytics siteSlug={siteSlug} />

                {/* Gerenciador de Palavras-chave (Novo) */}
                <KeywordManager reviews={reviews} />
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
