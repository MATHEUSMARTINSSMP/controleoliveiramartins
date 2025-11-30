-- ============================================================================
-- SCRIPT: Testar Função e Ver Resultado Real
-- Descrição: Testar a função e ver o que ela realmente retorna
-- ============================================================================

-- ============================================================================
-- 1. TESTAR A FUNÇÃO E VER RESULTADO COMPLETO
-- ============================================================================

SELECT 
    sistemaretiradas.chamar_processar_fila_whatsapp() as resultado_json;

-- ============================================================================
-- 2. VER RESULTADO FORMATADO (Extrair campos do JSON)
-- ============================================================================

SELECT 
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'success' as sucesso,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'error' as erro,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'message' as mensagem;

-- ============================================================================
-- 3. VERIFICAR EXTENSÕES HTTP DISPONÍVEIS
-- ============================================================================

SELECT 
    extname as extensao,
    extversion as versao,
    CASE extname
        WHEN 'http' THEN '✅ Disponível - Pode fazer chamadas HTTP'
        WHEN 'pg_net' THEN '✅ Disponível - Pode fazer chamadas HTTP (novo)'
        ELSE 'ℹ️ Outras'
    END as status
FROM pg_extension
WHERE extname IN ('http', 'pg_net');

-- ============================================================================
-- 4. VERIFICAR service_role_key
-- ============================================================================

SELECT 
    key,
    CASE 
        WHEN value IS NOT NULL AND value != '' THEN '✅ Configurado'
        ELSE '❌ NÃO configurado'
    END as status,
    LENGTH(value) as tamanho_chave,
    LEFT(value, 20) || '...' as preview_chave
FROM sistemaretiradas.app_config
WHERE key = 'service_role_key';

-- ============================================================================
-- 5. VER LOGS DO POSTGRES (Se disponível)
-- ============================================================================

-- Os RAISE NOTICE e RAISE WARNING aparecem nos logs do Supabase
-- Verifique: Supabase Dashboard > Logs > Postgres Logs

-- ============================================================================
-- DIAGNÓSTICO:
-- Se a função retornar {"success": false, "error": "Extensão http não disponível"},
-- então precisamos de uma solução alternativa.
-- ============================================================================

