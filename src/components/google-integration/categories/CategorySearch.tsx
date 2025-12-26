import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, Users, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CategoryResult {
    name: string;
    popularity: number; // 0-100
    competitors: number;
    trend: "up" | "down" | "stable";
}

export function CategorySearch() {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<CategoryResult[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = () => {
        if (!searchTerm) return;
        setSearching(true);

        // Simulação de busca
        setTimeout(() => {
            const mockResults: CategoryResult[] = [
                { name: `${searchTerm} Delivery`, popularity: 85, competitors: 12, trend: "up" },
                { name: `Restaurante de ${searchTerm}`, popularity: 92, competitors: 25, trend: "stable" },
                { name: `${searchTerm} Artesanal`, popularity: 60, competitors: 5, trend: "up" },
                { name: `Loja de ${searchTerm}`, popularity: 45, competitors: 8, trend: "down" },
            ];
            setResults(mockResults);
            setSearching(false);
        }, 1000);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Pesquisar Categorias
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-2">
                    <Input
                        placeholder="Ex: Pizza, Hambúrguer, Roupas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={searching}>
                        {searching ? "Buscando..." : "Pesquisar"}
                    </Button>
                </div>

                {results.length > 0 && (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Popularidade</TableHead>
                                    <TableHead>Concorrência</TableHead>
                                    <TableHead>Tendência</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map((result, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{result.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary"
                                                        style={{ width: `${result.popularity}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground">{result.popularity}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Users className="h-3 w-3 text-muted-foreground" />
                                                {result.competitors} locais
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {result.trend === "up" && <span className="text-green-500 flex items-center text-xs"><TrendingUp className="h-3 w-3 mr-1" /> Alta</span>}
                                            {result.trend === "down" && <span className="text-red-500 flex items-center text-xs"><TrendingUp className="h-3 w-3 mr-1 rotate-180" /> Baixa</span>}
                                            {result.trend === "stable" && <span className="text-yellow-500 flex items-center text-xs">Estável</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm">
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
