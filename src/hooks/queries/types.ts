/**
 * Tipos compartilhados para queries Supabase
 * Enterprise-grade type definitions
 */

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'COLABORADORA' | 'LOJA';
  active: boolean;
  store_id: string | null;
  limite_total: number;
  limite_mensal: number;
  created_at?: string;
}

export interface Store {
  id: string;
  name: string;
  active: boolean;
  subscription_plan?: string;
  tiny_api_token?: string;
  tiny_ultimo_sync?: string;
}

export interface Sale {
  id: string;
  colaboradora_id: string;
  store_id: string;
  data_venda: string;
  valor: number;
  comissao?: number;
  profiles?: Pick<Profile, 'name'>;
  stores?: Pick<Store, 'name'>;
}

export interface Bonus {
  id: string;
  store_id: string;
  mes_referencia: string;
  data_inicio: string;
  data_fim: string;
  meta_minima: number;
  meta_maxima: number;
  ativo: boolean;
  tipo?: string;
}

export interface Goal {
  id: string;
  colaboradora_id: string;
  store_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  meta_valor: number;
  tipo: 'diaria' | 'semanal' | 'mensal';
}

export interface Adiantamento {
  id: string;
  colaboradora_id: string;
  valor: number;
  data_solicitacao: string;
  mes_competencia: string;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'PAGO';
  motivo_recusa?: string | null;
  observacoes?: string | null;
}

export interface Purchase {
  id: string;
  colaboradora_id: string;
  store_id: string;
  data_compra: string;
  item: string;
  preco_final: number;
  num_parcelas: number;
  status_compra: string;
  stores?: Pick<Store, 'name'>;
}

export interface Parcela {
  id: string;
  compra_id: string;
  n_parcela: number;
  competencia: string;
  valor_parcela: number;
  status_parcela: string;
  purchases?: {
    item: string;
    stores?: Pick<Store, 'name'>;
  };
}

export interface TinyOrder {
  id: string;
  store_id: string;
  numero_pedido: string;
  cliente_nome?: string;
  vendedor_nome?: string;
  valor_total: number;
  data_pedido: string;
  situacao?: string;
  itens?: unknown[];
}

export interface TinyContact {
  id: string;
  store_id: string;
  codigo: string;
  nome: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  data_nascimento?: string;
}

export interface CashbackTransaction {
  id: string;
  cliente_id: string;
  store_id: string | null;
  colaboradora_id?: string | null;
  sale_id?: string | null;
  tiny_order_id?: string | null;
  cashback_rule_id?: string | null;
  cashback_settings_id?: string | null;
  contact_id?: string | null;
  transaction_type: 'EARNED' | 'REDEEMED' | 'EXPIRED';
  amount: number;
  description?: string | null;
  data_liberacao?: string | null;
  data_expiracao?: string | null;
  renovado?: boolean;
  recuperado?: boolean;
  created_at: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export function serializeDateRange(range?: DateRange): string | undefined {
  if (!range) return undefined;
  return `${range.start || ''}_${range.end || ''}`;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface QueryFilters {
  storeId?: string;
  colaboradoraId?: string;
  dateRange?: DateRange;
  status?: string;
  search?: string;
}

export const QUERY_KEYS = {
  profiles: 'profiles',
  stores: 'stores',
  sales: 'sales',
  bonuses: 'bonuses',
  goals: 'goals',
  adiantamentos: 'adiantamentos',
  purchases: 'purchases',
  parcelas: 'parcelas',
  tinyOrders: 'tiny-orders',
  tinyContacts: 'tiny-contacts',
  cashback: 'cashback',
  kpis: 'kpis',
} as const;
