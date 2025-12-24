-- ============================================================================
-- MIGRATION: Correção robusta da função end_attendance
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: Versão mais robusta que limpa duplicatas antes de atualizar
-- ============================================================================

-- Função para finalizar atendimento (versão robusta)
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
    v_new_position INTEGER;
    v_existing_member_id UUID;
    v_profile_id UUID;
BEGIN
    -- Buscar dados do atendimento
    SELECT a.*, qs.store_id as store_id, a.session_id, a.profile_id
    INTO v_attendance
    FROM sistemaretiradas.attendances a
    LEFT JOIN sistemaretiradas.queue_sessions qs ON qs.id = a.session_id
    WHERE a.id = p_attendance_id
      AND a.status = 'em_andamento';
    
    IF v_attendance IS NULL THEN
        RAISE EXCEPTION 'Atendimento não encontrado ou já finalizado';
    END IF;
    
    v_session_id := v_attendance.session_id;
    v_store_id := v_attendance.store_id;
    v_profile_id := v_attendance.profile_id;
    
    -- IMPORTANTE: Usar função helper para limpar duplicatas automaticamente
    -- Esta função garante que há apenas um registro por (session_id, profile_id)
    SELECT sistemaretiradas.cleanup_duplicate_queue_members(v_session_id, v_profile_id) INTO v_member_id;
    
    -- Se não encontrou member_id após limpeza, buscar novamente
    IF v_member_id IS NULL THEN
        SELECT id INTO v_member_id
        FROM sistemaretiradas.queue_members
        WHERE profile_id = v_profile_id
          AND session_id = v_session_id
        LIMIT 1;
    END IF;
    
    -- Finalizar atendimento
    UPDATE sistemaretiradas.attendances
    SET ended_at = NOW(),
        status = 'finalizado',
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
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
    
    -- Se membro ainda está na fila, SEMPRE mover para o final
    IF v_member_id IS NOT NULL THEN
        -- Calcular nova posição (final da fila)
        SELECT COALESCE(MAX(position), 0) + 1 INTO v_new_position
        FROM sistemaretiradas.queue_members
        WHERE session_id = v_session_id
          AND status = 'disponivel'
          AND id != v_member_id;
        
        -- Atualizar para disponível e mover para o final
        UPDATE sistemaretiradas.queue_members
        SET status = 'disponivel',
            position = v_new_position,
            updated_at = NOW()
        WHERE id = v_member_id;
        
        -- Reorganizar fila para garantir posições corretas
        PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    END IF;
    
    -- Registrar evento
    INSERT INTO sistemaretiradas.queue_events (session_id, member_id, attendance_id, event_type, event_data, performed_by)
    VALUES (v_session_id, v_member_id, p_attendance_id, 'end_attendance', 
            jsonb_build_object('result', p_result, 'sale_value', p_sale_value), v_profile_id);
    
    RETURN v_outcome_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário
COMMENT ON FUNCTION sistemaretiradas.end_attendance IS
'Finaliza um atendimento, limpa duplicatas e SEMPRE move a colaboradora para o final da fila.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

