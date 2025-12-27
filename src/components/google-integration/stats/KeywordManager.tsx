import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GoogleReview } from "@/hooks/use-google-reviews";

interface KeywordManagerProps {
    reviews: GoogleReview[];
}

export function KeywordManager({ reviews }: KeywordManagerProps) {
    // Extrair palavras-chave dos comentários dos reviews
    const keywords = useMemo(() => {
        const wordCount: Record<string, number> = {};
        const stopWords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'por', 'é', 'são', 'foi', 'ser', 'que', 'quem', 'qual', 'quais', 'muito', 'mais', 'bom', 'boa', 'ótimo', 'ótima', 'excelente', 'péssimo', 'péssima', 'ruim', 'nao', 'não', 'sim', 'também', 'tambem', 'muito', 'muito', 'bom', 'boa', 'ótimo', 'ótima']);
        
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
            .slice(0, 7)
            .map(([term, impressions], index) => ({
                id: index + 1,
                term,
                impressions,
                trend: "stable" as "up" | "down" | "stable",
                change: "0%",
            }));
    }, [reviews]);

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case "up": return <TrendingUp className="h-4 w-4 text-green-500" />;
            case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
            default: return <Minus className="h-4 w-4 text-gray-400" />;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gerenciador de Palavras-chave</CardTitle>
                <CardDescription>Termos que mais trazem clientes para o seu perfil</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Palavra-chave</TableHead>
                            <TableHead className="text-right">Impressões</TableHead>
                            <TableHead className="text-center">Tendência</TableHead>
                            <TableHead className="text-right">Variação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {keywords.map((keyword) => (
                            <TableRow key={keyword.id}>
                                <TableCell className="font-medium">{keyword.term}</TableCell>
                                <TableCell className="text-right">{keyword.impressions.toLocaleString()}</TableCell>
                                <TableCell className="flex justify-center">{getTrendIcon(keyword.trend)}</TableCell>
                                <TableCell className={`text-right ${keyword.trend === "up" ? "text-green-600" : keyword.trend === "down" ? "text-red-600" : "text-gray-500"}`}>
                                    {keyword.change}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
