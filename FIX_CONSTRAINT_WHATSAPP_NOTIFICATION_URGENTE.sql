-- FIX URGENTE: Corrigir constraint único para incluir store_id
-- Este script corrige o erro "duplicate key value violates unique constraint"
-- SCRIPT IDEMPOTENTE - pode ser executado múltiplas vezes sem erro

-- ============================================
-- 1. REMOVER CONSTRAINT ANTIGO (se existir)
-- ============================================

-- Remover constraint antigo que não inclui store_id
ALTER TABLE sistemaretiradas.whatsapp_notification_config 
DROP CONSTRAINT IF EXISTS whatsapp_notification_config_admin_id_notification_type_phone_key;

-- Remover qualquer outro constraint único que possa estar causando conflito
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Buscar todos os constraints únicos na tabela
    FOR constraint_name IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'sistemaretiradas.whatsapp_notification_config'::regclass
        AND contype = 'u'
        AND conname LIKE '%whatsapp_notification_config%'
    ) LOOP
        EXECUTE format('ALTER TABLE sistemaretiradas.whatsapp_notification_config DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Constraint removido: %', constraint_name;
    END LOOP;
END $$;

-- ============================================
-- 2. GARANTIR QUE COLUNA store_id EXISTE
-- ============================================

-- Adicionar coluna store_id se não existir
ALTER TABLE sistemaretiradas.whatsapp_notification_config 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE;

-- ============================================
-- 3. CRIAR NOVO CONSTRAINT QUE INCLUI store_id
-- ============================================

-- Criar novo constraint único que inclui store_id
-- Permite mesmo telefone para tipos diferentes OU lojas diferentes
ALTER TABLE sistemaretiradas.whatsapp_notification_config 
ADD CONSTRAINT whatsapp_notification_config_unique 
UNIQUE(admin_id, notification_type, store_id, phone);

-- ============================================
-- 4. VERIFICAR E REMOVER DUPLICATAS EXISTENTES
-- ============================================

-- Remover duplicatas mantendo o registro mais recente
DO $$
DECLARE
    duplicate_record RECORD;
    ids_to_delete UUID[];
BEGIN
    -- Encontrar duplicatas baseado em admin_id, notification_type, telefone e store_id
    FOR duplicate_record IN (
        SELECT 
            admin_id,
            notification_type,
            COALESCE(store_id::text, 'NULL') as store_key,
            phone,
            array_agg(id ORDER BY created_at DESC) as ids,
            count(*) as count
        FROM sistemaretiradas.whatsapp_notification_config
        GROUP BY admin_id, notification_type, store_id, phone
        HAVING count(*) > 1
    ) LOOP
        -- Manter o primeiro (mais recente), deletar os demais
        ids_to_delete := duplicate_record.ids[2:array_length(duplicate_record.ids, 1)];
        
        IF array_length(ids_to_delete, 1) > 0 THEN
            DELETE FROM sistemaretiradas.whatsapp_notification_config
            WHERE id = ANY(ids_to_delete);
            
            RAISE NOTICE 'Removidas % duplicatas para admin_id=%, tipo=%, loja=%, telefone=%', 
                array_length(ids_to_delete, 1),
                duplicate_record.admin_id,
                duplicate_record.notification_type,
                duplicate_record.store_key,
                duplicate_record.phone;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 5. VERIFICAÇÃO FINAL
-- ============================================

DO $$
DECLARE
    constraint_exists BOOLEAN;
    duplicates_remaining INTEGER;
BEGIN
    -- Verificar se o novo constraint existe
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'sistemaretiradas.whatsapp_notification_config'::regclass
        AND conname = 'whatsapp_notification_config_unique'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✅ Constraint único criado com sucesso: whatsapp_notification_config_unique';
    ELSE
        RAISE WARNING '⚠️ Constraint único não foi criado!';
    END IF;
    
    -- Verificar se ainda há duplicatas
    SELECT COUNT(*) INTO duplicates_remaining
    FROM (
        SELECT 
            admin_id,
            notification_type,
            store_id,
            phone,
            count(*) as cnt
        FROM sistemaretiradas.whatsapp_notification_config
        GROUP BY admin_id, notification_type, store_id, phone
        HAVING count(*) > 1
    ) duplicates;
    
    IF duplicates_remaining > 0 THEN
        RAISE WARNING '⚠️ Ainda existem % duplicatas! Verifique manualmente.', duplicates_remaining;
    ELSE
        RAISE NOTICE '✅ Nenhuma duplicata encontrada!';
    END IF;
END $$;

