-- ============================================
-- CRON JOB PARA MARKETING WORKER
-- ============================================
-- Cria um cron job para executar o marketing-worker
-- automaticamente a cada 1 minuto
-- ============================================

-- Função para chamar o marketing-worker
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_marketing_worker()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_netlify_url TEXT;
  v_service_role_key TEXT;
  v_supabase_url TEXT;
  v_response_body TEXT;
  v_request_id BIGINT;
BEGIN
  -- Obter variáveis de ambiente
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  v_netlify_url := 'https://eleveaone.com.br/.netlify/functions/marketing-worker';
  
  -- Se não tiver variáveis configuradas, usar valores padrão
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://kktsbnrnlnzyofupegjc.supabase.co';
  END IF;
  
  -- Tentar usar pg_net para chamar a Netlify Function
  BEGIN
    SELECT net.http_post(
      url := v_netlify_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) INTO v_request_id;
    
    RAISE NOTICE '[pg_cron] Marketing worker iniciado via pg_net. Request ID: %', v_request_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'request_id', v_request_id,
      'netlify_url', v_netlify_url
    );
  EXCEPTION WHEN OTHERS THEN
    -- Se pg_net não estiver disponível, tentar http extension
    BEGIN
      PERFORM http_post(
        v_netlify_url,
        '{}'::json,
        'application/json'
      );
      RAISE NOTICE '[pg_cron] Marketing worker chamado via http extension';
      
      RETURN jsonb_build_object(
        'success', true,
        'netlify_url', v_netlify_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[pg_cron] Nenhuma extensão HTTP disponível (pg_net ou http). Configure uma delas no Supabase. Erro: %', SQLERRM;
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'netlify_url', v_netlify_url
      );
    END;
  END;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.chamar_marketing_worker IS 
'Chama Netlify Function marketing-worker para processar jobs de geração de mídia. Executada via pg_cron a cada 1 minuto.';

-- Remover job existente se houver
DO $$
BEGIN
  PERFORM cron.unschedule('marketing-worker-automatico');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Criar job para executar a cada 1 minuto
SELECT cron.schedule(
  'marketing-worker-automatico',
  '* * * * *', -- A cada minuto
  $$SELECT sistemaretiradas.chamar_marketing_worker();$$
);

-- =====================================================
-- COMANDOS ÚTEIS PARA GERENCIAR CRON JOB
-- =====================================================

-- Ver todos os cron jobs:
-- SELECT * FROM cron.job ORDER BY jobid;

-- Ver logs do cron job:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'marketing-worker-automatico')
-- ORDER BY start_time DESC LIMIT 10;

-- Parar o job:
-- SELECT cron.unschedule('marketing-worker-automatico');

-- Reiniciar o job:
-- SELECT cron.unschedule('marketing-worker-automatico');
-- SELECT cron.schedule(
--   'marketing-worker-automatico',
--   '* * * * *',
--   $$SELECT sistemaretiradas.chamar_marketing_worker();$$
-- );

