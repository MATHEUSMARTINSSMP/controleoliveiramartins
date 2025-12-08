-- ============================================================================
-- Habilitar pg_net para permitir requisições HTTP dos cron jobs
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- 1. HABILITAR EXTENSÃO pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. VERIFICAR SE FOI HABILITADA
SELECT 
    'EXTENSÃO pg_net' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
        ) THEN '✅ HABILITADA'
        ELSE '❌ NÃO FOI POSSÍVEL HABILITAR'
    END as status;

-- 3. TESTAR A FUNÇÃO DE SYNC MANUALMENTE (OPCIONAL)
-- Descomente a linha abaixo para testar:
-- SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');

-- ============================================================================
-- NOTA: Se pg_net não puder ser habilitado, verifique se:
-- 1. Você tem permissões de superuser no banco
-- 2. A extensão está disponível no seu plano do Supabase
-- 3. Se necessário, use a extensão 'http' como alternativa
-- ============================================================================

