/**
 * @fileoverview Hooks e utilitários para analytics de campanhas WhatsApp
 * @module whatsapp-campaigns/useAnalytics
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Interface para analytics agregados por categoria de campanha
 */
interface CampaignAnalyticsByCategory {
  category: string;
  total_campaigns: number;
  total_messages_sent: number;
  total_recipients: number;
  successful_messages: number;
  failed_messages: number;
  conversion_rate: number | null;
  avg_days_to_return: number;
  total_revenue_generated: number;
  avg_ticket_post_campaign: number;
  total_sales_count: number;
  roi_percentage: number;
}

/**
 * Interface para rastreamento de retorno de clientes após campanha
 */
interface CustomerReturnTracking {
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  message_sent_at: string;
  first_sale_after_message: string | null;
  days_to_return: number | null;
  total_sales_count: number;
  total_revenue: number;
  avg_ticket: number;
  returned: boolean;
}

/**
 * Interface para analytics detalhados de uma campanha específica
 */
interface CampaignDetailedAnalytics {
  campaign_id: string;
  campaign_name: string;
  campaign_category: string;
  total_recipients: number;
  messages_sent: number;
  messages_failed: number;
  unique_customers_reached: number;
  customers_who_returned: number;
  conversion_rate: number | null;
  avg_days_to_return: number;
  total_revenue_30_days: number;
  total_revenue_60_days: number;
  total_revenue_90_days: number;
  avg_ticket_30_days: number;
  avg_ticket_60_days: number;
  avg_ticket_90_days: number;
  total_sales_30_days: number;
  total_sales_60_days: number;
  total_sales_90_days: number;
  roi_30_days: number;
  roi_60_days: number;
  roi_90_days: number;
}

/**
 * Interface para clientes mais responsivos por categoria
 */
interface MostResponsiveCustomer {
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  category: string;
  campaigns_received: number;
  times_returned: number;
  total_revenue_generated: number;
  avg_days_to_return: number;
  responsiveness_score: number;
}

/**
 * Hook para buscar analytics agregados por categoria de campanha
 * @param storeId - ID da loja (opcional)
 * @param category - Categoria específica (opcional)
 * @param startDate - Data inicial do período (opcional)
 * @param endDate - Data final do período (opcional)
 * @returns Objeto com dados de analytics, loading, error e função refetch
 */
