import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

interface ReviewsFiltersProps {
  searchText: string;
  setSearchText: (text: string) => void;
  filterRating: number | null;
  setFilterRating: (rating: number | null) => void;
  filterDateRange: string;
  setFilterDateRange: (range: string) => void;
  filterStatus: "all" | "responded" | "unresponded" | "unread";
  setFilterStatus: (status: "all" | "responded" | "unresponded" | "unread") => void;
  sortBy: "newest" | "oldest" | "highest" | "lowest";
  setSortBy: (sort: "newest" | "oldest" | "highest" | "lowest") => void;
  hasFilters: boolean;
  onClearFilters: () => void;
}

export function ReviewsFilters({
  searchText,
  setSearchText,
  filterRating,
  setFilterRating,
  filterDateRange,
  setFilterDateRange,
  filterStatus,
  setFilterStatus,
  sortBy,
  setSortBy,
  hasFilters,
  onClearFilters,
}: ReviewsFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder="Buscar por autor ou comentário..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="rating">Avaliação</Label>
            <Select
              value={filterRating !== null ? filterRating.toString() : "all"}
              onValueChange={(value) =>
                setFilterRating(value === "all" ? null : parseInt(value))
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="5">5 estrelas</SelectItem>
                <SelectItem value="4">4 estrelas</SelectItem>
                <SelectItem value="3">3 estrelas</SelectItem>
                <SelectItem value="2">2 estrelas</SelectItem>
                <SelectItem value="1">1 estrela</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dateRange">Período</Label>
            <Select value={filterDateRange} onValueChange={setFilterDateRange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="1y">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unread">Não lidas</SelectItem>
                <SelectItem value="unresponded">Sem resposta</SelectItem>
                <SelectItem value="responded">Respondidas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sort">Ordenar</Label>
            <Select
              value={sortBy}
              onValueChange={(value: any) => setSortBy(value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Mais recentes</SelectItem>
                <SelectItem value="oldest">Mais antigas</SelectItem>
                <SelectItem value="highest">Melhor avaliação</SelectItem>
                <SelectItem value="lowest">Pior avaliação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


