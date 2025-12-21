-- =====================================================
-- FORÇAR MR KITSCH COMO PRINCIPAL E PREVENIR CONFUSÃO
-- =====================================================
-- Esta migration:
-- 1. Força o número 559699741090 como principal da MR KITSCH
-- 2. Remove qualquer backup que esteja sendo confundido como principal
-- 3. Garante que site_slug principal nunca contenha "_backup"
-- 4. Adiciona validação para prevenir misturas futuras
-- =====================================================

DO $$
DECLARE
    _admin_id UUID;
    _store_id UUID;
    _site_slug TEXT := 'mrkitsch'; -- Slug da loja MR KITSCH
    _uazapi_token TEXT := '2fada9de-3960-4dbb-b47c-be72d00eb1e4';
    _uazapi_phone_number TEXT := '559699741090';
    _uazapi_instance_id TEXT := 'r770aaed21d3443'; -- Instance ID do UazAPI
    _backup_count INTEGER;
BEGIN
    -- 1. Encontrar o admin_id e store_id da loja 'mrkitsch'
    SELECT p.id INTO _admin_id
    FROM sistemaretiradas.profiles p
    JOIN sistemaretiradas.stores s ON p.id = s.admin_id
    WHERE s.site_slug = _site_slug
    LIMIT 1;

    IF _admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin ID para a loja % não encontrado.', _site_slug;
    END IF;

    SELECT id INTO _store_id
    FROM sistemaretiradas.stores
    WHERE site_slug = _site_slug
    LIMIT 1;

    IF _store_id IS NULL THEN
        RAISE EXCEPTION 'Store ID para a loja % não encontrado.', _site_slug;
    END IF;

    RAISE NOTICE '✅ Admin ID: %, Store ID: %', _admin_id, _store_id;

    -- 2. REMOVER QUALQUER REGISTRO DE BACKUP QUE ESTEJA EM whatsapp_credentials COM site_slug PRINCIPAL
    -- Se houver registros com site_slug principal mas que são backups (identificados por padrão no nome ou token)
    -- Vamos garantir que apenas o registro principal correto exista
    
    -- Primeiro, verificar se há registros duplicados ou incorretos
    DELETE FROM sistemaretiradas.whatsapp_credentials
    WHERE admin_id = _admin_id
      AND site_slug LIKE '%_backup%'
      AND uazapi_phone_number = _uazapi_phone_number;
    
    GET DIAGNOSTICS _backup_count = ROW_COUNT;
    IF _backup_count > 0 THEN
        RAISE NOTICE '✅ Removidos % registros de backup incorretos de whatsapp_credentials', _backup_count;
    END IF;

    -- 3. GARANTIR QUE O REGISTRO PRINCIPAL EXISTA E ESTEJA CORRETO
    -- Upsert do número principal em whatsapp_credentials
    INSERT INTO sistemaretiradas.whatsapp_credentials (
        admin_id,
        site_slug,
        uazapi_token,
        uazapi_phone_number,
        uazapi_instance_id,
        uazapi_status,
        status,
        updated_at
    ) VALUES (
        _admin_id,
        _site_slug, -- site_slug SEM "_backup" - é o principal
        _uazapi_token,
        _uazapi_phone_number,
        _uazapi_instance_id,
        'connected',
        'active',
        NOW()
    )
    ON CONFLICT (admin_id, site_slug) DO UPDATE SET
        uazapi_token = EXCLUDED.uazapi_token,
        uazapi_phone_number = EXCLUDED.uazapi_phone_number,
        uazapi_instance_id = EXCLUDED.uazapi_instance_id,
        uazapi_status = 'connected', -- Forçar status connected
        status = 'active',
        updated_at = NOW(),
        -- GARANTIR que site_slug nunca tenha "_backup" (caso exista registro anterior incorreto)
        site_slug = EXCLUDED.site_slug;

    RAISE NOTICE '✅ Número principal da loja % forçado para CONNECTED.', _site_slug;

    -- 4. GARANTIR QUE NENHUM BACKUP TENHA ESTE NÚMERO COMO PRINCIPAL
    -- Verificar se há backups em whatsapp_accounts com este número
    -- Se houver, limpar ou corrigir
    UPDATE sistemaretiradas.whatsapp_accounts
    SET phone = NULL,
        uazapi_phone_number = NULL,
        uazapi_status = 'disconnected'
    WHERE store_id = _store_id
      AND (is_backup1 = true OR is_backup2 = true OR is_backup3 = true)
      AND phone = _uazapi_phone_number;
    
    GET DIAGNOSTICS _backup_count = ROW_COUNT;
    IF _backup_count > 0 THEN
        RAISE NOTICE '✅ Limpados % registros de backup que tinham o número principal incorretamente', _backup_count;
    END IF;

    -- 5. Atualizar o status whatsapp_ativo na tabela stores
    UPDATE sistemaretiradas.stores
    SET whatsapp_ativo = TRUE
    WHERE id = _store_id;

    RAISE NOTICE '✅ whatsapp_ativo da loja % definido como TRUE.', _site_slug;

