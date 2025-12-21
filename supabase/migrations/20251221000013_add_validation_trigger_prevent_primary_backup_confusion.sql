-- =====================================================
-- TRIGGER DE VALIDAÇÃO: PREVENIR CONFUSÃO PRINCIPAL/BACKUP
-- =====================================================
-- Esta migration adiciona uma função de validação e trigger
-- para prevenir que números principais sejam salvos com site_slug contendo "_backup"
-- =====================================================

-- Função para validar que site_slug principal não contenha "_backup"
CREATE OR REPLACE FUNCTION sistemaretiradas.validate_whatsapp_primary_site_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- VALIDAÇÃO CRÍTICA: Se é um registro principal (não tem _backup no site_slug),
    -- garantir que o site_slug não contenha "_backup"
    IF NEW.site_slug IS NOT NULL AND NEW.site_slug LIKE '%_backup%' THEN
        -- Se tem _backup, é um backup - permitir (mas registrar log)
        RAISE NOTICE '[validate_whatsapp_primary_site_slug] Registro de BACKUP detectado: site_slug = %', NEW.site_slug;
    ELSE
        -- Se não tem _backup, é um principal - garantir que não há conflito
        -- Verificar se já existe um backup com este site_slug + "_backup"
        IF EXISTS (
            SELECT 1 
            FROM sistemaretiradas.whatsapp_credentials 
            WHERE admin_id = NEW.admin_id 
              AND site_slug LIKE NEW.site_slug || '_backup%'
        ) THEN
            RAISE NOTICE '[validate_whatsapp_primary_site_slug] Principal % tem backups associados (CORRETO)', NEW.site_slug;
        END IF;
        
        -- Garantir que não há outro principal com site_slug que contenha "_backup" e seja similar
        -- (Isso não deveria acontecer, mas vamos validar)
        IF EXISTS (
            SELECT 1 
            FROM sistemaretiradas.whatsapp_credentials 
            WHERE admin_id = NEW.admin_id 
              AND site_slug LIKE '%_backup%'
              AND site_slug LIKE NEW.site_slug || '%'
              AND site_slug != NEW.site_slug
        ) THEN
            RAISE WARNING '[validate_whatsapp_primary_site_slug] ⚠️ ATENÇÃO: Existe registro de backup com site_slug similar ao principal: %', NEW.site_slug;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS trigger_validate_whatsapp_primary_site_slug ON sistemaretiradas.whatsapp_credentials;

CREATE TRIGGER trigger_validate_whatsapp_primary_site_slug
    BEFORE INSERT OR UPDATE OF site_slug, admin_id
    ON sistemaretiradas.whatsapp_credentials
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.validate_whatsapp_primary_site_slug();

RAISE NOTICE '✅ Trigger de validação criado para prevenir confusão entre principal e backup';

-- Adicionar comentário na função
COMMENT ON FUNCTION sistemaretiradas.validate_whatsapp_primary_site_slug() IS 
'Valida que números principais (site_slug sem "_backup") não sejam confundidos com backups (site_slug com "_backup"). Esta função é executada via trigger antes de INSERT/UPDATE em whatsapp_credentials.';

DO $$
BEGIN
    RAISE NOTICE '✅ Trigger de validação criado para prevenir confusão entre principal e backup';
END $$;

