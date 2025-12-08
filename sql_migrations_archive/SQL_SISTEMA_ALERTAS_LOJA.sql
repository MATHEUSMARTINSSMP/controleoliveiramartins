-- ============================================================
-- SISTEMA DE ALERTAS DA LOJA (Store Task Alerts)
-- Data: 2024-12-08
-- Descrição: Extensão da tabela store_notifications para
--            suportar alertas/tarefas programadas por WhatsApp
-- ============================================================

-- ============================================================
-- 1. ADICIONAR COLUNAS EXTRAS NA TABELA store_notifications
-- ============================================================

-- Adicionar nome/título da tarefa
ALTER TABLE sistemaretiradas.store_notifications
ADD COLUMN IF NOT EXISTS nome TEXT;

-- Adicionar tipo de remetente (GLOBAL = número Elevea, STORE = número próprio da loja)
ALTER TABLE sistemaretiradas.store_notifications
ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'GLOBAL' CHECK (sender_type IN ('GLOBAL', 'STORE'));

-- Adicionar telefone do remetente (se STORE, usar este; se GLOBAL ou NULL, usar padrão)
ALTER TABLE sistemaretiradas.store_notifications
ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- Adicionar contador de envios do dia (para limite de 10/dia)
ALTER TABLE sistemaretiradas.store_notifications
ADD COLUMN IF NOT EXISTS envios_hoje INTEGER DEFAULT 0;

-- Adicionar data do último reset do contador
ALTER TABLE sistemaretiradas.store_notifications
ADD COLUMN IF NOT EXISTS data_ultimo_reset DATE DEFAULT CURRENT_DATE;

-- Adicionar referência ao admin (para RLS)
ALTER TABLE sistemaretiradas.store_notifications
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES sistemaretiradas.profiles(id);

-- ============================================================
-- 2. CRIAR TABELA DE DESTINATÁRIOS (MÚLTIPLOS POR NOTIFICAÇÃO)
-- ============================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.store_notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES sistemaretiradas.store_notifications(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(notification_id, phone)
);

-- ============================================================
-- 3. CRIAR TABELA DE LOG DE ENVIOS (PARA AUDITORIA E QUOTA)
-- ============================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.store_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES sistemaretiradas.store_notifications(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    mensagem TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    error_message TEXT,
    enviado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por data
CREATE INDEX IF NOT EXISTS idx_notification_logs_date 
ON sistemaretiradas.store_notification_logs(store_id, created_at);

-- ============================================================
-- 4. ATUALIZAR admin_id EXISTENTE BASEADO NO store_id
-- ============================================================

UPDATE sistemaretiradas.store_notifications sn
SET admin_id = (
    SELECT s.admin_id 
    FROM sistemaretiradas.stores s 
    WHERE s.id = sn.store_id
)
WHERE sn.admin_id IS NULL AND sn.store_id IS NOT NULL;

-- ============================================================
-- 5. RLS POLICIES PARA SEGURANÇA
-- ============================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE sistemaretiradas.store_notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.store_notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy para destinatários (via notification_id -> store_notifications -> admin_id)
DROP POLICY IF EXISTS "Recipients visible to admin" ON sistemaretiradas.store_notification_recipients;
CREATE POLICY "Recipients visible to admin" ON sistemaretiradas.store_notification_recipients
    FOR ALL
    USING (
        notification_id IN (
            SELECT id FROM sistemaretiradas.store_notifications 
            WHERE admin_id = auth.uid()
        )
    );

-- Policy para logs (via store_id -> stores -> admin_id)
DROP POLICY IF EXISTS "Logs visible to admin" ON sistemaretiradas.store_notification_logs;
CREATE POLICY "Logs visible to admin" ON sistemaretiradas.store_notification_logs
    FOR ALL
    USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE admin_id = auth.uid()
        )
    );

-- ============================================================
-- 6. FUNÇÃO PARA RESETAR CONTADOR DIÁRIO
-- ============================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.reset_notification_daily_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE sistemaretiradas.store_notifications
    SET envios_hoje = 0,
        data_ultimo_reset = CURRENT_DATE
    WHERE data_ultimo_reset < CURRENT_DATE;
END;
$$;

-- ============================================================
-- 7. FUNÇÃO PARA VERIFICAR SE PODE ENVIAR (LIMITE 10/DIA)
-- ============================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.can_send_notification(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_envios_hoje INTEGER;
BEGIN
    -- Primeiro resetar contadores antigos
    PERFORM sistemaretiradas.reset_notification_daily_count();
    
    -- Contar envios do dia para esta loja
    SELECT COALESCE(SUM(envios_hoje), 0) INTO total_envios_hoje
    FROM sistemaretiradas.store_notifications
    WHERE store_id = p_store_id;
    
    RETURN total_envios_hoje < 10;
END;
$$;

-- ============================================================
-- 8. FUNÇÃO PARA INCREMENTAR CONTADOR DE ENVIO
-- ============================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.increment_notification_count(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Resetar se necessário
    PERFORM sistemaretiradas.reset_notification_daily_count();
    
    -- Incrementar contador
    UPDATE sistemaretiradas.store_notifications
    SET envios_hoje = envios_hoje + 1,
        data_ultimo_reset = CURRENT_DATE
    WHERE id = p_notification_id;
END;
$$;

-- ============================================================
-- 9. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================

COMMENT ON TABLE sistemaretiradas.store_notifications IS 'Tarefas/alertas programados para envio via WhatsApp por loja';
COMMENT ON COLUMN sistemaretiradas.store_notifications.nome IS 'Nome/título da tarefa (ex: Espirrar aromatizador)';
COMMENT ON COLUMN sistemaretiradas.store_notifications.sender_type IS 'Tipo de remetente: GLOBAL (número Elevea) ou STORE (número próprio da loja)';
COMMENT ON COLUMN sistemaretiradas.store_notifications.horarios IS 'Array de horários para envio (ex: {11:00, 15:00, 20:00})';
COMMENT ON COLUMN sistemaretiradas.store_notifications.dias_semana IS 'Array de dias da semana (1=Segunda...7=Domingo)';
COMMENT ON COLUMN sistemaretiradas.store_notifications.envios_hoje IS 'Contador de envios realizados hoje (limite 10/dia por loja)';

COMMENT ON TABLE sistemaretiradas.store_notification_recipients IS 'Destinatários de cada alerta (permite múltiplos por notificação)';
COMMENT ON TABLE sistemaretiradas.store_notification_logs IS 'Log de envios para auditoria e controle de quota';
