-- =====================================================
-- MÓDULO GESTÃO WHATSAPP - CAMPANHAS EM MASSA
-- Sistema inteligente de envio com IA, rotação de números
-- e integração robusta com CRM
-- =====================================================

-- 1. CONTAS WHATSAPP (inclui reservas para rotação)
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (account_type IN ('PRIMARY', 'BACKUP_1', 'BACKUP_2')),
    uazapi_token TEXT,
    uazapi_instance_id TEXT,
    is_connected BOOLEAN DEFAULT false,
    health_status TEXT DEFAULT 'OK' CHECK (health_status IN ('OK', 'WARNING', 'BLOCKED', 'DISCONNECTED')),
    daily_message_count INTEGER DEFAULT 0,
    daily_count_reset_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, account_type)
);

-- 2. CAMPANHAS DE WHATSAPP
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    created_by UUID REFERENCES sistemaretiradas.profiles(id),
    
    -- Informações básicas
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED')),
    
    -- Configuração de filtros CRM (JSON)
    filter_config JSONB NOT NULL DEFAULT '{}',
    -- Exemplo: {"type": "inactive_days", "value": 30, "combineWith": [{"type": "min_ticket", "value": 100}]}
    
    -- Configuração de agendamento
    daily_limit INTEGER DEFAULT 50,
    start_hour INTEGER DEFAULT 9 CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour INTEGER DEFAULT 18 CHECK (end_hour >= 0 AND end_hour <= 23),
    active_days TEXT[] DEFAULT ARRAY['MON', 'TUE', 'WED', 'THU', 'FRI'],
    min_interval_minutes INTEGER DEFAULT 5,
    
    -- Rotação de números
    use_rotation BOOLEAN DEFAULT false,
    rotation_strategy TEXT DEFAULT 'EQUAL' CHECK (rotation_strategy IN ('EQUAL', 'PRIMARY_FIRST', 'RANDOM')),
    
    -- Métricas
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    
    -- Timestamps
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TEMPLATES DE MENSAGEM COM VARIAÇÕES IA
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_campaign_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES sistemaretiradas.whatsapp_campaigns(id) ON DELETE CASCADE,
    
    -- Template base
    base_template TEXT NOT NULL,
    
    -- Variações geradas pela IA (aprovadas pelo usuário)
    variations JSONB DEFAULT '[]',
    -- Exemplo: [{"id": "v1", "text": "Olá {primeiro_nome}...", "approved": true, "created_at": "..."}]
    
    -- Variáveis disponíveis no template
    available_variables TEXT[] DEFAULT ARRAY['primeiro_nome', 'nome_completo', 'ultima_compra', 'dias_sem_comprar', 'total_gasto', 'categoria', 'loja'],
    
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES sistemaretiradas.profiles(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FILA DE MENSAGENS (cada mensagem para cada destinatário)
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES sistemaretiradas.whatsapp_campaigns(id) ON DELETE CASCADE,
    
    -- Destinatário
    contact_id UUID REFERENCES sistemaretiradas.crm_contacts(id),
    phone TEXT NOT NULL,
    contact_name TEXT,
    
    -- Mensagem personalizada (já com variáveis substituídas)
    message_content TEXT NOT NULL,
    variation_id TEXT, -- Qual variação do template foi usada
    
    -- Status de envio
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED')),
    
    -- Qual número WhatsApp foi usado
    whatsapp_account_id UUID REFERENCES sistemaretiradas.whatsapp_accounts(id),
    
    -- Agendamento
    scheduled_for TIMESTAMPTZ,
    
    -- Resultado
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadados do contato para relatórios
    contact_metadata JSONB DEFAULT '{}',
    -- Exemplo: {"ultima_compra": "2024-12-01", "total_gasto": 1500, "categoria": "VIP"}
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EVENTOS/LOGS DA CAMPANHA (auditoria)
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES sistemaretiradas.whatsapp_campaigns(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL CHECK (event_type IN (
        'CREATED', 'STARTED', 'PAUSED', 'RESUMED', 'CANCELLED', 'COMPLETED', 'FAILED',
        'MESSAGE_SENT', 'MESSAGE_FAILED', 'RISK_WARNING', 'ACCOUNT_ROTATED', 'DAILY_LIMIT_REACHED',
        'AI_VARIATIONS_GENERATED', 'TEMPLATE_APPROVED', 'FILTER_APPLIED'
    )),
    
    event_data JSONB DEFAULT '{}',
    message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SNAPSHOTS DE FILTROS (para reproduzir a seleção)
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_campaign_recipient_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES sistemaretiradas.whatsapp_campaigns(id) ON DELETE CASCADE,
    
    -- Dados do contato no momento da seleção
    contact_id UUID REFERENCES sistemaretiradas.crm_contacts(id),
    contact_data JSONB NOT NULL,
    -- Inclui: nome, telefone, ultima_compra, total_gasto, ticket_medio, frequencia, categoria
    
    -- Status de seleção
    is_selected BOOLEAN DEFAULT true,
    deselected_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_store ON sistemaretiradas.whatsapp_campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status ON sistemaretiradas.whatsapp_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_messages_campaign ON sistemaretiradas.whatsapp_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_messages_status ON sistemaretiradas.whatsapp_campaign_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_messages_scheduled ON sistemaretiradas.whatsapp_campaign_messages(scheduled_for) WHERE status = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_store ON sistemaretiradas.whatsapp_accounts(store_id);

-- RLS POLICIES
ALTER TABLE sistemaretiradas.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.whatsapp_campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.whatsapp_campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.whatsapp_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.whatsapp_campaign_recipient_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop policies se existirem (para permitir re-execução)
DROP POLICY IF EXISTS whatsapp_campaigns_admin ON sistemaretiradas.whatsapp_campaigns;
DROP POLICY IF EXISTS whatsapp_accounts_admin ON sistemaretiradas.whatsapp_accounts;
DROP POLICY IF EXISTS whatsapp_templates_admin ON sistemaretiradas.whatsapp_campaign_templates;
DROP POLICY IF EXISTS whatsapp_messages_admin ON sistemaretiradas.whatsapp_campaign_messages;
DROP POLICY IF EXISTS whatsapp_events_admin ON sistemaretiradas.whatsapp_campaign_events;
DROP POLICY IF EXISTS whatsapp_snapshots_admin ON sistemaretiradas.whatsapp_campaign_recipient_snapshots;

-- Política: Admin pode ver/editar campanhas das suas lojas
CREATE POLICY whatsapp_campaigns_admin ON sistemaretiradas.whatsapp_campaigns
    FOR ALL USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE admin_id = auth.uid()
        )
    );

