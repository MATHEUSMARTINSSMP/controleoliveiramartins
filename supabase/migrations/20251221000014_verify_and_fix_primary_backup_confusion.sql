-- =====================================================
-- VERIFICAR E CORRIGIR CONFUSÃO PRINCIPAL/BACKUP
-- =====================================================
-- Esta migration verifica se há backups sendo usados como principais
-- e corrige qualquer inconsistência encontrada
-- =====================================================

DO $$
DECLARE
    _store_record RECORD;
    _backup_as_primary RECORD;
    _correct_primary RECORD;
    _backup_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICAÇÃO DE INTEGRIDADE: Principal vs Backup';
    RAISE NOTICE '========================================';
    
    -- Verificar todas as lojas
    FOR _store_record IN 
        SELECT id, site_slug, admin_id 
        FROM sistemaretiradas.stores 
        WHERE active = true
    LOOP
        RAISE NOTICE '--- Verificando loja: % (slug: %)', _store_record.id, _store_record.site_slug;
        
        -- 1. Verificar se há registro de backup sendo usado como principal
        -- (site_slug principal mas que contém _backup)
        FOR _backup_as_primary IN
            SELECT * 
            FROM sistemaretiradas.whatsapp_credentials
            WHERE admin_id = _store_record.admin_id
              AND site_slug LIKE _store_record.site_slug || '_backup%'
        LOOP
            RAISE WARNING '⚠️ BACKUP sendo confundido como PRINCIPAL encontrado:';
            RAISE WARNING '   Site Slug: % (deveria ser apenas %)', _backup_as_primary.site_slug, _store_record.site_slug;
            RAISE WARNING '   Phone: %', _backup_as_primary.uazapi_phone_number;
            RAISE WARNING '   Status: %', _backup_as_primary.uazapi_status;
            
            -- NÃO DELETAR automaticamente - apenas reportar
            -- O usuário deve verificar manualmente
        END LOOP;
        
        -- 2. Verificar se há múltiplos registros principais (sem _backup)
        SELECT COUNT(*) INTO _backup_count
        FROM sistemaretiradas.whatsapp_credentials
        WHERE admin_id = _store_record.admin_id
          AND site_slug = _store_record.site_slug
          AND site_slug NOT LIKE '%_backup%';
        
        IF _backup_count > 1 THEN
            RAISE WARNING '⚠️ Múltiplos registros PRINCIPAIS encontrados para loja %!', _store_record.site_slug;
            RAISE WARNING '   Total: % registros (deveria ser 1)', _backup_count;
        ELSIF _backup_count = 0 THEN
            RAISE NOTICE '   ℹ️ Nenhum registro principal encontrado para loja %', _store_record.site_slug;
        ELSE
            RAISE NOTICE '   ✅ Exatamente 1 registro principal encontrado (CORRETO)';
        END IF;
        
        -- 3. Verificar se há backups válidos em whatsapp_accounts
        SELECT COUNT(*) INTO _backup_count
        FROM sistemaretiradas.whatsapp_accounts
        WHERE store_id = _store_record.id
          AND (is_backup1 = true OR is_backup2 = true OR is_backup3 = true);
        
        IF _backup_count > 0 THEN
            RAISE NOTICE '   ℹ️ % números reserva configurados em whatsapp_accounts', _backup_count;
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verificação concluída';
    RAISE NOTICE '========================================';
    
    -- Criar índice único adicional para garantir que não haja duplicatas principais
    CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_credentials_unique_primary_per_store
        ON sistemaretiradas.whatsapp_credentials(admin_id, site_slug)
        WHERE site_slug NOT LIKE '%_backup%';
    
    RAISE NOTICE '✅ Índice único criado para garantir apenas um principal por loja';
    
END $$;

-- =====================================================
-- VALIDAÇÃO FINAL: Listar todos os registros principais e backups
-- =====================================================

SELECT 
    'PRINCIPAL' as tipo,
    wc.site_slug,
    wc.uazapi_phone_number as phone,
    wc.uazapi_status,
    s.name as loja_nome
FROM sistemaretiradas.whatsapp_credentials wc
JOIN sistemaretiradas.stores s ON s.admin_id = wc.admin_id AND s.site_slug = wc.site_slug
WHERE wc.site_slug NOT LIKE '%_backup%'
ORDER BY s.name, wc.site_slug;

SELECT 
    'BACKUP' as tipo,
    wc.site_slug,
    wc.uazapi_phone_number as phone,
    wc.uazapi_status,
    s.name as loja_nome
FROM sistemaretiradas.whatsapp_credentials wc
JOIN sistemaretiradas.stores s ON s.admin_id = wc.admin_id AND s.site_slug = SUBSTRING(wc.site_slug FROM 1 FOR POSITION('_backup' IN wc.site_slug) - 1)
WHERE wc.site_slug LIKE '%_backup%'
ORDER BY s.name, wc.site_slug;

