-- ============================================================================
-- VERIFICAR REQUISIÇÕES HTTP DO pg_net
-- ============================================================================
-- Este script verifica se as requisições HTTP estão sendo feitas corretamente
-- e se há erros nas chamadas para a Edge Function
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE pg_net ESTÁ HABILITADO
-- ============================================================================
SELECT 
    '1. Extensão pg_net' as verificacao,
    extname as extensao,
    extversion as versao
FROM pg_extension
WHERE extname = 'pg_net';

-- ============================================================================
-- 2. VERIFICAR ÚLTIMAS REQUISIÇÕES HTTP DO pg_net
-- ============================================================================
-- Nota: pg_net armazena histórico de requisições na tabela net.http_request_queue
SELECT 
    '2. Últimas requisições HTTP (pg_net)' as verificacao,
    id,
    method,
    url,
    status_code,
    error_msg,
    created,
    started_at,
    finished_at,
    CASE 
        WHEN status_code IS NULL AND error_msg IS NULL THEN '⏳ Pendente'
        WHEN status_code >= 200 AND status_code < 300 THEN '✅ Sucesso'
        WHEN status_code >= 400 THEN '❌ Erro HTTP'
        WHEN error_msg IS NOT NULL THEN '❌ Erro: ' || error_msg
        ELSE '⚠️ Desconhecido'
    END as status_detalhado
FROM net.http_request_queue
WHERE url LIKE '%process-cashback-queue%'
ORDER BY created DESC
LIMIT 20;

-- ============================================================================
-- 3. VERIFICAR ESTATÍSTICAS DE REQUISIÇÕES
-- ============================================================================
SELECT 
    '3. Estatísticas de requisições' as verificacao,
    COUNT(*) as total_requisicoes,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as sucessos,
    COUNT(*) FILTER (WHERE status_code >= 400) as erros_http,
    COUNT(*) FILTER (WHERE error_msg IS NOT NULL) as erros_geral,
    COUNT(*) FILTER (WHERE status_code IS NULL AND error_msg IS NULL) as pendentes,
    MAX(created) as ultima_requisicao
FROM net.http_request_queue
WHERE url LIKE '%process-cashback-queue%'
  AND created > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- 4. VERIFICAR SE HÁ REQUISIÇÕES RECENTES (últimas 2 horas)
-- ============================================================================
SELECT 
    '4. Requisições nas últimas 2 horas' as verificacao,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as sucessos,
    COUNT(*) FILTER (WHERE status_code IS NULL) as ainda_nao_processadas
FROM net.http_request_queue
WHERE url LIKE '%process-cashback-queue%'
  AND created > NOW() - INTERVAL '2 hours';

-- ============================================================================
-- 5. TESTAR CHAMADA MANUAL E VERIFICAR SE APARECE NO HISTÓRICO
-- ============================================================================
-- Execute este bloco para testar uma chamada manual
/*
DO $$
DECLARE
    request_id bigint;
BEGIN
    SELECT id INTO request_id
    FROM net.http_post(
        url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s'
        ),
        body := '{}'::jsonb
    );
    
    RAISE NOTICE '✅ Requisição criada. ID: %', request_id;
    RAISE NOTICE 'Aguarde alguns segundos e execute novamente a query 2 para ver o resultado';
END;
$$;
*/

-- ============================================================================
-- 6. VERIFICAR CONFIGURAÇÃO DA FUNÇÃO chamar_process_cashback_queue
-- ============================================================================
SELECT 
    '6. Função chamar_process_cashback_queue' as verificacao,
    p.proname as nome,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%net.http_post%' 
        THEN '✅ Usa net.http_post'
        ELSE '❌ NÃO usa net.http_post'
    END as usa_pg_net,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%process-cashback-queue%' 
        THEN '✅ URL correta'
        ELSE '❌ URL incorreta ou não encontrada'
    END as url_correta
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
AND p.proname = 'chamar_process_cashback_queue';

