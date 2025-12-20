-- =====================================================
-- CORREÇÃO FORÇADA: LOUNGERIE WHATSAPP
-- =====================================================
-- Dados da UazAPI:
-- - Token: db5cac34-cd20-44d5-bacd-f1f9d3360789
-- - Número: 559681094159
-- - Status: connected
-- - Instance ID: loungerie_<customer_id> (gerado automaticamente)
-- =====================================================

-- 1. BUSCAR DADOS DA LOJA LOUNGERIE
SELECT 
    '🔍 DADOS DA LOJA' as info,
    s.id as store_id,
    s.name as store_name,
    s.site_slug,
    s.admin_id as store_admin_id,
    p.email as admin_email,
    s.whatsapp_ativo
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) = 'loungerie'
LIMIT 1;

-- 2. CORRIGIR/ATUALIZAR WHATSAPP_CREDENTIALS
-- IMPORTANTE: Ajustar admin_id e customer_id conforme resultado da query acima
DO $$
DECLARE
    v_site_slug TEXT := 'loungerie';
    v_admin_email TEXT := 'matheusmartinss@icloud.com'; -- Ajustar se necessário
    v_admin_id UUID;
    v_store_slug TEXT;
    v_instance_id TEXT;
BEGIN
    -- Buscar admin_id pelo email
    SELECT id INTO v_admin_id
    FROM sistemaretiradas.profiles
    WHERE email = v_admin_email
    AND role = 'ADMIN'
    LIMIT 1;

    -- Buscar site_slug real da loja
    SELECT COALESCE(site_slug, 'loungerie') INTO v_store_slug
    FROM sistemaretiradas.stores
    WHERE LOWER(name) LIKE '%loungerie%'
       OR LOWER(COALESCE(site_slug, '')) = 'loungerie'
    LIMIT 1;

    -- Gerar instance_id (formato: slug_customer_id)
    v_instance_id := v_store_slug || '_' || REPLACE(LOWER(v_admin_email), '@', '_');

    RAISE NOTICE 'Admin ID: %', v_admin_id;
    RAISE NOTICE 'Site Slug: %', v_store_slug;
    RAISE NOTICE 'Instance ID: %', v_instance_id;

    -- Verificar se já existe registro
    IF EXISTS (
        SELECT 1 FROM sistemaretiradas.whatsapp_credentials
        WHERE site_slug = v_store_slug
        AND admin_id = v_admin_id
    ) THEN
        -- UPDATE: Atualizar registro existente
        UPDATE sistemaretiradas.whatsapp_credentials
        SET 
            uazapi_status = 'connected',
            uazapi_token = 'db5cac34-cd20-44d5-bacd-f1f9d3360789',
            uazapi_instance_id = v_instance_id,
            uazapi_phone_number = '559681094159',
            updated_at = NOW()
        WHERE site_slug = v_store_slug
        AND admin_id = v_admin_id;

        RAISE NOTICE '✅ Registro atualizado para site_slug: %, admin_id: %', v_store_slug, v_admin_id;
    ELSE
        -- INSERT: Criar novo registro
        INSERT INTO sistemaretiradas.whatsapp_credentials (
            admin_id,
            customer_id,
            site_slug,
            uazapi_status,
            uazapi_token,
            uazapi_instance_id,
            uazapi_phone_number,
            status,
            is_global,
            updated_at,
            created_at
        ) VALUES (
            v_admin_id,
            v_admin_email, -- customer_id = email do admin
            v_store_slug,
            'connected',
            'db5cac34-cd20-44d5-bacd-f1f9d3360789',
            v_instance_id,
            '559681094159',
            'active',
            false,
            NOW(),
            NOW()
        );

        RAISE NOTICE '✅ Novo registro criado para site_slug: %, admin_id: %', v_store_slug, v_admin_id;
    END IF;
END $$;

-- 3. VERIFICAR SE ATUALIZOU CORRETAMENTE
SELECT 
    '✅ VERIFICAÇÃO APÓS CORREÇÃO' as info,
    wc.id,
    wc.admin_id,
    wc.customer_id,
    wc.site_slug,
    wc.uazapi_status,
    LEFT(wc.uazapi_token, 20) || '...' as token_preview,
    wc.uazapi_instance_id,
    wc.uazapi_phone_number,
    wc.updated_at,
    s.name as store_name,
    s.whatsapp_ativo,
    CASE 
        WHEN wc.uazapi_status = 'connected' AND wc.uazapi_phone_number = '559681094159' THEN '✅ CORRETO'
        ELSE '⚠️ VERIFICAR'
    END as status_validacao
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE LOWER(wc.site_slug) = 'loungerie'
   OR s.id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%'
   )
ORDER BY wc.updated_at DESC
LIMIT 1;

-- 4. ATIVAR WHATSAPP_ATIVO SE ESTIVER DESATIVADO
UPDATE sistemaretiradas.stores
SET whatsapp_ativo = true,
    updated_at = NOW()
WHERE LOWER(name) LIKE '%loungerie%'
   OR LOWER(COALESCE(site_slug, '')) = 'loungerie'
   AND (whatsapp_ativo IS NULL OR whatsapp_ativo = false);

-- 5. VERIFICAÇÃO FINAL COMPLETA
SELECT 
    '📊 STATUS FINAL LOUNGERIE' as info,
    s.id as store_id,
    s.name as store_name,
    s.site_slug,
    s.whatsapp_ativo,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    LEFT(wc.uazapi_token, 20) || '...' as token_preview,
    wc.updated_at,
    CASE 
        WHEN wc.uazapi_status = 'connected' 
         AND wc.uazapi_phone_number = '559681094159'
         AND wc.uazapi_token = 'db5cac34-cd20-44d5-bacd-f1f9d3360789'
         AND s.whatsapp_ativo = true
        THEN '✅ TUDO CORRETO'
        ELSE '⚠️ AINDA HÁ PROBLEMAS'
    END as status_final
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.whatsapp_credentials wc ON wc.site_slug = s.site_slug AND wc.is_global = false
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(COALESCE(s.site_slug, '')) = 'loungerie'
ORDER BY s.updated_at DESC
LIMIT 1;

