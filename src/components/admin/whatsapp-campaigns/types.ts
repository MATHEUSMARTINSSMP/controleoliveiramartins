export interface WhatsAppAccount {
  id: string;
  store_id: string;
  phone: string;
  account_type: 'PRIMARY' | 'BACKUP_1' | 'BACKUP_2';
  is_connected: boolean;
  health_status: 'OK' | 'WARNING' | 'BLOCKED' | 'DISCONNECTED';
  daily_message_count: number;
}

export interface Campaign {
  id: string;
  store_id: string;
  created_by: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  filter_config: FilterConfig;
  daily_limit: number;
  start_hour: number;
  end_hour: number;
  active_days: string[];
  min_interval_minutes: number;
  use_rotation: boolean;
  rotation_strategy: 'EQUAL' | 'PRIMARY_FIRST' | 'RANDOM';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  scheduled_start_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface CampaignTemplate {
  id: string;
  campaign_id: string;
  base_template: string;
  variations: TemplateVariation[];
  available_variables: string[];
  is_approved: boolean;
}

export interface TemplateVariation {
  id: string;
  text: string;
  approved: boolean;
  created_at: string;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  contact_id?: string;
  phone: string;
  contact_name?: string;
  message_content: string;
  status: 'PENDING' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  sent_at?: string;
  error_message?: string;
  contact_metadata: ContactMetadata;
}

export interface ContactMetadata {
  ultima_compra?: string;
  dias_sem_comprar?: number;
  total_gasto?: number;
  ticket_medio?: number;
  categoria?: string;
  quantidade_compras?: number;
}

export interface FilterConfig {
  filters: FilterRule[];
  combineLogic: 'AND' | 'OR';
}

export interface FilterRule {
  type: FilterType;
  value: string | number;
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
}

export type FilterType = 
  | 'inactive_days'
  | 'min_ticket'
  | 'max_ticket'
  | 'min_purchases'
  | 'max_purchases'
  | 'category'
  | 'top_spenders'
  | 'purchased_period'
  | 'not_purchased_period'
  | 'birthday_month';

export interface CustomerStats {
  contact_id: string;
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  ultima_compra?: string;
  dias_sem_comprar: number;
  total_compras: number;
  quantidade_compras: number;
  ticket_medio: number;
  categoria: string;
  selected?: boolean;
}

export interface ImportedContact {
  id: string;
  primeiro_nome: string;
  telefone: string;
  telefone_formatado: string;
  errors: string[];
  selected: boolean;
}

export type AudienceSource = 'CRM' | 'IMPORT';

export interface AudienceData {
  source: AudienceSource;
  crmContacts: CustomerStats[];
  importedContacts: ImportedContact[];
}

export interface RiskIndicator {
  metric: string;
  value: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export const AVAILABLE_VARIABLES = [
  { key: 'primeiro_nome', label: 'Primeiro Nome', example: 'Maria' },
  { key: 'nome_completo', label: 'Nome Completo', example: 'Maria Silva Santos' },
  { key: 'ultima_compra', label: 'Última Compra', example: '15/12/2025' },
  { key: 'dias_sem_comprar', label: 'Dias sem Comprar', example: '45' },
  { key: 'total_gasto', label: 'Total Gasto', example: 'R$ 2.500,00' },
  { key: 'categoria', label: 'Categoria', example: 'VIP' },
  { key: 'loja', label: 'Nome da Loja', example: 'Mr. Kitsch' },
];

export const FILTER_OPTIONS = [
  { type: 'inactive_days', label: 'Clientes inativos há X dias', icon: 'clock', description: 'Clientes que não compram há um período' },
  { type: 'min_ticket', label: 'Ticket médio mínimo', icon: 'trending-up', description: 'Clientes com ticket médio acima de X' },
  { type: 'top_spenders', label: 'Top clientes por faturamento', icon: 'crown', description: 'Os X clientes que mais gastaram' },
  { type: 'min_purchases', label: 'Mínimo de compras', icon: 'shopping-bag', description: 'Clientes com pelo menos X compras' },
  { type: 'category', label: 'Por categoria', icon: 'star', description: 'BLACK, PLATINUM, VIP ou REGULAR' },
  { type: 'birthday_month', label: 'Aniversariantes', icon: 'cake', description: 'Clientes que fazem aniversário no mês' },
  { type: 'purchased_period', label: 'Compraram no período', icon: 'calendar-check', description: 'Clientes que compraram entre datas' },
  { type: 'not_purchased_period', label: 'NÃO compraram no período', icon: 'calendar-x', description: 'Clientes que NÃO compraram entre datas' },
];

export interface PrepareWebhookRequest {
  site_slug: string;
  campaign_id: string;
  template_message: string;
  filters: {
    dias_sem_comprar: number;
    valor_minimo_compras: number;
  };
  generate_variations: boolean;
  variation_count: number;
  limit: number;
  preview_limit: number;
}

export interface PrepareWebhookResponse {
  success: boolean;
  error?: string;
  campaign_id?: string;
  total_contacts?: number;
  preview?: PreparedContact[];
  message_variations?: string[];
}

export interface PreparedContact {
  contact_name: string;
  contact_phone: string;
  message_variation: string;
  variation_index: number;
  last_purchase?: string;
  total_spent?: number;
}

export const RISK_MATRIX = {
  interval: {
    1: { level: 'HIGH' as const, label: '1 msg/min', description: 'Risco muito alto de banimento' },
    3: { level: 'MEDIUM' as const, label: '1 msg/3min', description: 'Risco moderado' },
    5: { level: 'LOW' as const, label: '1 msg/5min', description: 'Risco baixo' },
  },
  daily: {
    50: { level: 'LOW' as const, label: 'Até 50/dia', description: 'Volume seguro' },
    100: { level: 'MEDIUM' as const, label: '50-100/dia', description: 'Atenção recomendada' },
    101: { level: 'HIGH' as const, label: '100+/dia', description: 'Alto risco de banimento' },
  },
};
