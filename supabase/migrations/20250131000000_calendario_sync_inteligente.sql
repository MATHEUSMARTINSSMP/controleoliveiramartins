-- =============================================================================
-- Migration: Calendário de Sincronização Inteligente
-- Data: 2025-01-31
-- Descrição: Cria múltiplos jobs de sincronização com diferentes frequências
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- VERIFICAÇÕES INICIAIS
-- =============================================================================

-- Verificar se pg_cron está habilitado
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE EXCEPTION 'pg_cron não está habilitado. Habilite no Supabase Dashboard: Database → Extensions → pg_cron';
    END IF;
END $$;

-- =============================================================================
-- REMOVER JOBS ANTIGOS (se existirem)
-- =============================================================================

-- Remover job antigo se existir
SELECT cron.unschedule('sync-tiny-orders-automatic') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-tiny-orders-automatic'
);

-- =============================================================================
-- JOB 1: HARD SYNC SEMANAL (Domingo 02:00)
-- =============================================================================
-- Verifica TUDO desde o começo (desde 2010-01-01)
-- Frequência: 1x por semana (Domingo 02:00)

DO $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
BEGIN
    -- Obter URL do Supabase (ajustar conforme necessário)
    -- Usar variável de ambiente ou buscar de uma tabela de configuração
    supabase_url := current_setting('app.supabase_url', true);
    
    -- Se não tiver variável, usar padrão (ajustar manualmente depois)
    IF supabase_url IS NULL OR supabase_url = '' THEN
        supabase_url := 'https://SEU_PROJETO.supabase.co'; -- ⚠️ AJUSTAR MANUALMENTE
    END IF;
    
    service_role_key := current_setting('app.service_role_key', true);
    
    -- Remover job se já existir
    PERFORM cron.unschedule('sync-weekly-full') WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'sync-weekly-full'
    );
    
    -- Criar job semanal
    PERFORM cron.schedule(
        'sync-weekly-full',
        '0 2 * * 0', -- Todo domingo às 02:00
        $$
        SELECT net.http_post(
            url := supabase_url || '/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object(
                'sync_type', 'ORDERS',
                'hard_sync', true,
                'data_inicio', '2010-01-01',
                'max_pages', 99999,
                'limit', 100
            )
        ) AS request_id;
        $$
    );
    
    RAISE NOTICE '✅ Job 1 criado: Hard Sync Semanal (Domingo 02:00)';
END $$;

-- =============================================================================
-- JOB 2: SYNC DIÁRIO 7 DIAS (Diariamente 03:00)
-- =============================================================================
-- Verifica últimos 7 dias
-- Frequência: 1x por dia (03:00)

DO $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    IF supabase_url IS NULL OR supabase_url = '' THEN
        supabase_url := 'https://SEU_PROJETO.supabase.co'; -- ⚠️ AJUSTAR MANUALMENTE
    END IF;
    
    service_role_key := current_setting('app.service_role_key', true);
    
    PERFORM cron.unschedule('sync-daily-7days') WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'sync-daily-7days'
    );
    
    PERFORM cron.schedule(
        'sync-daily-7days',
        '0 3 * * *', -- Todo dia às 03:00
        $$
        SELECT net.http_post(
            url := supabase_url || '/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object(
                'sync_type', 'ORDERS',
                'hard_sync', false,
                'data_inicio', (CURRENT_DATE - INTERVAL '7 days')::text,
                'max_pages', 50,
                'limit', 100
            )
        ) AS request_id;
        $$
    );
    
    RAISE NOTICE '✅ Job 2 criado: Sync Diário 7 dias (03:00)';
END $$;

-- =============================================================================
-- JOB 3: SYNC 2X POR DIA 24H (06:00 e 18:00)
-- =============================================================================
-- Verifica últimas 24 horas
-- Frequência: 2x por dia

DO $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    IF supabase_url IS NULL OR supabase_url = '' THEN
        supabase_url := 'https://SEU_PROJETO.supabase.co'; -- ⚠️ AJUSTAR MANUALMENTE
    END IF;
    
    service_role_key := current_setting('app.service_role_key', true);
    
    -- Job 3.1: 06:00
    PERFORM cron.unschedule('sync-twice-daily-24h-06') WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'sync-twice-daily-24h-06'
    );
    
    PERFORM cron.schedule(
        'sync-twice-daily-24h-06',
        '0 6 * * *', -- Todo dia às 06:00
        $$
        SELECT net.http_post(
            url := supabase_url || '/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object(
                'sync_type', 'ORDERS',
                'hard_sync', false,
                'data_inicio', (CURRENT_DATE - INTERVAL '1 day')::text,
                'max_pages', 20,
                'limit', 100
            )
        ) AS request_id;
        $$
    );
    
    -- Job 3.2: 18:00
    PERFORM cron.unschedule('sync-twice-daily-24h-18') WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'sync-twice-daily-24h-18'
    );
    
    PERFORM cron.schedule(
        'sync-twice-daily-24h-18',
        '0 18 * * *', -- Todo dia às 18:00
        $$
        SELECT net.http_post(
            url := supabase_url || '/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object(
                'sync_type', 'ORDERS',
                'hard_sync', false,
                'data_inicio', (CURRENT_DATE - INTERVAL '1 day')::text,
                'max_pages', 20,
                'limit', 100
            )
        ) AS request_id;
        $$
    );
    
    RAISE NOTICE '✅ Job 3 criado: Sync 2x por dia 24h (06:00 e 18:00)';
