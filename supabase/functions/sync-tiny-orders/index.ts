/**
 * Supabase Edge Function: Sincronização de Pedidos/Clientes Tiny ERP
 * 
 * Esta função suporta:
 * 1. Sincronização MANUAL (chamada do frontend) - roda em background
 * 2. Sincronização AUTOMÁTICA (agendada via pg_cron)
 * 
 * Documentação: https://supabase.com/docs/guides/functions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncResult {
  store_id: string;
  store_name: string;
  success: boolean;
  synced: number;
  updated: number;
  errors: number;
  message: string;
}

/**
 * Verifica se há nova venda comparando último pedido no banco vs API
 * Retorna objeto com: { temNovaVenda: boolean, ultimoNumeroConhecido: number | null }
 * Esta função implementa POLLING INTELIGENTE para evitar requisições desnecessárias
 */
async function verificarNovaVenda(
  supabase: any,
  storeId: string,
  netlifyUrl: string
): Promise<{ temNovaVenda: boolean; ultimoNumeroConhecido: number | null }> {
  try {
    console.log(`[SyncTiny] 🔍 Verificando se há nova venda para loja ${storeId}...`);

    // 1. Buscar último pedido no banco
    const { data: ultimoPedidoBanco } = await supabase
      .schema('sistemaretiradas')
      .from('tiny_orders')
      .select('numero_pedido, data_pedido')
      .eq('store_id', storeId)
      .not('numero_pedido', 'is', null)
      .order('numero_pedido', { ascending: false })
      .limit(1)
      .single();

    const ultimoNumeroConhecido = ultimoPedidoBanco?.numero_pedido 
      ? parseInt(String(ultimoPedidoBanco.numero_pedido)) 
      : null;

    console.log(`[SyncTiny] 📊 Último pedido no banco:`, {
      numero: ultimoNumeroConhecido,
      data: ultimoPedidoBanco?.data_pedido,
    });

    // 2. Buscar último pedido na API (requisição leve, apenas listagem)
    const checkUrl = `${netlifyUrl}/.netlify/functions/erp-api-proxy`;
    
    const checkResponse = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        store_id: storeId,
        endpoint: '/pedidos',
        params: {
          situacao: '1,3', // Aprovado (1) e Faturado (3)
          limit: 1,
          ordenar: 'numeroPedido|DESC', // Último pedido primeiro
        },
        method: 'GET',
      }),
    });

    if (!checkResponse.ok) {
      console.warn(`[SyncTiny] ⚠️ Erro ao verificar última venda na API:`, checkResponse.status);
      // Em caso de erro, assumir que há nova venda (sincronizar por segurança)
      return { temNovaVenda: true, ultimoNumeroConhecido };
    }

    const checkData = await checkResponse.json();
    const pedidos = checkData?.itens || checkData?.pedidos || checkData?.response?.pedidos || [];
    const ultimoPedidoAPI = pedidos[0];

    console.log(`[SyncTiny] 📊 Último pedido na API:`, {
      numero: ultimoPedidoAPI?.numeroPedido || ultimoPedidoAPI?.numero_pedido,
      data: ultimoPedidoAPI?.data || ultimoPedidoAPI?.dataCriacao,
    });

    // 3. Comparar
    if (!ultimoNumeroConhecido) {
      // Se não há pedidos no banco, há nova venda (primeira sincronização)
      console.log(`[SyncTiny] ✅ Primeira sincronização para loja ${storeId}`);
      return { temNovaVenda: true, ultimoNumeroConhecido: null };
    }

    if (!ultimoPedidoAPI) {
      // Se não há pedidos na API, não há nova venda
      console.log(`[SyncTiny] ℹ️ Nenhum pedido encontrado na API`);
      return { temNovaVenda: false, ultimoNumeroConhecido };
    }

    // Comparar números de pedido
    const numeroAPI = parseInt(String(ultimoPedidoAPI.numeroPedido || ultimoPedidoAPI.numero_pedido || 0));

    if (numeroAPI > ultimoNumeroConhecido) {
      console.log(`[SyncTiny] ✅ NOVA VENDA DETECTADA! API: ${numeroAPI} > Banco: ${ultimoNumeroConhecido}`);
      return { temNovaVenda: true, ultimoNumeroConhecido };
    }

    console.log(`[SyncTiny] ℹ️ Sem mudanças. Último pedido: ${ultimoNumeroConhecido}`);
    return { temNovaVenda: false, ultimoNumeroConhecido };

  } catch (error) {
    console.error(`[SyncTiny] ❌ Erro ao verificar nova venda:`, error);
    // Em caso de erro, assumir que há nova venda (sincronizar por segurança)
    const ultimoNumeroConhecido = null;
    return { temNovaVenda: true, ultimoNumeroConhecido };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase com Service Role Key (tem acesso total)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // ✅ DETECTAR SE É CHAMADA MANUAL OU AUTOMÁTICA (CRON)
    let body: any = {};
    try {
      body = await req.json();
      
      // ✅ NOVO: Detectar tipo de sincronização do body
      const tipoSync = body.tipo_sync || 'incremental_1min'; // Default: incremental 1min
    } catch {
      // Se não tiver body, é chamada automática (cron)
      body = {};
    }

    const isManualSync = body.store_id && (body.sync_type === 'ORDERS' || body.sync_type === 'CONTACTS');
    const syncType = body.sync_type || 'ORDERS'; // 'ORDERS' ou 'CONTACTS'
    
    if (isManualSync) {
      // ✅ SINCRONIZAÇÃO MANUAL (chamada do frontend) - roda em background
      console.log(`[SyncTiny] 🔥 SINCRONIZAÇÃO MANUAL ${syncType} iniciada em background...`);
      
      const storeId = body.store_id;
      const hardSync = body.hard_sync === true;
      
      // ✅ OBTER URL DO NETLIFY
      const netlifyUrl = Deno.env.get('NETLIFY_FUNCTION_URL') || 
                        Deno.env.get('NETLIFY_URL') || 
                        Deno.env.get('DEPLOY_PRIME_URL') ||
                        'https://eleveaone.com.br';

      // Buscar dados da loja
      const { data: storeData } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('id, name')
        .eq('id', storeId)
        .single();
      
      if (!storeData) {
        throw new Error(`Loja ${storeId} não encontrada`);
      }
      
      // Buscar integração
      const { data: integration } = await supabase
        .schema('sistemaretiradas')
        .from('erp_integrations')
        .select('*')
        .eq('store_id', storeId)
        .eq('sistema_erp', 'TINY')
        .eq('sync_status', 'CONNECTED')
        .single();
      
      if (!integration) {
        throw new Error(`Integração não encontrada ou não conectada para loja ${storeData.name}`);
      }

      // ✅ POLLING INTELIGENTE: Verificar mudanças antes de sincronizar (apenas para sync não-hard)
      if (!hardSync && syncType === 'ORDERS') {
        const { temNovaVenda, ultimoNumeroConhecido } = await verificarNovaVenda(supabase, storeId, netlifyUrl);
        
        if (!temNovaVenda) {
          console.log(`[SyncTiny] ⏭️ Sem nova venda detectada. Pulando sincronização.`);
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Sem nova venda detectada. Sincronização não necessária.',
              skipped: true,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
        
        console.log(`[SyncTiny] ✅ Nova venda detectada! Último conhecido: ${ultimoNumeroConhecido || 'nenhum'}. Iniciando sincronização incremental...`);
        
        // ✅ Passar último número conhecido para buscar apenas pedidos novos
        body.ultimo_numero_conhecido = ultimoNumeroConhecido;
      }
      
      // ✅ Determinar qual Netlify Function chamar
      const functionName = syncType === 'CONTACTS' ? 'sync-tiny-contacts-background' : 'sync-tiny-orders-background';
      const syncUrl = `${netlifyUrl}/.netlify/functions/${functionName}`;
      
      // ✅ Parâmetros para pedidos
      let syncBody: any = {
        store_id: storeId,
      };
      
      if (syncType === 'ORDERS') {
        syncBody = {
          ...syncBody,
          data_inicio: hardSync ? (body.data_inicio || '2010-01-01') : body.data_inicio,
          incremental: body.incremental !== undefined ? body.incremental : !hardSync,
          limit: hardSync ? 200 : (body.limit || 100), // Hard sync usa 200 por página
          max_pages: hardSync ? (body.max_pages || 99999) : (body.max_pages || 50),
          hard_sync: hardSync,
        };
      } else if (syncType === 'CONTACTS') {
        syncBody = {
          ...syncBody,
          limit: hardSync ? 200 : (body.limit || 100), // Hard sync usa 200 por página
          max_pages: hardSync ? (body.max_pages || 9999) : (body.max_pages || 50),
          hard_sync: hardSync,
        };
      }
      
      console.log(`[SyncTiny] 📡 Chamando Netlify Function ${functionName} para sincronizar loja ${storeData.name}...`);
      console.log(`[SyncTiny] 🔗 URL: ${syncUrl}`);
      console.log(`[SyncTiny] 📋 Parâmetros:`, JSON.stringify(syncBody, null, 2));
      
      // ✅ IMPORTANTE: Chamar assíncrono e retornar imediatamente (fire and forget)
      // Isso permite que a função rode em background sem esperar a resposta
      // A Edge Function (Deno) pode fazer fetch direto para Netlify Function sem proxy
      fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syncBody),
      }).then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[SyncTiny] ❌ Erro na resposta da Netlify Function:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
        } else {
          console.log(`[SyncTiny] ✅ Sincronização iniciada com sucesso em background`);
        }
      }).catch(err => {
        console.error(`[SyncTiny] ❌ Erro ao iniciar sync em background:`, err);
      });
      
      // Retornar imediatamente (fire and forget)
      return new Response(
        JSON.stringify({
          success: true,
          message: `Sincronização ${syncType === 'ORDERS' ? 'de pedidos' : 'de clientes'} iniciada em background para loja ${storeData.name}. Você pode fechar a página!`,
          sync_type: syncType,
          hard_sync: hardSync,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ✅ SINCRONIZAÇÃO AUTOMÁTICA (via cron)
    const tipoSync = body.tipo_sync || 'incremental_1min';
    console.log(`[SyncTinyOrders] 🚀 Iniciando sincronização automática: ${tipoSync}`)

    // Obter URL do Netlify
    const netlifyUrl = Deno.env.get('NETLIFY_FUNCTION_URL') || 
                      Deno.env.get('NETLIFY_URL') || 
                      Deno.env.get('DEPLOY_PRIME_URL') ||
                      'https://eleveaone.com.br';

    // 1. Buscar todas as lojas com integração ERP ativa
    const { data: integrations, error: integrationsError } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select(`
        id,
        store_id,
        sistema_erp,
        access_token,
        sync_status,
        stores:store_id (
          id,
          name
        )
      `)
      .eq('sistema_erp', 'TINY')
      .eq('sync_status', 'CONNECTED')
      .not('access_token', 'is', null)

    if (integrationsError) {
      console.error('[SyncTinyOrders] ❌ Erro ao buscar integrações:', integrationsError)
      throw integrationsError
    }

    if (!integrations || integrations.length === 0) {
      console.log('[SyncTinyOrders] ⚠️ Nenhuma integração ativa encontrada')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma integração ativa para sincronizar',
          results: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`[SyncTinyOrders] 📊 Encontradas ${integrations.length} integrações ativas`)

    // 2. Determinar parâmetros de sincronização baseado no tipo
    let syncParams: any = {};
    
    switch (tipoSync) {
      case 'incremental_1min':
        // A cada 1 minuto: Apenas vendas NOVAS (incremental otimizado)
        syncParams = {
          modo_incremental_otimizado: true,
          apenas_novas_vendas: true,
          limit: 100,
          max_pages: 10,
        };
        break;
        
      case 'ultima_hora':
        // A cada 1 hora: Últimas vendas da última hora (apenas atualizações)
        const umaHoraAtras = new Date();
        umaHoraAtras.setHours(umaHoraAtras.getHours() - 1);
        syncParams = {
          data_inicio: umaHoraAtras.toISOString().split('T')[0],
          apenas_atualizacoes: true,
          limit: 100,
          max_pages: 5,
        };
        break;
        
      case 'ultimo_dia':
        // A cada 1 dia: Vendas das últimas 24h
        const umDiaAtras = new Date();
        umDiaAtras.setDate(umDiaAtras.getDate() - 1);
        syncParams = {
          data_inicio: umDiaAtras.toISOString().split('T')[0],
          apenas_atualizacoes: true,
          limit: 100,
          max_pages: 20,
        };
        break;
        
      case 'ultimos_30_dias':
        // A cada 29 dias: Últimos 30 dias
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        syncParams = {
          data_inicio: trintaDiasAtras.toISOString().split('T')[0],
          apenas_atualizacoes: true,
          limit: 100,
          max_pages: 100,
        };
        break;
        
      case 'ultimos_7_dias':
        // A cada 6 dias: Últimos 7 dias
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        syncParams = {
          data_inicio: seteDiasAtras.toISOString().split('T')[0],
          apenas_atualizacoes: true,
          limit: 100,
          max_pages: 50,
        };
        break;
        
      case 'hard_sync':
        // A cada 60 dias: Hard sync (desde sempre, sem filtro de data)
        syncParams = {
          hard_sync: true,
          data_inicio: '2010-01-01',
          limit: 200,
          max_pages: 99999,
        };
        break;
        
      case 'resumo_3h':
        // Sempre às 3h da manhã: Resumo diário (últimas 24h)
        const umDiaAtrasResumo = new Date();
        umDiaAtrasResumo.setDate(umDiaAtrasResumo.getDate() - 1);
        syncParams = {
          data_inicio: umDiaAtrasResumo.toISOString().split('T')[0],
          apenas_atualizacoes: true,
          limit: 100,
          max_pages: 20,
        };
        break;
        
      default:
        console.warn(`[SyncTinyOrders] ⚠️ Tipo de sincronização desconhecido: ${tipoSync}. Usando incremental_1min.`);
        syncParams = {
          modo_incremental_otimizado: true,
          apenas_novas_vendas: true,
          limit: 100,
          max_pages: 10,
        };
    }

    // 3. Para cada integração, sincronizar pedidos
    const results: SyncResult[] = []
    
    for (const integration of integrations) {
      const storeId = integration.store_id
      const storeName = (integration.stores as any)?.name || 'Loja Desconhecida'
      
      console.log(`[SyncTinyOrders] 🔄 Processando loja: ${storeName} (${storeId}) - Tipo: ${tipoSync}`)

      try {
        // ✅ Para incremental_1min: Verificar se há nova venda antes de sincronizar
        if (tipoSync === 'incremental_1min') {
          const { temNovaVenda, ultimoNumeroConhecido } = await verificarNovaVenda(supabase, storeId, netlifyUrl);

          if (!temNovaVenda) {
            console.log(`[SyncTinyOrders] ⏭️ Sem nova venda detectada para loja ${storeName}. Pulando sincronização.`);
            results.push({
              store_id: storeId,
              store_name: storeName,
              success: true,
              synced: 0,
              updated: 0,
              errors: 0,
              message: 'Sem nova venda detectada. Sincronização não necessária.',
            });
            continue; // Pular para próxima loja
          }

          console.log(`[SyncTinyOrders] ✅ Nova venda detectada para loja ${storeName}! Último conhecido: ${ultimoNumeroConhecido || 'nenhum'}.`);
          syncParams.ultimo_numero_conhecido = ultimoNumeroConhecido;
        }

        // ✅ Para outros tipos: Verificar se há mudanças (opcional, pode ser implementado depois)
        // Por enquanto, sempre sincroniza para tipos que não são incremental_1min

        const syncUrl = `${netlifyUrl}/.netlify/functions/sync-tiny-orders-background`
        
        console.log(`[SyncTinyOrders] 📡 Chamando Netlify Function para sincronizar loja ${storeId}...`)
        
        const syncResponse = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            store_id: storeId,
            tipo_sync: tipoSync,
            ...syncParams,
          }),
        })

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text()
          console.error(`[SyncTinyOrders] ❌ Erro na resposta da Netlify Function:`, errorText)
          throw new Error(`Erro na sincronização: ${errorText}`)
        }

        const syncResult = await syncResponse.json()
        
        if (!syncResult.success) {
          throw new Error(syncResult.error || syncResult.message || 'Erro desconhecido na sincronização')
        }

        results.push({
          store_id: storeId,
          store_name: storeName,
          success: syncResult.success || false,
          synced: syncResult.synced || 0,
          updated: syncResult.updated || 0,
          errors: syncResult.errors || 0,
          message: syncResult.message || 'Sincronização concluída',
        })

        console.log(`[SyncTinyOrders] ✅ Loja ${storeName}: ${syncResult.synced || 0} pedidos sincronizados`)

      } catch (error: any) {
        console.error(`[SyncTinyOrders] ❌ Erro ao sincronizar loja ${storeName}:`, error)
        
        results.push({
          store_id: storeId,
          store_name: storeName,
          success: false,
          synced: 0,
          updated: 0,
          errors: 1,
          message: error.message || 'Erro desconhecido',
        })
      }
    }

    // 3. Resumo final
    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
    const successful = results.filter(r => r.success).length

    console.log(`[SyncTinyOrders] ✅ Sincronização concluída:`)
    console.log(`  - Lojas processadas: ${results.length}`)
    console.log(`  - Sucesso: ${successful}`)
    console.log(`  - Total sincronizados: ${totalSynced}`)
    console.log(`  - Total atualizados: ${totalUpdated}`)
    console.log(`  - Erros: ${totalErrors}`)

    // 4. Salvar log da sincronização
    for (const result of results) {
      await supabase
        .schema('sistemaretiradas')
        .from('erp_sync_logs')
        .insert({
          store_id: result.store_id,
          sistema_erp: 'TINY',
          tipo_sync: tipoSync || 'PEDIDOS_AUTO', // ✅ Usar tipo de sincronização correto
          status: result.success ? 'SUCCESS' : 'ERROR',
          registros_sincronizados: result.synced,
          registros_atualizados: result.updated,
          registros_com_erro: result.errors,
          error_message: result.success ? null : result.message,
          sync_at: new Date().toISOString(),
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${totalSynced} pedidos sincronizados em ${successful}/${results.length} lojas`,
        total_synced: totalSynced,
        total_updated: totalUpdated,
        total_errors: totalErrors,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('[SyncTinyOrders] ❌ Erro geral:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
