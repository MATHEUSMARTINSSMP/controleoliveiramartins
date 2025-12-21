-- =====================================================
-- FORÇAR NÚMERO PRINCIPAL MR KITSCH (DEFINITIVO)
-- =====================================================
-- Esta migration força o número 559699741090 como principal da MR KITSCH
-- Remove qualquer inconsistência e garante que este é o único número principal
-- =====================================================

DO $$
DECLARE
    _admin_id UUID;
    _admin_email TEXT;
    _store_id UUID;
    _site_slug TEXT := 'mrkitsch';
    _uazapi_token TEXT := '2fada9de-3960-4dbb-b47c-be72d00eb1e4';
    _uazapi_phone_number TEXT := '559699741090';
    _uazapi_instance_id TEXT;
    _updated_count INTEGER;
    _principal_record RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FORÇAR NÚMERO PRINCIPAL MR KITSCH';
    RAISE NOTICE '========================================';
    
    -- 1. Encontrar admin_id e admin_email da loja 'mrkitsch'
    SELECT p.id, p.email INTO _admin_id, _admin_email
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

    IF _admin_email IS NULL THEN
        SELECT email INTO _admin_email
        FROM auth.users
        WHERE id = _admin_id;
        
        IF _admin_email IS NULL THEN
            RAISE EXCEPTION 'Email do admin não encontrado para admin_id %.', _admin_id;
        END IF;
    END IF;

    RAISE NOTICE 'Admin ID: %', _admin_id;
    RAISE NOTICE 'Admin Email: %', _admin_email;
    RAISE NOTICE 'Store ID: %', _store_id;
    RAISE NOTICE 'Site Slug: %', _site_slug;
    RAISE NOTICE 'Phone Number: %', _uazapi_phone_number;
    RAISE NOTICE '';

    -- 2. DELETAR TODOS os registros de whatsapp_credentials que são backups mas estão sendo confundidos como principais
    -- (site_slug que contém _backup mas está sendo usado incorretamente)
    DELETE FROM sistemaretiradas.whatsapp_credentials
    WHERE admin_id = _admin_id
      AND site_slug = _site_slug
      AND site_slug LIKE '%_backup%';
    
    GET DIAGNOSTICS _updated_count = ROW_COUNT;
    IF _updated_count > 0 THEN
        RAISE NOTICE '✅ Removidos % registros de backup incorretos de whatsapp_credentials', _updated_count;
    END IF;

    -- 3. BUSCAR instance_id se já existe um registro principal válido
    SELECT uazapi_instance_id INTO _uazapi_instance_id
    FROM sistemaretiradas.whatsapp_credentials
    WHERE admin_id = _admin_id
      AND site_slug = _site_slug
      AND site_slug NOT LIKE '%_backup%'
      AND uazapi_phone_number = _uazapi_phone_number
    LIMIT 1;

    -- Se não encontrou, usar um padrão (pode ser atualizado depois pelo N8N)
    IF _uazapi_instance_id IS NULL THEN
        _uazapi_instance_id := 'r770aaed21d3443'; -- Instance ID conhecido
    END IF;

    RAISE NOTICE 'Instance ID: %', _uazapi_instance_id;
    RAISE NOTICE '';

    -- 4. FORÇAR O REGISTRO PRINCIPAL CORRETO
    -- Deletar TODOS os registros principais existentes primeiro (para garantir limpeza)
    DELETE FROM sistemaretiradas.whatsapp_credentials
    WHERE admin_id = _admin_id
      AND site_slug = _site_slug
      AND site_slug NOT LIKE '%_backup%';
    
    GET DIAGNOSTICS _updated_count = ROW_COUNT;
    IF _updated_count > 0 THEN
        RAISE NOTICE '✅ Removidos % registros principais antigos (limpando para recriar)', _updated_count;
    END IF;

    -- 5. INSERIR o registro principal CORRETO
    INSERT INTO sistemaretiradas.whatsapp_credentials (
        admin_id,
        customer_id,
        site_slug,
        uazapi_token,
        uazapi_phone_number,
        uazapi_instance_id,
        uazapi_status,
        status,
        updated_at
    ) VALUES (
        _admin_id,
        _admin_email,
        _site_slug, -- site_slug SEM "_backup" - é o principal
        _uazapi_token,
        _uazapi_phone_number,
        _uazapi_instance_id,
        'connected', -- Forçar status connected
        'active',
        NOW()
    );

    RAISE NOTICE '✅ Registro PRINCIPAL inserido/atualizado com sucesso';
    RAISE NOTICE '';

    -- 6. GARANTIR que NENHUM backup tenha este número
    UPDATE sistemaretiradas.whatsapp_accounts
    SET phone = NULL,
        uazapi_status = 'disconnected'
    WHERE store_id = _store_id
      AND (is_backup1 = true OR is_backup2 = true OR is_backup3 = true)
      AND phone = _uazapi_phone_number;
    
    GET DIAGNOSTICS _updated_count = ROW_COUNT;
    IF _updated_count > 0 THEN
        RAISE NOTICE '✅ Limpados % registros de backup que tinham o número principal incorretamente', _updated_count;
    END IF;

    -- 7. Atualizar status whatsapp_ativo na tabela stores
    UPDATE sistemaretiradas.stores
    SET whatsapp_ativo = TRUE
    WHERE id = _store_id;

    RAISE NOTICE '✅ whatsapp_ativo da loja % definido como TRUE', _site_slug;
    RAISE NOTICE '';

    -- 8. VERIFICAÇÃO FINAL
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICAÇÃO FINAL:';
    RAISE NOTICE '========================================';
    
    -- Contar registros principais (deve ser 1)
    SELECT COUNT(*) INTO _updated_count
    FROM sistemaretiradas.whatsapp_credentials
    WHERE admin_id = _admin_id
      AND site_slug = _site_slug
      AND site_slug NOT LIKE '%_backup%';
    
    IF _updated_count = 1 THEN
        RAISE NOTICE '✅ EXATAMENTE 1 registro principal encontrado (CORRETO)';
    ELSE
        RAISE WARNING '⚠️ PROBLEMA: % registros principais encontrados (deveria ser 1)', _updated_count;
    END IF;
    
    -- Mostrar detalhes do registro principal
    FOR _principal_record IN
        SELECT uazapi_phone_number, uazapi_status, site_slug
        FROM sistemaretiradas.whatsapp_credentials
        WHERE admin_id = _admin_id
          AND site_slug = _site_slug
          AND site_slug NOT LIKE '%_backup%'
    LOOP
        RAISE NOTICE '   Phone: %, Status: %, Slug: %', 
            _principal_record.uazapi_phone_number, 
            _principal_record.uazapi_status, 
            _principal_record.site_slug;
    END LOOP;
    
    RAISE NOTICE '========================================';

END $$;

