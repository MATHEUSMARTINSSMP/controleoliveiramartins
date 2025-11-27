/**
 * Componente para visualizar clientes sincronizados do Tiny ERP
 * Passo 12: Criar componente para visualizar clientes sincronizados
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, User, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShoppingBag, TrendingUp, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TinyContact {
  id: string;
  store_id: string;
  tiny_id: string;
  nome: string;
  tipo: string; // 'F' ou 'J'
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  data_nascimento: string | null;
  sync_at: string;
}

interface CustomerStats {
  lastPurchase: { date: string; value: number } | null;
  totalPurchases: { count: number; value: number };
  cashbackBalance: number;
  topProducts: Array<{ descricao: string; quantidade: number }>;
  purchaseFrequency: number; // days between purchases
}

interface TinyContactsListProps {
  storeId?: string;
  limit?: number;
}

export default function TinyContactsList({ storeId, limit = 10000 }: TinyContactsListProps) {
  const [contacts, setContacts] = useState<TinyContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<TinyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [customerStats, setCustomerStats] = useState<Map<string, CustomerStats>>(new Map());
  const [loadingStats, setLoadingStats] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetchContacts();
  }, [storeId]);

  useEffect(() => {
    filterContacts();
    setCurrentPage(1); // Resetar para primeira página quando filtros mudarem
  }, [contacts, searchTerm]);

  // Recalcular paginação quando itemsPerPage mudar
  useEffect(() => {
    // Ajustar currentPage se estiver fora do range após mudança de itemsPerPage
    const newTotalPages = Math.ceil(filteredContacts.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
  }, [itemsPerPage, filteredContacts.length]);

  // Calcular paginação
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('*')
        .order('nome', { ascending: true })
        .limit(limit);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Log detalhado dos dados recebidos do banco
      console.log('[TinyContactsList] 👤 Dados recebidos do banco:', {
        total: data?.length || 0,
        primeiro_cliente: data?.[0] ? {
          tiny_id: data[0].tiny_id,
          nome: data[0].nome,
          cpf_cnpj: data[0].cpf_cnpj,
          telefone: data[0].telefone,
          celular: data[0].celular,
          data_nascimento: data[0].data_nascimento,
        } : null,
        todas_as_chaves: data?.[0] ? Object.keys(data[0]) : [],
      });

      setContacts(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = [...contacts];

    // Filtro por busca (nome, CPF/CNPJ, email, telefone)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (contact) =>
          contact.nome?.toLowerCase().includes(term) ||
          contact.cpf_cnpj?.toLowerCase().includes(term) ||
          contact.email?.toLowerCase().includes(term) ||
          contact.telefone?.toLowerCase().includes(term) ||
          contact.celular?.toLowerCase().includes(term)
      );
    }

    setFilteredContacts(filtered);
  };

  const fetchCustomerStats = async (contactId: string, tinyId: string) => {
    if (customerStats.has(contactId) || loadingStats.has(contactId)) return;

    setLoadingStats(prev => new Set(prev).add(contactId));

    try {
      // Buscar vendas do cliente (usando tiny_orders)
      const { data: vendas, error } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('*')
        .eq('cliente_id', contactId)
        .order('numero_pedido', { ascending: false });

      if (error) throw error;

      if (!vendas || vendas.length === 0) {
        setCustomerStats(prev => new Map(prev).set(contactId, {
          lastPurchase: null,
          totalPurchases: { count: 0, value: 0 },
          cashbackBalance: 0,
          topProducts: [],
          purchaseFrequency: 0,
        }));
        return;
      }

      // Última compra
      const lastPurchase = vendas[0] ? {
        date: vendas[0].data_pedido,
        value: vendas[0].valor_total || 0,
      } : null;

      // Total de compras
      const totalPurchases = {
        count: vendas.length,
        value: vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0),
      };

      // Top produtos (agrupar por descrição dos itens do pedido)
      const productMap = new Map<string, number>();
      vendas.forEach(venda => {
        if (venda.itens && Array.isArray(venda.itens)) {
          venda.itens.forEach((item: any) => {
            const desc = item.descricao || item.produto || 'Produto sem descrição';
            const qtd = parseFloat(item.quantidade || 1);
            productMap.set(desc, (productMap.get(desc) || 0) + qtd);
          });
        }
      });
      const topProducts = Array.from(productMap.entries())
        .map(([descricao, quantidade]) => ({ descricao, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 3);

      // Frequência de compra (média de dias entre compras)
      let purchaseFrequency = 0;
      if (vendas.length > 1) {
        const dates = vendas.map(v => new Date(v.data_pedido).getTime()).sort((a, b) => b - a);
        const intervals = [];
        for (let i = 0; i < dates.length - 1; i++) {
          intervals.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
        }
        purchaseFrequency = Math.round(intervals.reduce((sum, i) => sum + i, 0) / intervals.length);
      }

      // Buscar saldo de cashback
      const { data: cashbackData } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_balances')
        .select('saldo_disponivel')
        .eq('cliente_id', contactId)
        .single();

      setCustomerStats(prev => new Map(prev).set(contactId, {
        lastPurchase,
        totalPurchases,
        cashbackBalance: cashbackData?.saldo_disponivel || 0,
        topProducts,
        purchaseFrequency,
      }));
    } catch (error) {
      console.error('Erro ao buscar estatísticas do cliente:', error);
    } finally {
      setLoadingStats(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  const toggleRow = (contactId: string, tinyId: string, event?: React.MouseEvent) => {
    // Prevenir propagação se o clique foi no botão
    if (event) {
      event.stopPropagation();
    }

    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId);
    } else {
      newExpanded.add(contactId);
      // Buscar stats apenas se ainda não temos
      if (!customerStats.has(contactId) && !loadingStats.has(contactId)) {
        fetchCustomerStats(contactId, tinyId);
      }
    }
    setExpandedRows(newExpanded);
  };

  const formatCPFCNPJ = (cpfCnpj: string | null) => {
    if (!cpfCnpj) return '-';
    const cleaned = cpfCnpj.replace(/\D/g, '');
    if (cleaned.length === 11) {
      // CPF: 000.000.000-00
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      // CNPJ: 00.000.000/0000-00
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cpfCnpj;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Lista de Clientes
        </CardTitle>
        <CardDescription>
          Visualize os clientes sincronizados do Tiny ERP ({filteredContacts.length} {filteredContacts.length === contacts.length ? 'clientes' : `de ${contacts.length} clientes`})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros e Paginação */}
        <div className="mb-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Itens por página" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela */}
        {filteredContacts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum cliente encontrado
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.map((contact) => {
                    const isExpanded = expandedRows.has(contact.id);
                    const stats = customerStats.get(contact.id);
                    const isLoadingStats = loadingStats.has(contact.id);

                    return (
                      <>
                        <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell onClick={(e) => toggleRow(contact.id, contact.tiny_id, e)}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium" onClick={(e) => toggleRow(contact.id, contact.tiny_id, e)}>{contact.nome}</TableCell>
                          <TableCell className="font-mono text-sm" onClick={(e) => toggleRow(contact.id, contact.tiny_id, e)}>
                            {formatCPFCNPJ(contact.cpf_cnpj)}
                          </TableCell>
                          <TableCell onClick={(e) => toggleRow(contact.id, contact.tiny_id, e)}>
                            {contact.telefone || contact.celular || '-'}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${contact.id}-details`}>
                            <TableCell colSpan={4} className="bg-muted/30 p-6">
                              {isLoadingStats ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                              ) : stats ? (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                                  {/* Data de Nascimento */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                      <Calendar className="h-4 w-4" />
                                      Data de Nascimento
                                    </div>
                                    {contact.data_nascimento ? (
                                      <div className="text-sm font-medium">
                                        {format(new Date(contact.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Não informada</div>
                                    )}
                                  </div>
                                  {/* Última Compra */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                      <ShoppingBag className="h-4 w-4" />
                                      Última Compra
                                    </div>
                                    {stats.lastPurchase ? (
                                      <>
                                        <div className="text-sm">
                                          {format(new Date(stats.lastPurchase.date), 'dd/MM/yyyy', { locale: ptBR })}
                                        </div>
                                        <div className="text-lg font-bold">
                                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.lastPurchase.value)}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Nenhuma compra</div>
                                    )}
                                  </div>

                                  {/* Total de Compras */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                      <TrendingUp className="h-4 w-4" />
                                      Total de Compras
                                    </div>
                                    <div className="text-sm">{stats.totalPurchases.count} pedidos</div>
                                    <div className="text-lg font-bold">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalPurchases.value)}
                                    </div>
                                  </div>

                                  {/* Cashback */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                      <Gift className="h-4 w-4" />
                                      Saldo Cashback
                                    </div>
                                    <div className="text-lg font-bold">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.cashbackBalance)}
                                    </div>
                                    {stats.purchaseFrequency > 0 && (
                                      <div className="text-xs text-muted-foreground">
                                        Compra a cada {stats.purchaseFrequency} dias
                                      </div>
                                    )}
                                  </div>

                                  {/* Top Produtos */}
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium text-muted-foreground">Top Produtos</div>
                                    {stats.topProducts.length > 0 ? (
                                      <div className="space-y-1">
                                        {stats.topProducts.map((product, idx) => (
                                          <div key={idx} className="flex items-center justify-between text-xs">
                                            <span className="truncate max-w-[150px]">{product.descricao}</span>
                                            <Badge variant="secondary" className="ml-2">{product.quantidade}x</Badge>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Nenhum produto</div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">Nenhum dado disponível</div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Paginação - Sempre visível */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredContacts.length)} de {filteredContacts.length} clientes
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="text-sm">
                  Página {currentPage} de {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

