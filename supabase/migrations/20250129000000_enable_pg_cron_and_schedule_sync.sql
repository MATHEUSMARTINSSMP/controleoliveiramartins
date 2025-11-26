-- =============================================================================
-- Migration: Habilitar pg_cron e agendar sincronização automática
-- Data: 2025-01-29
-- Descrição: Configura sincronização automática de pedidos Tiny ERP
--            Executa a cada 30 minutos via Supabase Edge Function
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- ETAPA 1: Habilitar extensão pg_cron
-- =============================================================================

-- Verificar se a extensão já existe
DO $$
BEGIN
    -- Tentar criar a extensão (pode falhar se não tiver permissão)
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    
    EXCEPTION WHEN OTHERS THEN
        -- Se falhar, apenas logar (pode precisar ser habilitado no Supabase Dashboard)
        RAISE NOTICE 'pg_cron não pôde ser habilitado automaticamente. Habilite manualmente no Supabase Dashboard: Database → Extensions → pg_cron';
END $$;

-- =============================================================================
-- ETAPA 2: Criar função helper para chamar Edge Function
-- =============================================================================

-- Função para chamar a Supabase Edge Function de sincronização
CREATE OR REPLACE FUNCTION call_sync_tiny_orders_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
    response_status INT;
    response_body TEXT;
BEGIN
    -- Obter URL do Supabase (pode ser configurado como variável ou buscar de settings)
    -- Por enquanto, vamos usar uma variável de ambiente ou configurar manualmente
    -- NOTA: No Supabase, você pode usar secrets para armazenar a service_role_key
    
    -- Verificar se temos as configurações necessárias
    -- Se não tiver, a função não executará (evita erros)
    
    -- Por enquanto, vamos apenas logar que a função foi chamada
    -- A implementação completa requer configuração de secrets no Supabase
    RAISE NOTICE 'Função de sincronização chamada em: %', NOW();
    
    -- TODO: Implementar chamada HTTP para Edge Function
    -- Isso requer a extensão http ou usar uma abordagem diferente
    -- Por enquanto, vamos usar uma abordagem mais simples:
    -- A Edge Function será chamada diretamente pelo Supabase quando agendada
END;
$$;

-- =============================================================================
-- ETAPA 3: Agendar execução automática (se pg_cron estiver habilitado)
-- =============================================================================

-- Verificar se pg_cron está disponível antes de agendar
-- NOTA: O agendamento será feito manualmente após habilitar pg_cron
-- Esta seção apenas documenta o processo

-- =============================================================================
-- INSTRUÇÕES PARA AGENDAR MANUALMENTE:
-- =============================================================================
-- 1. Habilite pg_cron no Supabase Dashboard: Database → Extensions → pg_cron
-- 2. Configure SUPABASE_SERVICE_ROLE_KEY como secret em Edge Functions
-- 3. Execute o SQL abaixo no SQL Editor (substitua SEU_PROJETO_SUPABASE pela URL real):
--
-- SELECT cron.schedule(
--     'sync-tiny-orders-automatic',
--     '*/30 * * * *',
--     $$
--     SELECT net.http_post(
--         url := 'https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/sync-tiny-orders',
--         headers := jsonb_build_object(
--             'Content-Type', 'application/json',
--             'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--         )::jsonb,
--         body := '{}'::jsonb
--     ) AS request_id;
--     $$
-- );
-- =============================================================================

-- Tentar agendar automaticamente (pode falhar se pg_cron não estiver habilitado)
DO $$
BEGIN
    -- Verificar se pg_cron está disponível
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Tentar agendar (pode falhar se não tiver permissão)
        PERFORM cron.schedule(
            'sync-tiny-orders-automatic',
            '*/30 * * * *',
            'SELECT net.http_post(
                url := ''https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/sync-tiny-orders'',
                headers := jsonb_build_object(
                    ''Content-Type'', ''application/json'',
                    ''Authorization'', ''Bearer '' || current_setting(''app.service_role_key'', true)
                )::jsonb,
                body := ''{}''::jsonb
            ) AS request_id;'
        );
        
        RAISE NOTICE 'Sincronização automática agendada: a cada 30 minutos';
    ELSE
        RAISE NOTICE 'pg_cron não está habilitado. Habilite no Supabase Dashboard e execute o agendamento manualmente.';
    END IF;
    
    EXCEPTION WHEN OTHERS THEN
        -- Se falhar, logar instruções
        RAISE NOTICE 'Não foi possível agendar automaticamente. Execute manualmente:';
        RAISE NOTICE '1. Habilite pg_cron no Supabase Dashboard';
        RAISE NOTICE '2. Configure SUPABASE_SERVICE_ROLE_KEY como secret';
        RAISE NOTICE '3. Execute o SQL de agendamento manualmente (ver comentários acima)';
END $$;

-- =============================================================================
-- ETAPA 4: Criar tabela de configuração (opcional)
-- =============================================================================

-- Tabela para armazenar configurações de sincronização
CREATE TABLE IF NOT EXISTS erp_sync_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    sistema_erp TEXT NOT NULL DEFAULT 'TINY',
    enabled BOOLEAN DEFAULT true,
    interval_minutes INTEGER DEFAULT 30,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id, sistema_erp)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_erp_sync_schedule_enabled ON erp_sync_schedule(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_erp_sync_schedule_next_run ON erp_sync_schedule(next_run_at) WHERE enabled = true;

-- Comentários
COMMENT ON TABLE erp_sync_schedule IS 'Configuração de agendamento de sincronização automática por loja';
COMMENT ON COLUMN erp_sync_schedule.interval_minutes IS 'Intervalo em minutos entre sincronizações (padrão: 30)';
COMMENT ON COLUMN erp_sync_schedule.enabled IS 'Se a sincronização automática está habilitada para esta loja';

-- =============================================================================
-- ETAPA 5: Função para atualizar next_run_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_sync_schedule_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.next_run_at = NOW() + (NEW.interval_minutes || ' minutes')::INTERVAL;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger para atualizar next_run_at automaticamente
DROP TRIGGER IF EXISTS trigger_update_sync_schedule_next_run ON erp_sync_schedule;
CREATE TRIGGER trigger_update_sync_schedule_next_run
    BEFORE INSERT OR UPDATE OF interval_minutes ON erp_sync_schedule
    FOR EACH ROW
    EXECUTE FUNCTION update_sync_schedule_next_run();

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

-- Instruções finais
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration concluída!';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Habilite pg_cron no Supabase Dashboard';
    RAISE NOTICE '2. Configure SUPABASE_SERVICE_ROLE_KEY como secret';
    RAISE NOTICE '3. Deploy da Edge Function sync-tiny-orders';
    RAISE NOTICE '4. Execute o SQL de agendamento manualmente (ver documentação)';
    RAISE NOTICE '========================================';
END $$;

