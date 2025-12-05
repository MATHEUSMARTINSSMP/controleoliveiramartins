import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Phone, Loader2, Trash2, X } from "lucide-react";
import { format, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import WhatsAppButton from "@/components/crm/WhatsAppButton";
import { useWishlist } from "@/hooks/useWishlist";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface WishlistItem {
  id: string;
  cliente_nome: string;
  produto: string;
  especificacao: string | null;
  telefone: string;
  cpf_cnpj: string | null;
  contact_id: string | null;
  data_cadastro: string;
  data_limite_aviso: string | null;
  contact?: {
    nome: string;
    telefone: string | null;
  };
}

interface WishlistSearchProps {
  storeId: string | null;
  onScheduleCRM?: (item: WishlistItem) => void;
  refreshTrigger?: number; // Para forçar atualização quando adicionar item
}

export function WishlistSearch({ storeId, onScheduleCRM, refreshTrigger }: WishlistSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [allItems, setAllItems] = useState<WishlistItem[]>([]); // Todos os itens para autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]); // Sugestões de produtos
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WishlistItem | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { searchByProduct, deleteItem, items: hookItems, refetch } = useWishlist({ storeId, autoFetch: true });

  // Carregar todos os itens quando storeId mudar ou refreshTrigger mudar
  useEffect(() => {
    if (storeId) {
      refetch();
    }
  }, [storeId, refreshTrigger, refetch]);

  // Atualizar allItems quando hookItems mudar
  useEffect(() => {
    if (hookItems && hookItems.length > 0) {
      setAllItems(hookItems);
      
      // Gerar sugestões únicas de produtos
      const uniqueProducts = Array.from(
        new Set(hookItems.map(item => item.produto.toLowerCase().trim()))
      ).sort();
      setSuggestions(uniqueProducts);
    } else {
      setAllItems([]);
      setSuggestions([]);
    }
  }, [hookItems]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quando refreshTrigger muda, atualizar a busca se houver termo
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && searchTerm && searchTerm.trim().length > 0) {
      const performSearch = async () => {
        setLoading(true);
        const results = await searchByProduct(searchTerm);
        setItems(results);
        setLoading(false);
      };
      performSearch();
    } else if (refreshTrigger && refreshTrigger > 0 && (!searchTerm || searchTerm.trim().length === 0)) {
      // Se não há termo, mostrar todos os itens
      setItems(allItems);
    }
  }, [refreshTrigger, searchTerm, searchByProduct, allItems]);

  // Buscar quando searchTerm mudar
  useEffect(() => {
    if (!storeId) {
      setItems([]);
      setLoading(false);
      return;
    }

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Se não há termo de busca, mostrar todos os itens
    if (!searchTerm || searchTerm.trim().length < 1) {
      setItems(allItems);
      setLoading(false);
      return;
    }

    // Debounce: esperar 300ms antes de buscar
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      const results = await searchByProduct(searchTerm);
      setItems(results);
      setLoading(false);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setLoading(false);
    };
  }, [searchTerm, storeId, searchByProduct, allItems]);

  // Filtrar sugestões baseado no que está sendo digitado
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10); // Limitar a 10 sugestões

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(value.trim().length > 0 && filteredSuggestions.length > 0);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    const success = await deleteItem(itemToDelete.id);
    if (success) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      // Atualizar lista
      if (searchTerm && searchTerm.trim().length > 0) {
        const results = await searchByProduct(searchTerm);
        setItems(results);
      } else {
        await refetch();
      }
    }
  };

  const normalizeWhatsApp = (phone: string) => {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("55")) {
      return cleaned;
    }
    if (cleaned.length === 11) {
      return "55" + cleaned;
    }
    if (cleaned.length === 10) {
      return "55" + cleaned;
    }
    return "55" + cleaned;
  };

  // Verificar se item está vencido (data_limite_aviso passou)
  const isItemExpired = (item: WishlistItem): boolean => {
    if (!item.data_limite_aviso) return false;
    try {
      const limitDate = parseISO(item.data_limite_aviso);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return isAfter(today, limitDate);
    } catch {
      return false;
    }
  };

  // Itens a exibir (resultados da busca ou todos)
  const displayItems = searchTerm && searchTerm.trim().length > 0 ? items : allItems;

  return (
    <>
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Buscar na Lista de Desejos</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Digite o nome do produto para ver os clientes interessados
          </p>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="space-y-4">
            {/* Campo de Busca com Autocomplete */}
            <div className="space-y-2" ref={containerRef}>
              <Label htmlFor="search-produto" className="text-sm">
                Produto
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  ref={inputRef}
                  id="search-produto"
                  placeholder="Ex: Vestido, Blusa, Calça..."
                  value={searchTerm}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => {
                    if (filteredSuggestions.length > 0 && searchTerm.trim().length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  className={cn(
                    "pl-10 text-base",
                    showSuggestions && filteredSuggestions.length > 0 && "rounded-b-none"
                  )}
                />
                {searchTerm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setShowSuggestions(false);
                    }}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Sugestões de Autocomplete */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-0 bg-background border border-t-0 rounded-b-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="px-4 py-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-b-0"
                    >
                      <span className="text-sm font-medium">{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de Resultados */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && searchTerm && searchTerm.trim().length >= 1 && items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado para "{searchTerm}"
              </div>
            )}

            {!loading && displayItems.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Cliente</TableHead>
                      <TableHead className="text-xs sm:text-sm">Produto</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">Especificações</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Telefone</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Data Cadastro</TableHead>
                      <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayItems.map((item) => {
                      const expired = isItemExpired(item);
                      return (
                        <TableRow 
                          key={item.id}
                          className={cn(
                            expired && "opacity-60 bg-muted/30"
                          )}
                        >
                          <TableCell className="text-xs sm:text-sm font-medium">
                            <div className="flex flex-col">
                              <span>{item.cliente_nome}</span>
                              {expired && item.data_limite_aviso && (
                                <Badge variant="outline" className="mt-1 text-xs w-fit">
                                  Vencido
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2 mt-1">
                              {item.cpf_cnpj && (
                                <Badge variant="outline" className="text-xs">
                                  CPF
                                </Badge>
                              )}
                              {item.contact_id && (
                                <Badge variant="secondary" className="text-xs">
                                  Cadastrado
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{item.produto}</span>
                              {item.especificacao && (
                                <span className="text-xs text-muted-foreground mt-1">
                                  {item.especificacao}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                            {item.especificacao || "-"}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {item.telefone}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                            {format(new Date(item.data_cadastro), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <WhatsAppButton
                                phone={normalizeWhatsApp(item.telefone)}
                                message={`Olá ${item.cliente_nome}, temos novidades sobre o produto ${item.produto}${item.especificacao ? ` (${item.especificacao})` : ''} que você estava interessado!`}
                                size="sm"
                                variant="outline"
                              />
                              {onScheduleCRM && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onScheduleCRM(item)}
                                  className="text-xs"
                                >
                                  Agendar CRM
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setItemToDelete(item);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-xs text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && (!searchTerm || searchTerm.trim().length < 1) && allItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum desejo cadastrado ainda. Clique em "Adicionar Desejo" para começar.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o desejo de <strong>{itemToDelete?.cliente_nome}</strong> por <strong>{itemToDelete?.produto}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


