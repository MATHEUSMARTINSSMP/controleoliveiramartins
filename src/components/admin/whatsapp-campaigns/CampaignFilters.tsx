import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

interface CampaignFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  storeFilter: string;
  onStoreFilterChange: (value: string) => void;
  stores: Array<{ id: string; name: string }>;
  sortBy: string;
  onSortByChange: (value: string) => void;
}

export function CampaignFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  storeFilter,
  onStoreFilterChange,
  stores,
  sortBy,
  onSortByChange,
}: CampaignFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtro por Status */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger>
          <SelectValue placeholder="Todos os status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="DRAFT">Rascunho</SelectItem>
          <SelectItem value="SCHEDULED">Agendada</SelectItem>
          <SelectItem value="RUNNING">Em Andamento</SelectItem>
          <SelectItem value="PAUSED">Pausada</SelectItem>
          <SelectItem value="COMPLETED">Concluída</SelectItem>
          <SelectItem value="CANCELLED">Cancelada</SelectItem>
          <SelectItem value="FAILED">Falhou</SelectItem>
        </SelectContent>
      </Select>

      {/* Filtro por Loja */}
      <Select value={storeFilter} onValueChange={onStoreFilterChange}>
        <SelectTrigger>
          <SelectValue placeholder="Todas as lojas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as lojas</SelectItem>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Ordenação */}
      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger>
          <SelectValue placeholder="Ordenar por..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_desc">Mais recente</SelectItem>
          <SelectItem value="created_asc">Mais antiga</SelectItem>
          <SelectItem value="status">Status</SelectItem>
          <SelectItem value="progress_desc">Maior progresso</SelectItem>
          <SelectItem value="progress_asc">Menor progresso</SelectItem>
          <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
          <SelectItem value="name_desc">Nome (Z-A)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

