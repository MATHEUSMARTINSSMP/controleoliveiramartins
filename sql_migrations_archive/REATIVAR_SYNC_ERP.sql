-- ============================================================================
-- REATIVAR SINCRONIZAÇÃO AUTOMÁTICA DO ERP
-- Execute este script se a sincronização parou de funcionar
-- ============================================================================

-- 1. VERIFICAR E HABILITAR pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. VERIFICAR SE A FUNÇÃO chamar_sync_tiny_orders EXISTE E ESTÁ CORRETA
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_sync_tiny_orders(
  p_tipo_sync TEXT DEFAULT 'incremental_1min'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
  body_json JSONB;
BEGIN
  -- Buscar configurações da tabela app_config
  SELECT value INTO supabase_url
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_url'
  LIMIT 1;
  
  SELECT value INTO service_role_key
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;
  
  -- Validar que URL está configurada
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE EXCEPTION 'Supabase URL não configurada. Execute: INSERT INTO sistemaretiradas.app_config (key, value) VALUES (''supabase_url'', ''SUA_URL_AQUI'');';
  END IF;
  
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Service Role Key não configurada. Execute: INSERT INTO sistemaretiradas.app_config (key, value) VALUES (''supabase_service_role_key'', ''SEU_KEY_AQUI'');';
  END IF;
  
  -- Construir body com tipo de sincronização
  body_json := jsonb_build_object('tipo_sync', p_tipo_sync);
  
  -- Tentar usar pg_net se disponível
  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/sync-tiny-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      ),
      body := body_json
    ) INTO request_id;
    
    RAISE NOTICE '[pg_cron] Sync % iniciado via pg_net. Request ID: %', p_tipo_sync, request_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Se pg_net não estiver disponível, tentar usar http extension
    BEGIN
      PERFORM http((
        'POST',
        supabase_url || '/functions/v1/sync-tiny-orders',
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || service_role_key),
          http_header('apikey', service_role_key)
        ],
        'application/json',
        body_json::text
      )::http_request);
      
      RAISE NOTICE '[pg_cron] Sync % chamado via http extension', p_tipo_sync;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[pg_cron] Nenhuma extensão HTTP disponível. Erro: %', SQLERRM;
    END;
  END;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[pg_cron] Erro ao chamar sync-tiny-orders (%): %', p_tipo_sync, SQLERRM;
END;
$$;

-- 3. REMOVER JOBS ANTIGOS (se existirem)
DO $$
BEGIN
  PERFORM cron.unschedule('sync-incremental-1min') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-incremental-1min'
  );
  PERFORM cron.unschedule('sync-ultima-hora') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-ultima-hora'
  );
  PERFORM cron.unschedule('sync-ultimo-dia') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-ultimo-dia'
  );
  PERFORM cron.unschedule('sync-tiny-orders-automatico') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico'
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignorar erros se jobs não existirem
END $$;

-- 4. CRIAR/REATIVAR JOB PRINCIPAL (a cada 1 minuto)
SELECT cron.schedule(
  'sync-incremental-1min',
  '* * * * *', -- A cada minuto
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');$$
);

-- 5. CRIAR JOB DE BACKUP (a cada 1 hora)
SELECT cron.schedule(
  'sync-ultima-hora',
  '0 * * * *', -- A cada hora (minuto 0)
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('ultima_hora');$$
);

-- 6. VERIFICAR SE OS JOBS FORAM CRIADOS
SELECT 
    'JOBS CRIADOS' as status,
    jobid,
    jobname,
    schedule,
    active,
    CASE 
        WHEN active THEN '✅ ATIVO'
        ELSE '❌ INATIVO - REATIVE MANUALMENTE'
    END as status_descricao
FROM cron.job
WHERE jobname LIKE '%sync%'
ORDER BY jobname;

-- 7. GARANTIR QUE AS CONFIGURAÇÕES ESTÃO PRESENTES
-- NOTA: Configure as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
-- ao invés de hardcodar valores aqui
-- INSERT INTO sistemaretiradas.app_config (key, value, description)
-- VALUES 
--     ('supabase_url', '${SUPABASE_URL}', 'URL do projeto Supabase'),
--     ('supabase_service_role_key', '${SUPABASE_SERVICE_ROLE_KEY}', 'Service Role Key do Supabase')
-- ON CONFLICT (key) DO UPDATE 
-- SET value = EXCLUDED.value,
--     updated_at = NOW();

-- 8. TESTAR A FUNÇÃO MANUALMENTE (OPCIONAL - DESCOMENTE PARA TESTAR)
-- SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================
SELECT 
    'VERIFICAÇÃO FINAL' as status,
    'Execute DIAGNOSTICAR_SYNC_ERP.sql para verificar se tudo está funcionando' as proximo_passo;


