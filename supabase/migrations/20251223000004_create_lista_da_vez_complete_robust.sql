-- ============================================================================
-- MIGRATION: Sistema Completo e Robusto de Lista da Vez
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: Sistema completo de fila de atendimento com sessões, membros,
--            atendimentos, resultados, métricas, auditoria e configurações
--            Adaptado para schema sem tenant_id (usando store_id diretamente)
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR CAMPO lista_da_vez_ativo NA TABELA stores
-- ============================================================================

ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS lista_da_vez_ativo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stores_lista_da_vez_ativo 
ON sistemaretiradas.stores(lista_da_vez_ativo) 
WHERE lista_da_vez_ativo = true;

COMMENT ON COLUMN sistemaretiradas.stores.lista_da_vez_ativo IS 
'Indica se o módulo Lista da Vez está ativo para esta loja';

-- ============================================================================
-- 2. TABELA: queue_sessions (Sessões de Fila por Dia/Turno)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(20) DEFAULT 'integral' CHECK (shift IN ('manha', 'tarde', 'integral', 'noite')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, session_date, shift)
);

CREATE INDEX IF NOT EXISTS idx_queue_sessions_store_date ON sistemaretiradas.queue_sessions(store_id, session_date);
CREATE INDEX IF NOT EXISTS idx_queue_sessions_status ON sistemaretiradas.queue_sessions(status) WHERE status = 'active';

COMMENT ON TABLE sistemaretiradas.queue_sessions IS 
'Sessões de fila de atendimento por dia e turno. Cada loja pode ter múltiplas sessões por dia (manhã, tarde, integral)';

COMMENT ON COLUMN sistemaretiradas.queue_sessions.shift IS 
'Turno: manha, tarde, integral, noite';

COMMENT ON COLUMN sistemaretiradas.queue_sessions.status IS 
'Status da sessão: active = em andamento, paused = pausada, ended = finalizada';

