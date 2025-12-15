/**
 * Página de Gestão de Cashback - REDESIGN COMPLETO
 * 
 * Inspirado no sistema Kikadi
 * 3 Tabs: Lançar, Clientes, Histórico Geral
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Gift,
  RefreshCw,
  Tag,
  Plus,
  X,
  Edit2,
  Filter,
  Calendar,
  Package,
  ShoppingBag,
  Download,
  FileSpreadsheet,
  FileText,
  Settings,
  Save
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import CashbackSettings from '@/components/erp/CashbackSettings';
import { CashbackWhatsAppQueue } from '@/components/admin/CashbackWhatsAppQueue';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  tags?: string[] | null;
  data_nascimento?: string | null;
  categoria?: string | null;
}

interface ClienteComMetricas extends Cliente {
  totalFaturamento?: number;
  ticketMedio?: number;
  pa?: number;
  parametroFiltro?: 'ticket_medio' | 'pa' | 'faturamento';
  amount?: number; // Valor bonificado
}

interface CashbackTransaction {
  id: string;
  cliente_id: string;
  tiny_order_id: string | null;
  transaction_type: 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADJUSTMENT';
  amount: number;
  description: string | null;
  data_liberacao: string | null;
  data_expiracao: string | null;
  renovado: boolean;
  created_at: string;
  tiny_order?: { numero_pedido: string | null };
}

interface ClienteComSaldo {
  cliente: Cliente;
  saldo_disponivel: number;
  saldo_pendente: number;
  total_earned: number;
  transactions: CashbackTransaction[];
}

export default function CashbackManagement() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lancar');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [stores, setStores] = useState<{ id: string; name: string; cashback_ativo?: boolean }[]>([]);

  // Estados para lançamento/resgate
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteLancar, setSelectedClienteLancar] = useState('');
  const [valorLancar, setValorLancar] = useState('');
  const [descricaoLancar, setDescricaoLancar] = useState('');
  const [lancando, setLancando] = useState(false);
  const [searchClienteLancar, setSearchClienteLancar] = useState('');

  const [selectedClienteResgatar, setSelectedClienteResgatar] = useState('');
  const [valorResgatar, setValorResgatar] = useState('');
  const [descricaoResgatar, setDescricaoResgatar] = useState('');
  const [resgatando, setResgatando] = useState(false);
  const [searchClienteResgatar, setSearchClienteResgatar] = useState('');

  // Estados para lista de clientes
  const [clientesComSaldo, setClientesComSaldo] = useState<ClienteComSaldo[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para filtros na aba Clientes
  interface FiltroClientes {
    tipo: 'melhores_clientes' | 'compra_periodo' | 'nao_visita' | 'aniversario' | 'tag' | 'todos' | 'categoria' | 'categoria_cliente' | 'produto';
    incluir: boolean;
    parametro?: 'ticket_medio' | 'pa' | 'faturamento';
    quantidade?: number;
    dataInicio?: string;
    dataFim?: string;
    mesAniversario?: number;
    tag?: string;
    categoria?: string; // Categoria de produto
    categoria_cliente?: string; // Categoria de cliente (BLACK, PLATINUM, VIP, REGULAR)
    produto?: string;
  }
  const [filtrosClientes, setFiltrosClientes] = useState<FiltroClientes[]>([]);
  const [filtrosClientesCumulativos, setFiltrosClientesCumulativos] = useState(true);
  const [clientesFiltradosClientes, setClientesFiltradosClientes] = useState<ClienteComMetricas[]>([]);
  const [loadingFiltrosClientes, setLoadingFiltrosClientes] = useState(false);
  const [editandoTags, setEditandoTags] = useState<string | null>(null);
  const [novaTag, setNovaTag] = useState('');
  const [salvandoTags, setSalvandoTags] = useState(false);
  const [bonificandoIndividual, setBonificandoIndividual] = useState<string | null>(null);
  const [categoriasProdutos, setCategoriasProdutos] = useState<string[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [valorBonificacaoIndividual, setValorBonificacaoIndividual] = useState('');
  const [descricaoBonificacaoIndividual, setDescricaoBonificacaoIndividual] = useState('');
  const [tipoValidadeBonificacaoIndividual, setTipoValidadeBonificacaoIndividual] = useState<'data' | 'dias'>('dias');
  const [dataExpiracaoBonificacaoIndividual, setDataExpiracaoBonificacaoIndividual] = useState('');
  const [diasValidadeBonificacaoIndividual, setDiasValidadeBonificacaoIndividual] = useState('30');

  // Estados para histórico geral
  const [historicoGeral, setHistoricoGeral] = useState<CashbackTransaction[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'EARNED' | 'REDEEMED' | 'EXPIRED'>('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterClientSearch, setFilterClientSearch] = useState('');

  // Estados para cancelamento
  const [canceling, setCanceling] = useState<string | null>(null);

  // Estados para Bonificar
  interface FiltroBonificacao {
    tipo: 'melhores_clientes' | 'compra_periodo' | 'nao_visita' | 'aniversario' | 'tag' | 'todos' | 'categoria' | 'categoria_cliente' | 'produto';
    incluir: boolean; // true = incluir, false = excluir
    parametro?: 'ticket_medio' | 'pa' | 'faturamento'; // Para melhores clientes
    quantidade?: number; // Para melhores clientes
    dataInicio?: string; // Para compra_periodo e nao_visita
    dataFim?: string; // Para compra_periodo
    mesAniversario?: number; // Para aniversario (1-12)
    tag?: string; // Para tag
    categoria?: string; // Para categoria de produto
    categoria_cliente?: string; // Para categoria de cliente (BLACK, PLATINUM, VIP, REGULAR)
    produto?: string; // Para produto
  }
  const [filtrosBonificacao, setFiltrosBonificacao] = useState<FiltroBonificacao[]>([]);
  const [filtrosCumulativos, setFiltrosCumulativos] = useState(true); // true = AND, false = OR
  const [clientesFiltrados, setClientesFiltrados] = useState<ClienteComMetricas[]>([]);
  const [loadingFiltros, setLoadingFiltros] = useState(false);
  const [searchClientesFiltrados, setSearchClientesFiltrados] = useState('');
  const [ultimaBonificacao, setUltimaBonificacao] = useState<(ClienteComMetricas & { amount: number })[]>([]);

  // Função para normalizar telefone
  const normalizarTelefone = (telefone: string | null): string => {
    if (!telefone) return '';
    // Remover tudo que não é número
    const apenasNumeros = telefone.replace(/\D/g, '');
    return apenasNumeros;
  };

  // Função para formatar telefone para WhatsApp (55 + DDD + número)
  const formatarTelefoneWhatsApp = (telefone: string | null): string => {
    const numeros = normalizarTelefone(telefone);
    if (numeros.length === 0) return '';

    // Se já começa com 55, retornar como está
    if (numeros.startsWith('55')) {
      return numeros;
    }

    // Se tem 11 dígitos (DDD + 9 dígitos), adicionar 55
    if (numeros.length === 11) {
      return `55${numeros}`;
    }

    // Se tem 10 dígitos (DDD + 8 dígitos), adicionar 55
    if (numeros.length === 10) {
      return `55${numeros}`;
    }

    // Caso contrário, retornar como está
    return numeros;
  };

  // Função para separar primeiro nome e sobrenome
  const separarNome = (nomeCompleto: string): { primeiroNome: string; sobrenome: string } => {
    const partes = nomeCompleto.trim().split(/\s+/);
    if (partes.length === 0) return { primeiroNome: '', sobrenome: '' };
    if (partes.length === 1) return { primeiroNome: partes[0], sobrenome: '' };

    const primeiroNome = partes[0];
    const sobrenome = partes.slice(1).join(' ');
    return { primeiroNome, sobrenome };
  };

  // Exportar Formato 1 - Normal (XLSX ou PDF)
  const exportarFormatoNormal = async (formato: 'xlsx' | 'pdf') => {
    if (ultimaBonificacao.length === 0) {
      toast.error('Nenhuma bonificação para exportar');
      return;
    }

    if (formato === 'xlsx') {
      const dados = ultimaBonificacao.map(c => ({
        'Nome Completo': c.nome,
        'Telefone': c.telefone || '',
        'Valor do Bônus': formatCurrency(c.amount || 0, { showSymbol: false }),
      }));

      const ws = XLSX.utils.json_to_sheet(dados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bonificação');

      const nomeArquivo = `bonificacao_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);
      toast.success('Arquivo XLSX exportado com sucesso!');
    } else {
      // PDF
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Relatório de Bonificação', 14, 20);
      doc.setFontSize(10);
      doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);

      const dados = ultimaBonificacao.map(c => [
        c.nome,
        c.telefone || '-',
        formatCurrency(c.amount || 0, { showSymbol: false }),
      ]);

      (doc as any).autoTable({
        head: [['Nome Completo', 'Telefone', 'Valor do Bônus']],
        body: dados,
        startY: 35,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
      });

      const nomeArquivo = `bonificacao_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.pdf`;
      doc.save(nomeArquivo);
      toast.success('Arquivo PDF exportado com sucesso!');
    }
  };

  // Exportar Formato 2 - WhatsApp (somente XLSX)
  const exportarFormatoWhatsApp = () => {
    if (ultimaBonificacao.length === 0) {
      toast.error('Nenhuma bonificação para exportar');
      return;
    }

    const dados = ultimaBonificacao.map(c => {
      const { primeiroNome, sobrenome } = separarNome(c.nome);
      const telefoneWhatsApp = formatarTelefoneWhatsApp(c.telefone);

      return {
        'Primeiro Nome': primeiroNome,
        'Sobrenome': sobrenome,
        'Telefone': telefoneWhatsApp,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bonificação WhatsApp');

    const nomeArquivo = `bonificacao_whatsapp_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
    toast.success('Arquivo XLSX (WhatsApp) exportado com sucesso!');
  };
  const [valorBonificacao, setValorBonificacao] = useState('');
  const [descricaoBonificacao, setDescricaoBonificacao] = useState('');
  const [bonificando, setBonificando] = useState(false);
  const [selectedClientesBonificar, setSelectedClientesBonificar] = useState<Set<string>>(new Set());
  const [tipoValidadeBonificacao, setTipoValidadeBonificacao] = useState<'data' | 'dias'>('dias');
  const [dataExpiracaoBonificacao, setDataExpiracaoBonificacao] = useState('');
  const [diasValidadeBonificacao, setDiasValidadeBonificacao] = useState('30');

  // KPIs
  const [kpis, setKpis] = useState({
    total_gerado: 0,
    total_clientes: 0,
    total_resgatado: 0,
    a_vencer_7d: 0,
  });

  const fetchCategoriasProdutos = async () => {
    try {
      setLoadingCategorias(true);
      // Buscar itens dos últimos 1000 pedidos para extrair categorias
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('itens')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const categoriasSet = new Set<string>();

      data?.forEach((order: any) => {
        try {
          const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens || [];
          if (Array.isArray(itens)) {
            itens.forEach((item: any) => {
              if (item.categoria && typeof item.categoria === 'string' && item.categoria.trim() !== '') {
                categoriasSet.add(item.categoria.trim());
              }
            });
          }
        } catch (e) {
          console.warn('Erro ao processar itens do pedido:', e);
        }
      });

      // Extrair categorias únicas
      const categoriasUnicas = Array.from(categoriasSet).sort();
      setCategoriasProdutos(categoriasUnicas);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      toast.error('Erro ao carregar categorias de produtos');
    } finally {
      setLoadingCategorias(false);
    }
  };

  useEffect(() => {
    if (!authLoading && profile) {
      fetchStores();
    }
  }, [authLoading, profile]);

  useEffect(() => {
    if (!authLoading && profile && selectedStoreId) {
      fetchData();
      fetchCategoriasProdutos();
    }
  }, [authLoading, profile, selectedStoreId]);

  const [hasActiveCashback, setHasActiveCashback] = useState(false);

  const fetchStores = async () => {
    try {
      let query = supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name, cashback_ativo')
        .eq('active', true)
        .order('name');

      // Se for LOJA, filtrar apenas sua loja
      if (profile?.role === 'LOJA' && profile.store_id) {
        query = query.eq('id', profile.store_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setStores(data);
        
        // Verificar se há pelo menos uma loja com cashback ativo
        const hasActive = data.some(store => store.cashback_ativo === true);
        setHasActiveCashback(hasActive);
        console.log('[CashbackManagement] Lojas carregadas:', {
          total: data.length,
          comCashbackAtivo: data.filter(s => s.cashback_ativo === true).length,
          lojas: data.map(s => ({ name: s.name, cashback_ativo: s.cashback_ativo }))
        });
        
        // Auto-selecionar primeira loja (sempre uma loja específica)
        if (data.length > 0) {
          setSelectedStoreId(data[0].id);
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      toast.error('Erro ao carregar lojas');
    }
  };

  const fetchData = async () => {
    if (!selectedStoreId) {
      console.warn('[CashbackManagement] selectedStoreId não definido, abortando fetchData');
      return;
    }

    try {
      setLoading(true);
      console.log('[CashbackManagement] fetchData iniciado, selectedStoreId:', selectedStoreId);

      // Buscar TODAS as clientes (com e sem saldo) - filtrar por loja se selecionada
      // Filtrar apenas clientes ativos (se existir coluna active, senão buscar todos)
      let clientesQuery = supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('id, nome, cpf_cnpj, telefone, email, tags, data_nascimento, store_id')
        .not('cpf_cnpj', 'is', null)
        .neq('cpf_cnpj', '');
      
      // Filtrar por loja selecionada
      if (selectedStoreId) {
        clientesQuery = clientesQuery.eq('store_id', selectedStoreId);
      }
      
      // Ordenar por nome
      clientesQuery = clientesQuery.order('nome');

      const { data: allClientes, error: clientesError } = await clientesQuery;

      if (clientesError) throw clientesError;
      setClientes(allClientes || []);

      // Buscar saldos - filtrar por loja selecionada
      let balances: any[] = [];
      let balancesError: any = null;
      
      if (selectedStoreId) {
        // Filtrar saldos de clientes da loja selecionada
        const clienteIds = (allClientes || []).map(c => c.id);
        if (clienteIds.length > 0) {
          // Dividir em chunks de 100 para evitar URL muito longa
          const CHUNK_SIZE = 100;
          const chunks: string[][] = [];
          for (let i = 0; i < clienteIds.length; i += CHUNK_SIZE) {
            chunks.push(clienteIds.slice(i, i + CHUNK_SIZE));
          }
          
          // Fazer queries em paralelo para cada chunk
          const balancePromises = chunks.map(chunk => 
            supabase
              .schema('sistemaretiradas')
              .from('cashback_balance')
              .select('*')
              .in('cliente_id', chunk)
          );
          
          const balanceResults = await Promise.all(balancePromises);
          
          // Combinar resultados e verificar erros
          for (const result of balanceResults) {
            if (result.error) {
              balancesError = result.error;
              break;
            }
            if (result.data) {
              balances.push(...result.data);
            }
          }
        }
        // Se não houver clientes, balances já está como array vazio
      }

      if (balancesError) throw balancesError;

      // Buscar todas as transações - filtrar por loja selecionada
      let transactions: any[] = [];
      let transactionsError: any = null;
      
      if (selectedStoreId) {
        // Filtrar transações de clientes da loja selecionada
        const clienteIds = (allClientes || []).map(c => c.id);
        if (clienteIds.length > 0) {
          // Dividir em chunks de 100 para evitar URL muito longa
          const CHUNK_SIZE = 100;
          const chunks: string[][] = [];
          for (let i = 0; i < clienteIds.length; i += CHUNK_SIZE) {
            chunks.push(clienteIds.slice(i, i + CHUNK_SIZE));
          }
          
          // Fazer queries em paralelo para cada chunk
          const transactionPromises = chunks.map(chunk => 
            supabase
              .schema('sistemaretiradas')
              .from('cashback_transactions')
              .select(`
                *,
                tiny_order:tiny_order_id (numero_pedido)
              `)
              .in('cliente_id', chunk)
              .order('created_at', { ascending: false })
          );
          
          const transactionResults = await Promise.all(transactionPromises);
          
          // Combinar resultados e verificar erros
          for (const result of transactionResults) {
            if (result.error) {
              transactionsError = result.error;
              break;
            }
            if (result.data) {
              transactions.push(...result.data);
            }
          }
          
          // Ordenar todas as transações por created_at após combinar
          transactions.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA; // Descendente
          });
        }
        // Se não houver clientes, transactions já está como array vazio
      }

      if (transactionsError) throw transactionsError;

      // Buscar pedidos para calcular categoria - filtrar por loja selecionada
      let ordersQuery = supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_id, valor_total');
      
      if (selectedStoreId) {
        ordersQuery = ordersQuery.eq('store_id', selectedStoreId);
      }

      const { data: ordersData } = await ordersQuery;

      // Calcular total de compras por cliente
      const totalComprasPorCliente = new Map<string, number>();
      ordersData?.forEach((order: any) => {
        if (order.cliente_id) {
          const atual = totalComprasPorCliente.get(order.cliente_id) || 0;
          totalComprasPorCliente.set(order.cliente_id, atual + parseFloat(order.valor_total || 0));
        }
      });

      // Função para obter categoria do cliente (do maior para o menor)
      const obterCategoriaCliente = (clienteId: string): string | null => {
        const totalCompras = totalComprasPorCliente.get(clienteId) || 0;
        if (totalCompras > 10000) return 'BLACK';
        if (totalCompras >= 5000) return 'PLATINUM';
        if (totalCompras >= 1000) return 'VIP';
        if (totalCompras > 0) return 'REGULAR';
        return null;
      };

      // Combinar clientes com saldos e transações
      const clientesComSaldoData: ClienteComSaldo[] = (allClientes || []).map(cliente => {
        const balance = (balances || []).find(b => b.cliente_id === cliente.id);
        const clienteTransactions = (transactions || []).filter(t => t.cliente_id === cliente.id);
        const categoria = obterCategoriaCliente(cliente.id);

        return {
          cliente: { ...cliente, categoria },
          saldo_disponivel: balance?.balance_disponivel || 0,
          saldo_pendente: balance?.balance_pendente || 0,
          total_earned: balance?.total_earned || 0,
          transactions: clienteTransactions,
        };
      });

      setClientesComSaldo(clientesComSaldoData);
      setHistoricoGeral(transactions || []);

      // Calcular KPIs
      const totalGerado = (transactions || [])
        .filter(t => t.transaction_type === 'EARNED')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalResgatado = (transactions || [])
        .filter(t => t.transaction_type === 'REDEEMED')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const aVencer7d = (transactions || [])
        .filter(t => {
          if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
          const expDate = new Date(t.data_expiracao);
          const now = new Date();
          const diff = expDate.getTime() - now.getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          return days > 0 && days <= 7;
        })
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setKpis({
        total_gerado: totalGerado,
        total_clientes: clientesComSaldoData.length,
        total_resgatado: totalResgatado,
        a_vencer_7d: aVencer7d,
      });

    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      const errorMessage = error?.message || error?.error_description || error?.details || 'Erro desconhecido';
      console.error('Detalhes do erro:', {
        message: errorMessage,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        fullError: error
      });
      toast.error(`Erro ao carregar dados de cashback: ${errorMessage}`);
      // Em caso de erro, limpar dados para evitar inconsistências
      setClientes([]);
      setClientesComSaldo([]);
      setHistoricoGeral([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLancar = async () => {
    if (!selectedClienteLancar || !valorLancar) {
      toast.error('Preencha cliente e valor');
      return;
    }

    setLancando(true);
    try {
      const valorCompra = parseFloat(valorLancar);
      if (valorCompra <= 0) {
        toast.error('Valor deve ser maior que zero');
        setLancando(false);
        return;
      }

      // ✅ 1. Validar se cliente tem CPF
      const cliente = clientes.find(c => c.id === selectedClienteLancar);
      if (!cliente || !cliente.cpf_cnpj || cliente.cpf_cnpj.trim() === '') {
        toast.error('Cliente sem CPF/CNPJ. Cashback não pode ser lançado.');
        setLancando(false);
        return;
      }

      // ✅ 2. Buscar configurações de cashback (global)
      const { data: settingsData, error: settingsError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('*')
        .is('store_id', null)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      // Se não tem configuração global, usar padrão
      const settings = settingsData || {
        percentual_cashback: 15.00,
        prazo_liberacao_dias: 2,
        prazo_expiracao_dias: 30,
      };

      // ✅ 3. Calcular valor do cashback e arredondar para cima (sem centavos)
      // Exemplo: 152.15 -> 153 | 77.07 -> 78
      const cashbackAmount = Math.ceil((valorCompra * parseFloat(settings.percentual_cashback.toString())) / 100);

      if (cashbackAmount <= 0) {
        toast.error('Valor de cashback zero ou negativo');
        setLancando(false);
        return;
      }

      // ✅ 4. Calcular datas no fuso horário de Macapá (UTC-3)
      const agora = new Date();
      // Ajustar para UTC-3 (Macapá)
      const macapaOffset = -3 * 60; // -3 horas em minutos
      const macapaTime = new Date(agora.getTime() + (macapaOffset - agora.getTimezoneOffset()) * 60000);

      const dataLiberacao = new Date(macapaTime);
      dataLiberacao.setDate(dataLiberacao.getDate() + settings.prazo_liberacao_dias);

      const dataExpiracao = new Date(dataLiberacao);
      dataExpiracao.setDate(dataExpiracao.getDate() + settings.prazo_expiracao_dias);

      // ✅ 5. Inserir diretamente na tabela cashback_transactions
      const { error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: selectedClienteLancar,
          tiny_order_id: null, // Lançamento manual não tem pedido vinculado
          transaction_type: 'EARNED',
          amount: cashbackAmount,
          description: descricaoLancar || 'Lançamento manual de cashback',
          data_liberacao: dataLiberacao.toISOString(),
          data_expiracao: dataExpiracao.toISOString(),
          store_id: selectedStoreId, // ✅ Associar à loja selecionada
        });

      if (insertError) throw insertError;

      // ✅ O trigger do banco vai atualizar o saldo automaticamente

      toast.success(`✅ Cashback lançado: ${formatCurrency(cashbackAmount)}`);
      setSelectedClienteLancar('');
      setValorLancar('');
      setDescricaoLancar('');
      setSearchClienteLancar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao lançar cashback:', error);
      toast.error(error.message || 'Erro ao lançar cashback');
    } finally {
      setLancando(false);
    }
  };

  const handleResgatar = async () => {
    if (!selectedClienteResgatar || !valorResgatar) {
      toast.error('Preencha cliente e valor');
      return;
    }

    setResgatando(true);
    try {
      const valorResgate = parseFloat(valorResgatar);
      if (valorResgate <= 0) {
        toast.error('Valor deve ser maior que zero');
        setResgatando(false);
        return;
      }

      // ✅ 1. Buscar saldo disponível do cliente
      const { data: balanceData, error: balanceError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_balance')
        .select('balance_disponivel')
        .eq('cliente_id', selectedClienteResgatar)
        .single();

      if (balanceError && balanceError.code !== 'PGRST116') {
        throw balanceError;
      }

      const balanceDisponivel = balanceData?.balance_disponivel || 0;

      if (balanceDisponivel === 0) {
        toast.error('Cliente não possui saldo de cashback');
        setResgatando(false);
        return;
      }

      if (balanceDisponivel < valorResgate) {
        toast.error(`Saldo insuficiente. Disponível: ${formatCurrency(balanceDisponivel)}`);
        setResgatando(false);
        return;
      }

      // ✅ 2. Inserir diretamente na tabela cashback_transactions
      // Usar horário de Macapá (UTC-3)
      const agora = new Date();
      const macapaOffset = -3 * 60; // -3 horas em minutos
      const macapaTime = new Date(agora.getTime() + (macapaOffset - agora.getTimezoneOffset()) * 60000);

      const { error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: selectedClienteResgatar,
          tiny_order_id: null,
          transaction_type: 'REDEEMED',
          amount: valorResgate,
          description: descricaoResgatar || 'Resgate manual de cashback',
          data_liberacao: macapaTime.toISOString(), // Resgate é imediato
          data_expiracao: null, // Resgate não expira
        });

      if (insertError) throw insertError;

      // ✅ O trigger do banco vai atualizar o saldo automaticamente

      toast.success(`✅ Cashback resgatado: ${formatCurrency(valorResgate)}`);
      setSelectedClienteResgatar('');
      setValorResgatar('');
      setDescricaoResgatar('');
      setSearchClienteResgatar('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao resgatar cashback:', error);
      toast.error(error.message || 'Erro ao resgatar cashback');
    } finally {
      setResgatando(false);
    }
  };

  const handleCancelar = async (transactionId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta transação?')) return;

    setCanceling(transactionId);
    try {
      const { data, error } = await supabase.rpc('cancelar_transacao_cashback', {
        p_transaction_id: transactionId,
      });

      if (error) throw error;

      if (data.success) {
        toast.success('✅ Transação cancelada com sucesso');
        await fetchData();
      } else {
        toast.error(`❌ ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao cancelar transação:', error);
      toast.error('Erro ao cancelar transação');
    } finally {
      setCanceling(null);
    }
  };

  const handleRenovar = async (clienteId: string) => {
    // Buscar transação expirada mais recente do cliente
    const cliente = clientesComSaldo.find(c => c.cliente.id === clienteId);
    if (!cliente) return;

    const expiredTransaction = cliente.transactions.find(t =>
      t.transaction_type === 'EARNED' &&
      t.data_expiracao &&
      new Date(t.data_expiracao) < new Date()
    );

    if (!expiredTransaction) {
      toast.error('Nenhum cashback expirado encontrado');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('renovar_cashback', {
        p_transaction_id: expiredTransaction.id,
        p_cliente_id: clienteId,
      });

      if (error) throw error;

      if (data.success) {
        toast.success('✅ Cashback renovado com sucesso');
        await fetchData();
      } else {
        toast.error(`❌ ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao renovar cashback:', error);
      toast.error('Erro ao renovar cashback');
    }
  };

  const toggleClientExpanded = (clienteId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clienteId)) {
      newExpanded.delete(clienteId);
    } else {
      newExpanded.add(clienteId);
    }
    setExpandedClients(newExpanded);
  };

  const filteredClientes = useMemo(() => {
    return clientesComSaldo.filter(c => {
      const searchLower = searchTerm.toLowerCase();
      return (
        c.cliente.nome.toLowerCase().includes(searchLower) ||
        c.cliente.cpf_cnpj?.toLowerCase().includes(searchLower) ||
        c.cliente.telefone?.toLowerCase().includes(searchLower)
      );
    });
  }, [clientesComSaldo, searchTerm]);

  const filteredHistorico = useMemo(() => {
    let filtered = historicoGeral;

    // Filtro por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.transaction_type === filterType);
    }

    // Filtro por data
    if (filterDateStart) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(filterDateStart));
    }
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.created_at) <= endDate);
    }

    // Filtro por cliente (nome ou CPF)
    if (filterClientSearch) {
      const searchLower = filterClientSearch.toLowerCase();
      filtered = filtered.filter(t => {
        const cliente = clientes.find(c => c.id === t.cliente_id);
        return (
          cliente?.nome.toLowerCase().includes(searchLower) ||
          cliente?.cpf_cnpj?.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [historicoGeral, filterType, filterDateStart, filterDateEnd, filterClientSearch, clientes]);

  const cashbackPreview = useMemo(() => {
    if (!valorLancar) return 0;
    return parseFloat(valorLancar) * 0.15; // 15%
  }, [valorLancar]);

  const saldoClienteResgatar = useMemo(() => {
    if (!selectedClienteResgatar) return 0;
    const cliente = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);
    return cliente?.saldo_disponivel || 0;
  }, [selectedClienteResgatar, clientesComSaldo]);

  // Filtrar clientes para busca progressiva
  const filteredClientesLancar = useMemo(() => {
    if (!searchClienteLancar) return [];
    const searchLower = searchClienteLancar.toLowerCase();
    return clientes
      .filter(c =>
        c.nome.toLowerCase().includes(searchLower) ||
        c.cpf_cnpj?.toLowerCase().includes(searchLower) ||
        c.telefone?.toLowerCase().includes(searchLower)
      )
      .slice(0, 10); // Limitar a 10 resultados
  }, [clientes, searchClienteLancar]);

  const filteredClientesResgatar = useMemo(() => {
    if (!searchClienteResgatar) return [];
    const searchLower = searchClienteResgatar.toLowerCase();
    return clientes
      .filter(c =>
        c.nome.toLowerCase().includes(searchLower) ||
        c.cpf_cnpj?.toLowerCase().includes(searchLower) ||
        c.telefone?.toLowerCase().includes(searchLower)
      )
      .slice(0, 10); // Limitar a 10 resultados
  }, [clientes, searchClienteResgatar]);

  // Função para salvar tags de um cliente
  const handleSalvarTags = async (clienteId: string, tags: string[]) => {
    setSalvandoTags(true);
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .update({ tags: tags.length > 0 ? tags : null })
        .eq('id', clienteId);

      if (error) throw error;

      // Atualizar lista de clientes
      setClientes(prev => prev.map(c =>
        c.id === clienteId ? { ...c, tags: tags.length > 0 ? tags : null } : c
      ));

      toast.success('Tags atualizadas com sucesso!');
      setEditandoTags(null);
      setNovaTag('');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao salvar tags:', error);
      toast.error('Erro ao salvar tags: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSalvandoTags(false);
    }
  };

  // Função para adicionar tag
  const handleAdicionarTag = (clienteId: string, tagsAtuais: string[] = []) => {
    if (!novaTag.trim()) return;
    const tagLimpa = novaTag.trim();
    if (!tagsAtuais.includes(tagLimpa)) {
      handleSalvarTags(clienteId, [...tagsAtuais, tagLimpa]);
    } else {
      toast.error('Tag já existe');
      setNovaTag('');
    }
  };

  // Função para remover tag
  const handleRemoverTag = (clienteId: string, tagRemover: string, tagsAtuais: string[] = []) => {
    handleSalvarTags(clienteId, tagsAtuais.filter(t => t !== tagRemover));
  };

  // Função para bonificar cliente individual
  const handleBonificarIndividual = async (clienteId: string) => {
    if (!valorBonificacaoIndividual || parseFloat(valorBonificacaoIndividual) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (tipoValidadeBonificacaoIndividual === 'data' && !dataExpiracaoBonificacaoIndividual) {
      toast.error('Informe a data de expiração');
      return;
    }

    if (tipoValidadeBonificacaoIndividual === 'dias' && (!diasValidadeBonificacaoIndividual || parseInt(diasValidadeBonificacaoIndividual) <= 0)) {
      toast.error('Informe o número de dias de validade');
      return;
    }

    setBonificandoIndividual(clienteId);
    try {
      const { data: settingsData } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('*')
        .is('store_id', null)
        .single();

      const settings = settingsData || {
        prazo_liberacao_dias: 2,
      };

      const valorBonificacaoNum = parseFloat(valorBonificacaoIndividual);
      const agora = new Date();
      const macapaOffset = -3 * 60;
      const macapaTime = new Date(agora.getTime() + (macapaOffset - agora.getTimezoneOffset()) * 60000);

      const dataLiberacao = new Date(macapaTime);
      dataLiberacao.setDate(dataLiberacao.getDate() + settings.prazo_liberacao_dias);

      let dataExpiracao: Date;
      if (tipoValidadeBonificacaoIndividual === 'data') {
        dataExpiracao = new Date(dataExpiracaoBonificacaoIndividual + 'T23:59:59');
      } else {
        dataExpiracao = new Date(dataLiberacao);
        dataExpiracao.setDate(dataExpiracao.getDate() + parseInt(diasValidadeBonificacaoIndividual));
      }

      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert({
          cliente_id: clienteId,
          tiny_order_id: null,
          transaction_type: 'EARNED' as const,
          amount: valorBonificacaoNum,
          description: `BONIFICAÇÃO: ${descricaoBonificacaoIndividual || 'Bonificação individual'}`,
          data_liberacao: dataLiberacao.toISOString(),
          data_expiracao: dataExpiracao.toISOString(),
        });

      if (error) throw error;

      toast.success(`✅ Cliente bonificado com ${formatCurrency(valorBonificacaoNum)}`);
      setValorBonificacaoIndividual('');
      setDescricaoBonificacaoIndividual('');
      setTipoValidadeBonificacaoIndividual('dias');
      setDataExpiracaoBonificacaoIndividual('');
      setDiasValidadeBonificacaoIndividual('30');
      setBonificandoIndividual(null);
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao bonificar:', error);
      toast.error('Erro ao bonificar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setBonificandoIndividual(null);
    }
  };

  // Função para aplicar filtros na aba Clientes (reutiliza lógica da bonificação)
  const aplicarFiltrosClientes = async () => {
    if (filtrosClientes.length === 0) {
      toast.error('Adicione pelo menos um filtro');
      return;
    }

    setLoadingFiltrosClientes(true);
    try {
      // Reutilizar a mesma lógica de aplicarFiltrosBonificacao
      // Buscar todos os pedidos para análise
      const { data: orders, error: ordersError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_id, cliente_nome, cliente_cpf_cnpj, data_pedido, valor_total, itens');

      if (ordersError) throw ordersError;

      // Agrupar pedidos por cliente (mesma lógica da bonificação)
      const clienteMap = new Map<string, {
        cliente: Cliente;
        pedidos: any[];
        totalFaturamento: number;
        ticketMedio: number;
        pa: number;
        ultimaCompra: string | null;
        categorias: Set<string>;
        produtos: Set<string>;
      }>();

      // Processar pedidos (mesma lógica)
      orders?.forEach((order: any) => {
        if (!order.cliente_id) return;

        const clienteId = order.cliente_id;
        if (!clienteMap.has(clienteId)) {
          const cliente = clientes.find(c => c.id === clienteId);
          if (!cliente) return;
          clienteMap.set(clienteId, {
            cliente,
            pedidos: [],
            totalFaturamento: 0,
            ticketMedio: 0,
            pa: 0,
            ultimaCompra: null,
            categorias: new Set(),
            produtos: new Set(),
          });
        }

        const clienteData = clienteMap.get(clienteId)!;
        clienteData.pedidos.push(order);
        const valorPedido = parseFloat(order.valor_total || 0);
        if (!isNaN(valorPedido) && isFinite(valorPedido)) {
          clienteData.totalFaturamento += valorPedido;
        }

        // Processar itens
        if (order.itens && Array.isArray(order.itens)) {
          order.itens.forEach((item: any) => {
            if (item.categoria || item.categoria_produto) {
              clienteData.categorias.add(item.categoria || item.categoria_produto);
            }
            if (item.produto_id || item.produto_nome) {
              clienteData.produtos.add(item.produto_id || item.produto_nome);
            }
          });
        }

        if (!clienteData.ultimaCompra || order.data_pedido > clienteData.ultimaCompra) {
          clienteData.ultimaCompra = order.data_pedido;
        }
      });

      // Calcular métricas
      clienteMap.forEach((data) => {
        const qtdPedidos = data.pedidos.length;
        data.ticketMedio = qtdPedidos > 0 ? data.totalFaturamento / qtdPedidos : 0;

        const totalPecas = data.pedidos.reduce((sum, p) => {
          if (p.itens && Array.isArray(p.itens)) {
            return sum + p.itens.reduce((s: number, i: any) => s + (parseFloat(i.quantidade || 0)), 0);
          }
          return sum;
        }, 0);
        data.pa = qtdPedidos > 0 ? totalPecas / qtdPedidos : 0;
      });

      // Aplicar filtros (mesma lógica da bonificação)
      let clientesFiltradosSet = new Set<string>();

      if (filtrosClientesCumulativos) {
        const todosClientes = Array.from(clienteMap.keys());
        clientesFiltradosSet = new Set(todosClientes);

        for (const filtro of filtrosClientes) {
          const clientesFiltro = new Set<string>();

          switch (filtro.tipo) {
            case 'melhores_clientes': {
              const clientesArray = Array.from(clienteMap.entries())
                .map(([id, data]) => ({
                  id,
                  cliente: data.cliente,
                  pedidos: data.pedidos,
                  totalFaturamento: data.totalFaturamento || 0,
                  ticketMedio: data.ticketMedio || 0,
                  pa: data.pa || 0,
                  ultimaCompra: data.ultimaCompra,
                  categorias: data.categorias,
                  produtos: data.produtos,
                }));

              let sorted = [];
              if (filtro.parametro === 'ticket_medio') {
                sorted = clientesArray.sort((a, b) => (b.ticketMedio || 0) - (a.ticketMedio || 0));
              } else if (filtro.parametro === 'pa') {
                sorted = clientesArray.sort((a, b) => (b.pa || 0) - (a.pa || 0));
              } else if (filtro.parametro === 'faturamento') {
                sorted = clientesArray.sort((a, b) => (b.totalFaturamento || 0) - (a.totalFaturamento || 0));
              }

              const topClientes = sorted.slice(0, filtro.quantidade || 10);
              topClientes.forEach(c => clientesFiltro.add(c.id));
              break;
            }
            case 'compra_periodo': {
              if (filtro.dataInicio && filtro.dataFim) {
                clienteMap.forEach((data, id) => {
                  const temCompraNoPeriodo = data.pedidos.some((p: any) => {
                    const dataPedido = p.data_pedido;
                    return dataPedido >= filtro.dataInicio! && dataPedido <= filtro.dataFim!;
                  });
                  if (temCompraNoPeriodo) clientesFiltro.add(id);
                });
              }
              break;
            }
            case 'nao_visita': {
              if (filtro.dataInicio) {
                clienteMap.forEach((data, id) => {
                  if (!data.ultimaCompra || data.ultimaCompra < filtro.dataInicio!) {
                    clientesFiltro.add(id);
                  }
                });
              }
              break;
            }
            case 'aniversario': {
              const { data: clientesComNascimento } = await supabase
                .schema('sistemaretiradas')
                .from('tiny_contacts')
                .select('id, data_nascimento')
                .not('data_nascimento', 'is', null);

              if (clientesComNascimento && filtro.mesAniversario) {
                clientesComNascimento.forEach((c: any) => {
                  if (c.data_nascimento) {
                    const nascimento = new Date(c.data_nascimento);
                    if (nascimento.getMonth() + 1 === filtro.mesAniversario) {
                      clientesFiltro.add(c.id);
                    }
                  }
                });
              }
              break;
            }
            case 'tag': {
              const { data: clientesComTag } = await supabase
                .schema('sistemaretiradas')
                .from('tiny_contacts')
                .select('id, tags')
                .contains('tags', [filtro.tag || '']);

              if (clientesComTag) {
                clientesComTag.forEach((c: any) => {
                  clientesFiltro.add(c.id);
                });
              }
              break;
            }
            case 'todos': {
              clienteMap.forEach((_, id) => clientesFiltro.add(id));
              break;
            }
            case 'categoria': {
              // Categoria de PRODUTO (não de cliente)
              clienteMap.forEach((data, id) => {
                if (data.categorias.has(filtro.categoria || '')) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
            case 'categoria_cliente': {
              // Categoria de CLIENTE (BLACK, PLATINUM, VIP, REGULAR)
              const obterCategoriaCliente = (totalFaturamento: number): string | null => {
                if (totalFaturamento > 10000) return 'BLACK';
                if (totalFaturamento >= 5000) return 'PLATINUM';
                if (totalFaturamento >= 1000) return 'VIP';
                if (totalFaturamento > 0) return 'REGULAR';
                return null;
              };

              clienteMap.forEach((data, id) => {
                const categoriaCliente = obterCategoriaCliente(data.totalFaturamento || 0);
                if (categoriaCliente === filtro.categoria_cliente) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
            case 'produto': {
              clienteMap.forEach((data, id) => {
                if (data.produtos.has(filtro.produto || '')) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
          }

          if (filtro.incluir) {
            clientesFiltradosSet = new Set(
              Array.from(clientesFiltradosSet).filter(id => clientesFiltro.has(id))
            );
          } else {
            clientesFiltro.forEach(id => clientesFiltradosSet.delete(id));
          }
        }
      } else {
        // OR logic (similar to bonificação)
        const clientesPorFiltro: Set<string>[] = [];

        for (const filtro of filtrosClientes) {
          const clientesFiltro = new Set<string>();

          // Aplicar a mesma lógica de filtros (similar à bonificação)
          switch (filtro.tipo) {
            case 'melhores_clientes': {
              const clientesArray = Array.from(clienteMap.entries())
                .map(([id, data]) => ({
                  id,
                  cliente: data.cliente,
                  pedidos: data.pedidos,
                  totalFaturamento: data.totalFaturamento || 0,
                  ticketMedio: data.ticketMedio || 0,
                  pa: data.pa || 0,
                  ultimaCompra: data.ultimaCompra,
                  categorias: data.categorias,
                  produtos: data.produtos,
                }));

              let sorted = [];
              if (filtro.parametro === 'ticket_medio') {
                sorted = clientesArray.sort((a, b) => (b.ticketMedio || 0) - (a.ticketMedio || 0));
              } else if (filtro.parametro === 'pa') {
                sorted = clientesArray.sort((a, b) => (b.pa || 0) - (a.pa || 0));
              } else if (filtro.parametro === 'faturamento') {
                sorted = clientesArray.sort((a, b) => (b.totalFaturamento || 0) - (a.totalFaturamento || 0));
              }

              const topClientes = sorted.slice(0, filtro.quantidade || 10);
              topClientes.forEach(c => clientesFiltro.add(c.id));
              break;
            }
            case 'tag': {
              const { data: clientesComTag } = await supabase
                .schema('sistemaretiradas')
                .from('tiny_contacts')
                .select('id, tags')
                .contains('tags', [filtro.tag || '']);

              if (clientesComTag) {
                clientesComTag.forEach((c: any) => {
                  clientesFiltro.add(c.id);
                });
              }
              break;
            }
            // ... outros casos similares
          }

          if (filtro.incluir) {
            clientesPorFiltro.push(clientesFiltro);
          } else {
            clientesFiltro.forEach(id => clientesFiltradosSet.delete(id));
          }
        }

        if (clientesPorFiltro.length > 0) {
          clientesPorFiltro.forEach(filtroSet => {
            filtroSet.forEach(id => clientesFiltradosSet.add(id));
          });
        }
      }

      // Converter para array de clientes com métricas
      const clientesFiltradosArray: ClienteComMetricas[] = Array.from(clientesFiltradosSet)
        .map(id => {
          const data = clienteMap.get(id);
          if (!data) return null;
          return {
            ...data.cliente,
            totalFaturamento: data.totalFaturamento,
            ticketMedio: data.ticketMedio,
            pa: data.pa,
            parametroFiltro: filtrosClientes.find(f => f.tipo === 'melhores_clientes')?.parametro,
          };
        })
        .filter((c): c is ClienteComMetricas => c !== null);

      // Ordenar do maior para o menor
      if (filtrosClientes.some(f => f.tipo === 'melhores_clientes')) {
        const filtroMelhores = filtrosClientes.find(f => f.tipo === 'melhores_clientes');
        if (filtroMelhores?.parametro === 'ticket_medio') {
          clientesFiltradosArray.sort((a, b) => (b.ticketMedio || 0) - (a.ticketMedio || 0));
        } else if (filtroMelhores?.parametro === 'pa') {
          clientesFiltradosArray.sort((a, b) => (b.pa || 0) - (a.pa || 0));
        } else if (filtroMelhores?.parametro === 'faturamento') {
          clientesFiltradosArray.sort((a, b) => (b.totalFaturamento || 0) - (a.totalFaturamento || 0));
        }
      }

      setClientesFiltradosClientes(clientesFiltradosArray);
      toast.success(`${clientesFiltradosArray.length} cliente(s) encontrado(s)`);
    } catch (error: any) {
      console.error('Erro ao aplicar filtros:', error);
      toast.error('Erro ao aplicar filtros: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoadingFiltrosClientes(false);
    }
  };

  // Funções auxiliares para filtros de clientes
  const adicionarFiltroCliente = () => {
    setFiltrosClientes([...filtrosClientes, {
      tipo: 'todos',
      incluir: true,
    }]);
  };

  const removerFiltroCliente = (index: number) => {
    setFiltrosClientes(filtrosClientes.filter((_, i) => i !== index));
  };

  const atualizarFiltroCliente = (index: number, updates: Partial<FiltroClientes>) => {
    const novosFiltros = [...filtrosClientes];
    novosFiltros[index] = { ...novosFiltros[index], ...updates };
    setFiltrosClientes(novosFiltros);
  };

  // Função para aplicar filtros de bonificação
  const aplicarFiltrosBonificacao = async () => {
    if (filtrosBonificacao.length === 0) {
      toast.error('Adicione pelo menos um filtro');
      return;
    }

    setLoadingFiltros(true);
    try {
      // Buscar todos os pedidos para análise
      const { data: orders, error: ordersError } = await supabase
        .schema('sistemaretiradas')
        .from('tiny_orders')
        .select('cliente_id, cliente_nome, cliente_cpf_cnpj, data_pedido, valor_total, itens');

      if (ordersError) throw ordersError;

      // Agrupar pedidos por cliente
      const clienteMap = new Map<string, {
        cliente: Cliente;
        pedidos: any[];
        totalFaturamento: number;
        ticketMedio: number;
        pa: number; // Peças por Atendimento
        ultimaCompra: string | null;
        categorias: Set<string>;
        produtos: Set<string>;
      }>();

      // Função auxiliar para converter valores monetários
      const parseMoney = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        if (typeof val === 'string') {
          // Remover R$, espaços e substituir vírgula por ponto
          const clean = val.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };

      // Processar pedidos
      orders?.forEach((order: any) => {
        if (!order.cliente_id) return;

        const clienteId = order.cliente_id;
        if (!clienteMap.has(clienteId)) {
          const cliente = clientes.find(c => c.id === clienteId);
          if (!cliente) return;
          clienteMap.set(clienteId, {
            cliente,
            pedidos: [],
            totalFaturamento: 0,
            ticketMedio: 0,
            pa: 0,
            ultimaCompra: null,
            categorias: new Set(),
            produtos: new Set(),
          });
        }

        const clienteData = clienteMap.get(clienteId)!;
        clienteData.pedidos.push(order);

        // ✅ CORREÇÃO: Usar parseMoney para garantir valor correto
        const valorPedido = parseMoney(order.valor_total);
        if (valorPedido > 0) {
          clienteData.totalFaturamento += valorPedido;
        }

        // ✅ CORREÇÃO: Processar itens com parse JSON robusto
        let itens: any[] = [];
        try {
          itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens || [];
        } catch (e) {
          console.warn('Erro ao fazer parse dos itens:', e);
          itens = [];
        }

        if (Array.isArray(itens)) {
          itens.forEach((item: any) => {
            if (item.categoria && typeof item.categoria === 'string') {
              clienteData.categorias.add(item.categoria.trim());
            }
            // Tentar pegar nome do produto de várias formas
            const nomeProduto = item.descricao || item.produto_nome || item.nome;
            if (nomeProduto && typeof nomeProduto === 'string') {
              clienteData.produtos.add(nomeProduto.trim());
            }
            // Tentar pegar ID do produto
            const idProduto = item.id || item.produto_id || item.codigo;
            if (idProduto) {
              clienteData.produtos.add(String(idProduto));
            }
          });
        }

        // ✅ CORREÇÃO: Extrair data do pedido corretamente
        let dataPedido = order.data_pedido;
        if (dataPedido) {
          // Se for string ISO, pegar apenas a parte da data YYYY-MM-DD
          if (typeof dataPedido === 'string' && dataPedido.includes('T')) {
            dataPedido = dataPedido.split('T')[0];
          }

          if (!clienteData.ultimaCompra || dataPedido > clienteData.ultimaCompra) {
            clienteData.ultimaCompra = dataPedido;
          }

          // Normalizar data no objeto do pedido para facilitar filtros
          order.data_pedido_normalizada = dataPedido;
        }
      });

      // Calcular métricas
      clienteMap.forEach((data) => {
        const qtdPedidos = data.pedidos.length;
        data.ticketMedio = qtdPedidos > 0 ? data.totalFaturamento / qtdPedidos : 0;

        // Calcular PA (peças por atendimento)
        const totalPecas = data.pedidos.reduce((sum, p) => {
          let itens: any[] = [];
          try {
            itens = typeof p.itens === 'string' ? JSON.parse(p.itens) : p.itens || [];
          } catch (e) { itens = []; }

          if (Array.isArray(itens)) {
            return sum + itens.reduce((s: number, i: any) => s + (parseFloat(i.quantidade || 0)), 0);
          }
          return sum;
        }, 0);
        data.pa = qtdPedidos > 0 ? totalPecas / qtdPedidos : 0;
      });

      // Aplicar filtros
      let clientesFiltradosSet = new Set<string>();

      if (filtrosCumulativos) {
        // AND: Todos os filtros devem ser satisfeitos
        const todosClientes = Array.from(clienteMap.keys());
        clientesFiltradosSet = new Set(todosClientes);

        // Usar for...of async para permitir await
        for (const filtro of filtrosBonificacao) {
          const clientesFiltro = new Set<string>();

          switch (filtro.tipo) {
            case 'melhores_clientes': {
              const clientesArray = Array.from(clienteMap.entries())
                .map(([id, data]) => ({
                  id,
                  cliente: data.cliente,
                  pedidos: data.pedidos,
                  totalFaturamento: data.totalFaturamento || 0,
                  ticketMedio: data.ticketMedio || 0,
                  pa: data.pa || 0,
                  ultimaCompra: data.ultimaCompra,
                  categorias: data.categorias,
                  produtos: data.produtos,
                }));

              let sorted = [];
              if (filtro.parametro === 'ticket_medio') {
                sorted = clientesArray.sort((a, b) => (b.ticketMedio || 0) - (a.ticketMedio || 0));
              } else if (filtro.parametro === 'pa') {
                sorted = clientesArray.sort((a, b) => (b.pa || 0) - (a.pa || 0));
              } else if (filtro.parametro === 'faturamento') {
                sorted = clientesArray.sort((a, b) => (b.totalFaturamento || 0) - (a.totalFaturamento || 0));
              }

              const topClientes = sorted.slice(0, filtro.quantidade || 10);
              topClientes.forEach(c => clientesFiltro.add(c.id));
              break;
            }
            case 'compra_periodo': {
              if (filtro.dataInicio && filtro.dataFim) {
                clienteMap.forEach((data, id) => {
                  const temCompraNoPeriodo = data.pedidos.some((p: any) => {
                    const dataPedido = p.data_pedido;
                    return dataPedido >= filtro.dataInicio! && dataPedido <= filtro.dataFim!;
                  });
                  if (temCompraNoPeriodo) clientesFiltro.add(id);
                });
              }
              break;
            }
            case 'nao_visita': {
              if (filtro.dataInicio) {
                clienteMap.forEach((data, id) => {
                  if (!data.ultimaCompra || data.ultimaCompra < filtro.dataInicio!) {
                    clientesFiltro.add(id);
                  }
                });
              }
              break;
            }
            case 'aniversario': {
              // Buscar clientes com data de nascimento
              const { data: clientesComNascimento } = await supabase
                .schema('sistemaretiradas')
                .from('tiny_contacts')
                .select('id, data_nascimento')
                .not('data_nascimento', 'is', null);

              if (clientesComNascimento && filtro.mesAniversario) {
                clientesComNascimento.forEach((c: any) => {
                  if (c.data_nascimento) {
                    const nascimento = new Date(c.data_nascimento);
                    if (nascimento.getMonth() + 1 === filtro.mesAniversario) {
                      clientesFiltro.add(c.id);
                    }
                  }
                });
              }
              break;
            }
            case 'tag': {
              // Buscar clientes com tag específica
              const { data: clientesComTag } = await supabase
                .schema('sistemaretiradas')
                .from('tiny_contacts')
                .select('id, tags')
                .contains('tags', [filtro.tag || '']);

              if (clientesComTag) {
                clientesComTag.forEach((c: any) => {
                  clientesFiltro.add(c.id);
                });
              }
              break;
            }
            case 'todos': {
              clienteMap.forEach((_, id) => clientesFiltro.add(id));
              break;
            }
            case 'categoria': {
              // Categoria de PRODUTO (não de cliente)
              clienteMap.forEach((data, id) => {
                if (data.categorias.has(filtro.categoria || '')) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
            case 'categoria_cliente': {
              // Categoria de CLIENTE (BLACK, PLATINUM, VIP, REGULAR)
              const obterCategoriaCliente = (totalFaturamento: number): string | null => {
                if (totalFaturamento > 10000) return 'BLACK';
                if (totalFaturamento >= 5000) return 'PLATINUM';
                if (totalFaturamento >= 1000) return 'VIP';
                if (totalFaturamento > 0) return 'REGULAR';
                return null;
              };

              clienteMap.forEach((data, id) => {
                const categoriaCliente = obterCategoriaCliente(data.totalFaturamento || 0);
                if (categoriaCliente === filtro.categoria_cliente) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
            case 'produto': {
              clienteMap.forEach((data, id) => {
                if (data.produtos.has(filtro.produto || '')) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
          }

          // Aplicar filtro (incluir ou excluir)
          if (filtro.incluir) {
            // Intersecção (AND)
            clientesFiltradosSet = new Set(
              Array.from(clientesFiltradosSet).filter(id => clientesFiltro.has(id))
            );
          } else {
            // Excluir
            clientesFiltro.forEach(id => clientesFiltradosSet.delete(id));
          }
        }
      } else {
        // OR: Pelo menos um filtro deve ser satisfeito
        const clientesPorFiltro: Set<string>[] = [];

        for (const filtro of filtrosBonificacao) {
          const clientesFiltro = new Set<string>();

          // Aplicar a mesma lógica de filtros
          switch (filtro.tipo) {
            case 'melhores_clientes': {
              const clientesArray = Array.from(clienteMap.entries())
                .map(([id, data]) => ({
                  id,
                  cliente: data.cliente,
                  pedidos: data.pedidos,
                  totalFaturamento: data.totalFaturamento || 0,
                  ticketMedio: data.ticketMedio || 0,
                  pa: data.pa || 0,
                  ultimaCompra: data.ultimaCompra,
                  categorias: data.categorias,
                  produtos: data.produtos,
                }));

              let sorted = [];
              if (filtro.parametro === 'ticket_medio') {
                sorted = clientesArray.sort((a, b) => (b.ticketMedio || 0) - (a.ticketMedio || 0));
              } else if (filtro.parametro === 'pa') {
                sorted = clientesArray.sort((a, b) => (b.pa || 0) - (a.pa || 0));
              } else if (filtro.parametro === 'faturamento') {
                sorted = clientesArray.sort((a, b) => (b.totalFaturamento || 0) - (a.totalFaturamento || 0));
              }

              const topClientes = sorted.slice(0, filtro.quantidade || 10);
              topClientes.forEach(c => clientesFiltro.add(c.id));
              break;
            }
            case 'compra_periodo': {
              if (filtro.dataInicio && filtro.dataFim) {
                clienteMap.forEach((data, id) => {
                  const temCompraNoPeriodo = data.pedidos.some((p: any) => {
                    const dataPedido = p.data_pedido;
                    return dataPedido >= filtro.dataInicio! && dataPedido <= filtro.dataFim!;
                  });
                  if (temCompraNoPeriodo) clientesFiltro.add(id);
                });
              }
              break;
            }
            case 'nao_visita': {
              if (filtro.dataInicio) {
                clienteMap.forEach((data, id) => {
                  if (!data.ultimaCompra || data.ultimaCompra < filtro.dataInicio!) {
                    clientesFiltro.add(id);
                  }
                });
              }
              break;
            }
            case 'aniversario': {
              const { data: clientesComNascimento } = await supabase
                .schema('sistemaretiradas')
                .from('tiny_contacts')
                .select('id, data_nascimento')
                .not('data_nascimento', 'is', null);

              if (clientesComNascimento && filtro.mesAniversario) {
                clientesComNascimento.forEach((c: any) => {
                  if (c.data_nascimento) {
                    const nascimento = new Date(c.data_nascimento);
                    if (nascimento.getMonth() + 1 === filtro.mesAniversario) {
                      clientesFiltro.add(c.id);
                    }
                  }
                });
              }
              break;
            }
            case 'tag': {
              const { data: clientesComTag } = await supabase
                .schema('sistemaretiradas')
                .from('tiny_contacts')
                .select('id, tags')
                .contains('tags', [filtro.tag || '']);

              if (clientesComTag) {
                clientesComTag.forEach((c: any) => {
                  clientesFiltro.add(c.id);
                });
              }
              break;
            }
            case 'todos': {
              clienteMap.forEach((_, id) => clientesFiltro.add(id));
              break;
            }
            case 'categoria': {
              // Categoria de PRODUTO (não de cliente)
              clienteMap.forEach((data, id) => {
                if (data.categorias.has(filtro.categoria || '')) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
            case 'categoria_cliente': {
              // Categoria de CLIENTE (BLACK, PLATINUM, VIP, REGULAR)
              const obterCategoriaCliente = (totalFaturamento: number): string | null => {
                if (totalFaturamento > 10000) return 'BLACK';
                if (totalFaturamento >= 5000) return 'PLATINUM';
                if (totalFaturamento >= 1000) return 'VIP';
                if (totalFaturamento > 0) return 'REGULAR';
                return null;
              };

              clienteMap.forEach((data, id) => {
                const categoriaCliente = obterCategoriaCliente(data.totalFaturamento || 0);
                if (categoriaCliente === filtro.categoria_cliente) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
            case 'produto': {
              clienteMap.forEach((data, id) => {
                if (data.produtos.has(filtro.produto || '')) {
                  clientesFiltro.add(id);
                }
              });
              break;
            }
          }

          if (filtro.incluir) {
            clientesPorFiltro.push(clientesFiltro);
          } else {
            // Para exclusão em OR, remover dos resultados finais
            clientesFiltro.forEach(id => clientesFiltradosSet.delete(id));
          }
        }

        // União de todos os filtros de inclusão (OR)
        if (clientesPorFiltro.length > 0) {
          clientesPorFiltro.forEach(filtroSet => {
            filtroSet.forEach(id => clientesFiltradosSet.add(id));
          });
        }
      }

      // Converter para array de clientes com métricas
      const clientesFiltradosArray: ClienteComMetricas[] = Array.from(clientesFiltradosSet)
        .map(id => {
          const data = clienteMap.get(id);
          if (!data) return null;
          return {
            ...data.cliente,
            totalFaturamento: data.totalFaturamento,
            ticketMedio: data.ticketMedio,
            pa: data.pa,
            parametroFiltro: filtrosBonificacao.find(f => f.tipo === 'melhores_clientes')?.parametro,
          };
        })
        .filter((c): c is ClienteComMetricas => c !== null);

      // Ordenar do maior para o menor baseado no parâmetro do filtro
      if (filtrosBonificacao.some(f => f.tipo === 'melhores_clientes')) {
        const filtroMelhores = filtrosBonificacao.find(f => f.tipo === 'melhores_clientes');
        if (filtroMelhores?.parametro === 'ticket_medio') {
          clientesFiltradosArray.sort((a, b) => (b.ticketMedio || 0) - (a.ticketMedio || 0));
        } else if (filtroMelhores?.parametro === 'pa') {
          clientesFiltradosArray.sort((a, b) => (b.pa || 0) - (a.pa || 0));
        } else if (filtroMelhores?.parametro === 'faturamento') {
          clientesFiltradosArray.sort((a, b) => (b.totalFaturamento || 0) - (a.totalFaturamento || 0));
        }
      }

      setClientesFiltrados(clientesFiltradosArray);
      toast.success(`${clientesFiltradosArray.length} cliente(s) encontrado(s)`);
    } catch (error: any) {
      console.error('Erro ao aplicar filtros:', error);
      toast.error('Erro ao aplicar filtros: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoadingFiltros(false);
    }
  };

  // Adicionar novo filtro
  const adicionarFiltro = () => {
    setFiltrosBonificacao([...filtrosBonificacao, {
      tipo: 'todos',
      incluir: true,
    }]);
  };

  // Remover filtro
  const removerFiltro = (index: number) => {
    setFiltrosBonificacao(filtrosBonificacao.filter((_, i) => i !== index));
  };

  // Atualizar filtro
  const atualizarFiltro = (index: number, updates: Partial<FiltroBonificacao>) => {
    const novosFiltros = [...filtrosBonificacao];
    novosFiltros[index] = { ...novosFiltros[index], ...updates };
    setFiltrosBonificacao(novosFiltros);
  };

  // Bonificar clientes selecionados
  const handleBonificar = async () => {
    if (selectedClientesBonificar.size === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }

    if (!valorBonificacao || parseFloat(valorBonificacao) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    // Validar prazo de validade
    if (tipoValidadeBonificacao === 'data' && !dataExpiracaoBonificacao) {
      toast.error('Informe a data de expiração');
      return;
    }

    if (tipoValidadeBonificacao === 'dias' && (!diasValidadeBonificacao || parseInt(diasValidadeBonificacao) <= 0)) {
      toast.error('Informe o número de dias de validade');
      return;
    }

    setBonificando(true);
    try {
      // Buscar configurações de cashback (apenas para prazo de liberação)
      const { data: settingsData } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_settings')
        .select('*')
        .is('store_id', null)
        .single();

      const settings = settingsData || {
        prazo_liberacao_dias: 2,
      };

      const valorBonificacaoNum = parseFloat(valorBonificacao);
      const agora = new Date();
      const macapaOffset = -3 * 60;
      const macapaTime = new Date(agora.getTime() + (macapaOffset - agora.getTimezoneOffset()) * 60000);

      // Data de liberação (usa configuração padrão)
      const dataLiberacao = new Date(macapaTime);
      dataLiberacao.setDate(dataLiberacao.getDate() + settings.prazo_liberacao_dias);

      // Data de expiração (usa configuração específica da bonificação)
      let dataExpiracao: Date;
      if (tipoValidadeBonificacao === 'data') {
        // Usar data específica informada
        dataExpiracao = new Date(dataExpiracaoBonificacao + 'T23:59:59');
      } else {
        // Usar dias de validade
        dataExpiracao = new Date(dataLiberacao);
        dataExpiracao.setDate(dataExpiracao.getDate() + parseInt(diasValidadeBonificacao));
      }

      // Inserir transações para todos os clientes selecionados
      // Usar description com prefixo "BONIFICAÇÃO:" para identificar
      const transacoes = Array.from(selectedClientesBonificar).map(clienteId => ({
        cliente_id: clienteId,
        tiny_order_id: null,
        transaction_type: 'EARNED' as const,
        amount: valorBonificacaoNum,
        description: `BONIFICAÇÃO: ${descricaoBonificacao || 'Bonificação em massa'}`,
        data_liberacao: dataLiberacao.toISOString(),
        data_expiracao: dataExpiracao.toISOString(),
      }));

      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('cashback_transactions')
        .insert(transacoes);

      if (error) throw error;

      // Salvar lista de clientes bonificados para exportação
      const clientesBonificados = clientesFiltrados.filter(c => selectedClientesBonificar.has(c.id));
      setUltimaBonificacao(clientesBonificados.map(c => ({ ...c, amount: valorBonificacaoNum })));

      toast.success(`✅ ${transacoes.length} cliente(s) bonificado(s) com ${formatCurrency(valorBonificacaoNum)} cada`);
      setSelectedClientesBonificar(new Set());
      setValorBonificacao('');
      setDescricaoBonificacao('');
      setTipoValidadeBonificacao('dias');
      setDataExpiracaoBonificacao('');
      setDiasValidadeBonificacao('30');
      await fetchData();
    } catch (error: any) {
      console.error('Erro ao bonificar:', error);
      toast.error('Erro ao bonificar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setBonificando(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Verificar se há lojas com cashback ativo
  // Verificar se a loja selecionada tem cashback ativo
  const selectedStore = selectedStoreId 
    ? stores.find(s => s.id === selectedStoreId)
    : null;
  
  const selectedStoreHasCashback = selectedStore?.cashback_ativo === true;
  
  console.log('[CashbackManagement] Verificação de cashback:', {
    selectedStoreId,
    hasActiveCashback,
    selectedStore: selectedStore ? { name: selectedStore.name, cashback_ativo: selectedStore.cashback_ativo } : null,
    selectedStoreHasCashback,
    storesLength: stores.length
  });
  
  if (stores.length > 0 && !selectedStoreHasCashback) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Gift className="h-8 w-8 text-primary" />
                Gestão de Cashback
              </h1>
              <p className="text-muted-foreground">Gerencie o programa de cashback dos seus clientes</p>
            </div>
          </div>
        </div>

        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Módulo Cashback Desativado
            </CardTitle>
            <CardDescription className="text-orange-600 dark:text-orange-300">
              {selectedStore 
                ? `O módulo de cashback não está ativo para a loja "${selectedStore.name}".`
                : 'O módulo de cashback não está ativo para nenhuma loja no momento.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Para utilizar o sistema de cashback, é necessário ativar o módulo primeiro na aba <strong>Configurações → Módulos do Sistema</strong>.
            </p>
            <Button
              onClick={() => {
                // Navegar para a aba de configurações
                navigate('/admin', { state: { tab: 'configuracoes', scrollTo: 'modules' } });
              }}
              variant="default"
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Ir para Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Gift className="h-8 w-8 text-primary" />
              Gestão de Cashback
            </h1>
            <p className="text-muted-foreground">Gerencie o programa de cashback dos seus clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stores.length > 0 && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashback Gerado</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.total_gerado)}</div>
            <p className="text-xs text-muted-foreground">Total histórico</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{kpis.total_clientes}</div>
            <p className="text-xs text-muted-foreground">Total cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resgatado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpis.total_resgatado)}</div>
            <p className="text-xs text-muted-foreground">Total utilizado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Vencer (7 dias)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.a_vencer_7d)}</div>
            <p className="text-xs text-muted-foreground">Expira na próxima semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
          <TabsTrigger value="lancar" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[55px] justify-center">Lançar</TabsTrigger>
          <TabsTrigger value="clientes" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[55px] justify-center">Clientes</TabsTrigger>
          <TabsTrigger value="historico" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[70px] justify-center">Histórico</TabsTrigger>
          <TabsTrigger value="bonificar" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">Bonificar</TabsTrigger>
          <TabsTrigger value="fila" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[55px] justify-center">Fila</TabsTrigger>
          <TabsTrigger value="configuracoes" className="text-[10px] sm:text-xs px-2 py-1.5 flex-1 min-w-[60px] justify-center">Config</TabsTrigger>
        </TabsList>

        {/* TAB 1: LANÇAR */}
        <TabsContent value="lancar" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card Pontuar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Pontuar
                </CardTitle>
                <CardDescription>Lançar cashback manualmente para uma cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente-lancar">Cliente *</Label>
                  {!selectedClienteLancar ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cliente-lancar"
                          placeholder="Digite nome, CPF ou telefone..."
                          value={searchClienteLancar}
                          onChange={(e) => setSearchClienteLancar(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {searchClienteLancar && filteredClientesLancar.length > 0 && (
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          {filteredClientesLancar.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedClienteLancar(c.id);
                                setSearchClienteLancar('');
                              }}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            >
                              <div className="font-medium">{c.nome}</div>
                              <div className="text-sm text-muted-foreground">{c.cpf_cnpj}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchClienteLancar && filteredClientesLancar.length === 0 && (
                        <div className="text-sm text-muted-foreground p-2">Nenhum cliente encontrado</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium">{clientes.find(c => c.id === selectedClienteLancar)?.nome}</div>
                        <div className="text-sm text-muted-foreground">{clientes.find(c => c.id === selectedClienteLancar)?.cpf_cnpj}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClienteLancar('')}
                      >
                        Alterar
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor-lancar">Valor da Compra *</Label>
                  <Input
                    id="valor-lancar"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valorLancar}
                    onChange={(e) => setValorLancar(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao-lancar">Descrição (opcional)</Label>
                  <Input
                    id="descricao-lancar"
                    placeholder="Ex: Compra em loja física"
                    value={descricaoLancar}
                    onChange={(e) => setDescricaoLancar(e.target.value)}
                  />
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    Cashback a gerar: <strong>{formatCurrency(cashbackPreview)}</strong>
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleLancar}
                  disabled={lancando || !selectedClienteLancar || !valorLancar}
                >
                  {lancando ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lançando...</>
                  ) : (
                    'LANÇAR'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Card Resgatar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-orange-600" />
                  Resgatar
                </CardTitle>
                <CardDescription>Resgatar cashback manualmente de uma cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente-resgatar">Cliente *</Label>
                  {!selectedClienteResgatar ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cliente-resgatar"
                          placeholder="Digite nome, CPF ou telefone..."
                          value={searchClienteResgatar}
                          onChange={(e) => setSearchClienteResgatar(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {searchClienteResgatar && filteredClientesResgatar.length > 0 && (
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          {filteredClientesResgatar.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedClienteResgatar(c.id);
                                setSearchClienteResgatar('');
                              }}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            >
                              <div className="font-medium">{c.nome}</div>
                              <div className="text-sm text-muted-foreground">{c.cpf_cnpj}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchClienteResgatar && filteredClientesResgatar.length === 0 && (
                        <div className="text-sm text-muted-foreground p-2">Nenhum cliente encontrado</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium">{clientes.find(c => c.id === selectedClienteResgatar)?.nome}</div>
                        <div className="text-sm text-muted-foreground">{clientes.find(c => c.id === selectedClienteResgatar)?.cpf_cnpj}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClienteResgatar('')}
                      >
                        Alterar
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor-resgatar">Valor a Resgatar *</Label>
                  <Input
                    id="valor-resgatar"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={valorResgatar}
                    onChange={(e) => setValorResgatar(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao-resgatar">Descrição (opcional)</Label>
                  <Input
                    id="descricao-resgatar"
                    placeholder="Ex: Desconto aplicado em compra"
                    value={descricaoResgatar}
                    onChange={(e) => setDescricaoResgatar(e.target.value)}
                  />
                </div>

                <div className="p-3 bg-orange-50 rounded-lg space-y-1">
                  <p className="text-sm text-orange-800">
                    Saldo disponível: <strong>{formatCurrency(saldoClienteResgatar)}</strong>
                  </p>
                  {selectedClienteResgatar && (() => {
                    const cliente = clientesComSaldo.find(c => c.cliente.id === selectedClienteResgatar);
                    const saldoPendente = cliente?.saldo_pendente || 0;
                    if (saldoPendente > 0) {
                      return (
                        <p className="text-xs text-orange-700">
                          ⏳ Pendente: {formatCurrency(saldoPendente)} (será liberado em até 2 dias)
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={handleResgatar}
                  disabled={resgatando || !selectedClienteResgatar || !valorResgatar}
                >
                  {resgatando ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Resgatando...</>
                  ) : (
                    'RESGATAR'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: CLIENTES */}
        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todas as Clientes</CardTitle>
              <CardDescription>Lista completa de clientes (com e sem saldo)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filtros Avançados */}
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Filtros Avançados</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Modo:</Label>
                        <Select
                          value={filtrosClientesCumulativos ? 'and' : 'or'}
                          onValueChange={(v) => setFiltrosClientesCumulativos(v === 'and')}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="and">E (AND)</SelectItem>
                            <SelectItem value="or">OU (OR)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={adicionarFiltroCliente} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Filtro
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Filtros */}
                  {filtrosClientes.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border rounded-lg">
                      <Filter className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum filtro adicionado. Clique em "Adicionar Filtro" para começar.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtrosClientes.map((filtro, index) => (
                        <Card key={index} className="border-2">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1">
                                    <Label>Tipo de Filtro</Label>
                                    <Select
                                      value={filtro.tipo}
                                      onValueChange={(v: any) => atualizarFiltroCliente(index, { tipo: v })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="melhores_clientes">Melhores Clientes</SelectItem>
                                        <SelectItem value="compra_periodo">Compra entre Datas</SelectItem>
                                        <SelectItem value="nao_visita">Não Visita Desde</SelectItem>
                                        <SelectItem value="aniversario">Aniversário no Mês</SelectItem>
                                        <SelectItem value="tag">Cliente com Tag</SelectItem>
                                        <SelectItem value="todos">Todos os Clientes</SelectItem>
                                        <SelectItem value="categoria">Comprou Categoria de Produto</SelectItem>
                                        <SelectItem value="categoria_cliente">Categoria de Cliente</SelectItem>
                                        <SelectItem value="produto">Comprou Produto</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Ação</Label>
                                    <Select
                                      value={filtro.incluir ? 'incluir' : 'excluir'}
                                      onValueChange={(v) => atualizarFiltroCliente(index, { incluir: v === 'incluir' })}
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="incluir">Incluir</SelectItem>
                                        <SelectItem value="excluir">Excluir</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removerFiltroCliente(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Parâmetros específicos (mesmos da bonificação) */}
                                {filtro.tipo === 'melhores_clientes' && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Parâmetro</Label>
                                      <Select
                                        value={filtro.parametro || 'faturamento'}
                                        onValueChange={(v: any) => atualizarFiltroCliente(index, { parametro: v })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ticket_medio">Ticket Médio</SelectItem>
                                          <SelectItem value="pa">PA (Peças/Atendimento)</SelectItem>
                                          <SelectItem value="faturamento">Faturamento</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>Quantidade</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={filtro.quantidade || 10}
                                        onChange={(e) => atualizarFiltroCliente(index, { quantidade: parseInt(e.target.value) || 10 })}
                                      />
                                    </div>
                                  </div>
                                )}

                                {filtro.tipo === 'compra_periodo' && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Data Início</Label>
                                      <Input
                                        type="date"
                                        value={filtro.dataInicio || ''}
                                        onChange={(e) => atualizarFiltroCliente(index, { dataInicio: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label>Data Fim</Label>
                                      <Input
                                        type="date"
                                        value={filtro.dataFim || ''}
                                        onChange={(e) => atualizarFiltroCliente(index, { dataFim: e.target.value })}
                                      />
                                    </div>
                                  </div>
                                )}

                                {filtro.tipo === 'nao_visita' && (
                                  <div>
                                    <Label>Não Visita Desde</Label>
                                    <Input
                                      type="date"
                                      value={filtro.dataInicio || ''}
                                      onChange={(e) => atualizarFiltroCliente(index, { dataInicio: e.target.value })}
                                    />
                                  </div>
                                )}

                                {filtro.tipo === 'aniversario' && (
                                  <div>
                                    <Label>Mês do Aniversário</Label>
                                    <Select
                                      value={filtro.mesAniversario?.toString() || ''}
                                      onValueChange={(v) => atualizarFiltroCliente(index, { mesAniversario: parseInt(v) })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione o mês" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => (
                                          <SelectItem key={mes} value={mes.toString()}>
                                            {format(new Date(2024, mes - 1, 1), 'MMMM', { locale: ptBR })}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {filtro.tipo === 'tag' && (
                                  <div>
                                    <Label>Tag</Label>
                                    <Input
                                      placeholder="Digite a tag"
                                      value={filtro.tag || ''}
                                      onChange={(e) => atualizarFiltroCliente(index, { tag: e.target.value })}
                                    />
                                  </div>
                                )}

                                {filtro.tipo === 'categoria' && (
                                  <div>
                                    <Label>Categoria de Produto</Label>
                                    <Select
                                      value={filtro.categoria || ''}
                                      onValueChange={(v) => atualizarFiltroCliente(index, { categoria: v })}
                                      disabled={loadingCategorias}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder={loadingCategorias ? "Carregando..." : "Selecione a categoria"} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {categoriasProdutos.length === 0 && !loadingCategorias ? (
                                          <SelectItem value="" disabled>Nenhuma categoria encontrada</SelectItem>
                                        ) : (
                                          categoriasProdutos.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                              {cat}
                                            </SelectItem>
                                          ))
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {filtro.tipo === 'categoria_cliente' && (
                                  <div>
                                    <Label>Categoria de Cliente</Label>
                                    <Select
                                      value={filtro.categoria_cliente || ''}
                                      onValueChange={(v) => atualizarFiltroCliente(index, { categoria_cliente: v })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione a categoria" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="BLACK">BLACK</SelectItem>
                                        <SelectItem value="PLATINUM">PLATINUM</SelectItem>
                                        <SelectItem value="VIP">VIP</SelectItem>
                                        <SelectItem value="REGULAR">REGULAR</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                {filtro.tipo === 'produto' && (
                                  <div>
                                    <Label>Produto</Label>
                                    <Input
                                      placeholder="Digite o nome ou ID do produto"
                                      value={filtro.produto || ''}
                                      onChange={(e) => atualizarFiltroCliente(index, { produto: e.target.value })}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={aplicarFiltrosClientes}
                    disabled={loadingFiltrosClientes || filtrosClientes.length === 0}
                    className="w-full"
                  >
                    {loadingFiltrosClientes ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Aplicando Filtros...
                      </>
                    ) : (
                      <>
                        <Filter className="h-4 w-4 mr-2" />
                        Aplicar Filtros
                      </>
                    )}
                  </Button>
                </div>

                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente (nome, CPF, telefone)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Lista de Clientes */}
                <div className="space-y-2">
                  {(() => {
                    // Se houver filtros aplicados, usar clientesFiltradosClientes
                    // Caso contrário, usar filteredClientes normal
                    const clientesParaExibir = clientesFiltradosClientes.length > 0
                      ? clientesFiltradosClientes.map(c => {
                        const clienteComSaldo = clientesComSaldo.find(cs => cs.cliente.id === c.id);
                        return clienteComSaldo || {
                          cliente: c,
                          saldo_disponivel: 0,
                          saldo_pendente: 0,
                          transactions: [],
                        };
                      })
                      : filteredClientes;

                    if (clientesParaExibir.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          {clientesFiltradosClientes.length > 0
                            ? 'Nenhuma cliente encontrada com os filtros aplicados'
                            : 'Nenhuma cliente encontrada'}
                        </div>
                      );
                    }

                    return clientesParaExibir.map(({ cliente, saldo_disponivel, saldo_pendente, transactions }) => {
                      const aVencer = transactions.filter(t => {
                        if (t.transaction_type !== 'EARNED' || !t.data_expiracao) return false;
                        const expDate = new Date(t.data_expiracao);
                        const now = new Date();
                        const diff = expDate.getTime() - now.getTime();
                        const days = diff / (1000 * 60 * 60 * 24);
                        return days > 0 && days <= 7;
                      }).reduce((sum, t) => sum + Number(t.amount), 0);

                      const temExpirado = transactions.some(t =>
                        t.transaction_type === 'EARNED' &&
                        t.data_expiracao &&
                        new Date(t.data_expiracao) < new Date()
                      );

                      return (
                        <Collapsible
                          key={cliente.id}
                          open={expandedClients.has(cliente.id)}
                          onOpenChange={() => toggleClientExpanded(cliente.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                              <div className="flex items-center gap-3">
                                {expandedClients.has(cliente.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <div className="flex-1">
                                  <div className="font-medium">{cliente.nome}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {cliente.cpf_cnpj} • {transactions.length} transações
                                  </div>
                                  {/* Tags e Categoria */}
                                  {(cliente.tags && cliente.tags.length > 0) || cliente.categoria ? (
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {cliente.tags && cliente.tags.length > 0 && (
                                        cliente.tags.map((tag, idx) => (
                                          <Badge key={idx} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))
                                      )}
                                      {cliente.categoria && (
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                          {cliente.categoria}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">
                                  💰 {formatCurrency(saldo_disponivel)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {saldo_pendente > 0 && `⏳ Pendente: ${formatCurrency(saldo_pendente)}`}
                                  {aVencer > 0 && ` • ⚠️ A vencer: ${formatCurrency(aVencer)}`}
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 border-t pt-4 px-4 space-y-4">
                              {/* Histórico - Foco Principal */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold">Histórico de Transações</h4>
                                  <div className="flex items-center gap-2">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => e.stopPropagation()}
                                          className="h-7 text-xs"
                                        >
                                          <Tag className="h-3 w-3 mr-1" />
                                          Tags
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent onClick={(e) => e.stopPropagation()}>
                                        <DialogHeader>
                                          <DialogTitle>Gerenciar Tags</DialogTitle>
                                          <DialogDescription>
                                            Adicione ou remova tags para {cliente.nome}
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                          {cliente.tags && cliente.tags.length > 0 && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {cliente.tags.map((tag, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                                                  {tag}
                                                  <button
                                                    onClick={() => handleRemoverTag(cliente.id, tag, cliente.tags || [])}
                                                    className="hover:text-red-600 ml-1"
                                                    disabled={salvandoTags}
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </Badge>
                                              ))}
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <Input
                                              placeholder="Digite a nova tag"
                                              value={novaTag}
                                              onChange={(e) => setNovaTag(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  handleAdicionarTag(cliente.id, cliente.tags || []);
                                                }
                                              }}
                                            />
                                            <Button
                                              onClick={() => handleAdicionarTag(cliente.id, cliente.tags || [])}
                                              disabled={salvandoTags || !novaTag.trim()}
                                            >
                                              <Plus className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => e.stopPropagation()}
                                          className="h-7 text-xs"
                                        >
                                          <Gift className="h-3 w-3 mr-1" />
                                          Bonificar
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-md">
                                        <DialogHeader>
                                          <DialogTitle>Bonificar Cliente</DialogTitle>
                                          <DialogDescription>
                                            Adicione uma bonificação para {cliente.nome}
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                          <div className="space-y-2">
                                            <Label>Valor da Bonificação *</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              placeholder="0,00"
                                              value={valorBonificacaoIndividual}
                                              onChange={(e) => setValorBonificacaoIndividual(e.target.value)}
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Descrição (opcional)</Label>
                                            <Input
                                              placeholder="Ex: Bonificação especial"
                                              value={descricaoBonificacaoIndividual}
                                              onChange={(e) => setDescricaoBonificacaoIndividual(e.target.value)}
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <Label>Prazo de Validade</Label>
                                            <div className="flex items-center gap-4">
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="radio"
                                                  id={`validade-dias-${cliente.id}`}
                                                  name={`tipo-validade-${cliente.id}`}
                                                  checked={tipoValidadeBonificacaoIndividual === 'dias'}
                                                  onChange={() => setTipoValidadeBonificacaoIndividual('dias')}
                                                  className="w-4 h-4"
                                                />
                                                <Label htmlFor={`validade-dias-${cliente.id}`} className="font-normal cursor-pointer text-sm">
                                                  Válido por X dias
                                                </Label>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="radio"
                                                  id={`validade-data-${cliente.id}`}
                                                  name={`tipo-validade-${cliente.id}`}
                                                  checked={tipoValidadeBonificacaoIndividual === 'data'}
                                                  onChange={() => setTipoValidadeBonificacaoIndividual('data')}
                                                  className="w-4 h-4"
                                                />
                                                <Label htmlFor={`validade-data-${cliente.id}`} className="font-normal cursor-pointer text-sm">
                                                  Válido até data específica
                                                </Label>
                                              </div>
                                            </div>
                                            {tipoValidadeBonificacaoIndividual === 'dias' ? (
                                              <Input
                                                type="number"
                                                min="1"
                                                placeholder="30"
                                                value={diasValidadeBonificacaoIndividual}
                                                onChange={(e) => setDiasValidadeBonificacaoIndividual(e.target.value)}
                                              />
                                            ) : (
                                              <Input
                                                type="date"
                                                value={dataExpiracaoBonificacaoIndividual}
                                                onChange={(e) => setDataExpiracaoBonificacaoIndividual(e.target.value)}
                                              />
                                            )}
                                          </div>
                                          <Button
                                            onClick={() => {
                                              handleBonificarIndividual(cliente.id);
                                              setValorBonificacaoIndividual('');
                                              setDescricaoBonificacaoIndividual('');
                                              setTipoValidadeBonificacaoIndividual('dias');
                                              setDataExpiracaoBonificacaoIndividual('');
                                              setDiasValidadeBonificacaoIndividual('30');
                                            }}
                                            disabled={bonificandoIndividual === cliente.id || !valorBonificacaoIndividual}
                                            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                                          >
                                            {bonificandoIndividual === cliente.id ? (
                                              <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Bonificando...
                                              </>
                                            ) : (
                                              <>
                                                <Gift className="h-4 w-4 mr-2" />
                                                Bonificar Cliente
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </div>
                                {transactions.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-8">
                                    Nenhuma transação ainda
                                  </p>
                                ) : (
                                  <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                                    <Table>
                                      <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                          <TableHead>Data</TableHead>
                                          <TableHead>Evento</TableHead>
                                          <TableHead>Valor</TableHead>
                                          <TableHead>Expira</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {transactions.map(t => (
                                          <TableRow key={t.id}>
                                            <TableCell className="text-sm">
                                              {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex items-center gap-2">
                                                {t.transaction_type === 'EARNED' && (
                                                  <>
                                                    {t.description?.startsWith('BONIFICAÇÃO:') ? (
                                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                        Bonificação
                                                      </Badge>
                                                    ) : (
                                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                        Ganhou
                                                      </Badge>
                                                    )}
                                                  </>
                                                )}
                                                {t.transaction_type === 'REDEEMED' && (
                                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                                    Resgatou
                                                  </Badge>
                                                )}
                                                {t.transaction_type === 'EXPIRED' && (
                                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                    Expirou
                                                  </Badge>
                                                )}
                                                {t.tiny_order?.numero_pedido && (
                                                  <span className="text-xs text-muted-foreground">
                                                    (Pedido #{t.tiny_order.numero_pedido})
                                                  </span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className={t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? 'text-red-600' : 'text-green-600'}>
                                              {t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? '-' : '+'}
                                              {formatCurrency(Math.abs(Number(t.amount)))}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                              {t.data_expiracao ? format(new Date(t.data_expiracao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                                {temExpirado && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRenovar(cliente.id)}
                                    className="w-full"
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Renovar Cashback Expirado
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    });
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: HISTÓRICO GERAL */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico Cronológico da Loja</CardTitle>
              <CardDescription>Todas as movimentações de cashback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Tipos</SelectItem>
                        <SelectItem value="EARNED">Ganhou</SelectItem>
                        <SelectItem value="REDEEMED">Resgatou</SelectItem>
                        <SelectItem value="EXPIRED">Expirou</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={filterDateStart}
                      onChange={(e) => setFilterDateStart(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={filterDateEnd}
                      onChange={(e) => setFilterDateEnd(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Buscar Cliente</Label>
                    <Input
                      placeholder="Nome ou CPF..."
                      value={filterClientSearch}
                      onChange={(e) => setFilterClientSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Tabela */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cashback</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistorico.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nenhuma transação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistorico.slice(0, 50).map(t => {
                        const cliente = clientes.find(c => c.id === t.cliente_id);
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">
                              {format(new Date(t.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{cliente?.nome || 'Desconhecido'}</div>
                                <div className="text-xs text-muted-foreground">{cliente?.cpf_cnpj}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {t.transaction_type === 'EARNED' && (
                                <>
                                  {t.description?.startsWith('BONIFICAÇÃO:') ? (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                      Bonificação
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      Ganhou
                                    </Badge>
                                  )}
                                </>
                              )}
                              {t.transaction_type === 'REDEEMED' && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  Resgatou
                                </Badge>
                              )}
                              {t.transaction_type === 'EXPIRED' && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                  Expirou
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                              {t.transaction_type === 'REDEEMED' || t.transaction_type === 'EXPIRED' ? '-' : '+'}
                              {formatCurrency(Math.abs(Number(t.amount)))}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.tiny_order?.numero_pedido ? `#${t.tiny_order.numero_pedido}` : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.data_expiracao ? format(new Date(t.data_expiracao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {t.transaction_type !== 'ADJUSTMENT' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelar(t.id)}
                                  disabled={canceling === t.id}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  {canceling === t.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Cancelar'
                                  )}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: BONIFICAR */}
        <TabsContent value="bonificar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-600" />
                Bonificação em Massa
              </CardTitle>
              <CardDescription>
                Selecione clientes usando filtros avançados e bonifique todos de uma vez
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Configuração de Filtros */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Filtros de Seleção</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Modo:</Label>
                      <Select
                        value={filtrosCumulativos ? 'and' : 'or'}
                        onValueChange={(v) => setFiltrosCumulativos(v === 'and')}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="and">E (AND)</SelectItem>
                          <SelectItem value="or">OU (OR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={adicionarFiltro} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Filtro
                    </Button>
                  </div>
                </div>

                {/* Lista de Filtros */}
                {filtrosBonificacao.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum filtro adicionado. Clique em "Adicionar Filtro" para começar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtrosBonificacao.map((filtro, index) => (
                      <Card key={index} className="border-2">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-4">
                              {/* Tipo de Filtro */}
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <Label>Tipo de Filtro</Label>
                                  <Select
                                    value={filtro.tipo}
                                    onValueChange={(v: any) => atualizarFiltro(index, { tipo: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="melhores_clientes">Melhores Clientes</SelectItem>
                                      <SelectItem value="compra_periodo">Compra entre Datas</SelectItem>
                                      <SelectItem value="nao_visita">Não Visita Desde</SelectItem>
                                      <SelectItem value="aniversario">Aniversário no Mês</SelectItem>
                                      <SelectItem value="tag">Cliente com Tag</SelectItem>
                                      <SelectItem value="todos">Todos os Clientes</SelectItem>
                                      <SelectItem value="categoria">Comprou Categoria</SelectItem>
                                      <SelectItem value="produto">Comprou Produto</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Ação</Label>
                                  <Select
                                    value={filtro.incluir ? 'incluir' : 'excluir'}
                                    onValueChange={(v) => atualizarFiltro(index, { incluir: v === 'incluir' })}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="incluir">Incluir</SelectItem>
                                      <SelectItem value="excluir">Excluir</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removerFiltro(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Parâmetros específicos por tipo */}
                              {filtro.tipo === 'melhores_clientes' && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Parâmetro</Label>
                                    <Select
                                      value={filtro.parametro || 'faturamento'}
                                      onValueChange={(v: any) => atualizarFiltro(index, { parametro: v })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ticket_medio">Ticket Médio</SelectItem>
                                        <SelectItem value="pa">PA (Peças/Atendimento)</SelectItem>
                                        <SelectItem value="faturamento">Faturamento</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Quantidade</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={filtro.quantidade || 10}
                                      onChange={(e) => atualizarFiltro(index, { quantidade: parseInt(e.target.value) || 10 })}
                                    />
                                  </div>
                                </div>
                              )}

                              {filtro.tipo === 'compra_periodo' && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Data Início</Label>
                                    <Input
                                      type="date"
                                      value={filtro.dataInicio || ''}
                                      onChange={(e) => atualizarFiltro(index, { dataInicio: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <Label>Data Fim</Label>
                                    <Input
                                      type="date"
                                      value={filtro.dataFim || ''}
                                      onChange={(e) => atualizarFiltro(index, { dataFim: e.target.value })}
                                    />
                                  </div>
                                </div>
                              )}

                              {filtro.tipo === 'nao_visita' && (
                                <div>
                                  <Label>Não Visita Desde</Label>
                                  <Input
                                    type="date"
                                    value={filtro.dataInicio || ''}
                                    onChange={(e) => atualizarFiltro(index, { dataInicio: e.target.value })}
                                  />
                                </div>
                              )}

                              {filtro.tipo === 'aniversario' && (
                                <div>
                                  <Label>Mês do Aniversário</Label>
                                  <Select
                                    value={filtro.mesAniversario?.toString() || ''}
                                    onValueChange={(v) => atualizarFiltro(index, { mesAniversario: parseInt(v) })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione o mês" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => (
                                        <SelectItem key={mes} value={mes.toString()}>
                                          {format(new Date(2024, mes - 1, 1), 'MMMM', { locale: ptBR })}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {filtro.tipo === 'tag' && (
                                <div>
                                  <Label>Tag</Label>
                                  <Input
                                    placeholder="Digite a tag"
                                    value={filtro.tag || ''}
                                    onChange={(e) => atualizarFiltro(index, { tag: e.target.value })}
                                  />
                                </div>
                              )}

                              {filtro.tipo === 'categoria' && (
                                <div>
                                  <Label>Categoria de Produto</Label>
                                  <Select
                                    value={filtro.categoria || ''}
                                    onValueChange={(v) => atualizarFiltro(index, { categoria: v })}
                                    disabled={loadingCategorias}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={loadingCategorias ? "Carregando..." : "Selecione a categoria"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categoriasProdutos.length === 0 && !loadingCategorias ? (
                                        <SelectItem value="" disabled>Nenhuma categoria encontrada</SelectItem>
                                      ) : (
                                        categoriasProdutos.map((cat) => (
                                          <SelectItem key={cat} value={cat}>
                                            {cat}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {filtro.tipo === 'categoria_cliente' && (
                                <div>
                                  <Label>Categoria de Cliente</Label>
                                  <Select
                                    value={filtro.categoria_cliente || ''}
                                    onValueChange={(v) => atualizarFiltro(index, { categoria_cliente: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione a categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="BLACK">BLACK</SelectItem>
                                      <SelectItem value="PLATINUM">PLATINUM</SelectItem>
                                      <SelectItem value="VIP">VIP</SelectItem>
                                      <SelectItem value="REGULAR">REGULAR</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {filtro.tipo === 'produto' && (
                                <div>
                                  <Label>Produto</Label>
                                  <Input
                                    placeholder="Digite o nome ou ID do produto"
                                    value={filtro.produto || ''}
                                    onChange={(e) => atualizarFiltro(index, { produto: e.target.value })}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <Button
                  onClick={aplicarFiltrosBonificacao}
                  disabled={loadingFiltros || filtrosBonificacao.length === 0}
                  className="w-full"
                >
                  {loadingFiltros ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aplicando Filtros...
                    </>
                  ) : (
                    <>
                      <Filter className="h-4 w-4 mr-2" />
                      Aplicar Filtros
                    </>
                  )}
                </Button>
              </div>

              <Separator />

              {/* Lista de Clientes Filtrados */}
              {clientesFiltrados.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">
                        Clientes Encontrados: {clientesFiltrados.length}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedClientesBonificar.size > 0 && `${selectedClientesBonificar.size} selecionado(s)`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedClientesBonificar.size === clientesFiltrados.length) {
                            setSelectedClientesBonificar(new Set());
                          } else {
                            setSelectedClientesBonificar(new Set(clientesFiltrados.map(c => c.id)));
                          }
                        }}
                      >
                        {selectedClientesBonificar.size === clientesFiltrados.length ? 'Desselecionar Todos' : 'Selecionar Todos'}
                      </Button>
                    </div>
                  </div>

                  {/* Busca por Nome ou CPF */}
                  <div className="space-y-2">
                    <Label>Buscar Cliente (Nome ou CPF)</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite o nome ou CPF..."
                        value={searchClientesFiltrados}
                        onChange={(e) => setSearchClientesFiltrados(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Filtrar clientes pela busca */}
                  {(() => {
                    const clientesFiltradosBusca = clientesFiltrados.filter(c => {
                      if (!searchClientesFiltrados) return true;
                      const busca = searchClientesFiltrados.toLowerCase();
                      return (
                        c.nome.toLowerCase().includes(busca) ||
                        (c.cpf_cnpj && c.cpf_cnpj.toLowerCase().includes(busca))
                      );
                    });

                    return (
                      <>
                        {searchClientesFiltrados && (
                          <p className="text-sm text-muted-foreground">
                            {clientesFiltradosBusca.length} cliente(s) encontrado(s) na busca
                          </p>
                        )}

                        <div className="border rounded-lg max-h-96 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">
                                  <Checkbox
                                    checked={selectedClientesBonificar.size === clientesFiltrados.length && clientesFiltrados.length > 0}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedClientesBonificar(new Set(clientesFiltrados.map(c => c.id)));
                                      } else {
                                        setSelectedClientesBonificar(new Set());
                                      }
                                    }}
                                  />
                                </TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>CPF/CNPJ</TableHead>
                                <TableHead>Telefone</TableHead>
                                {clientesFiltrados[0]?.parametroFiltro && (
                                  <TableHead className="text-right">
                                    {clientesFiltrados[0].parametroFiltro === 'ticket_medio' && 'Ticket Médio'}
                                    {clientesFiltrados[0].parametroFiltro === 'pa' && 'PA'}
                                    {clientesFiltrados[0].parametroFiltro === 'faturamento' && 'Faturamento'}
                                  </TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clientesFiltradosBusca.map((cliente) => (
                                <TableRow key={cliente.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedClientesBonificar.has(cliente.id)}
                                      onCheckedChange={(checked) => {
                                        const novoSet = new Set(selectedClientesBonificar);
                                        if (checked) {
                                          novoSet.add(cliente.id);
                                        } else {
                                          novoSet.delete(cliente.id);
                                        }
                                        setSelectedClientesBonificar(novoSet);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{cliente.nome}</TableCell>
                                  <TableCell>{cliente.cpf_cnpj || '-'}</TableCell>
                                  <TableCell>{cliente.telefone ? normalizarTelefone(cliente.telefone) : '-'}</TableCell>
                                  {cliente.parametroFiltro && (
                                    <TableCell className="text-right font-medium">
                                      {cliente.parametroFiltro === 'ticket_medio' && formatCurrency(cliente.ticketMedio || 0)}
                                      {cliente.parametroFiltro === 'pa' && (cliente.pa?.toFixed(2) || '0.00')}
                                      {cliente.parametroFiltro === 'faturamento' && formatCurrency(cliente.totalFaturamento || 0)}
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    );
                  })()}

                  <Separator />

                  {/* Formulário de Bonificação */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Valor da Bonificação</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor por Cliente *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={valorBonificacao}
                          onChange={(e) => setValorBonificacao(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input
                          placeholder="Ex: Bonificação especial"
                          value={descricaoBonificacao}
                          onChange={(e) => setDescricaoBonificacao(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Prazo de Validade da Bonificação */}
                    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                      <Label className="text-base font-semibold">Prazo de Validade da Bonificação</Label>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              id="validade-dias"
                              name="tipo-validade"
                              checked={tipoValidadeBonificacao === 'dias'}
                              onChange={() => setTipoValidadeBonificacao('dias')}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="validade-dias" className="font-normal cursor-pointer">
                              Válido por X dias
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              id="validade-data"
                              name="tipo-validade"
                              checked={tipoValidadeBonificacao === 'data'}
                              onChange={() => setTipoValidadeBonificacao('data')}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="validade-data" className="font-normal cursor-pointer">
                              Válido até data específica
                            </Label>
                          </div>
                        </div>

                        {tipoValidadeBonificacao === 'dias' ? (
                          <div className="space-y-2">
                            <Label>Dias de Validade *</Label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="30"
                              value={diasValidadeBonificacao}
                              onChange={(e) => setDiasValidadeBonificacao(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              O cashback será válido por {diasValidadeBonificacao || 'X'} dias após a liberação
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Data de Expiração *</Label>
                            <Input
                              type="date"
                              value={dataExpiracaoBonificacao}
                              onChange={(e) => setDataExpiracaoBonificacao(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              O cashback será válido até a data informada
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedClientesBonificar.size > 0 && valorBonificacao && (
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Total a bonificar: <span className="font-bold text-primary">
                            {formatCurrency(parseFloat(valorBonificacao || '0') * selectedClientesBonificar.size)}
                          </span>
                          {' '}({selectedClientesBonificar.size} cliente(s) × {formatCurrency(parseFloat(valorBonificacao || '0'))})
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={handleBonificar}
                      disabled={bonificando || selectedClientesBonificar.size === 0 || !valorBonificacao}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                      size="lg"
                    >
                      {bonificando ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Bonificando...
                        </>
                      ) : (
                        <>
                          <Gift className="h-4 w-4 mr-2" />
                          Bonificar {selectedClientesBonificar.size} Cliente(s)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Exportação após Bonificação */}
              {ultimaBonificacao.length > 0 && (
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Download className="h-5 w-5 text-purple-600" />
                      Exportar Lista de Bonificação
                    </CardTitle>
                    <CardDescription>
                      {ultimaBonificacao.length} cliente(s) bonificado(s) - Exporte em diferentes formatos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => exportarFormatoNormal('xlsx')}
                        className="flex items-center gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar XLSX (Normal)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => exportarFormatoNormal('pdf')}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Exportar PDF (Normal)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={exportarFormatoWhatsApp}
                        className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar XLSX (WhatsApp)
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Formato Normal:</strong> Nome Completo, Telefone, Valor do Bônus</p>
                      <p><strong>Formato WhatsApp:</strong> Primeiro Nome, Sobrenome, Telefone (55 + DDD + número, sem formatação)</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: FILA DE WHATSAPP */}
        <TabsContent value="fila" className="space-y-4">
          <CashbackWhatsAppQueue storeId={selectedStoreId || undefined} />
        </TabsContent>

        {/* TAB 6: CONFIGURAÇÕES */}
        <TabsContent value="configuracoes" className="space-y-4">
          <CashbackSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
