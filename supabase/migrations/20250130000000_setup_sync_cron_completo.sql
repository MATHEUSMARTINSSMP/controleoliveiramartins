-- ============================================================================
-- Migration: Configuração Completa de Sincronização Automática
-- Data: 2025-01-30
-- Descrição: Configura todos os jobs pg_cron para sincronização automática
-- ============================================================================

-- 1. Criar tabela app_config se não existir (para armazenar chaves sensíveis)
CREATE TABLE IF NOT EXISTS sistemaretiradas.app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_app_config_key ON sistemaretiradas.app_config(key);

-- RLS: Apenas ADMIN pode ver/editar configurações
ALTER TABLE sistemaretiradas.app_config ENABLE ROW LEVEL SECURITY;

-- Política: Apenas ADMIN pode ver configurações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'sistemaretiradas' 
    AND tablename = 'app_config' 
    AND policyname = 'app_config_select_admin'
  ) THEN
    CREATE POLICY "app_config_select_admin"
      ON sistemaretiradas.app_config
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM sistemaretiradas.profiles
          WHERE id = auth.uid()
          AND role = 'ADMIN'
        )
      );
  END IF;
END $$;

-- Política: Apenas ADMIN pode inserir/atualizar configurações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'sistemaretiradas' 
    AND tablename = 'app_config' 
    AND policyname = 'app_config_modify_admin'
  ) THEN
    CREATE POLICY "app_config_modify_admin"
      ON sistemaretiradas.app_config
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM sistemaretiradas.profiles
          WHERE id = auth.uid()
          AND role = 'ADMIN'
        )
      );
  END IF;
END $$;

-- 2. Habilitar extensão pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Criar função que chama Edge Function com parâmetros específicos
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_sync_tiny_orders(
  p_tipo_sync TEXT DEFAULT 'incremental_1min' -- Tipo de sincronização
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
  -- ✅ Buscar configurações da tabela app_config (sem expor chaves no código)
  SELECT value INTO supabase_url
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_url'
  LIMIT 1;
  
  SELECT value INTO service_role_key
  FROM sistemaretiradas.app_config
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;
  
  -- ✅ Validar que URL está configurada
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

-- 3. Remover jobs anteriores se existirem
DO $$
BEGIN
  PERFORM cron.unschedule('sync-incremental-1min');
  PERFORM cron.unschedule('sync-ultima-hora');
  PERFORM cron.unschedule('sync-ultimo-dia');
  PERFORM cron.unschedule('sync-ultimos-30-dias');
  PERFORM cron.unschedule('sync-ultimos-7-dias');
  PERFORM cron.unschedule('sync-hard-60-dias');
  PERFORM cron.unschedule('sync-resumo-3h');
  PERFORM cron.unschedule('sync-tiny-orders-automatico'); -- Job antigo
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignorar erros se jobs não existirem
END $$;

-- 4. Criar todos os jobs de sincronização

-- ✅ JOB 1: A cada 1 minuto - Apenas vendas NOVAS (incremental otimizado)
SELECT cron.schedule(
  'sync-incremental-1min',
  '* * * * *', -- A cada minuto
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');$$
);

-- ✅ JOB 2: A cada 1 hora - Últimas vendas da última hora (apenas atualizações)
SELECT cron.schedule(
  'sync-ultima-hora',
  '0 * * * *', -- A cada hora (minuto 0)
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('ultima_hora');$$
);

-- ✅ JOB 3: A cada 1 dia - Vendas das últimas 24h
SELECT cron.schedule(
  'sync-ultimo-dia',
  '0 0 * * *', -- Todo dia à meia-noite
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('ultimo_dia');$$
);

-- ✅ JOB 4: A cada 29 dias - Últimos 30 dias
SELECT cron.schedule(
  'sync-ultimos-30-dias',
  '0 0 1 * *', -- Dia 1 de cada mês (aproximadamente a cada 29-31 dias)
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('ultimos_30_dias');$$
);

-- ✅ JOB 5: A cada 6 dias - Últimos 7 dias
SELECT cron.schedule(
  'sync-ultimos-7-dias',
  '0 0 */6 * *', -- A cada 6 dias
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('ultimos_7_dias');$$
);

-- ✅ JOB 6: A cada 60 dias - Hard sync (desde sempre, sem filtro de data)
SELECT cron.schedule(
  'sync-hard-60-dias',
  '0 0 1 */2 *', -- Dia 1 a cada 2 meses (aproximadamente 60 dias)
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('hard_sync');$$
);

-- ✅ JOB 7: Sempre às 3h da manhã - Resumo diário (opcional, pode ser usado para relatórios)
SELECT cron.schedule(
  'sync-resumo-3h',
  '0 3 * * *', -- Todo dia às 3h da manhã
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders('resumo_3h');$$
);

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.chamar_sync_tiny_orders(TEXT) IS 
'Chama Edge Function sync-tiny-orders com tipo de sincronização específico. Tipos: incremental_1min, ultima_hora, ultimo_dia, ultimos_30_dias, ultimos_7_dias, hard_sync, resumo_3h';

-- ============================================================================
-- ✅ CONFIGURAÇÃO COMPLETA - PRONTO PARA USO!
-- ============================================================================
-- Jobs criados:
-- 1. sync-incremental-1min: A cada 1 minuto (apenas vendas novas)
-- 2. sync-ultima-hora: A cada 1 hora (últimas vendas da última hora)
-- 3. sync-ultimo-dia: A cada 1 dia (vendas das últimas 24h)
-- 4. sync-ultimos-30-dias: A cada 29 dias (últimos 30 dias)
-- 5. sync-ultimos-7-dias: A cada 6 dias (últimos 7 dias)
-- 6. sync-hard-60-dias: A cada 60 dias (hard sync, desde sempre)
-- 7. sync-resumo-3h: Sempre às 3h da manhã (resumo diário)
-- ============================================================================

