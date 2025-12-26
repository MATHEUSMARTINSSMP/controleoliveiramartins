-- ============================================================================
-- Migration: Sincronização Automática de Reviews do Google My Business
-- Data: 2025-12-26
-- Descrição: Cria cron job para sincronizar reviews automaticamente
-- ============================================================================

-- 1. Habilitar extensão pg_cron (se não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Criar função para chamar Netlify Function de sincronização
CREATE OR REPLACE FUNCTION sistemaretiradas.sync_google_reviews_automatico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  netlify_function_url TEXT;
  supabase_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  -- Buscar configurações
  SELECT value INTO supabase_url
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_url'
  LIMIT 1;

  SELECT value INTO service_role_key
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;

  -- URL da Netlify Function (ajustar conforme necessário)
  netlify_function_url := COALESCE(
    (SELECT value FROM sistemaretiradas.app_config WHERE key = 'netlify_function_base_url'),
    'https://eleveaone.com.br/.netlify/functions'
  ) || '/google-reviews-fetch';

  -- Tentar usar pg_net primeiro (mais eficiente)
  BEGIN
    SELECT net.http_post(
      url := netlify_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'trigger', 'cron',
        'sync_all', true
      )
    ) INTO request_id;

    RAISE NOTICE '[pg_cron] Sync Google Reviews iniciado via pg_net. Request ID: %', request_id;

  EXCEPTION WHEN OTHERS THEN
    -- Se pg_net não estiver disponível, tentar usar http extension
    BEGIN
      PERFORM http((
        'POST',
        netlify_function_url,
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || service_role_key)
        ],
        'application/json',
        json_build_object('trigger', 'cron', 'sync_all', true)::text
      )::http_request);

      RAISE NOTICE '[pg_cron] Sync Google Reviews chamado via http extension';

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[pg_cron] Nenhuma extensão HTTP disponível. Erro: %', SQLERRM;
    END;
  END;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[pg_cron] Erro ao chamar sync Google Reviews: %', SQLERRM;
END;
$$;

-- 3. Remover job anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('sync-google-reviews-automatico');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Criar cron job para rodar a cada 6 horas
SELECT cron.schedule(
  'sync-google-reviews-automatico',
  '0 */6 * * *', -- A cada 6 horas
  $$SELECT sistemaretiradas.sync_google_reviews_automatico();$$
);

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.sync_google_reviews_automatico() IS 
'Chama Netlify Function google-reviews-fetch para sincronização automática de reviews. Executada via pg_cron a cada 6 horas.';

-- ============================================================================
-- COMANDOS ÚTEIS PARA GERENCIAR CRON JOB
-- ============================================================================
-- Ver todos os cron jobs:
-- SELECT * FROM cron.job ORDER BY jobid;

-- Ver logs do cron job:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-google-reviews-automatico')
-- ORDER BY start_time DESC LIMIT 10;

-- Parar o cron job:
-- SELECT cron.unschedule('sync-google-reviews-automatico');

-- Reativar o cron job:
-- SELECT cron.schedule('sync-google-reviews-automatico', '0 */6 * * *', 
--   $$SELECT sistemaretiradas.sync_google_reviews_automatico();$$);


