-- ============================================================================
-- Migration: Configurar pg_cron para Sincronização Automática de Pedidos
-- Data: 2025-01-29
-- Descrição: Cria job no pg_cron para chamar Edge Function sync-tiny-orders
--            a cada 5 minutos, mantendo notificações quase "push"
-- ============================================================================

-- 1. Habilitar extensão pg_cron (se não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Criar função auxiliar para chamar Edge Function via http
-- Esta função será chamada pelo pg_cron
-- NOTA: Requer extensão pg_net habilitada no Supabase
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_sync_tiny_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT := 'https://ljcqoxpevrckwwsctxhb.supabase.co';
  service_role_key TEXT;
  response_status INT;
  response_body TEXT;
BEGIN
  -- Buscar Service Role Key da tabela de configuração
  SELECT value INTO service_role_key
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;
  
  -- Se não encontrou, tentar usar variável de ambiente ou valor padrão
  IF service_role_key IS NULL OR service_role_key = '' THEN
    -- Tentar obter de variável de ambiente (se configurada)
    BEGIN
      service_role_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Se ainda não encontrou, usar valor hardcoded (SUBSTITUA!)
    IF service_role_key IS NULL OR service_role_key = '' THEN
      RAISE EXCEPTION 'Service Role Key não configurada. Execute: INSERT INTO sistemaretiradas.app_config (key, value) VALUES (''supabase_service_role_key'', ''SEU_KEY_AQUI'');';
    END IF;
  END IF;
  
  -- Chamar Edge Function sync-tiny-orders usando pg_net
  -- A função detecta automaticamente que é chamada via cron (sem body = {})
  SELECT status, content INTO response_status, response_body
  FROM net.http_post(
    url := supabase_url || '/functions/v1/sync-tiny-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key
    ),
    body := '{}'::jsonb
  );
  
  -- Log do resultado
  RAISE NOTICE '[pg_cron] Sync chamado: Status %, Response: %', response_status, LEFT(response_body, 200);
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, logar mas não falhar (para não quebrar o cron)
    RAISE WARNING '[pg_cron] Erro ao chamar sync-tiny-orders: %', SQLERRM;
END;
$$;

-- 4. Criar job no pg_cron para rodar a cada 5 minutos
-- Remove job anterior se existir
SELECT cron.unschedule('sync-tiny-orders-automatico');

-- Agenda job para rodar a cada 5 minutos
SELECT cron.schedule(
  'sync-tiny-orders-automatico',           -- Nome do job
  '*/5 * * * *',                           -- Cron expression: a cada 5 minutos
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders();$$  -- Função a executar
);

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.chamar_sync_tiny_orders() IS 
'Chama Edge Function sync-tiny-orders para sincronização automática de pedidos. Executada via pg_cron a cada 5 minutos.';

-- ============================================================================
-- NOTA IMPORTANTE: Configuração Necessária
-- ============================================================================
-- Para que esta migration funcione, você precisa:
--
-- 1. Executar a migration 20250129000001_create_app_config_table.sql primeiro
-- 2. Inserir o Service Role Key na tabela app_config (apenas ADMIN pode fazer):
--
--    INSERT INTO sistemaretiradas.app_config (key, value, description)
--    VALUES (
--      'supabase_service_role_key',
--      'SEU_SERVICE_ROLE_KEY_AQUI',
--      'Service Role Key do Supabase para chamar Edge Functions via pg_cron'
--    );
--
-- 3. Você pode encontrar o Service Role Key em:
--    Supabase Dashboard > Settings > API > service_role (secret)
--
-- 4. Verificar se o job foi criado:
--    SELECT * FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico';
--
-- 5. Ver logs do job:
--    SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico');
-- ============================================================================

