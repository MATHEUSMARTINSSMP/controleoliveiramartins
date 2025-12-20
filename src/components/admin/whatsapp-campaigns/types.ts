export interface WhatsAppCampaign {
  id: string;
  name: string;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_start_at: string | null;
  store_id: string;
  store?: {
    name: string;
  };
  // Configurações de agendamento e limites
  start_hour?: number | null;
  end_hour?: number | null;
  min_interval_minutes?: number | null;
  daily_limit?: number | null;
  // Categoria (para analytics)
  category?: string | null;
}

export interface CampaignStats {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
}
