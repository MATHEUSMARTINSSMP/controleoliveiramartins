-- ============================================================================
-- CRIAR TABELA: whatsapp_notification_config
-- Descricao: Armazena numeros de telefone para receber notificacoes por tipo
-- Data: 2024-12-07
-- ============================================================================

-- Criar tabela para configuracao de notificacoes WhatsApp
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_notification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamentos
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    
    -- Configuracao
    phone VARCHAR(20) NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'VENDA',
    is_active BOOLEAN DEFAULT true,
    description VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_notification_type CHECK (
        notification_type IN ('VENDA', 'PARABENS', 'ADIANTAMENTO', 'CASHBACK', 'META', 'GERAL')
    )
);

-- Comentarios
COMMENT ON TABLE sistemaretiradas.whatsapp_notification_config IS 'Configuracao de destinatarios para notificacoes WhatsApp por tipo';
COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.phone IS 'Numero de telefone no formato brasileiro (55 + DDD + numero)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.notification_type IS 'Tipo de notificacao: VENDA, PARABENS, ADIANTAMENTO, CASHBACK, META, GERAL';
COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.is_active IS 'Se a notificacao esta ativa para este numero';

-- Indices para busca rapida
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_config_store 
    ON sistemaretiradas.whatsapp_notification_config(store_id);
    
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_config_admin 
    ON sistemaretiradas.whatsapp_notification_config(admin_id);
    
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_config_type_active 
    ON sistemaretiradas.whatsapp_notification_config(notification_type, is_active);

-- RLS (Row Level Security)
ALTER TABLE sistemaretiradas.whatsapp_notification_config ENABLE ROW LEVEL SECURITY;

-- Politica: Admins podem ver/editar configuracoes da sua loja
CREATE POLICY "Admins podem gerenciar notificacoes da sua loja"
    ON sistemaretiradas.whatsapp_notification_config
    FOR ALL
    USING (
        admin_id = auth.uid() 
        OR store_id IN (
            SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
        )
    );

-- Politica: Service role pode tudo
CREATE POLICY "Service role full access"
    ON sistemaretiradas.whatsapp_notification_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- INSERIR DADOS DE EXEMPLO (OPCIONAL - DESCOMENTE SE QUISER)
-- ============================================================================
-- Substitua os valores pelos dados reais da sua loja

-- INSERT INTO sistemaretiradas.whatsapp_notification_config 
-- (store_id, admin_id, phone, notification_type, is_active, description)
-- VALUES 
-- ('SEU_STORE_ID', 'SEU_ADMIN_ID', '5511999999999', 'VENDA', true, 'Admin principal'),
-- ('SEU_STORE_ID', 'SEU_ADMIN_ID', '5511999999999', 'PARABENS', true, 'Notificacao de parabens');

-- ============================================================================
-- VERIFICAR CRIACAO
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_notification_config'
    ) THEN
        RAISE NOTICE 'Tabela whatsapp_notification_config criada com sucesso!';
    ELSE
        RAISE WARNING 'ERRO: Tabela whatsapp_notification_config NAO foi criada!';
    END IF;
END $$;

SELECT 'Tabela whatsapp_notification_config pronta para uso!' AS status;
