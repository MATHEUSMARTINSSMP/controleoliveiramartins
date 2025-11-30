-- ============================================================================
-- SCRIPT: Configuração Completa - Executar Tudo de Uma Vez
-- Descrição: Configura service_role_key e testa a função
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURAR service_role_key
-- ============================================================================

INSERT INTO sistemaretiradas.app_config (key, value, description)
VALUES (
    'service_role_key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s',
    'Chave de serviço do Supabase para chamadas administrativas (Edge Functions, etc)'
)
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- ============================================================================
-- 2. VERIFICAR SE FOI CONFIGURADA
-- ============================================================================

SELECT 
    key,
    '✅ Configurado' as status,
    LENGTH(value) as tamanho_chave,
    LEFT(value, 30) || '...' as preview_chave
FROM sistemaretiradas.app_config
WHERE key = 'service_role_key';

-- ============================================================================
-- 3. TESTAR A FUNÇÃO (Deve funcionar agora!)
-- ============================================================================

SELECT 
    sistemaretiradas.chamar_processar_fila_whatsapp() as resultado,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'success' as sucesso,
    (sistemaretiradas.chamar_processar_fila_whatsapp())->>'error' as erro;

-- ============================================================================
-- 4. VERIFICAR MENSAGENS PENDENTES (Antes)
-- ============================================================================

SELECT 
    COUNT(*) as total_pendentes,
    MIN(created_at) as mais_antiga
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';

-- ============================================================================
-- PRÓXIMOS PASSOS:
-- 1. Execute esta query completa
-- 2. Aguarde alguns minutos
-- 3. Execute a Query 4 novamente para ver se as mensagens foram processadas
-- ============================================================================