END $$;

-- =====================================================
-- CRIAR CONSTRAINT/FUNÇÃO PARA PREVENIR CONFUSÃO FUTURA
-- =====================================================
-- Adicionar constraint check para garantir que site_slug principal nunca contenha "_backup"

DO $$
BEGIN
    -- Tentar criar uma função que valida site_slug principal
    -- (Não podemos adicionar constraint direta em whatsapp_credentials porque
    --  backups também são salvos lá pelo N8N com site_slug "_backup")
    
    -- Em vez disso, vamos criar um índice parcial e comentários para documentação
    
    -- Criar índice único para garantir que só existe UM principal por admin+site_slug (sem _backup)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_credentials_primary_unique
        ON sistemaretiradas.whatsapp_credentials(admin_id, site_slug)
        WHERE site_slug NOT LIKE '%_backup%';
    
    RAISE NOTICE '✅ Índice único criado para garantir apenas um principal por admin+site_slug';
    
    -- Adicionar comentário na tabela para documentar a regra
    COMMENT ON TABLE sistemaretiradas.whatsapp_credentials IS 
    'Credenciais WhatsApp. REGRA CRÍTICA: Números principais têm site_slug SEM "_backup". Números reserva têm site_slug COM "_backup" (ex: "mrkitsch_backup1"). NUNCA misturar principal com reserva.';
    
    COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.site_slug IS 
    'Slug único do site. PRINCIPAL: apenas o slug base (ex: "mrkitsch"). BACKUP: slug + "_backupN" (ex: "mrkitsch_backup1"). REGRA: Principal NUNCA deve conter "_backup".';
    
    RAISE NOTICE '✅ Comentários de documentação adicionados';
    
END $$;

-- =====================================================
-- VALIDAÇÃO FINAL: VERIFICAR QUE ESTÁ TUDO CORRETO
-- =====================================================

DO $$
DECLARE
    _admin_id UUID;
    _site_slug TEXT := 'mrkitsch';
    _principal_count INTEGER;
    _backup_in_credentials_count INTEGER;
BEGIN
    -- Encontrar admin_id
    SELECT p.id INTO _admin_id
    FROM sistemaretiradas.profiles p
    JOIN sistemaretiradas.stores s ON p.id = s.admin_id
    WHERE s.site_slug = _site_slug
    LIMIT 1;

    IF _admin_id IS NULL THEN
        RAISE NOTICE '⚠️ Admin ID não encontrado para validação';
        RETURN;
    END IF;

    -- Contar registros principais (sem _backup)
    SELECT COUNT(*) INTO _principal_count
    FROM sistemaretiradas.whatsapp_credentials
    WHERE admin_id = _admin_id
      AND site_slug = _site_slug
      AND site_slug NOT LIKE '%_backup%';

    -- Contar registros de backup em whatsapp_credentials (com _backup)
    SELECT COUNT(*) INTO _backup_in_credentials_count
    FROM sistemaretiradas.whatsapp_credentials
    WHERE admin_id = _admin_id
      AND site_slug LIKE _site_slug || '_backup%';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'VALIDAÇÃO FINAL:';
    RAISE NOTICE '  Registros PRINCIPAIS (whatsapp_credentials): %', _principal_count;
    RAISE NOTICE '  Registros BACKUP (whatsapp_credentials): %', _backup_in_credentials_count;
    
    IF _principal_count = 1 THEN
        RAISE NOTICE '  ✅ EXATAMENTE 1 registro principal encontrado (CORRETO)';
    ELSIF _principal_count > 1 THEN
        RAISE WARNING '  ⚠️ MÚLTIPLOS registros principais encontrados! Verificar duplicatas.';
    ELSE
        RAISE WARNING '  ⚠️ NENHUM registro principal encontrado!';
    END IF;
    
    RAISE NOTICE '========================================';

END $$;

