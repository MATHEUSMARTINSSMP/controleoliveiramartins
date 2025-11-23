-- CRIAR TABELA DE CONFIGURAÇÃO DE NOTIFICAÇÕES WHATSAPP
-- Permite que cada admin configure quais números recebem cada tipo de notificação
-- SCRIPT IDEMPOTENTE - pode ser executado múltiplas vezes sem erro

-- 1. Criar tabela para configuração de notificações WhatsApp
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_notification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('VENDA', 'ADIANTAMENTO', 'PARABENS')),
    phone TEXT NOT NULL,
    name TEXT, -- Nome opcional para identificar o destinatário (ex: "Admin Principal", "Gerente Loja 1")
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(admin_id, notification_type, phone) -- Evita duplicatas
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_config_admin_type 
    ON sistemaretiradas.whatsapp_notification_config(admin_id, notification_type, active);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notif_config_admin 
    ON sistemaretiradas.whatsapp_notification_config(admin_id);

-- 3. Habilitar RLS
ALTER TABLE sistemaretiradas.whatsapp_notification_config ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas existentes (se houver)
DROP POLICY IF EXISTS "ADMIN can do everything on whatsapp_notification_config" ON sistemaretiradas.whatsapp_notification_config;
DROP POLICY IF EXISTS "LOJA can view admin notification config" ON sistemaretiradas.whatsapp_notification_config;
DROP POLICY IF EXISTS "ADMIN can view own notification config" ON sistemaretiradas.whatsapp_notification_config;
DROP POLICY IF EXISTS "ADMIN can insert notification config" ON sistemaretiradas.whatsapp_notification_config;
DROP POLICY IF EXISTS "ADMIN can update notification config" ON sistemaretiradas.whatsapp_notification_config;
DROP POLICY IF EXISTS "ADMIN can delete notification config" ON sistemaretiradas.whatsapp_notification_config;

-- Remover qualquer outra política que possa existir
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

-- 5. Criar políticas RLS simplificadas (similar ao FIX_GOALS_EDIT_URGENTE.sql)

-- Política para ADMIN: pode fazer tudo (SELECT, INSERT, UPDATE, DELETE) em suas próprias configurações
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

-- Política para LOJA: pode visualizar configurações do admin da sua loja (para enviar notificações)
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
        AND whatsapp_notification_config.active = true
    )
);

-- 6. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION sistemaretiradas.update_whatsapp_notification_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_whatsapp_notification_config_updated_at 
    ON sistemaretiradas.whatsapp_notification_config;

CREATE TRIGGER trigger_update_whatsapp_notification_config_updated_at
    BEFORE UPDATE ON sistemaretiradas.whatsapp_notification_config
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_whatsapp_notification_config_updated_at();

-- 7. Inserir configurações padrão para o admin existente
-- VENDA e ADIANTAMENTO: números do admin (migrar da tabela whatsapp_recipients se existir)
-- PARABENS: deixar vazio inicialmente (será configurado pelo admin)

DO $$
DECLARE
    admin_record RECORD;
    recipient_record RECORD;
BEGIN
    -- Buscar todos os admins ativos
    FOR admin_record IN (
        SELECT id FROM sistemaretiradas.profiles
        WHERE role = 'ADMIN' AND active = true
    ) LOOP
        -- Migrar números de whatsapp_recipients para VENDA e ADIANTAMENTO
        FOR recipient_record IN (
            SELECT phone, name FROM sistemaretiradas.whatsapp_recipients
            WHERE admin_id = admin_record.id AND active = true
        ) LOOP
            -- Inserir para VENDA (se não existir)
            INSERT INTO sistemaretiradas.whatsapp_notification_config (admin_id, notification_type, phone, name, active)
            VALUES (admin_record.id, 'VENDA', recipient_record.phone, recipient_record.name, true)
            ON CONFLICT (admin_id, notification_type, phone) DO NOTHING;
            
            -- Inserir para ADIANTAMENTO (se não existir)
            INSERT INTO sistemaretiradas.whatsapp_notification_config (admin_id, notification_type, phone, name, active)
            VALUES (admin_record.id, 'ADIANTAMENTO', recipient_record.phone, recipient_record.name, true)
            ON CONFLICT (admin_id, notification_type, phone) DO NOTHING;
        END LOOP;
        
        -- Se não houver números em whatsapp_recipients, criar entradas vazias para o admin configurar
        IF NOT EXISTS (
            SELECT 1 FROM sistemaretiradas.whatsapp_notification_config
            WHERE admin_id = admin_record.id AND notification_type = 'VENDA'
        ) THEN
            RAISE NOTICE 'Admin % não tem números configurados. Será necessário configurar manualmente.', admin_record.id;
        END IF;
    END LOOP;
END $$;

-- 8. Comentários para documentação
COMMENT ON TABLE sistemaretiradas.whatsapp_notification_config IS 
'Configuração de destinatários WhatsApp para cada tipo de notificação por admin';

COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.notification_type IS 
'Tipos: VENDA (nova venda lançada), ADIANTAMENTO (solicitação de adiantamento), PARABENS (parabéns após venda)';

COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.phone IS 
'Número do WhatsApp (formato: apenas números, sem DDI - o sistema adiciona 55 automaticamente)';

COMMENT ON POLICY "ADMIN can do everything on whatsapp_notification_config" ON sistemaretiradas.whatsapp_notification_config IS 
'ADMIN pode fazer qualquer operação (SELECT, INSERT, UPDATE, DELETE) em suas próprias configurações de notificação';

COMMENT ON POLICY "LOJA can view admin notification config" ON sistemaretiradas.whatsapp_notification_config IS 
'LOJA pode visualizar configurações do admin da sua loja para enviar notificações';

-- 9. Verificar se a tabela foi criada corretamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_notification_config'
    ) THEN
        RAISE NOTICE '✅ Tabela whatsapp_notification_config criada com sucesso!';
    ELSE
        RAISE EXCEPTION '❌ Erro ao criar tabela whatsapp_notification_config';
    END IF;
END $$;

