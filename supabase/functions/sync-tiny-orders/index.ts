/**
 * Supabase Edge Function: Sincronização Automática de Pedidos Tiny ERP
 * 
 * Esta função roda em background (agendada via pg_cron) para sincronizar
 * pedidos do Tiny ERP mesmo quando a página está fechada.
 * 
 * Execução: A cada 30 minutos (configurável)
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

    console.log('[SyncTinyOrders] 🚀 Iniciando sincronização automática...')

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

    // 2. Para cada integração, sincronizar pedidos
    const results: SyncResult[] = []
    
    for (const integration of integrations) {
      const storeId = integration.store_id
      const storeName = (integration.stores as any)?.name || 'Loja Desconhecida'
      
      console.log(`[SyncTinyOrders] 🔄 Sincronizando loja: ${storeName} (${storeId})`)

      try {
        // Calcular data de início (últimas 12 horas)
        const dozeHorasAtras = new Date()
        dozeHorasAtras.setHours(dozeHorasAtras.getHours() - 12)
        const dataInicio = dozeHorasAtras.toISOString().split('T')[0]

        // ✅ ESTRATÉGIA: Chamar Netlify Function que tem a lógica completa de sincronização
        // Isso reutiliza o código existente sem duplicação
        // A Netlify Function chama syncTinyOrders que já está implementado
        
        const netlifyUrl = Deno.env.get('NETLIFY_FUNCTION_URL') || 'https://eleveaone.com.br'
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
            data_inicio: dataInicio,
            incremental: true,
            limit: 50,
            max_pages: 2,
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
          tipo_sync: 'PEDIDOS_AUTO',
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