CREATE POLICY whatsapp_accounts_admin ON sistemaretiradas.whatsapp_accounts
    FOR ALL USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE admin_id = auth.uid()
        )
    );

CREATE POLICY whatsapp_templates_admin ON sistemaretiradas.whatsapp_campaign_templates
    FOR ALL USING (
        campaign_id IN (
            SELECT c.id FROM sistemaretiradas.whatsapp_campaigns c
            JOIN sistemaretiradas.stores s ON c.store_id = s.id
            WHERE s.admin_id = auth.uid()
        )
    );

CREATE POLICY whatsapp_messages_admin ON sistemaretiradas.whatsapp_campaign_messages
    FOR ALL USING (
        campaign_id IN (
            SELECT c.id FROM sistemaretiradas.whatsapp_campaigns c
            JOIN sistemaretiradas.stores s ON c.store_id = s.id
            WHERE s.admin_id = auth.uid()
        )
    );

CREATE POLICY whatsapp_events_admin ON sistemaretiradas.whatsapp_campaign_events
    FOR ALL USING (
        campaign_id IN (
            SELECT c.id FROM sistemaretiradas.whatsapp_campaigns c
            JOIN sistemaretiradas.stores s ON c.store_id = s.id
            WHERE s.admin_id = auth.uid()
        )
    );

CREATE POLICY whatsapp_snapshots_admin ON sistemaretiradas.whatsapp_campaign_recipient_snapshots
    FOR ALL USING (
        campaign_id IN (
            SELECT c.id FROM sistemaretiradas.whatsapp_campaigns c
            JOIN sistemaretiradas.stores s ON c.store_id = s.id
            WHERE s.admin_id = auth.uid()
        )
    );

