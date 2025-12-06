-- ============================================================================
-- Script de Migracao: Copiar dados de stores para whatsapp_credentials
-- Data: 2025-12-06
-- Descricao: Migra tokens e configuracoes WhatsApp de stores para a tabela dedicada
-- ============================================================================

-- PASSO 1: Verificar dados existentes em stores com WhatsApp configurado
SELECT 
    s.id,
    s.name,
    s.uazapi_token,
    s.uazapi_instance_id,
    s.whatsapp_ativo,
    s.whatsapp_connection_status,
    p.email as admin_email
FROM sistemaretiradas.stores s
JOIN sistemaretiradas.profiles p ON s.admin_id = p.id
WHERE s.uazapi_token IS NOT NULL 
   OR s.uazapi_instance_id IS NOT NULL
   OR s.whatsapp_ativo = true;

-- ============================================================================
-- PASSO 2: Inserir/Atualizar dados em whatsapp_credentials
-- ============================================================================
-- Funcao para gerar slug compativel com o frontend
CREATE OR REPLACE FUNCTION sistemaretiradas.generate_store_slug(store_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                unaccent(store_name),
                '[^a-zA-Z0-9]+', '_', 'g'
            ),
            '^_|_$', '', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Migracao dos dados
INSERT INTO sistemaretiradas.whatsapp_credentials (
    customer_id,
    site_slug,
    uazapi_instance_id,
    uazapi_token,
    uazapi_phone_number,
    uazapi_status,
    whatsapp_instance_name,
    status
)
SELECT 
    p.email as customer_id,
    sistemaretiradas.generate_store_slug(s.name) as site_slug,
    s.uazapi_instance_id,
    s.uazapi_token,
    NULL as uazapi_phone_number,
    COALESCE(s.whatsapp_connection_status, 'disconnected') as uazapi_status,
    sistemaretiradas.generate_store_slug(s.name) as whatsapp_instance_name,
    'active' as status
FROM sistemaretiradas.stores s
JOIN sistemaretiradas.profiles p ON s.admin_id = p.id
WHERE (s.uazapi_token IS NOT NULL OR s.uazapi_instance_id IS NOT NULL)
  AND s.active = true
ON CONFLICT (customer_id, site_slug)
DO UPDATE SET
    uazapi_instance_id = COALESCE(EXCLUDED.uazapi_instance_id, whatsapp_credentials.uazapi_instance_id),
    uazapi_token = COALESCE(EXCLUDED.uazapi_token, whatsapp_credentials.uazapi_token),
    uazapi_status = COALESCE(EXCLUDED.uazapi_status, whatsapp_credentials.uazapi_status),
    updated_at = NOW();

-- ============================================================================
-- PASSO 3: Verificar resultado da migracao
-- ============================================================================
SELECT 
    wc.customer_id,
    wc.site_slug,
    wc.whatsapp_instance_name,
    wc.uazapi_instance_id,
    CASE WHEN wc.uazapi_token IS NOT NULL THEN 'TOKEN PRESENTE' ELSE 'SEM TOKEN' END as token_status,
    wc.uazapi_status,
    wc.status,
    wc.created_at,
    wc.updated_at
FROM sistemaretiradas.whatsapp_credentials wc
ORDER BY wc.updated_at DESC;

-- ============================================================================
-- PASSO 4 (OPCIONAL): Limpar dados antigos de stores apos confirmar migracao
-- CUIDADO: Execute apenas apos confirmar que os dados foram migrados corretamente!
-- ============================================================================
-- UPDATE sistemaretiradas.stores
-- SET 
--     uazapi_token = NULL,
--     uazapi_instance_id = NULL,
--     whatsapp_connection_status = NULL
-- WHERE uazapi_token IS NOT NULL OR uazapi_instance_id IS NOT NULL;

-- ============================================================================
-- VERIFICACAO FINAL
-- ============================================================================
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM sistemaretiradas.whatsapp_credentials
    WHERE status = 'active';
    
    RAISE NOTICE 'Migracao concluida! Total de credenciais em whatsapp_credentials: %', migrated_count;
END $$;
