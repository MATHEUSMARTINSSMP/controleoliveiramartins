-- ============================================================================
-- MIGRATION: Melhorias na Linkagem ERP e Gerenciamento de Fila
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: 
-- 1. Melhora linkagem automática ERP para finalizar atendimento e mover para final
-- 2. Adiciona funções para reorganizar fila (topo/final)
-- ============================================================================

-- 1. Função para mover colaboradora para o topo da fila
CREATE OR REPLACE FUNCTION sistemaretiradas.move_member_to_top(
    p_member_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_session_id UUID;
    v_current_position INTEGER;
BEGIN
    -- Buscar dados do membro
    SELECT session_id, position INTO v_session_id, v_current_position
    FROM sistemaretiradas.queue_members
    WHERE id = p_member_id
      AND status = 'disponivel';
    
    IF v_session_id IS NULL THEN
        RAISE EXCEPTION 'Membro não encontrado ou não está disponível';
    END IF;
    
    -- Mover todos os outros para baixo
    UPDATE sistemaretiradas.queue_members
    SET position = position + 1,
        updated_at = NOW()
    WHERE session_id = v_session_id
      AND status = 'disponivel'
      AND position < v_current_position;
    
    -- Mover para posição 1
    UPDATE sistemaretiradas.queue_members
    SET position = 1,
        updated_at = NOW()
    WHERE id = p_member_id;
    
    -- Reorganizar fila
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para mover colaboradora para o final da fila
CREATE OR REPLACE FUNCTION sistemaretiradas.move_member_to_end(
    p_member_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_session_id UUID;
    v_new_position INTEGER;
BEGIN
    -- Buscar dados do membro
    SELECT session_id INTO v_session_id
    FROM sistemaretiradas.queue_members
    WHERE id = p_member_id
      AND status = 'disponivel';
    
    IF v_session_id IS NULL THEN
        RAISE EXCEPTION 'Membro não encontrado ou não está disponível';
    END IF;
    
    -- Calcular nova posição (final)
    v_new_position := sistemaretiradas.get_next_queue_position(v_session_id);
    
    -- Mover para o final
    UPDATE sistemaretiradas.queue_members
    SET position = v_new_position,
        updated_at = NOW()
    WHERE id = p_member_id;
    
    -- Reorganizar fila
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Melhorar função de linkagem automática ERP
--    Agora finaliza o atendimento e move para final da fila
CREATE OR REPLACE FUNCTION sistemaretiradas.auto_link_erp_sale_to_attendance(
    p_sale_id UUID,
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_sale_date TIMESTAMPTZ,
    p_minutes_tolerance INTEGER DEFAULT 30
)
RETURNS UUID AS $$
DECLARE
    v_attendance_id UUID;
    v_attendances_count INTEGER;
    v_attendance RECORD;
    v_member_id UUID;
    v_session_id UUID;
    v_sale_value DECIMAL;
BEGIN
    -- Buscar valor da venda
    SELECT valor INTO v_sale_value
    FROM sistemaretiradas.sales
    WHERE id = p_sale_id;
    
    -- Buscar atendimentos ativos da colaboradora no período
    SELECT COUNT(*), MAX(attendance_id)
    INTO v_attendances_count, v_attendance_id
    FROM sistemaretiradas.get_active_attendances_for_sale(
        p_colaboradora_id,
        p_store_id,
        p_sale_date,
        p_minutes_tolerance
    );

    -- Se houver exatamente 1 atendimento, linkar automaticamente
    IF v_attendances_count = 1 AND v_attendance_id IS NOT NULL THEN
        -- Buscar dados do atendimento
        SELECT a.*, qm.id as member_id, qs.id as session_id
        INTO v_attendance
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.queue_members qm ON qm.profile_id = a.profile_id 
            AND qm.session_id = a.session_id 
            AND qm.status = 'em_atendimento'
        LEFT JOIN sistemaretiradas.queue_sessions qs ON qs.id = a.session_id
        WHERE a.id = v_attendance_id
          AND a.status = 'em_andamento';
        
        v_member_id := v_attendance.member_id;
        v_session_id := v_attendance.session_id;
        
        -- Linkar venda com atendimento
        UPDATE sistemaretiradas.sales
        SET attendance_id = v_attendance_id
        WHERE id = p_sale_id
          AND attendance_id IS NULL;
        
        -- Finalizar atendimento
        UPDATE sistemaretiradas.attendances
        SET ended_at = NOW(),
            status = 'finalizado',
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
            updated_at = NOW()
        WHERE id = v_attendance_id;
        
        -- Criar ou atualizar attendance_outcome
        INSERT INTO sistemaretiradas.attendance_outcomes (
            attendance_id,
            result,
            sale_id,
            sale_value
        )
        VALUES (
            v_attendance_id,
            'venda',
            p_sale_id,
            v_sale_value
        )
        ON CONFLICT (attendance_id) 
        DO UPDATE SET
            sale_id = p_sale_id,
            sale_value = v_sale_value,
            result = 'venda';
        
        -- Se membro ainda está na fila, mover para final
        IF v_member_id IS NOT NULL AND v_session_id IS NOT NULL THEN
            -- Mover para o final da fila
            PERFORM sistemaretiradas.move_member_to_end(v_member_id);
        END IF;
        
        RETURN v_attendance_id;
    END IF;

    -- Se houver múltiplos ou nenhum, retornar NULL (requer linkagem manual)
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Comentários
COMMENT ON FUNCTION sistemaretiradas.move_member_to_top IS
'Move uma colaboradora para o topo da fila (posição 1).';

COMMENT ON FUNCTION sistemaretiradas.move_member_to_end IS
'Move uma colaboradora para o final da fila.';

COMMENT ON FUNCTION sistemaretiradas.auto_link_erp_sale_to_attendance IS
'Linka automaticamente uma venda do ERP com atendimento, finaliza o atendimento e move colaboradora para final da fila.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

