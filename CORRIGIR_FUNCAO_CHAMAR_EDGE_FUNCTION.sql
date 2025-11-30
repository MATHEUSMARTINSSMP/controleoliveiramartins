-- ============================================================================
-- SCRIPT: Corrigir Função para Chamar Edge Function
-- Descrição: A função pode não estar conseguindo fazer chamada HTTP
-- ============================================================================

-- ============================================================================
-- PROBLEMA IDENTIFICADO:
-- O cron job executa, mas a função não consegue chamar a Edge Function
-- porque a extensão 'http' pode não estar disponível no Supabase.
-- ============================================================================

-- ============================================================================
-- SOLUÇÃO: Fazer a Edge Function processar a fila diretamente
-- Em vez de o cron chamar a Edge Function, a Edge Function pode ser chamada
-- via Supabase Scheduled Jobs (interface do dashboard) ou via n8n
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR EXTENSÕES DISPONÍVEIS
-- ============================================================================

SELECT 
    extname as extensao,
    extversion as versao,
    CASE extname
        WHEN 'http' THEN '✅ Disponível para chamadas HTTP'
        WHEN 'pg_net' THEN '✅ Disponível para chamadas HTTP (novo)'
        ELSE 'ℹ️ Outras extensões'
    END as observacao
FROM pg_extension
WHERE extname IN ('http', 'pg_net', 'pg_cron')
ORDER BY extname;

-- ============================================================================
-- 2. TESTAR A FUNÇÃO E VER O RETORNO REAL
-- ============================================================================

-- Executar e ver o JSON completo retornado
SELECT 
    sistemaretiradas.chamar_processar_fila_whatsapp() as resultado_json,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'success' as sucesso,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'error' as erro;

-- ============================================================================
-- 3. ALTERNATIVA: Criar função que processa a fila DIRETAMENTE no banco
-- ============================================================================

-- Em vez de chamar Edge Function via HTTP, podemos fazer a Edge Function
-- ser chamada via Scheduled Jobs do Supabase Dashboard
-- OU podemos processar diretamente no banco (mas precisa de acesso ao Netlify)

-- ============================================================================
-- 4. RECOMENDAÇÃO: Usar Supabase Scheduled Jobs (Dashboard)
-- ============================================================================

-- O Supabase tem uma interface para agendar chamadas HTTP
-- Acesse: Supabase Dashboard > Database > Scheduled Jobs
-- Configure para chamar: 
--   POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue
--   Header: Authorization: Bearer SEU_SERVICE_ROLE_KEY
--   Schedule: */1 * * * * (a cada 1 minuto)

-- ============================================================================
-- 5. VERIFICAR SE service_role_key ESTÁ CONFIGURADA
-- ============================================================================

SELECT 
    key,
    CASE 
        WHEN value IS NOT NULL AND value != '' THEN '✅ Configurado'
        ELSE '❌ Não configurado'
    END as status,
    LENGTH(value) as tamanho_chave
FROM sistemaretiradas.app_config
WHERE key = 'service_role_key';

-- ============================================================================
-- NOTA FINAL:
-- Se a extensão http não estiver disponível, a função não consegue fazer
-- chamadas HTTP. Nesse caso, use:
-- 1. Supabase Scheduled Jobs (via Dashboard)
-- 2. n8n ou outro serviço externo
-- 3. Ou processar a fila diretamente no banco (mais complexo)
-- ============================================================================