-- ============================================================================
-- 3. TABELA: queue_members (Estado Atual na Fila)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sistemaretiradas.queue_sessions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_atendimento', 'pausado', 'indisponivel', 'finalizado')),
    pause_reason VARCHAR(50),
    position INTEGER NOT NULL DEFAULT 0,
    check_in_at TIMESTAMPTZ DEFAULT NOW(),
    check_out_at TIMESTAMPTZ,
    last_status_change TIMESTAMPTZ DEFAULT NOW(),
    total_available_time INTEGER DEFAULT 0, -- em segundos
    total_busy_time INTEGER DEFAULT 0, -- em segundos
    total_unavailable_time INTEGER DEFAULT 0, -- em segundos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_members_session ON sistemaretiradas.queue_members(session_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_members_profile ON sistemaretiradas.queue_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_queue_members_position ON sistemaretiradas.queue_members(session_id, position) 
WHERE status IN ('disponivel', 'em_atendimento');

-- Índice único parcial: garantir que cada colaboradora só pode estar uma vez na fila por sessão
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_members_unique_profile 
ON sistemaretiradas.queue_members(session_id, profile_id) 
WHERE status IN ('disponivel', 'em_atendimento', 'pausado');

COMMENT ON TABLE sistemaretiradas.queue_members IS 
'Membros da fila de atendimento. Representa colaboradoras que estão na fila para atender clientes';

COMMENT ON COLUMN sistemaretiradas.queue_members.status IS 
'Status: disponivel = aguardando na fila, em_atendimento = atendendo cliente, pausado = pausada temporariamente, indisponivel = fora da fila, finalizado = saiu da fila';

COMMENT ON COLUMN sistemaretiradas.queue_members.position IS 
'Posição na fila (1 = próximo a atender, 2 = segundo, etc). Reorganizada automaticamente quando alguém sai';

-- ============================================================================
-- 4. TABELA: loss_reasons (Motivos de Perda de Venda)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.loss_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loss_reasons_store ON sistemaretiradas.loss_reasons(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loss_reasons_active ON sistemaretiradas.loss_reasons(is_active) WHERE is_active = true;

COMMENT ON TABLE sistemaretiradas.loss_reasons IS 
'Motivos de perda de venda. Podem ser globais (store_id NULL) ou específicos por loja';

-- ============================================================================
-- 5. TABELA: attendances (Atendimentos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sistemaretiradas.queue_sessions(id) ON DELETE SET NULL,
    profile_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id),
    transferred_from UUID REFERENCES sistemaretiradas.profiles(id),
    transfer_reason VARCHAR(255),
    cliente_id UUID,
    cliente_nome VARCHAR(255),
    cliente_telefone VARCHAR(20),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    status VARCHAR(20) DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizado', 'cancelado', 'transferido')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendances_session ON sistemaretiradas.attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_attendances_profile ON sistemaretiradas.attendances(profile_id, started_at);
CREATE INDEX IF NOT EXISTS idx_attendances_store_date ON sistemaretiradas.attendances(store_id, started_at);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON sistemaretiradas.attendances(status) WHERE status = 'em_andamento';

COMMENT ON TABLE sistemaretiradas.attendances IS 
'Registro de atendimentos realizados. Cada atendimento pode resultar em venda ou perda';

COMMENT ON COLUMN sistemaretiradas.attendances.duration_seconds IS 
'Duração do atendimento em segundos. Calculado automaticamente quando ended_at é preenchido';

-- ============================================================================
-- 6. TABELA: attendance_outcomes (Resultado do Atendimento)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.attendance_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES sistemaretiradas.attendances(id) ON DELETE CASCADE,
    result VARCHAR(20) NOT NULL CHECK (result IN ('venda', 'perda', 'sem_resultado')),
    sale_value DECIMAL(12,2),
    items_count INTEGER,
    categories JSONB,
    loss_reason_id UUID REFERENCES sistemaretiradas.loss_reasons(id),
    loss_reason_other VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_outcomes_attendance ON sistemaretiradas.attendance_outcomes(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_outcomes_result ON sistemaretiradas.attendance_outcomes(result);
CREATE INDEX IF NOT EXISTS idx_attendance_outcomes_loss_reason ON sistemaretiradas.attendance_outcomes(loss_reason_id) WHERE loss_reason_id IS NOT NULL;

COMMENT ON TABLE sistemaretiradas.attendance_outcomes IS 
'Resultado de cada atendimento: venda (com valor), perda (com motivo) ou sem resultado';

-- ============================================================================
-- 7. TABELA: queue_events (Auditoria/Log de Eventos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sistemaretiradas.queue_sessions(id) ON DELETE CASCADE,
    member_id UUID REFERENCES sistemaretiradas.queue_members(id) ON DELETE SET NULL,
    attendance_id UUID REFERENCES sistemaretiradas.attendances(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    performed_by UUID REFERENCES sistemaretiradas.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_events_session ON sistemaretiradas.queue_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_type ON sistemaretiradas.queue_events(event_type);
CREATE INDEX IF NOT EXISTS idx_queue_events_member ON sistemaretiradas.queue_events(member_id) WHERE member_id IS NOT NULL;

COMMENT ON TABLE sistemaretiradas.queue_events IS 
'Log de todos os eventos do sistema de fila para auditoria e análise';

COMMENT ON COLUMN sistemaretiradas.queue_events.event_type IS 
'Tipos: check_in, check_out, pause, resume, start_attendance, end_attendance, transfer, etc';

-- ============================================================================
-- 8. TABELA: queue_store_settings (Configurações por Loja)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.queue_store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE UNIQUE,
    entry_position VARCHAR(20) DEFAULT 'end' CHECK (entry_position IN ('beginning', 'end')),
    return_position VARCHAR(20) DEFAULT 'end' CHECK (return_position IN ('beginning', 'end')),
    cooldown_minutes INTEGER DEFAULT 0 CHECK (cooldown_minutes >= 0),
    allowed_pause_types JSONB DEFAULT '["almoco", "estoque", "caixa"]'::jsonb,
    pause_requires_justification BOOLEAN DEFAULT false,
    max_pause_minutes JSONB DEFAULT '{"almoco": 60, "estoque": 15, "caixa": 30}'::jsonb,
    transfer_allowed BOOLEAN DEFAULT true,
    transfer_requires_reason BOOLEAN DEFAULT true,
    transfer_counts_for VARCHAR(20) DEFAULT 'receiver' CHECK (transfer_counts_for IN ('sender', 'receiver', 'both')),
    manager_can_pull_anyone BOOLEAN DEFAULT true,
    seller_can_self_pull BOOLEAN DEFAULT false,
    require_loss_reason BOOLEAN DEFAULT true,
    require_sale_value BOOLEAN DEFAULT true,
    require_category BOOLEAN DEFAULT false,
    attendance_categories JSONB DEFAULT '["sutia", "calcinha", "pijama", "pos_cirurgico", "fitness"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_store_settings_store ON sistemaretiradas.queue_store_settings(store_id);

COMMENT ON TABLE sistemaretiradas.queue_store_settings IS 
'Configurações específicas de cada loja para o sistema de fila';

-- ============================================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- ============================================================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION sistemaretiradas.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_queue_sessions_updated_at
    BEFORE UPDATE ON sistemaretiradas.queue_sessions
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_queue_members_updated_at
    BEFORE UPDATE ON sistemaretiradas.queue_members
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_attendances_updated_at
    BEFORE UPDATE ON sistemaretiradas.attendances
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_queue_store_settings_updated_at
    BEFORE UPDATE ON sistemaretiradas.queue_store_settings
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

-- Trigger para calcular duration_seconds quando atendimento termina
CREATE OR REPLACE FUNCTION sistemaretiradas.calculate_attendance_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_attendance_duration_trigger
    BEFORE UPDATE ON sistemaretiradas.attendances
    FOR EACH ROW
    WHEN (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL)
    EXECUTE FUNCTION sistemaretiradas.calculate_attendance_duration();

-- Trigger para atualizar last_status_change quando status muda
CREATE OR REPLACE FUNCTION sistemaretiradas.update_last_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        NEW.last_status_change = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_queue_members_status_change
    BEFORE UPDATE ON sistemaretiradas.queue_members
    FOR EACH ROW
    WHEN (NEW.status != OLD.status)
    EXECUTE FUNCTION sistemaretiradas.update_last_status_change();

-- ============================================================================
-- FUNÇÕES RPC PRINCIPAIS
-- ============================================================================

-- Função para obter ou criar sessão do dia
CREATE OR REPLACE FUNCTION sistemaretiradas.get_or_create_queue_session(
    p_store_id UUID,
    p_shift VARCHAR DEFAULT 'integral'
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Verificar se já existe sessão ativa
    SELECT id INTO v_session_id
    FROM sistemaretiradas.queue_sessions
    WHERE store_id = p_store_id
      AND session_date = CURRENT_DATE
      AND shift = p_shift
      AND status = 'active';
    
    -- Se não existe, criar nova
    IF v_session_id IS NULL THEN
        INSERT INTO sistemaretiradas.queue_sessions (store_id, shift)
        VALUES (p_store_id, p_shift)
        RETURNING id INTO v_session_id;
        
        -- Registrar evento
        INSERT INTO sistemaretiradas.queue_events (session_id, event_type, event_data)
        VALUES (v_session_id, 'session_created', jsonb_build_object('shift', p_shift));
    END IF;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular próxima posição na fila
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_queue_position(p_session_id UUID)
RETURNS INTEGER AS $$
    SELECT COALESCE(MAX(position), 0) + 1
    FROM sistemaretiradas.queue_members
    WHERE session_id = p_session_id
      AND status IN ('disponivel', 'em_atendimento', 'pausado');
$$ LANGUAGE sql SECURITY DEFINER;

-- Função para pegar próximo da fila (próximo a atender)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_in_queue(p_session_id UUID)
RETURNS UUID AS $$
    SELECT profile_id
    FROM sistemaretiradas.queue_members
    WHERE session_id = p_session_id
      AND status = 'disponivel'
    ORDER BY position ASC, check_in_at ASC
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Função para adicionar colaboradora na fila
CREATE OR REPLACE FUNCTION sistemaretiradas.add_to_queue(
    p_session_id UUID,
    p_profile_id UUID,
    p_entry_position VARCHAR DEFAULT 'end'
)
RETURNS UUID AS $$
DECLARE
    v_member_id UUID;
    v_position INTEGER;
    v_settings RECORD;
BEGIN
    -- Verificar se já está na fila
    SELECT id INTO v_member_id
    FROM sistemaretiradas.queue_members
    WHERE session_id = p_session_id
      AND profile_id = p_profile_id
      AND status IN ('disponivel', 'em_atendimento', 'pausado');
    
    IF v_member_id IS NOT NULL THEN
        RETURN v_member_id; -- Já está na fila
    END IF;
    
    -- Buscar configurações da loja
    SELECT qss.entry_position INTO v_settings
    FROM sistemaretiradas.queue_sessions qs
    JOIN sistemaretiradas.queue_store_settings qss ON qss.store_id = qs.store_id
    WHERE qs.id = p_session_id
    LIMIT 1;
    
    -- Usar configuração da loja ou parâmetro
    IF v_settings.entry_position IS NOT NULL THEN
        p_entry_position := v_settings.entry_position;
    END IF;
    
    -- Calcular posição
    IF p_entry_position = 'beginning' THEN
        -- Inserir no início (reorganizar todos)
        v_position := 1;
        UPDATE sistemaretiradas.queue_members
        SET position = position + 1
        WHERE session_id = p_session_id
          AND status IN ('disponivel', 'em_atendimento', 'pausado');
    ELSE
        -- Inserir no final
        v_position := sistemaretiradas.get_next_queue_position(p_session_id);
    END IF;
    
    -- Inserir na fila
    INSERT INTO sistemaretiradas.queue_members (
        session_id,
        profile_id,
        position,
        status
    ) VALUES (
        p_session_id,
        p_profile_id,
        v_position,
        'disponivel'
    )
    RETURNING id INTO v_member_id;
    
    -- Registrar evento
    INSERT INTO sistemaretiradas.queue_events (session_id, member_id, event_type, event_data, performed_by)
    VALUES (p_session_id, v_member_id, 'check_in', jsonb_build_object('position', v_position), p_profile_id);
    
    RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para remover da fila
CREATE OR REPLACE FUNCTION sistemaretiradas.remove_from_queue(
    p_member_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_session_id UUID;
    v_profile_id UUID;
BEGIN
    -- Buscar dados do membro
    SELECT session_id, profile_id INTO v_session_id, v_profile_id
    FROM sistemaretiradas.queue_members
    WHERE id = p_member_id;
    
    IF v_session_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Atualizar status
    UPDATE sistemaretiradas.queue_members
    SET status = 'finalizado',
        check_out_at = NOW(),
        updated_at = NOW()
    WHERE id = p_member_id;
    
    -- Reorganizar posições
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    -- Registrar evento
    INSERT INTO sistemaretiradas.queue_events (session_id, member_id, event_type, performed_by)
    VALUES (v_session_id, p_member_id, 'check_out', v_profile_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para reorganizar posições da fila
CREATE OR REPLACE FUNCTION sistemaretiradas.reorganize_queue_positions(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
    v_record RECORD;
    v_posicao INTEGER := 1;
BEGIN
    -- Reorganizar apenas quem está disponível
    FOR v_record IN
        SELECT id
        FROM sistemaretiradas.queue_members
        WHERE session_id = p_session_id
          AND status = 'disponivel'
        ORDER BY position ASC, check_in_at ASC
    LOOP
        UPDATE sistemaretiradas.queue_members
        SET position = v_posicao,
            updated_at = NOW()
        WHERE id = v_record.id;
        
        v_posicao := v_posicao + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para iniciar atendimento
CREATE OR REPLACE FUNCTION sistemaretiradas.start_attendance(
    p_member_id UUID,
    p_cliente_nome VARCHAR DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_cliente_telefone VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_member RECORD;
    v_attendance_id UUID;
    v_session_id UUID;
    v_store_id UUID;
BEGIN
    -- Buscar dados do membro
    SELECT qm.session_id, qm.profile_id, qs.store_id
    INTO v_member
    FROM sistemaretiradas.queue_members qm
    JOIN sistemaretiradas.queue_sessions qs ON qs.id = qm.session_id
    WHERE qm.id = p_member_id
      AND qm.status = 'disponivel';
    
    IF v_member IS NULL THEN
        RAISE EXCEPTION 'Membro não encontrado ou não está disponível';
    END IF;
    
    v_session_id := v_member.session_id;
    v_store_id := v_member.store_id;
    
    -- Atualizar status do membro
    UPDATE sistemaretiradas.queue_members
    SET status = 'em_atendimento',
        updated_at = NOW()
    WHERE id = p_member_id;
    
    -- Criar registro de atendimento
    INSERT INTO sistemaretiradas.attendances (
        store_id,
        session_id,
        profile_id,
        cliente_id,
        cliente_nome,
        cliente_telefone,
        status
    ) VALUES (
        v_store_id,
        v_session_id,
        v_member.profile_id,
        p_cliente_id,
        p_cliente_nome,
        p_cliente_telefone,
        'em_andamento'
    )
    RETURNING id INTO v_attendance_id;
    
    -- Registrar evento
    INSERT INTO sistemaretiradas.queue_events (session_id, member_id, attendance_id, event_type, event_data, performed_by)
    VALUES (v_session_id, p_member_id, v_attendance_id, 'start_attendance', 
            jsonb_build_object('cliente_nome', p_cliente_nome), v_member.profile_id);
    
    -- Reorganizar fila (remover da posição)
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para finalizar atendimento
CREATE OR REPLACE FUNCTION sistemaretiradas.end_attendance(
    p_attendance_id UUID,
    p_result VARCHAR,
    p_sale_value DECIMAL DEFAULT NULL,
    p_items_count INTEGER DEFAULT NULL,
    p_categories JSONB DEFAULT NULL,
    p_loss_reason_id UUID DEFAULT NULL,
    p_loss_reason_other VARCHAR DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_attendance RECORD;
    v_outcome_id UUID;
    v_member_id UUID;
    v_session_id UUID;
    v_store_id UUID;
    v_settings RECORD;
BEGIN
    -- Buscar dados do atendimento
    SELECT a.*, qm.id as member_id, qs.store_id as store_id
    INTO v_attendance
    FROM sistemaretiradas.attendances a
    LEFT JOIN sistemaretiradas.queue_members qm ON qm.profile_id = a.profile_id 
        AND qm.session_id = a.session_id 
        AND qm.status = 'em_atendimento'
    LEFT JOIN sistemaretiradas.queue_sessions qs ON qs.id = a.session_id
    WHERE a.id = p_attendance_id
      AND a.status = 'em_andamento';
    
    IF v_attendance IS NULL THEN
        RAISE EXCEPTION 'Atendimento não encontrado ou já finalizado';
    END IF;
    
    v_member_id := v_attendance.member_id;
    v_session_id := v_attendance.session_id;
    v_store_id := v_attendance.store_id;
    
    -- Finalizar atendimento
    UPDATE sistemaretiradas.attendances
    SET ended_at = NOW(),
        status = 'finalizado',
        updated_at = NOW()
    WHERE id = p_attendance_id;
    
    -- Criar resultado do atendimento
    INSERT INTO sistemaretiradas.attendance_outcomes (
        attendance_id,
        result,
        sale_value,
        items_count,
        categories,
        loss_reason_id,
        loss_reason_other,
        notes
    ) VALUES (
        p_attendance_id,
        p_result,
        p_sale_value,
        p_items_count,
        p_categories,
        p_loss_reason_id,
        p_loss_reason_other,
        p_notes
    )
    RETURNING id INTO v_outcome_id;
    
    -- Se membro ainda está na fila, voltar para disponível
    IF v_member_id IS NOT NULL THEN
        -- Buscar configurações
        SELECT return_position INTO v_settings
        FROM sistemaretiradas.queue_store_settings
        WHERE store_id = v_store_id
        LIMIT 1;
        
        IF v_settings.return_position = 'beginning' THEN
            -- Voltar para o início
            UPDATE sistemaretiradas.queue_members
            SET status = 'disponivel',
                position = 1,
                updated_at = NOW()
            WHERE id = v_member_id;
            
            -- Reorganizar outros
            UPDATE sistemaretiradas.queue_members
            SET position = position + 1
            WHERE session_id = v_session_id
              AND id != v_member_id
              AND status = 'disponivel';
        ELSE
            -- Voltar para o final
            UPDATE sistemaretiradas.queue_members
            SET status = 'disponivel',
                position = sistemaretiradas.get_next_queue_position(v_session_id),
                updated_at = NOW()
            WHERE id = v_member_id;
        END IF;
        
        -- Reorganizar fila
        PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    END IF;
    
    -- Registrar evento
    INSERT INTO sistemaretiradas.queue_events (session_id, member_id, attendance_id, event_type, event_data, performed_by)
    VALUES (v_session_id, v_member_id, p_attendance_id, 'end_attendance', 
            jsonb_build_object('result', p_result, 'sale_value', p_sale_value), v_attendance.profile_id);
    
    RETURN v_outcome_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNÇÕES DE MÉTRICAS E RELATÓRIOS
-- ============================================================================

-- Função para calcular métricas de uma colaboradora
CREATE OR REPLACE FUNCTION sistemaretiradas.get_collaborator_metrics(
    p_profile_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_attendances BIGINT,
    total_sales BIGINT,
    total_losses BIGINT,
    conversion_rate DECIMAL,
    total_sale_value DECIMAL,
    avg_attendance_duration INTEGER,
    total_attendance_time INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT a.id)::BIGINT as total_attendances,
        COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::BIGINT as total_sales,
        COUNT(DISTINCT CASE WHEN ao.result = 'perda' THEN a.id END)::BIGINT as total_losses,
        CASE 
            WHEN COUNT(DISTINCT a.id) > 0 THEN
                (COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL / COUNT(DISTINCT a.id)::DECIMAL * 100)
            ELSE 0
        END as conversion_rate,
        COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
        COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_attendance_duration,
        COALESCE(SUM(a.duration_seconds), 0)::INTEGER as total_attendance_time
    FROM sistemaretiradas.attendances a
    LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
    WHERE a.profile_id = p_profile_id
      AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
      AND a.status = 'finalizado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular métricas da loja
CREATE OR REPLACE FUNCTION sistemaretiradas.get_store_metrics(
    p_store_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_attendances BIGINT,
    total_sales BIGINT,
    total_losses BIGINT,
    conversion_rate DECIMAL,
    total_sale_value DECIMAL,
    avg_attendance_duration INTEGER,
    total_attendance_time INTEGER,
    active_collaborators BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT a.id)::BIGINT as total_attendances,
        COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::BIGINT as total_sales,
        COUNT(DISTINCT CASE WHEN ao.result = 'perda' THEN a.id END)::BIGINT as total_losses,
        CASE 
            WHEN COUNT(DISTINCT a.id) > 0 THEN
                (COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL / COUNT(DISTINCT a.id)::DECIMAL * 100)
            ELSE 0
        END as conversion_rate,
        COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
        COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_attendance_duration,
        COALESCE(SUM(a.duration_seconds), 0)::INTEGER as total_attendance_time,
        COUNT(DISTINCT a.profile_id)::BIGINT as active_collaborators
    FROM sistemaretiradas.attendances a
    LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
    WHERE a.store_id = p_store_id
      AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
      AND a.status = 'finalizado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE sistemaretiradas.queue_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.queue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.attendance_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.queue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.queue_store_settings ENABLE ROW LEVEL SECURITY;

-- Policies para queue_sessions
CREATE POLICY queue_sessions_select ON sistemaretiradas.queue_sessions FOR SELECT
    USING (
        store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY queue_sessions_insert ON sistemaretiradas.queue_sessions FOR INSERT
    WITH CHECK (
        store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY queue_sessions_update ON sistemaretiradas.queue_sessions FOR UPDATE
    USING (
        store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Policies para queue_members
CREATE POLICY queue_members_select ON sistemaretiradas.queue_members FOR SELECT
    USING (
        session_id IN (
            SELECT qs.id FROM sistemaretiradas.queue_sessions qs 
            WHERE qs.store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        )
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY queue_members_insert ON sistemaretiradas.queue_members FOR INSERT
    WITH CHECK (
        profile_id = auth.uid()
        AND session_id IN (
            SELECT qs.id FROM sistemaretiradas.queue_sessions qs 
            WHERE qs.store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY queue_members_update ON sistemaretiradas.queue_members FOR UPDATE
    USING (
        profile_id = auth.uid()
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Policies para attendances
CREATE POLICY attendances_select ON sistemaretiradas.attendances FOR SELECT
    USING (
        store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY attendances_insert ON sistemaretiradas.attendances FOR INSERT
    WITH CHECK (
        profile_id = auth.uid()
        AND store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
    );

CREATE POLICY attendances_update ON sistemaretiradas.attendances FOR UPDATE
    USING (
        profile_id = auth.uid()
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Policies para attendance_outcomes
CREATE POLICY attendance_outcomes_select ON sistemaretiradas.attendance_outcomes FOR SELECT
    USING (
        attendance_id IN (
            SELECT a.id FROM sistemaretiradas.attendances a 
            WHERE a.store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        )
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY attendance_outcomes_insert ON sistemaretiradas.attendance_outcomes FOR INSERT
    WITH CHECK (
        attendance_id IN (
            SELECT a.id FROM sistemaretiradas.attendances a 
            WHERE a.profile_id = auth.uid()
            AND a.store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        )
    );

-- Policies para loss_reasons
CREATE POLICY loss_reasons_select ON sistemaretiradas.loss_reasons FOR SELECT
    USING (
        store_id IS NULL 
        OR store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY loss_reasons_insert ON sistemaretiradas.loss_reasons FOR INSERT
    WITH CHECK (
        store_id IS NULL 
        OR store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Policies para queue_events (somente leitura para colaboradoras)
CREATE POLICY queue_events_select ON sistemaretiradas.queue_events FOR SELECT
    USING (
        session_id IN (
            SELECT qs.id FROM sistemaretiradas.queue_sessions qs 
            WHERE qs.store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        )
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Policies para queue_store_settings
CREATE POLICY queue_store_settings_select ON sistemaretiradas.queue_store_settings FOR SELECT
    USING (
        store_id IN (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY queue_store_settings_insert ON sistemaretiradas.queue_store_settings FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY queue_store_settings_update ON sistemaretiradas.queue_store_settings FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- ============================================================================
-- DADOS INICIAIS
-- ============================================================================

-- Motivos de perda padrão (globais)
INSERT INTO sistemaretiradas.loss_reasons (store_id, name, description, display_order) VALUES
(NULL, 'Preco alto', 'Cliente achou caro', 1),
(NULL, 'Falta de tamanho', 'Nao tinha o tamanho do cliente', 2),
(NULL, 'Falta de estoque', 'Produto indisponivel', 3),
(NULL, 'So olhando', 'Cliente estava apenas olhando', 4),
(NULL, 'Nao gostou', 'Cliente nao gostou do produto', 5),
(NULL, 'Vai pensar', 'Cliente disse que vai pensar', 6),
(NULL, 'Comprou em outro lugar', 'Cliente ja comprou em outro local', 7),
(NULL, 'Outro', 'Outro motivo', 99)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ✅ MIGRATION COMPLETA E ROBUSTA
-- ============================================================================

