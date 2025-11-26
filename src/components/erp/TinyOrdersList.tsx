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
import { Loader2, Search, Calendar, DollarSign, User, Package } from 'lucide-react';
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
  cliente_email: string | null; // ⚠️ Será removido na FASE 3
  valor_total: number;
  vendedor_nome: string | null;
  colaboradora_id: string | null;
  forma_pagamento: string | null;
  sync_at: string;
  // ✅ FASE 2: Dados completos do cliente via JOIN
  cliente?: {
    id: string;
    nome: string | null;
    telefone: string | null;
    email: string | null;
    cpf_cnpj: string | null;
  } | null;
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

  useEffect(() => {
    fetchOrders();
  }, [storeId]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter, dateFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // ✅ FASE 2: Fazer JOIN com tiny_contacts para obter dados completos do cliente
      let query = supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select(`
          *,
          cliente:tiny_contacts!cliente_id (
            id,
            nome,
            telefone,
            email,
            cpf_cnpj
          )
        `)
        .order('data_pedido', { ascending: false })
        .limit(limit);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Log detalhado dos dados recebidos do banco
      console.log('[TinyOrdersList] 📦 Dados recebidos do banco:', {
        total: data?.length || 0,
        primeiro_pedido: data?.[0] ? {
          id: data[0].id,
          tiny_id: data[0].tiny_id,
          numero_pedido: data[0].numero_pedido,
          valor_total: data[0].valor_total,
          valor_total_TIPO: typeof data[0].valor_total,
          data_pedido: data[0].data_pedido,
          data_pedido_TIPO: typeof data[0].data_pedido,
          cliente_nome: data[0].cliente_nome,
          cliente_cpf_cnpj: data[0].cliente_cpf_cnpj,
          vendedor_nome: data[0].vendedor_nome,
        } : null,
        todos_os_pedidos_valores: data?.slice(0, 5).map(o => ({
          numero: o.numero_pedido,
          valor: o.valor_total,
          data: o.data_pedido,
        })) || [],
        todas_as_chaves: data?.[0] ? Object.keys(data[0]) : [],
      });
      
      setOrders(data || []);
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
          order.cliente?.nome?.toLowerCase().includes(term) ||
          order.vendedor_nome?.toLowerCase().includes(term) ||
          order.cliente?.email?.toLowerCase().includes(term) ||
          order.cliente?.telefone?.toLowerCase().includes(term)
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
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
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
          Visualize os pedidos sincronizados do Tiny ERP ({filteredOrders.length} de {orders.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="mb-4 grid gap-4 md:grid-cols-3">
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
        </div>

        {/* Tabela */}
        {filteredOrders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum pedido encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
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
                          {order.cliente?.nome || order.cliente_nome || '-'}
                        </div>
                        {/* ✅ FASE 2: Usar dados do JOIN com tiny_contacts */}
                        {order.cliente?.telefone && (
                          <div className="text-xs text-muted-foreground">
                            📞 {order.cliente.telefone}
                          </div>
                        )}
                        {order.cliente?.email && (
                          <div className="text-xs text-muted-foreground">
                            ✉️ {order.cliente.email}
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

