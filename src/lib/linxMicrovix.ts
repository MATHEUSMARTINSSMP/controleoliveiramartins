/**
 * Integração Linx Microvix
 * 
 * Suporta:
 * 1. Hub Fidelidade (cashback/pontos)
 * 2. WebService de Saída (sincronização de vendas)
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TIPOS
// =============================================================================

export interface LinxMicrovixConfig {
  id: string;
  store_id: string;
  cnpj: string;
  nome_loja: string;
  
  // Hub Fidelidade
  hub_token_produto?: string;
  hub_token_parceiro?: string;
  hub_id_parceiro?: number;
  hub_ambiente: 'homologacao' | 'producao';
  hub_url_producao?: string;
  hub_active: boolean;
  hub_sync_status: string;
  
  // WebService de Saída
  ws_portal?: string;
  ws_chave?: string;
  ws_usuario?: string;
  ws_senha?: string;
  ws_grupo?: string;
  ws_ambiente: 'homologacao' | 'producao';
  ws_url_homologacao?: string;
  ws_url_producao?: string;
  ws_active: boolean;
  ws_sync_status: string;
  ws_last_timestamp?: number;
  
  active: boolean;
}

export interface LinxVenda {
  id?: string;
  store_id: string;
  id_transacao: string;
  numero_documento?: string;
  doc_cliente?: string;
  nome_cliente?: string;
  cod_vendedor?: string;
  nome_vendedor?: string;
  valor_bruto: number;
  valor_desconto: number;
  valor_liquido: number;
  data_venda: string;
  situacao?: string;
  cancelado: boolean;
  forma_pagamento?: string;
  timestamp_linx?: number;
}

export interface LinxClienteFidelidade {
  cpf: string;
  nome?: string;
  celular?: string;
  email?: string;
  saldo_atual: number;
  saldo_disponivel: number;
  utiliza_pin: boolean;
  cliente_cadastrado: boolean;
}

// =============================================================================
// URLs
// =============================================================================

const LINX_URLS = {
  HUB_HOMOLOGACAO: 'https://hubagnostico-homologacao.linx.com.br/v1',
  WS_HOMOLOGACAO: 'http://webapi.microvix.com.br/1.0/api/integracao',
};

// =============================================================================
// FUNÇÕES DE CONFIGURAÇÃO
// =============================================================================

/**
 * Busca configuração Linx Microvix de uma loja
 */
export async function getLinxConfig(storeId: string): Promise<LinxMicrovixConfig | null> {
  const { data, error } = await supabase
    .schema('sistemaretiradas')
    .from('linx_microvix_config')
    .select('*')
    .eq('store_id', storeId)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('[LinxMicrovix] Erro ao buscar config:', error);
    return null;
  }

  return data as LinxMicrovixConfig | null;
}

/**
 * Salva/atualiza configuração Linx Microvix
 */
export async function saveLinxConfig(config: Partial<LinxMicrovixConfig> & { store_id: string }): Promise<boolean> {
  const { error } = await supabase
    .schema('sistemaretiradas')
    .from('linx_microvix_config')
    .upsert(config, { onConflict: 'store_id' });

  if (error) {
    console.error('[LinxMicrovix] Erro ao salvar config:', error);
    return false;
  }

  return true;
}

// =============================================================================
// HUB FIDELIDADE - FUNÇÕES
// =============================================================================

/**
 * Chama API do Hub Fidelidade via proxy Netlify
 */
