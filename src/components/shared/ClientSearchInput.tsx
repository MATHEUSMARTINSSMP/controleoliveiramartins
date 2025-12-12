import React from 'react';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Client } from '@/hooks/use-client-search';

interface ClientSearchInputProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  selectedClientId: string | null;
  onClientSelect: (clientId: string) => void;
  onClearSelection: () => void;
  onNewClientClick: () => void;
  filteredClients: Client[];
  allClients: Client[];
  placeholder?: string;
  showNewClientButton?: boolean;
}

/**
 * Componente reutilizável de busca de cliente com autocomplete
 * Segue o padrão do CashbackManagement
 */
export const ClientSearchInput: React.FC<ClientSearchInputProps> = ({
  searchTerm,
  onSearchTermChange,
  selectedClientId,
  onClientSelect,
  onClearSelection,
  onNewClientClick,
  filteredClients,
  allClients,
  placeholder = "Digite nome, CPF ou telefone...",
  showNewClientButton = true,
}) => {
  const selectedClient = selectedClientId ? allClients.find(c => c.id === selectedClientId) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="client-search">Cliente</Label>
        {showNewClientButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewClientClick}
            className="border-primary/20"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Cliente
          </Button>
        )}
      </div>
      {!selectedClient ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="client-search"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchTerm && filteredClients.length > 0 && (
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {filteredClients.map(c => (
                <div
                  key={c.id}
                  onClick={() => onClientSelect(c.id)}
                  className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                >
                  <div className="font-medium">{c.nome}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.cpf || c.cpf_cnpj || ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchTerm && filteredClients.length === 0 && (
            <div className="text-sm text-muted-foreground p-2">Nenhum cliente encontrado</div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
          <div>
            <div className="font-medium">{selectedClient.nome}</div>
            <div className="text-sm text-muted-foreground">
              {selectedClient.cpf || selectedClient.cpf_cnpj || ''}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            type="button"
          >
            Alterar
          </Button>
        </div>
      )}
    </div>
  );
};