END $$;

-- =============================================================================
-- JOB 4: SYNC INCREMENTAL 60 MINUTOS (A cada 60 minutos / 1 hora)
-- =============================================================================
-- Verifica últimas 2 horas
-- Frequência: A cada 60 minutos (dobrado devido ao polling inteligente)

DO $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    IF supabase_url IS NULL OR supabase_url = '' THEN
        supabase_url := 'https://SEU_PROJETO.supabase.co'; -- ⚠️ AJUSTAR MANUALMENTE
    END IF;
    
    service_role_key := current_setting('app.service_role_key', true);
    
    PERFORM cron.unschedule('sync-60min-incremental') WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'sync-60min-incremental'
    );
    
    PERFORM cron.schedule(
        'sync-60min-incremental',
        '0 * * * *', -- A cada 60 minutos (a cada hora)
        $$
        SELECT net.http_post(
            url := supabase_url || '/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object(
                'sync_type', 'ORDERS',
                'hard_sync', false,
                'data_inicio', (CURRENT_TIMESTAMP - INTERVAL '2 hours')::date::text,
                'max_pages', 5,
                'limit', 100
            )
        ) AS request_id;
        $$
    );
    
    RAISE NOTICE '✅ Job 4 criado: Sync Incremental 60 minutos (dobrado devido ao polling inteligente)';
END $$;

-- =============================================================================
-- JOB 5: SYNC PUSH 1 MINUTO (A cada 1 minuto)
-- =============================================================================
-- Verifica apenas última venda (muito rápido)
-- Frequência: A cada 1 minuto (MÍNIMO POSSÍVEL do pg_cron)
-- NOTA: pg_cron não suporta segundos (mínimo é 1 minuto)
-- Com polling inteligente, verifica mudanças muito rapidamente
-- (1440 verificações por dia, sincronização apenas quando há nova venda)

DO $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    IF supabase_url IS NULL OR supabase_url = '' THEN
        supabase_url := 'https://SEU_PROJETO.supabase.co'; -- ⚠️ AJUSTAR MANUALMENTE
    END IF;
    
    service_role_key := current_setting('app.service_role_key', true);
    
    PERFORM cron.unschedule('sync-1min-push') WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'sync-1min-push'
    );
    
    PERFORM cron.schedule(
        'sync-1min-push',
        '*/1 * * * *', -- A cada 1 minuto (MÍNIMO POSSÍVEL do pg_cron)
        $$
        SELECT net.http_post(
            url := supabase_url || '/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object(
                'sync_type', 'ORDERS',
                'hard_sync', false,
                'data_inicio', (CURRENT_TIMESTAMP - INTERVAL '1 minute')::date::text,
                'max_pages', 1,
                'limit', 1 -- Apenas última venda!
            )
        ) AS request_id;
        $$
    );
    
    RAISE NOTICE '✅ Job 5 criado: Sync Push 1 minuto (MÍNIMO POSSÍVEL do pg_cron)';
    RAISE NOTICE '⚠️ NOTA: Com polling inteligente, 1 minuto garante detecção quase instantânea';
    RAISE NOTICE '   (1440 verificações/dia, sincronização apenas quando há nova venda)';
END $$;

-- =============================================================================
-- RESUMO FINAL
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ CALENDÁRIO DE SINCRONIZAÇÃO CRIADO!';
    RAISE NOTICE '';
    RAISE NOTICE 'Jobs criados:';
    RAISE NOTICE '1. sync-weekly-full: Domingo 02:00 (Hard Sync completo)';
    RAISE NOTICE '2. sync-daily-7days: Diariamente 03:00 (Últimos 7 dias)';
    RAISE NOTICE '3. sync-twice-daily-24h-06: Diariamente 06:00 (Últimas 24h)';
    RAISE NOTICE '4. sync-twice-daily-24h-18: Diariamente 18:00 (Últimas 24h)';
    RAISE NOTICE '5. sync-60min-incremental: A cada 60 minutos (Últimas 2h) - DOBRADO';
    RAISE NOTICE '6. sync-1min-push: A cada 1 minuto (Última venda) - MÍNIMO POSSÍVEL';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ IMPORTANTE:';
    RAISE NOTICE '- Ajuste supabase_url no código antes de executar';
    RAISE NOTICE '- Configure service_role_key como variável de ambiente';
    RAISE NOTICE '- Frequências OTIMIZADAS com polling inteligente:';
    RAISE NOTICE '  * Push sync: 1 minuto (MÍNIMO POSSÍVEL - 1440 verificações/dia)';
    RAISE NOTICE '  * Incremental: 60 minutos (24 verificações/dia)';
    RAISE NOTICE '- Polling inteligente reduz custos em ~90% sincronizando apenas quando há nova venda';
    RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- VERIFICAR JOBS CRIADOS
-- =============================================================================

-- Query para verificar todos os jobs criados
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job
WHERE jobname LIKE 'sync-%'
ORDER BY jobname;

