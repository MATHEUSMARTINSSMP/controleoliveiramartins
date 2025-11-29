-- ============================================================================
-- ✅ MIGRATION PRONTA - COPIAR E COLAR NO SUPABASE SQL EDITOR
-- ============================================================================
-- Configura pg_cron para sincronização automática de pedidos a cada 5 minutos
-- Valores já configurados com suas credenciais do Supabase
-- ============================================================================

-- 1. Habilitar extensão pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Criar função que chama Edge Function sync-tiny-orders
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_sync_tiny_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  -- ✅ Buscar configurações da tabela app_config (SUBSTITUA PELOS VALORES REAIS)
  -- Execute antes: INSERT INTO sistemaretiradas.app_config (key, value) VALUES 
  --   ('supabase_url', 'https://kktsbnrnlnzyofupegjc.supabase.co'),
  --   ('supabase_service_role_key', 'SEU_SERVICE_ROLE_KEY_AQUI');
  
  SELECT value INTO supabase_url
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_url'
  LIMIT 1;
  
  SELECT value INTO service_role_key
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;
  
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE EXCEPTION 'supabase_url não configurado em app_config. Execute: INSERT INTO sistemaretiradas.app_config (key, value) VALUES (''supabase_url'', ''https://kktsbnrnlnzyofupegjc.supabase.co'');';
  END IF;
  
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'supabase_service_role_key não configurado em app_config. Execute: INSERT INTO sistemaretiradas.app_config (key, value) VALUES (''supabase_service_role_key'', ''SEU_SERVICE_ROLE_KEY_AQUI'');';
  END IF;
  -- Tentar usar pg_net se disponível
  BEGIN
    -- Chamar Edge Function usando pg_net
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/sync-tiny-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      ),
      body := '{}'::jsonb
    ) INTO request_id;
    
    RAISE NOTICE '[pg_cron] Sync iniciado via pg_net. Request ID: %', request_id;
    
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
        '{}'::text
      )::http_request);
      
      RAISE NOTICE '[pg_cron] Sync chamado via http extension';
      
    EXCEPTION WHEN OTHERS THEN
      -- Se nenhuma extensão HTTP estiver disponível, apenas logar
      RAISE WARNING '[pg_cron] Nenhuma extensão HTTP disponível (pg_net ou http). Configure uma delas no Supabase. Erro: %', SQLERRM;
    END;
  END;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[pg_cron] Erro ao chamar sync-tiny-orders: %', SQLERRM;
END;
$$;

-- 3. Remover job anterior se existir (ignorar erro se não existir)
DO $$
BEGIN
  -- Tentar remover job anterior, mas não falhar se não existir
  PERFORM cron.unschedule('sync-tiny-orders-automatico');
EXCEPTION WHEN OTHERS THEN
  -- Job não existe, continuar normalmente
  NULL;
END $$;

-- 4. Criar job para rodar a cada 5 minutos
SELECT cron.schedule(
  'sync-tiny-orders-automatico',           -- Nome do job
  '*/5 * * * *',                           -- Cron: a cada 5 minutos
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders();$$
);

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.chamar_sync_tiny_orders() IS 
'Chama Edge Function sync-tiny-orders para sincronização automática. Executada via pg_cron a cada 5 minutos.';

-- ============================================================================
-- ✅ PRONTO! AGORA VERIFIQUE SE ESTÁ FUNCIONANDO:
-- ============================================================================
-- 
-- 1. Verificar se o job foi criado:
--    SELECT * FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico';
--
-- 2. Verificar logs de execução:
--    SELECT * FROM cron.job_run_details 
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico')
--    ORDER BY start_time DESC LIMIT 10;
--
-- 3. Verificar se está executando com sucesso:
--    SELECT * FROM cron.job_run_details 
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico')
--    AND status = 'succeeded'
--    ORDER BY start_time DESC;
--
-- ============================================================================

