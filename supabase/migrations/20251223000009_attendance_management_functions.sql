-- ============================================================================
-- MIGRATION: Funções para Gerenciamento de Atendimentos
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: Funções para criar, editar e transferir atendimentos manualmente
-- ============================================================================

-- 1. Função para criar atendimento manualmente
CREATE OR REPLACE FUNCTION sistemaretiradas.create_attendance_manual(
    p_store_id UUID,
    p_profile_id UUID,
    p_started_at TIMESTAMPTZ,
    p_ended_at TIMESTAMPTZ DEFAULT NULL,
    p_result VARCHAR DEFAULT NULL,
    p_sale_value DECIMAL DEFAULT NULL,
    p_loss_reason_id UUID DEFAULT NULL,
    p_cliente_nome VARCHAR DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_cliente_telefone VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_attendance_id UUID;
    v_session_id UUID;
    v_duration_seconds INTEGER;
    v_outcome_id UUID;
BEGIN
    -- Validar dados
    IF p_store_id IS NULL OR p_profile_id IS NULL OR p_started_at IS NULL THEN
        RAISE EXCEPTION 'Dados obrigatórios: store_id, profile_id, started_at';
    END IF;

    -- Buscar ou criar sessão do dia
    SELECT id INTO v_session_id
    FROM sistemaretiradas.queue_sessions
    WHERE store_id = p_store_id
      AND session_date = DATE(p_started_at)
      AND status = 'active'
    LIMIT 1;

    IF v_session_id IS NULL THEN
        INSERT INTO sistemaretiradas.queue_sessions (store_id, session_date)
        VALUES (p_store_id, DATE(p_started_at))
        RETURNING id INTO v_session_id;
    END IF;

    -- Calcular duração se ended_at fornecido
    IF p_ended_at IS NOT NULL THEN
        v_duration_seconds := EXTRACT(EPOCH FROM (p_ended_at - p_started_at))::INTEGER;
    END IF;

    -- Criar atendimento
    INSERT INTO sistemaretiradas.attendances (
        store_id,
        session_id,
        profile_id,
        started_at,
        ended_at,
        duration_seconds,
        status,
        cliente_nome,
        cliente_id,
        cliente_telefone
    ) VALUES (
        p_store_id,
        v_session_id,
        p_profile_id,
        p_started_at,
        p_ended_at,
        v_duration_seconds,
        CASE WHEN p_ended_at IS NOT NULL THEN 'finalizado' ELSE 'em_andamento' END,
        p_cliente_nome,
        p_cliente_id,
        p_cliente_telefone
    )
    RETURNING id INTO v_attendance_id;

    -- Se resultado fornecido, criar outcome
    IF p_result IS NOT NULL THEN
        INSERT INTO sistemaretiradas.attendance_outcomes (
            attendance_id,
            result,
            sale_value,
            loss_reason_id
        ) VALUES (
            v_attendance_id,
            p_result,
            p_sale_value,
            p_loss_reason_id
        )
        RETURNING id INTO v_outcome_id;
    END IF;

    RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para atualizar atendimento
CREATE OR REPLACE FUNCTION sistemaretiradas.update_attendance(
    p_attendance_id UUID,
    p_profile_id UUID DEFAULT NULL,
    p_started_at TIMESTAMPTZ DEFAULT NULL,
    p_ended_at TIMESTAMPTZ DEFAULT NULL,
    p_result VARCHAR DEFAULT NULL,
    p_sale_value DECIMAL DEFAULT NULL,
    p_loss_reason_id UUID DEFAULT NULL,
    p_cliente_nome VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_attendance RECORD;
    v_duration_seconds INTEGER;
    v_outcome_id UUID;
BEGIN
    -- Buscar atendimento
    SELECT * INTO v_attendance
    FROM sistemaretiradas.attendances
    WHERE id = p_attendance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atendimento não encontrado';
    END IF;

    -- Calcular duração se ambos os horários fornecidos
    IF p_started_at IS NOT NULL AND p_ended_at IS NOT NULL THEN
        v_duration_seconds := EXTRACT(EPOCH FROM (p_ended_at - p_started_at))::INTEGER;
    ELSIF v_attendance.started_at IS NOT NULL AND p_ended_at IS NOT NULL THEN
        v_duration_seconds := EXTRACT(EPOCH FROM (p_ended_at - v_attendance.started_at))::INTEGER;
    ELSIF p_started_at IS NOT NULL AND v_attendance.ended_at IS NOT NULL THEN
        v_duration_seconds := EXTRACT(EPOCH FROM (v_attendance.ended_at - p_started_at))::INTEGER;
    END IF;

    -- Atualizar atendimento
    UPDATE sistemaretiradas.attendances
    SET 
        profile_id = COALESCE(p_profile_id, profile_id),
        started_at = COALESCE(p_started_at, started_at),
        ended_at = COALESCE(p_ended_at, ended_at),
        duration_seconds = COALESCE(v_duration_seconds, duration_seconds),
        status = CASE 
            WHEN p_ended_at IS NOT NULL THEN 'finalizado'
            WHEN p_ended_at IS NULL AND ended_at IS NOT NULL THEN 'em_andamento'
            ELSE status
        END,
        cliente_nome = COALESCE(p_cliente_nome, cliente_nome),
        updated_at = NOW()
    WHERE id = p_attendance_id;

    -- Atualizar ou criar outcome se resultado fornecido
    IF p_result IS NOT NULL THEN
        SELECT id INTO v_outcome_id
        FROM sistemaretiradas.attendance_outcomes
        WHERE attendance_id = p_attendance_id;

        IF v_outcome_id IS NOT NULL THEN
            -- Atualizar outcome existente
            UPDATE sistemaretiradas.attendance_outcomes
            SET 
                result = p_result,
                sale_value = p_sale_value,
                loss_reason_id = p_loss_reason_id
            WHERE id = v_outcome_id;
        ELSE
            -- Criar novo outcome
            INSERT INTO sistemaretiradas.attendance_outcomes (
                attendance_id,
                result,
                sale_value,
                loss_reason_id
            ) VALUES (
                p_attendance_id,
                p_result,
                p_sale_value,
                p_loss_reason_id
            );
        END IF;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para transferir atendimento (alterar colaboradora)
CREATE OR REPLACE FUNCTION sistemaretiradas.transfer_attendance(
    p_attendance_id UUID,
    p_new_profile_id UUID,
    p_reason VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_attendance RECORD;
    v_old_profile_id UUID;
BEGIN
    -- Buscar atendimento
    SELECT * INTO v_attendance
    FROM sistemaretiradas.attendances
    WHERE id = p_attendance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atendimento não encontrado';
    END IF;

    IF v_attendance.status = 'finalizado' THEN
        RAISE EXCEPTION 'Não é possível transferir um atendimento já finalizado';
    END IF;

    v_old_profile_id := v_attendance.profile_id;

    -- Atualizar profile_id do atendimento
    UPDATE sistemaretiradas.attendances
    SET 
        profile_id = p_new_profile_id,
        transferred_from = v_old_profile_id,
        transfer_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_attendance_id;

    -- Se ainda está em andamento e tem member na fila, atualizar também
    IF v_attendance.status = 'em_andamento' THEN
        UPDATE sistemaretiradas.queue_members
        SET profile_id = p_new_profile_id
        WHERE session_id = v_attendance.session_id
          AND profile_id = v_old_profile_id
          AND status = 'em_atendimento';
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Comentários
COMMENT ON FUNCTION sistemaretiradas.create_attendance_manual IS
'Cria um atendimento manualmente. Útil para registrar atendimentos que não foram feitos através da fila.';

COMMENT ON FUNCTION sistemaretiradas.update_attendance IS
'Atualiza um atendimento existente. Permite alterar colaboradora, horários, resultado, etc.';

COMMENT ON FUNCTION sistemaretiradas.transfer_attendance IS
'Transfere um atendimento em andamento para outra colaboradora. Mantém histórico da transferência.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

