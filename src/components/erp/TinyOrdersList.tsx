/**
 * Componente para visualizar pedidos sincronizados do Tiny ERP
 * Passo 11: Criar componente para visualizar pedidos sincronizados
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
import { Loader2, Search, Calendar, DollarSign, User, Package, ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TinyOrder {
  id: string;
  store_id: string;
  tiny_id: string;
  numero_pedido: string | null;
  numero_ecommerce: string | null;
  situacao: string | null;
  data_pedido: string | null;
  cliente_id: string | null; // ✅ FASE 2: FK para tiny_contacts
  cliente_nome: string | null; // Mantido para histórico rápido
  cliente_cpf_cnpj: string | null; // Mantido para histórico rápido
  cliente_telefone: string | null; // ✅ Exibir diretamente do Supabase
  cliente_email: string | null; // ✅ Exibir diretamente do Supabase
  valor_total: number;
  vendedor_nome: string | null;
  colaboradora_id: string | null;
  forma_pagamento: string | null;
  sync_at: string;
  // ✅ CASHBACK: Dados de cashback gerado para este pedido
  cashback_gerado?: number | null;
  cashback_validade?: string | null;
}

interface TinyOrdersListProps {
  storeId?: string;
  limit?: number;
}

export default function TinyOrdersList({ storeId, limit = 50 }: TinyOrdersListProps) {
  const [orders, setOrders] = useState<TinyOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<TinyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const { toast } = useToast();

  // ✅ Flag para evitar notificações de pedidos antigos na primeira carga
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [storeId]);

  useEffect(() => {
    filterOrders();
    setCurrentPage(1); // Resetar para primeira página quando filtros mudarem
  }, [orders, searchTerm, statusFilter, dateFilter]);

  // Calcular paginação
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // ✅ AUTO-REFRESH SILENCIOSO - Atualizar lista quando houver novas vendas
  // Não mostra loading, apenas atualiza a lista silenciosamente
  useEffect(() => {
    if (!storeId) return;

    // ✅ OTIMIZADO: Atualizar a cada 30 segundos (reduzido de 8s para melhor performance)
    // O Realtime já detecta mudanças instantaneamente, então o auto-refresh é apenas backup
    const interval = setInterval(() => {
      fetchOrdersSilently();
    }, 30000); // 30 segundos (otimizado)

    return () => clearInterval(interval);
  }, [storeId]);

  // ✅ REALTIME: Escutar mudanças em tempo real via Supabase Realtime
  useEffect(() => {
    if (!storeId) return;

    console.log('[TinyOrdersList] 🔌 Configurando Realtime para store:', storeId);

    const channel = supabase
      .channel(`tiny_orders_${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'sistemaretiradas',
          table: 'tiny_orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('[TinyOrdersList] 🔔 Mudança detectada em tempo real:', payload.eventType, payload);
          // ✅ CORREÇÃO: Usar fetchOrdersSilently para detectar novos pedidos e mostrar notificações
          // fetchOrders() não mostra notificações, apenas recarrega a lista
          fetchOrdersSilently();
        }
      )
      .subscribe((status) => {
        console.log('[TinyOrdersList] 📡 Status da subscrição Realtime:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[TinyOrdersList] ✅ Realtime conectado com sucesso!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[TinyOrdersList] ❌ Erro ao conectar Realtime');
        }
      });

    return () => {
      console.log('[TinyOrdersList] 🔌 Desconectando Realtime');
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  // ✅ Buscar pedidos silenciosamente (sem mostrar loading)
  const fetchOrdersSilently = async () => {
    if (!storeId) return;

    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('*')
        .eq('store_id', storeId)
        .order('data_pedido', { ascending: false, nullsFirst: false }) // ✅ Ordenar por data (mais recente primeiro)
        .limit(Math.min(limit, 100)); // ✅ Máximo 100 registros

      if (error) throw error;

      if (data) {
        // ✅ NORMALIZAR DADOS: Garantir conversão de tipos (valor_total pode vir como string)
        const normalizedData = data.map((order: any) => ({
          ...order,
          valor_total: Number(order.valor_total) || 0,
        }));


        // ✅ Detectar novos pedidos usando TIMESTAMP de sincronização
        // Considerar "novo" qualquer pedido sincronizado nos últimos 2 minutos
        const doisMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);

        const novosPedidos = normalizedData.filter((order) => {
          // Se não tem sync_at, não é novo
          if (!order.sync_at) return false;

          const syncDate = new Date(order.sync_at);
          const isRecent = syncDate > doisMinutosAtras;

          // Verificar se já estava na lista anterior
          const jaExistia = orders.some((existingOrder) => existingOrder.id === order.id);

          // É novo se foi sincronizado recentemente E não estava na lista anterior
          return isRecent && !jaExistia;
        });

        console.log(`[AUTO-REFRESH] 📊 ${novosPedidos.length} novos pedidos detectados (isFirstLoad: ${isFirstLoad})`);

        if (novosPedidos.length > 0) {
          // ✅ Adicionar novos pedidos no TOPO da lista
          setOrders((prevOrders) => {
            // Remover duplicados e adicionar novos no topo
            const existingIds = new Set(prevOrders.map((o) => o.id));
            const novosSemDuplicados = novosPedidos.filter((o) => !existingIds.has(o.id));

            // 🔔 Mostrar notificação sonner APENAS se NÃO for primeira carga
            if (novosSemDuplicados.length > 0 && !isFirstLoad) {
              console.log(`[AUTO-REFRESH] 🔔 Mostrando ${novosSemDuplicados.length} notificações`);
              novosSemDuplicados.forEach((novoPedido) => {
                // ✅ Notificação Sonner (Minimalista)
                sonnerToast.success("🎉 Nova Venda!", {
                  description: `Pedido ${novoPedido.numero_pedido || novoPedido.tiny_id} - ${novoPedido.cliente_nome || 'Cliente'} - ${formatCurrency(novoPedido.valor_total || 0)}`,
                  duration: 5000,
                });

                // ✅ Notificação Toast (Balãozinho - Shadcn UI)
                // O usuário prefere este estilo visual
                toast({
                  title: "🎉 Nova Venda Detectada!",
                  description: (
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{novoPedido.cliente_nome || 'Cliente'}</span>
                      <span>Pedido #{novoPedido.numero_pedido || novoPedido.tiny_id}</span>
                      <span className="font-bold text-green-600">{formatCurrency(novoPedido.valor_total || 0)}</span>
                    </div>
                  ),
                  duration: 5000,
                  className: "bg-white border-green-500 border-l-4 shadow-lg",
                });
              });
            } else if (isFirstLoad) {
              console.log('[AUTO-REFRESH] ⏭️ Primeira carga - notificações suprimidas');
            }

            // ✅ Adicionar novos pedidos no topo, ordenando por número do pedido (maior = mais recente)
            const todasAsVendas = [...novosSemDuplicados, ...prevOrders];
            return todasAsVendas.sort((a, b) => {
              // Ordenar apenas por número do pedido (maior número = mais recente = no topo)
              const numA = parseInt(a.numero_pedido || a.numero_ecommerce || '0');
              const numB = parseInt(b.numero_pedido || b.numero_ecommerce || '0');
              return numB - numA; // Descendente: maior número primeiro
            });
          });
        } else {
          // Sem novos pedidos, apenas atualizar se houver mudanças
          setOrders(normalizedData);
        }

        // Marcar que primeira carga já passou
        if (isFirstLoad) {
          setIsFirstLoad(false);
          console.log('[AUTO-REFRESH] ✅ Primeira carga concluída');
        }
      }
    } catch (error: any) {
      console.error('[AUTO-REFRESH] ❌ Erro ao buscar pedidos:', error);
      // Não mostrar erro para não poluir a interface
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // ✅ Exibir diretamente as colunas do Supabase (sem JOIN)
      // Usa cliente_telefone e cliente_email que já estão em tiny_orders
      // ✅ Máximo 100 registros conforme solicitado
      const maxLimit = Math.min(limit, 100);
      let query = supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('*')
        .order('data_pedido', { ascending: false, nullsFirst: false }) // ✅ Ordenar por data (mais recente primeiro)
        .limit(maxLimit);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // ✅ BUSCAR DADOS DE CASHBACK PARA CADA PEDIDO
      if (data && data.length > 0) {
        const orderIds = data.map(o => o.id);

        // Buscar transações de cashback relacionadas aos pedidos
        const { data: cashbackTransactions } = await supabase
          .schema('sistemaretiradas')
          .from('cashback_transactions')
          .select('tiny_order_id, amount, data_expiracao, transaction_type')
          .in('tiny_order_id', orderIds)
          .eq('transaction_type', 'EARNED');

        // Criar mapa de cashback por pedido
        const cashbackMap = new Map<string, { amount: number; expiracao: string | null }>();
        cashbackTransactions?.forEach((transaction: any) => {
          if (transaction.tiny_order_id) {
            const existing = cashbackMap.get(transaction.tiny_order_id);
            if (existing) {
              existing.amount += Number(transaction.amount || 0);
              // Pegar a data de expiração mais próxima
              if (transaction.data_expiracao && (!existing.expiracao || transaction.data_expiracao < existing.expiracao)) {
                existing.expiracao = transaction.data_expiracao;
              }
            } else {
              cashbackMap.set(transaction.tiny_order_id, {
                amount: Number(transaction.amount || 0),
                expiracao: transaction.data_expiracao || null,
              });
            }
          }
        });

        // ✅ NORMALIZAR DADOS: Garantir que tipos estejam corretos
        // Adicionar dados de cashback aos pedidos e ordenar numericamente
        const ordersWithCashback = data.map((order: any) => {
          const cashback = cashbackMap.get(order.id);
          return {
            ...order,
            // ✅ GARANTIR CONVERSÃO DE TIPOS: valor_total pode vir como string do Supabase
            valor_total: Number(order.valor_total) || 0,
            cashback_gerado: cashback?.amount || null,
            cashback_validade: cashback?.expiracao || null,
          };
        });

        // ✅ Ordenar numericamente por numero_pedido (maior primeiro)
        ordersWithCashback.sort((a, b) => {
          const numA = parseInt(a.numero_pedido || a.numero_ecommerce || '0');
          const numB = parseInt(b.numero_pedido || b.numero_ecommerce || '0');
          return numB - numA; // Descendente: 1000, 999, 998...
        });

        setOrders(ordersWithCashback);
      } else {
        setOrders(data || []);
      }
    } catch (error: any) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Filtro por busca (número, cliente, vendedor)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.numero_pedido?.toLowerCase().includes(term) ||
          order.cliente_nome?.toLowerCase().includes(term) ||
          order.vendedor_nome?.toLowerCase().includes(term) ||
          order.cliente_email?.toLowerCase().includes(term) ||
          order.cliente_telefone?.toLowerCase().includes(term)
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.situacao === statusFilter);
    }

    // Filtro por data
    if (dateFilter !== 'all') {
      const today = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((order) => {
            if (!order.data_pedido) return false;
            const orderDate = new Date(order.data_pedido);
            return orderDate >= filterDate;
          });
          break;
        case 'week':
          filterDate.setDate(today.getDate() - 7);
          filtered = filtered.filter((order) => {
            if (!order.data_pedido) return false;
            const orderDate = new Date(order.data_pedido);
            return orderDate >= filterDate;
          });
          break;
        case 'month':
          filterDate.setMonth(today.getMonth() - 1);
          filtered = filtered.filter((order) => {
            if (!order.data_pedido) return false;
            const orderDate = new Date(order.data_pedido);
            return orderDate >= filterDate;
          });
          break;
      }
    }

    setFilteredOrders(filtered);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      // ✅ CORREÇÃO: A data vem do banco como string ISO, mas pode estar em UTC
      // Precisamos interpretar corretamente o timezone
      let date: Date;

      // Se a string tem timezone explícito (ex: -03:00, +00:00, Z)
      if (dateString.includes('T') && (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-'))) {
        date = new Date(dateString);
      }
      // Se não tem timezone, assumir que é horário local do Brasil (UTC-3)
      else if (dateString.includes('T')) {
        // Adicionar timezone do Brasil se não tiver
        const dateWithTimezone = dateString.endsWith('Z')
          ? dateString.replace('Z', '-03:00')
          : dateString.includes('+') || dateString.includes('-')
            ? dateString
            : `${dateString}-03:00`;
        date = new Date(dateWithTimezone);
      }
      // Se é apenas data (YYYY-MM-DD), criar como meia-noite no timezone local
      else {
        date = new Date(`${dateString}T00:00:00-03:00`);
      }

      // Formatar para horário local do Brasil
      return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch (error) {
      console.warn('[TinyOrdersList] Erro ao formatar data:', dateString, error);
      return dateString;
    }
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
          <Package className="h-5 w-5" />
          Pedidos Sincronizados
        </CardTitle>
        <CardDescription>
          Visualize os pedidos sincronizados do Tiny ERP ({filteredOrders.length} de {Math.min(orders.length, 100)})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros e Paginação */}
        <div className="mb-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente, vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as datas</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
              </SelectContent>
            </Select>
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
        {filteredOrders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum pedido encontrado
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Cashback Gerado</TableHead>
                    <TableHead>Validade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.numero_pedido || order.numero_ecommerce || order.tiny_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(order.data_pedido)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {order.cliente_nome || '-'}
                          </div>
                          {/* ✅ Exibir diretamente da coluna do Supabase */}
                          {order.cliente_telefone && (
                            <div className="text-xs text-muted-foreground">
                              📞 {order.cliente_telefone}
                            </div>
                          )}
                          {order.cliente_email && (
                            <div className="text-xs text-muted-foreground">
                              ✉️ {order.cliente_email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.vendedor_nome ? (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {order.vendedor_nome}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {formatCurrency(order.valor_total || 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.cashback_gerado && order.cashback_gerado > 0 ? (
                          <div className="flex items-center gap-1 text-green-600 font-medium">
                            <Gift className="h-3 w-3" />
                            {formatCurrency(order.cashback_gerado)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.cashback_validade ? (
                          <div className="text-xs">
                            {formatDate(order.cashback_validade)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, filteredOrders.length)} de {filteredOrders.length} pedidos
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

