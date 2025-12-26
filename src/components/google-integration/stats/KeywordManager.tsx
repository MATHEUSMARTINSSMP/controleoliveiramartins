import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function KeywordManager() {
    // Simulação de palavras-chave
    const keywords = [
        { id: 1, term: "restaurante italiano", impressions: 1250, trend: "up", change: "+15%" },
        { id: 2, term: "pizza delivery", impressions: 980, trend: "up", change: "+8%" },
        { id: 3, term: "massas frescas", impressions: 750, trend: "stable", change: "0%" },
        { id: 4, term: "jantar romântico", impressions: 620, trend: "down", change: "-5%" },
        { id: 5, term: "almoço executivo", impressions: 580, trend: "up", change: "+12%" },
        { id: 6, term: "vinho tinto", impressions: 450, trend: "stable", change: "+1%" },
        { id: 7, term: "sobremesas", impressions: 320, trend: "down", change: "-10%" },
    ];

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
