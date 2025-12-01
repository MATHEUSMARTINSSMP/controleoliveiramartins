-- ============================================================================
-- REATIVAR POOLING INTELIGENTE
-- ============================================================================
-- Este script reativa e garante que o pooling inteligente esteja funcionando

-- 1. HABILITAR EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. VERIFICAR STATUS DAS EXTENSÕES
SELECT 
    extname AS extensao,
    CASE 
        WHEN extname = 'pg_cron' THEN '✅ CRÍTICO: Usado para agendar jobs'
        WHEN extname = 'pg_net' THEN '✅ CRÍTICO: Usado para fazer requisições HTTP'
        ELSE 'ℹ️ Disponível'
    END AS status,
    extversion AS versao
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net');

-- 3. REMOVER TODOS OS JOBS DE SYNC EXISTENTES (PARA REINICIAR LIMPO)
DO $$
BEGIN
    -- Remover todos os jobs de sync existentes
    PERFORM cron.unschedule(jobname) 
    FROM cron.job 
    WHERE jobname LIKE '%sync%';
    
    RAISE NOTICE '✅ Jobs antigos removidos';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao remover jobs antigos: %', SQLERRM;
END $$;

-- 4. VERIFICAR SE AS CONFIGURAÇÕES EXISTEM
DO $$
DECLARE
    v_url TEXT;
    v_key TEXT;
BEGIN
    -- Verificar URL do Supabase
    SELECT value INTO v_url
    FROM sistemaretiradas.app_config
    WHERE key = 'supabase_url'
    LIMIT 1;
    
    IF v_url IS NULL OR v_url = '' THEN
        INSERT INTO sistemaretiradas.app_config (key, value, description)
        VALUES (
            'supabase_url',
            'https://kktsbnrnlnzyofupegjc.supabase.co',
            'URL do projeto Supabase para Edge Functions'
        )
        ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW();
        
        RAISE NOTICE '✅ Configuração supabase_url adicionada/atualizada';
    END IF;
    
    -- Verificar Service Role Key
    SELECT value INTO v_key
    FROM sistemaretiradas.app_config
    WHERE key = 'supabase_service_role_key'
    LIMIT 1;
    
    IF v_key IS NULL OR v_key = '' THEN
        RAISE WARNING '❌ ATENÇÃO: supabase_service_role_key não configurada!';
        RAISE WARNING '   Execute: INSERT INTO sistemaretiradas.app_config (key, value) VALUES (''supabase_service_role_key'', ''SUA_KEY_AQUI'');';
    ELSE
        RAISE NOTICE '✅ Service Role Key configurada';
    END IF;
END $$;

-- 5. RECRIAR A FUNÇÃO DE CHAMADA (GARANTIR QUE ESTÁ ATUALIZADA)
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
  -- Buscar configurações
  SELECT value INTO supabase_url
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_url'
  LIMIT 1;
  
  SELECT value INTO service_role_key
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;
  
  -- Fallback para URL
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://kktsbnrnlnzyofupegjc.supabase.co';
  END IF;
  
  -- Validar Service Role Key
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Service Role Key não configurada em app_config';
  END IF;
  
  -- Construir body com tipo de sincronização
  body_json := jsonb_build_object('tipo_sync', p_tipo_sync);
  
  -- Tentar usar pg_net primeiro (preferencial)
  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/sync-tiny-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      ),
      body := body_json,
      timeout_milliseconds := 30000  -- 30 segundos de timeout
    ) INTO request_id;
    
    RAISE NOTICE '[POOLING] Sync % iniciado via pg_net. Request ID: %', p_tipo_sync, request_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Se pg_net falhar, tentar http extension como fallback
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
      
      RAISE NOTICE '[POOLING] Sync % chamado via http extension', p_tipo_sync;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[POOLING] ❌ Nenhuma extensão HTTP disponível. Erro: %', SQLERRM;
      RAISE EXCEPTION 'Não foi possível fazer requisição HTTP: %', SQLERRM;
    END;
  END;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[POOLING] ❌ Erro ao chamar sync-tiny-orders (%): %', p_tipo_sync, SQLERRM;
    RAISE;
END;
$$;

-- 6. RECRIAR O CRON JOB PARA POOLING INTELIGENTE (A CADA 1 MINUTO)
SELECT cron.schedule(
  'sync-incremental-1min',
  '* * * * *',  -- A cada minuto
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');$$
);

-- 7. VERIFICAR SE O JOB FOI CRIADO
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    CASE 
        WHEN active THEN '✅ ATIVO'
        ELSE '❌ INATIVO'
    END AS status
FROM cron.job
WHERE jobname = 'sync-incremental-1min';

-- 8. TESTAR A FUNÇÃO MANUALMENTE (OPCIONAL - DESCOMENTE PARA TESTAR)
-- SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');

-- ============================================================================
-- ✅ POOLING INTELIGENTE REATIVADO!
-- ============================================================================
-- O job 'sync-incremental-1min' está agendado para executar a cada 1 minuto
-- Ele irá:
-- 1. Verificar se há novas vendas antes de sincronizar (pooling inteligente)
-- 2. Sincronizar apenas se houver mudanças
-- 3. Evitar requisições desnecessárias à API do Tiny
-- 
-- Para verificar se está funcionando:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-incremental-1min')
-- ORDER BY start_time DESC LIMIT 10;
-- ============================================================================