-- FUNÇÃO: Calcular risco dinamicamente
CREATE OR REPLACE FUNCTION sistemaretiradas.calculate_campaign_risk(
    p_daily_limit INTEGER,
    p_min_interval INTEGER,
    p_use_rotation BOOLEAN,
    p_total_recipients INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_risk_score INTEGER := 0;
BEGIN
    -- Pontuação por intervalo
    IF p_min_interval <= 1 THEN
        v_risk_score := v_risk_score + 3; -- ALTO
    ELSIF p_min_interval <= 3 THEN
        v_risk_score := v_risk_score + 2; -- MÉDIO
    ELSE
        v_risk_score := v_risk_score + 1; -- BAIXO
    END IF;
    
    -- Pontuação por volume diário
    IF p_daily_limit > 100 THEN
        v_risk_score := v_risk_score + 3;
    ELSIF p_daily_limit > 50 THEN
        v_risk_score := v_risk_score + 2;
    ELSE
        v_risk_score := v_risk_score + 1;
    END IF;
    
    -- Rotação reduz risco
    IF p_use_rotation THEN
        v_risk_score := v_risk_score - 1;
    END IF;
    
    -- Classificar
    IF v_risk_score >= 5 THEN
        RETURN 'HIGH';
    ELSIF v_risk_score >= 3 THEN
        RETURN 'MEDIUM';
    ELSE
        RETURN 'LOW';
    END IF;
END;
$$;

-- FUNÇÃO: Buscar próximas mensagens para envio
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_campaign_messages(
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    message_id UUID,
    campaign_id UUID,
    phone TEXT,
    message_content TEXT,
    store_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW() AT TIME ZONE 'America/Belem';
    v_current_hour INTEGER := EXTRACT(HOUR FROM v_now);
    v_current_day TEXT := TO_CHAR(v_now, 'DY');
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS message_id,
        m.campaign_id,
        m.phone,
        m.message_content,
        c.store_id
    FROM sistemaretiradas.whatsapp_campaign_messages m
    JOIN sistemaretiradas.whatsapp_campaigns c ON m.campaign_id = c.id
    WHERE m.status = 'SCHEDULED'
    AND c.status = 'RUNNING'
    AND m.scheduled_for <= NOW()
    AND v_current_hour >= c.start_hour
    AND v_current_hour < c.end_hour
    AND v_current_day = ANY(c.active_days)
    ORDER BY m.scheduled_for ASC
    LIMIT p_limit;
END;
$$;

-- FUNÇÃO: Estatísticas CRM para filtros (usa tabela SALES unificada - compatível com todos os ERPs)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_crm_customer_stats(
    p_store_id UUID
)
RETURNS TABLE (
    contact_id UUID,
    nome TEXT,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    ultima_compra DATE,
    dias_sem_comprar INTEGER,
    total_compras NUMERIC,
    quantidade_compras INTEGER,
    ticket_medio NUMERIC,
    categoria TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH customer_sales AS (
        -- Busca vendas da tabela SALES (unificada de todos os ERPs: Tiny, Bling, etc)
        SELECT 
            s.cliente_id,
            MAX(s.data_venda::DATE) AS ultima_compra,
            SUM(COALESCE(s.valor, 0)) AS total_compras,
            COUNT(*) AS quantidade_compras
        FROM sistemaretiradas.sales s
        WHERE s.store_id = p_store_id
        AND s.cliente_id IS NOT NULL
        GROUP BY s.cliente_id
    )
    SELECT 
        c.id AS contact_id,
        c.nome,
        COALESCE(c.telefone, c.celular) AS telefone,
        c.email,
        c.cpf,
        cs.ultima_compra,
        COALESCE((CURRENT_DATE - cs.ultima_compra), 9999)::INTEGER AS dias_sem_comprar,
        COALESCE(cs.total_compras, 0) AS total_compras,
        COALESCE(cs.quantidade_compras::INTEGER, 0) AS quantidade_compras,
        CASE WHEN cs.quantidade_compras > 0 
            THEN ROUND(cs.total_compras / cs.quantidade_compras, 2) 
            ELSE 0 
        END AS ticket_medio,
        CASE 
            WHEN cs.total_compras >= 5000 THEN 'BLACK'
            WHEN cs.total_compras >= 2000 THEN 'PLATINUM'
            WHEN cs.total_compras >= 500 THEN 'VIP'
            ELSE 'REGULAR'
        END AS categoria
    FROM sistemaretiradas.crm_contacts c
    LEFT JOIN customer_sales cs ON c.id = cs.cliente_id
    WHERE c.store_id = p_store_id
    AND (c.telefone IS NOT NULL OR c.celular IS NOT NULL);
END;
$$;

COMMENT ON TABLE sistemaretiradas.whatsapp_campaigns IS 'Campanhas de envio em massa de WhatsApp com IA';
COMMENT ON TABLE sistemaretiradas.whatsapp_accounts IS 'Contas WhatsApp (principal + reservas para rotação)';
COMMENT ON FUNCTION sistemaretiradas.calculate_campaign_risk(INTEGER, INTEGER, BOOLEAN, INTEGER) IS 'Calcula nível de risco de banimento baseado em configurações';
COMMENT ON FUNCTION sistemaretiradas.get_next_campaign_messages(INTEGER) IS 'Busca próximas mensagens para envio';
COMMENT ON FUNCTION sistemaretiradas.get_crm_customer_stats(UUID) IS 'Retorna estatísticas CRM dos clientes da tabela SALES unificada';
