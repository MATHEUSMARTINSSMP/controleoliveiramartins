-- =====================================================
-- ADICIONAR TIPO DE NOTIFICAÇÃO AJUSTES_CONDICIONAIS
-- =====================================================
-- Adiciona o novo tipo 'AJUSTES_CONDICIONAIS' à constraint CHECK
-- da tabela whatsapp_notification_config

-- 1. Remover constraint antiga
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'whatsapp_notification_config_notification_type_check' 
        AND conrelid = 'sistemaretiradas.whatsapp_notification_config'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_notification_config 
        DROP CONSTRAINT whatsapp_notification_config_notification_type_check;
        RAISE NOTICE '✅ Constraint antiga removida';
    END IF;
END $$;

-- 2. Criar nova constraint com o novo tipo
ALTER TABLE sistemaretiradas.whatsapp_notification_config
ADD CONSTRAINT whatsapp_notification_config_notification_type_check 
CHECK (notification_type IN ('VENDA', 'ADIANTAMENTO', 'PARABENS', 'AJUSTES_CONDICIONAIS'));

COMMENT ON CONSTRAINT whatsapp_notification_config_notification_type_check 
ON sistemaretiradas.whatsapp_notification_config IS 
'Permite os tipos: VENDA, ADIANTAMENTO, PARABENS, AJUSTES_CONDICIONAIS';