export function useCampaignAnalyticsByCategory(
  storeId?: string,
  category?: string,
  startDate?: Date,
  endDate?: Date
) {
  const [data, setData] = useState<CampaignAnalyticsByCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase.rpc(
        'get_campaign_analytics_by_category',
        {
          p_store_id: storeId || null,
          p_category: category || null,
          p_start_date: startDate?.toISOString() || null,
          p_end_date: endDate?.toISOString() || null,
        }
      );

      if (err) throw err;
      
      // Normalizar dados: converter null para 0 em campos numéricos
      const normalizedData = (result || []).map(item => ({
        ...item,
        conversion_rate: item.conversion_rate ?? 0,
        avg_days_to_return: item.avg_days_to_return ?? 0,
        total_revenue_generated: item.total_revenue_generated ?? 0,
        avg_ticket_post_campaign: item.avg_ticket_post_campaign ?? 0,
        roi_percentage: item.roi_percentage ?? 0,
      }));
      
      setData(normalizedData);
    } catch (err: any) {
      console.error("Erro ao buscar analytics por categoria:", err);
      setError(err.message || "Erro ao carregar analytics");
      toast.error("Erro ao carregar analytics: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, category, startDate, endDate]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook para rastrear retorno de clientes após uma campanha específica
 * @param campaignId - ID da campanha
 * @returns Objeto com dados de retorno, loading, error e função refetch
 */
export function useCustomerReturnTracking(campaignId: string | null) {
  const [data, setData] = useState<CustomerReturnTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    if (!campaignId) {
      setData([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase.rpc(
        'track_customer_return_after_campaign',
        {
          p_campaign_id: campaignId,
        }
      );

      if (err) throw err;
      setData(result || []);
    } catch (err: any) {
      console.error("Erro ao buscar rastreamento de retorno:", err);
      setError(err.message || "Erro ao carregar dados de retorno");
      toast.error("Erro ao carregar dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook para buscar analytics detalhados de uma campanha específica
 * @param campaignId - ID da campanha
 * @returns Objeto com analytics detalhados, loading, error e função refetch
 */
export function useCampaignDetailedAnalytics(campaignId: string | null) {
  const [data, setData] = useState<CampaignDetailedAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    if (!campaignId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase.rpc(
        'get_campaign_detailed_analytics',
        {
          p_campaign_id: campaignId,
        }
      );

      if (err) throw err;
      setData(result && result.length > 0 ? result[0] : null);
    } catch (err: any) {
      console.error("Erro ao buscar analytics detalhados:", err);
      setError(err.message || "Erro ao carregar analytics");
      toast.error("Erro ao carregar analytics: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook para buscar clientes mais responsivos por categoria
 * @param storeId - ID da loja (opcional)
 * @param category - Categoria específica (opcional)
 * @param limit - Limite de resultados (padrão: 50)
 * @returns Objeto com lista de clientes, loading, error e função refetch
 */
export function useMostResponsiveCustomers(
  storeId?: string,
  category?: string,
  limit: number = 50
) {
  const [data, setData] = useState<MostResponsiveCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    if (!storeId) {
      setData([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase.rpc(
        'get_most_responsive_customers_by_category',
        {
          p_store_id: storeId || null,
          p_category: category || null,
          p_limit: limit,
        }
      );

      if (err) throw err;
      setData(result || []);
    } catch (err: any) {
      console.error("Erro ao buscar clientes mais responsivos:", err);
      setError(err.message || "Erro ao carregar dados");
      toast.error("Erro ao carregar dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, category, limit]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Função utilitária para exportar dados para CSV
 * @param data - Array de objetos a serem exportados
 * @param filename - Nome do arquivo (sem extensão)
 * @param headers - Mapeamento de chaves para labels em português (opcional)
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers?: Record<keyof T, string>
) {
  if (data.length === 0) {
    toast.error("Nenhum dado para exportar");
    return;
  }

  const keys = Object.keys(data[0]) as Array<keyof T>;
  const headerRow = keys.map(key => headers?.[key] || String(key)).join(',');
  
  const rows = data.map(row => 
    keys.map(key => {
      const value = row[key];
      // Escapar vírgulas e aspas em valores
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  const csvContent = [headerRow, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast.success(`Relatório exportado: ${filename}.csv`);
}

/**
 * Exporta analytics por categoria para CSV
 * @param data - Array de analytics por categoria
 * @param filename - Nome do arquivo (padrão: 'analytics_por_categoria')
 */
export function exportCampaignAnalyticsByCategory(
  data: CampaignAnalyticsByCategory[],
  filename: string = 'analytics_por_categoria'
) {
  const headers: Record<keyof CampaignAnalyticsByCategory, string> = {
    category: 'Categoria',
    total_campaigns: 'Total de Campanhas',
    total_messages_sent: 'Mensagens Enviadas',
    total_recipients: 'Destinatários',
    successful_messages: 'Mensagens com Sucesso',
    failed_messages: 'Mensagens Falhas',
    conversion_rate: 'Taxa de Conversão (%)',
    avg_days_to_return: 'Tempo Médio até Retorno (dias)',
    total_revenue_generated: 'Receita Total Gerada (R$)',
    avg_ticket_post_campaign: 'Ticket Médio Pós-Campanha (R$)',
    total_sales_count: 'Total de Vendas',
    roi_percentage: 'ROI (%)',
  };
  
  exportToCSV(data, filename, headers);
}

/**
 * Exporta rastreamento de retorno de clientes para CSV
 * @param data - Array de dados de retorno
 * @param filename - Nome do arquivo (padrão: 'rastreamento_retorno_clientes')
 */
export function exportCustomerReturnTracking(
  data: CustomerReturnTracking[],
  filename: string = 'rastreamento_retorno_clientes'
) {
  const headers: Record<keyof CustomerReturnTracking, string> = {
    contact_id: 'ID do Contato',
    contact_name: 'Nome',
    contact_phone: 'Telefone',
    message_sent_at: 'Data do Envio',
    first_sale_after_message: 'Primeira Venda Após',
    days_to_return: 'Dias até Retorno',
    total_sales_count: 'Total de Vendas',
    total_revenue: 'Receita Total (R$)',
    avg_ticket: 'Ticket Médio (R$)',
    returned: 'Retornou',
  };
  
  exportToCSV(data, filename, headers);
}
