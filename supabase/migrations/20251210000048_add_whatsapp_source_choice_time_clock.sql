-- =====================================================
-- ADICIONAR ESCOLHA DE WHATSAPP (LOJA OU GLOBAL) PARA NOTIFICAÇÕES DE PONTO
-- =====================================================
-- Permite escolher entre usar WhatsApp da loja ou WhatsApp Global
-- mesmo quando ambos estão disponíveis

-- 1. Adicionar coluna use_global_whatsapp na tabela whatsapp_notification_config
-- para notificações de ponto (se a tabela existir)
DO $$
BEGIN
    -- Verificar se a coluna já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
          AND table_name = 'whatsapp_notification_config'
          AND column_name = 'use_global_whatsapp'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_notification_config
        ADD COLUMN use_global_whatsapp BOOLEAN DEFAULT false;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.use_global_whatsapp IS 
        'Se true, usa WhatsApp Global mesmo quando a loja tem WhatsApp próprio. Aplica apenas para CONTROLE_PONTO.';
        
        RAISE NOTICE '✅ Coluna use_global_whatsapp adicionada';
    ELSE
        RAISE NOTICE 'ℹ️ Coluna use_global_whatsapp já existe';
    END IF;
END $$;

-- 2. Criar tabela time_clock_notification_config se não existir
-- (para armazenar configurações específicas de notificações de ponto)
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_notification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    notifications_enabled BOOLEAN DEFAULT false,
    notify_clock_in BOOLEAN DEFAULT true,
    notify_clock_out BOOLEAN DEFAULT true,
    notify_change_requests BOOLEAN DEFAULT true,
    notify_request_approved BOOLEAN DEFAULT true,
    notify_request_rejected BOOLEAN DEFAULT true,
    recipient_phones TEXT[] DEFAULT ARRAY[]::TEXT[],
    use_global_whatsapp BOOLEAN DEFAULT false,  -- Se true, usa WhatsApp Global mesmo quando loja tem próprio
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id)
);

-- Adicionar índice
CREATE INDEX IF NOT EXISTS idx_time_clock_notification_config_store_id 
ON sistemaretiradas.time_clock_notification_config(store_id);

-- Comentários
COMMENT ON TABLE sistemaretiradas.time_clock_notification_config IS 
'Configurações de notificações WhatsApp para controle de ponto por loja';

COMMENT ON COLUMN sistemaretiradas.time_clock_notification_config.use_global_whatsapp IS 
'Se true, usa WhatsApp Global mesmo quando a loja tem WhatsApp próprio conectado. Se false, usa WhatsApp da loja quando disponível, com fallback para Global.';

-- 3. Habilitar RLS
ALTER TABLE sistemaretiradas.time_clock_notification_config ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas RLS
DROP POLICY IF EXISTS "time_clock_notification_config_admin_all" ON sistemaretiradas.time_clock_notification_config;
DROP POLICY IF EXISTS "time_clock_notification_config_loja_read" ON sistemaretiradas.time_clock_notification_config;

-- Admin pode fazer tudo
CREATE POLICY "time_clock_notification_config_admin_all"
ON sistemaretiradas.time_clock_notification_config
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        JOIN sistemaretiradas.stores s ON s.id = time_clock_notification_config.store_id
        WHERE p.id = auth.uid()
          AND (p.role = 'ADMIN' AND s.admin_id = p.id)
          AND p.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        JOIN sistemaretiradas.stores s ON s.id = time_clock_notification_config.store_id
        WHERE p.id = auth.uid()
          AND (p.role = 'ADMIN' AND s.admin_id = p.id)
          AND p.is_active = true
    )
);

-- LOJA pode ler e atualizar configurações da sua loja
CREATE POLICY "time_clock_notification_config_loja_read"
ON sistemaretiradas.time_clock_notification_config
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'LOJA'
          AND p.store_id = time_clock_notification_config.store_id
          AND p.is_active = true
    )
);

CREATE POLICY "time_clock_notification_config_loja_write"
ON sistemaretiradas.time_clock_notification_config
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'LOJA'
          AND p.store_id = time_clock_notification_config.store_id
          AND p.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'LOJA'
          AND p.store_id = time_clock_notification_config.store_id
          AND p.is_active = true
    )
);

