-- FIX CRÍTICO: Corrigir estrutura e duplicação da tabela whatsapp_notification_config
-- SCRIPT IDEMPOTENTE - pode ser executado múltiplas vezes sem erro

-- ============================================
-- 1. ADICIONAR COLUNA store_id E REMOVER name
-- ============================================

-- Adicionar coluna store_id (nullable - NULL = todas as lojas do admin)
ALTER TABLE sistemaretiradas.whatsapp_notification_config 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE;

-- Criar índice para store_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_config_store 
    ON sistemaretiradas.whatsapp_notification_config(store_id);

-- Criar índice composto para busca eficiente
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_config_admin_type_store 
    ON sistemaretiradas.whatsapp_notification_config(admin_id, notification_type, store_id, active);

-- ============================================
-- 2. REMOVER DUPLICATAS (mesmo admin, tipo, telefone normalizado)
-- ============================================

-- Função para normalizar telefone (remove DDI 55 e zeros iniciais)
CREATE OR REPLACE FUNCTION sistemaretiradas.normalize_phone_for_comparison(phone_text TEXT)
RETURNS TEXT AS $$
DECLARE
    cleaned TEXT;
BEGIN
    -- Remove tudo que não é número
    cleaned := regexp_replace(phone_text, '[^0-9]', '', 'g');
    
    -- Remove DDI 55 se presente
    IF cleaned LIKE '55%' THEN
        cleaned := substring(cleaned from 3);
    END IF;
    
    -- Remove zero inicial se presente
    IF cleaned LIKE '0%' THEN
        cleaned := substring(cleaned from 2);
    END IF;
    
    RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Remover duplicatas mantendo o registro mais recente
DO $$
DECLARE
    duplicate_record RECORD;
    ids_to_delete UUID[];
BEGIN
    -- Encontrar duplicatas baseado em admin_id, notification_type e telefone normalizado
    FOR duplicate_record IN (
        SELECT 
            admin_id,
            notification_type,
            sistemaretiradas.normalize_phone_for_comparison(phone) as normalized_phone,
            array_agg(id ORDER BY created_at DESC) as ids,
            count(*) as count
        FROM sistemaretiradas.whatsapp_notification_config
        GROUP BY admin_id, notification_type, sistemaretiradas.normalize_phone_for_comparison(phone)
        HAVING count(*) > 1
    ) LOOP
        -- Manter o primeiro (mais recente), deletar os demais
        ids_to_delete := duplicate_record.ids[2:array_length(duplicate_record.ids, 1)];
        
        IF array_length(ids_to_delete, 1) > 0 THEN
            DELETE FROM sistemaretiradas.whatsapp_notification_config
            WHERE id = ANY(ids_to_delete);
            
            RAISE NOTICE 'Removidas % duplicatas para admin_id=%, tipo=%, telefone=%', 
                array_length(ids_to_delete, 1),
                duplicate_record.admin_id,
                duplicate_record.notification_type,
                duplicate_record.normalized_phone;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 3. ATUALIZAR CONSTRAINT UNIQUE PARA INCLUIR store_id
-- ============================================

-- Remover constraint antigo se existir
ALTER TABLE sistemaretiradas.whatsapp_notification_config 
DROP CONSTRAINT IF EXISTS whatsapp_notification_config_admin_id_notification_type_phone_key;

-- Criar novo constraint que inclui store_id
-- Permite mesmo telefone para tipos diferentes OU lojas diferentes
ALTER TABLE sistemaretiradas.whatsapp_notification_config 
ADD CONSTRAINT whatsapp_notification_config_unique 
UNIQUE(admin_id, notification_type, store_id, phone);

-- ============================================
-- 4. REMOVER COLUNA name (se existir e não for mais necessária)
-- ============================================

-- Primeiro, verificar se há dados importantes na coluna name
DO $$
DECLARE
    name_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO name_count
    FROM sistemaretiradas.whatsapp_notification_config
    WHERE name IS NOT NULL AND name != '';
    
    IF name_count > 0 THEN
        RAISE NOTICE 'Existem % registros com nome preenchido. A coluna name será mantida por enquanto para não perder dados.', name_count;
    ELSE
        -- Se não houver dados, podemos remover a coluna
        ALTER TABLE sistemaretiradas.whatsapp_notification_config DROP COLUMN IF EXISTS name;
        RAISE NOTICE 'Coluna name removida (não havia dados)';
    END IF;
