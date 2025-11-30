-- ============================================================================
-- QUERY: Diagnosticar Função Helper
-- Descrição: Verificar se a função está realmente chamando a Edge Function
-- ============================================================================

-- ============================================================================
-- 1. VER O CÓDIGO DA FUNÇÃO
-- ============================================================================

SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'sistemaretiradas'
  AND routine_name = 'chamar_processar_fila_whatsapp';

-- ============================================================================
-- 2. TESTAR A FUNÇÃO MANUALMENTE E VER RESULTADO
-- ============================================================================

SELECT sistemaretiradas.chamar_processar_fila_whatsapp() as resultado;

-- ============================================================================
-- 3. VERIFICAR SE EXTENSÃO http ESTÁ DISPONÍVEL
-- ============================================================================

SELECT 
    extname as extensao,
    extversion as versao
FROM pg_extension
WHERE extname IN ('http', 'pg_net');

-- ============================================================================
-- 4. VERIFICAR CONFIGURAÇÃO DO service_role_key
-- ============================================================================

SELECT 
    key,
    CASE 
        WHEN LENGTH(value) > 0 THEN '✅ Configurado (' || LENGTH(value) || ' caracteres)'
        ELSE '❌ Não configurado'
    END as status,
    description
FROM sistemaretiradas.app_config
WHERE key = 'service_role_key';

-- ============================================================================
-- 5. VER LOGS DE EXECUÇÃO COM MAIS DETALHES
-- ============================================================================

SELECT 
    runid,
    start_time,
    end_time,
    status,
    return_message,
    LEFT(return_message, 200) as mensagem_resumida
FROM cron.job_run_details
WHERE jobid = 35
  AND start_time >= NOW() - INTERVAL '10 minutes'
ORDER BY start_time DESC;

-- ============================================================================
-- 6. ALTERNATIVA: Criar função que chama Edge Function diretamente
-- ============================================================================

-- A função atual pode estar usando http extension que não está disponível
-- Vamos criar uma versão melhorada que usa o método correto

-- PRIMEIRO: Ver qual método está disponível
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN 'http extension disponível'
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN 'pg_net disponível'
        ELSE 'Nenhuma extensão HTTP disponível'
    END as extensoes_disponiveis;

