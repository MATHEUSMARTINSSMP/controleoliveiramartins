-- ============================================================================
-- SCRIPT: Configurar service_role_key
-- Descrição: Adicionar service_role_key na tabela app_config
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE JÁ EXISTE
-- ============================================================================

SELECT 
    key,
    CASE 
        WHEN value IS NOT NULL AND value != '' THEN '✅ Já configurado'
        ELSE '❌ Não configurado'
    END as status,
    description
FROM sistemaretiradas.app_config
WHERE key = 'service_role_key';

-- ============================================================================
-- 2. INSERIR OU ATUALIZAR service_role_key
-- ============================================================================

-- IMPORTANTE: Substitua 'SUA_SERVICE_ROLE_KEY_AQUI' pela chave real do Supabase
-- Você encontra a chave em: Supabase Dashboard > Settings > API > service_role key

INSERT INTO sistemaretiradas.app_config (key, value, description)
VALUES (
    'service_role_key',
    'SUA_SERVICE_ROLE_KEY_AQUI',  -- ⚠️ SUBSTITUIR PELA CHAVE REAL
    'Chave de serviço do Supabase para chamadas administrativas (Edge Functions, etc)'
)
ON CONFLICT (key) DO UPDATE 
SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- ============================================================================
-- 3. VERIFICAR SE FOI CONFIGURADA
-- ============================================================================

SELECT 
    key,
    CASE 
        WHEN value IS NOT NULL AND value != '' THEN '✅ Configurado'
        ELSE '❌ Não configurado'
    END as status,
    LENGTH(value) as tamanho_chave,
    LEFT(value, 20) || '...' as preview_chave
FROM sistemaretiradas.app_config
WHERE key = 'service_role_key';

-- ============================================================================
-- 4. TESTAR A FUNÇÃO NOVAMENTE (Depois de configurar)
-- ============================================================================

-- Descomentar para testar:
-- SELECT sistemaretiradas.chamar_processar_fila_whatsapp() as resultado;

-- ============================================================================
-- ONDE ENCONTRAR A SERVICE_ROLE_KEY:
-- ============================================================================
-- 1. Acesse Supabase Dashboard
-- 2. Vá em Settings > API
-- 3. Procure por "service_role" key
-- 4. Copie a chave (é uma string longa que começa com "eyJ...")
-- 5. Cole no lugar de 'SUA_SERVICE_ROLE_KEY_AQUI' acima
-- ============================================================================