export async function callHubFidelidadeAPI(
  storeId: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch('/.netlify/functions/linx-hub-fidelidade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        endpoint,
        method,
        body,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro na API' };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('[LinxMicrovix] Erro na chamada Hub:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Consulta saldo de cliente no Hub Fidelidade
 */
export async function consultarSaldoCliente(
  storeId: string,
  cpf: string
): Promise<{ success: boolean; saldo?: number; saldo_disponivel?: number; error?: string }> {
  const result = await callHubFidelidadeAPI(storeId, '/ConsultarSaldoCliente', 'POST', {
    Documento: cpf.replace(/\D/g, ''),
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data as { Saldo?: number; SaldoDisponivel?: number };
  return {
    success: true,
    saldo: data.Saldo || 0,
    saldo_disponivel: data.SaldoDisponivel || 0,
  };
}

/**
 * Gera bônus após uma venda
 */
export async function gerarBonus(
  storeId: string,
  cpf: string,
  valorVenda: number,
  identificadorTransacao: string
): Promise<{ success: boolean; saldo_gerado?: number; error?: string }> {
  const result = await callHubFidelidadeAPI(storeId, '/GerarBonus', 'POST', {
    Documento: cpf.replace(/\D/g, ''),
    ValorBruto: valorVenda,
    ValorLiquido: valorVenda,
    IdentificadorTransacao: identificadorTransacao,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data as { SaldoGerado?: number };
  return {
    success: true,
    saldo_gerado: data.SaldoGerado || 0,
  };
}

/**
 * Resgata bônus (usa pontos para desconto)
 */
export async function resgatarBonus(
  storeId: string,
  cpf: string,
  valorResgate: number,
  identificadorTransacao: string,
  pin?: string
): Promise<{ success: boolean; error?: string }> {
  const body: Record<string, unknown> = {
    Documento: cpf.replace(/\D/g, ''),
    ValorResgate: valorResgate,
    IdentificadorTransacao: identificadorTransacao,
  };

  if (pin) {
    body.Pin = pin;
  }

  const result = await callHubFidelidadeAPI(storeId, '/ValidarBonus', 'POST', body);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

// =============================================================================
// WEBSERVICE DE SAÍDA - FUNÇÕES
// =============================================================================

/**
 * Sincroniza vendas do WebService de Saída
 */
export async function syncVendasLinx(storeId: string): Promise<{
  success: boolean;
  registros_processados?: number;
  registros_inseridos?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/.netlify/functions/linx-sync-vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Erro na sincronização' };
    }

    return {
      success: true,
      registros_processados: result.registros_processados,
      registros_inseridos: result.registros_inseridos,
    };
  } catch (error) {
    console.error('[LinxMicrovix] Erro na sincronização:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Testa conexão com WebService de Saída
 */
export async function testarConexaoWebService(storeId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch('/.netlify/functions/linx-test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, tipo: 'webservice' }),
    });

    const result = await response.json();

    return {
      success: response.ok,
      message: result.message || (response.ok ? 'Conexão estabelecida' : 'Falha na conexão'),
    };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

/**
 * Testa conexão com Hub Fidelidade
 */
export async function testarConexaoHubFidelidade(storeId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch('/.netlify/functions/linx-test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, tipo: 'hub' }),
    });

    const result = await response.json();

    return {
      success: response.ok,
      message: result.message || (response.ok ? 'Conexão estabelecida' : 'Falha na conexão'),
    };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Busca vendas sincronizadas de uma loja
 */
export async function getVendasLinx(
  storeId: string,
  dataInicio?: string,
  dataFim?: string,
  limite = 100
): Promise<LinxVenda[]> {
  let query = supabase
    .schema('sistemaretiradas')
    .from('linx_microvix_vendas')
    .select('*')
    .eq('store_id', storeId)
    .eq('cancelado', false)
    .order('data_venda', { ascending: false })
    .limit(limite);

  if (dataInicio) {
    query = query.gte('data_venda', dataInicio);
  }

  if (dataFim) {
    query = query.lte('data_venda', dataFim);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[LinxMicrovix] Erro ao buscar vendas:', error);
    return [];
  }

  return (data || []) as LinxVenda[];
}

/**
 * Busca clientes do Hub Fidelidade
 */
export async function getClientesFidelidade(
  storeId: string,
  limite = 100
): Promise<LinxClienteFidelidade[]> {
  const { data, error } = await supabase
    .schema('sistemaretiradas')
    .from('linx_microvix_clientes')
    .select('*')
    .eq('store_id', storeId)
    .order('saldo_disponivel', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('[LinxMicrovix] Erro ao buscar clientes:', error);
    return [];
  }

  return (data || []) as LinxClienteFidelidade[];
}
