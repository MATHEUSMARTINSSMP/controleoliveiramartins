-- ============================================================================
-- SCRIPT: Testar Função Agora que service_role_key está configurada
-- Descrição: Testar se a função consegue chamar a Edge Function
-- ============================================================================

-- ============================================================================
-- 1. TESTAR A FUNÇÃO E VER RESULTADO COMPLETO
-- ============================================================================

SELECT 
    sistemaretiradas.chamar_processar_fila_whatsapp() as resultado_json;

-- ============================================================================
-- 2. VER RESULTADO FORMATADO
-- ============================================================================

SELECT 
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'success' as sucesso,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'error' as erro,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'message' as mensagem;

-- ============================================================================
-- 3. VERIFICAR SE EXTENSÃO http ESTÁ DISPONÍVEL
-- ============================================================================

SELECT 
    extname as extensao,
    extversion as versao,
    CASE extname
        WHEN 'http' THEN '✅ Disponível - Pode fazer chamadas HTTP'
        WHEN 'pg_net' THEN '✅ Disponível - Pode fazer chamadas HTTP (novo)'
        ELSE '❌ Não encontrada'
    END as status
FROM pg_extension
WHERE extname IN ('http', 'pg_net');

-- ============================================================================
-- 4. VER MENSAGENS PENDENTES ANTES DE TESTAR
-- ============================================================================

SELECT 
    COUNT(*) as total_pendentes,
    STRING_AGG(id::TEXT, ', ') as ids_pendentes
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';

-- ============================================================================
-- 5. PROCESSAR FILA MANUALMENTE AGORA
-- ============================================================================

-- Chamar a função manualmente para processar as mensagens pendentes
SELECT sistemaretiradas.chamar_processar_fila_whatsapp() as resultado_processamento;

-- ============================================================================
-- 6. VER MENSAGENS PENDENTES DEPOIS (Execute novamente após alguns segundos)
-- ============================================================================

-- Execute esta query novamente depois de alguns segundos para ver se diminuiu
SELECT 
    COUNT(*) as total_pendentes,
    STRING_AGG(id::TEXT, ', ') as ids_pendentes
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';