END $$;

-- ============================================
-- 5. ATUALIZAR POLÍTICAS RLS PARA INCLUIR store_id
-- ============================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "ADMIN can do everything on whatsapp_notification_config" ON sistemaretiradas.whatsapp_notification_config;
DROP POLICY IF EXISTS "LOJA can view admin notification config" ON sistemaretiradas.whatsapp_notification_config;

-- Remover qualquer outra política
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'whatsapp_notification_config'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.whatsapp_notification_config', r.policyname);
        RAISE NOTICE 'Política % removida', r.policyname;
    END LOOP;
END $$;

-- Política para ADMIN: pode fazer tudo em suas próprias configurações
CREATE POLICY "ADMIN can do everything on whatsapp_notification_config"
ON sistemaretiradas.whatsapp_notification_config
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
        AND profiles.active = true
        AND profiles.id = whatsapp_notification_config.admin_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
        AND profiles.active = true
        AND profiles.id = whatsapp_notification_config.admin_id
    )
);

-- Política para LOJA: pode visualizar configurações do admin da sua loja
CREATE POLICY "LOJA can view admin notification config"
ON sistemaretiradas.whatsapp_notification_config
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        INNER JOIN sistemaretiradas.stores s ON s.admin_id = whatsapp_notification_config.admin_id
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND p.active = true
        AND (
            s.id::text = p.store_default::text
            OR s.id = p.store_id
        )
        AND (
            whatsapp_notification_config.store_id IS NULL 
            OR whatsapp_notification_config.store_id = s.id
        )
        AND whatsapp_notification_config.active = true
    )
);

-- ============================================
-- 6. VERIFICAR E LIMPAR DUPLICATAS ENTRE whatsapp_recipients E whatsapp_notification_config
-- ============================================

-- Verificar se há números duplicados entre as duas tabelas
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM sistemaretiradas.whatsapp_recipients wr
    INNER JOIN sistemaretiradas.whatsapp_notification_config wnc
        ON wr.admin_id = wnc.admin_id
        AND sistemaretiradas.normalize_phone_for_comparison(wr.phone) = 
            sistemaretiradas.normalize_phone_for_comparison(wnc.phone)
        AND wr.active = true
        AND wnc.active = true;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'ATENÇÃO: Existem % números duplicados entre whatsapp_recipients e whatsapp_notification_config', duplicate_count;
        RAISE NOTICE 'A tabela whatsapp_recipients pode ser descontinuada após migração completa';
    ELSE
        RAISE NOTICE 'Nenhuma duplicata encontrada entre as tabelas';
    END IF;
END $$;

-- ============================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.store_id IS 
'ID da loja (NULL = todas as lojas do admin). Para PARABENS, deve ser a loja específica onde a venda foi feita';

COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.phone IS 
'Número do WhatsApp normalizado (sem DDI 55, sem zeros iniciais). Ex: 96981113307';

-- ============================================
-- 8. VERIFICAÇÃO FINAL
-- ============================================

DO $$
DECLARE
    total_records INTEGER;
    duplicates_remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_records
    FROM sistemaretiradas.whatsapp_notification_config;
    
    SELECT COUNT(*) INTO duplicates_remaining
    FROM (
        SELECT 
            admin_id,
            notification_type,
            sistemaretiradas.normalize_phone_for_comparison(phone) as normalized_phone,
            count(*) as cnt
        FROM sistemaretiradas.whatsapp_notification_config
        GROUP BY admin_id, notification_type, sistemaretiradas.normalize_phone_for_comparison(phone)
        HAVING count(*) > 1
    ) duplicates;
    
    RAISE NOTICE '✅ Verificação final:';
    RAISE NOTICE '   Total de registros: %', total_records;
    RAISE NOTICE '   Duplicatas restantes: %', duplicates_remaining;
    
    IF duplicates_remaining > 0 THEN
        RAISE WARNING '⚠️ Ainda existem duplicatas! Verifique manualmente.';
    ELSE
        RAISE NOTICE '✅ Nenhuma duplicata encontrada!';
    END IF;
END $$;

