-- ============================================================================
-- MIGRATION: Corrigir status da fila e sempre mover para final ao finalizar
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: 
-- 1. Garantir que ao iniciar atendimento, o status seja atualizado corretamente
-- 2. Sempre mover colaboradora para o final da fila ao finalizar atendimento
-- ============================================================================

-- 1. Melhorar função start_attendance para garantir atualização de status
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
    
    -- Atualizar status do membro para 'em_atendimento' (IMPORTANTE: remove da lista "Esperando")
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
    
    -- Reorganizar fila (remover da posição, outros avançam)
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Melhorar função end_attendance para SEMPRE mover para o final
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
BEGIN
    -- Buscar dados do atendimento
    SELECT a.*, qs.store_id as store_id, a.session_id
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
    
    -- Buscar member_id diretamente pela profile_id e session_id
    -- IMPORTANTE: Buscar independente do status para garantir que encontramos o registro
    SELECT id INTO v_member_id
    FROM sistemaretiradas.queue_members
    WHERE profile_id = v_attendance.profile_id
      AND session_id = v_session_id
    LIMIT 1;
    
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
    
    -- Se membro ainda está na fila, SEMPRE mover para o final (independente da configuração)
    -- IMPORTANTE: Verificar se já existe registro 'disponivel' antes de atualizar
    IF v_member_id IS NOT NULL THEN
        -- Verificar se o membro ainda existe (pode ter sido removido)
        IF EXISTS (SELECT 1 FROM sistemaretiradas.queue_members WHERE id = v_member_id) THEN
            -- IMPORTANTE: Verificar se já existe outro registro 'disponivel' para esta colaboradora
            -- Se existir, deletar o registro antigo (com status 'em_atendimento') e usar o existente
            -- Buscar se já existe registro 'disponivel' para esta colaboradora e sessão
            SELECT id INTO v_existing_member_id
            FROM sistemaretiradas.queue_members
            WHERE profile_id = v_attendance.profile_id
              AND session_id = v_session_id
              AND status = 'disponivel'
              AND id != v_member_id
            LIMIT 1;
            
            IF v_existing_member_id IS NOT NULL THEN
                -- Já existe registro 'disponivel', deletar o registro 'em_atendimento'
                DELETE FROM sistemaretiradas.queue_members
                WHERE id = v_member_id;
                
                -- Usar o registro existente e apenas atualizar posição para o final
                SELECT COALESCE(MAX(position), 0) + 1 INTO v_new_position
                FROM sistemaretiradas.queue_members
                WHERE session_id = v_session_id
                  AND status = 'disponivel';
                
                UPDATE sistemaretiradas.queue_members
                SET position = v_new_position,
                    updated_at = NOW()
                WHERE id = v_existing_member_id;
                
                v_member_id := v_existing_member_id; -- Atualizar para usar no evento
            ELSE
                -- Não existe registro duplicado, apenas atualizar o existente
                SELECT COALESCE(MAX(position), 0) + 1 INTO v_new_position
                FROM sistemaretiradas.queue_members
                WHERE session_id = v_session_id
                  AND status = 'disponivel'
                  AND id != v_member_id;
                
                -- Sempre mover para o final da fila usando UPDATE (não INSERT)
                UPDATE sistemaretiradas.queue_members
                SET status = 'disponivel',
                    position = v_new_position,
                    updated_at = NOW()
                WHERE id = v_member_id;
            END IF;
            
            -- Reorganizar fila para garantir posições corretas
            PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
        ELSE
            -- Membro foi removido da fila, não fazer nada
            RAISE NOTICE 'Membro % não existe mais na fila para o atendimento %', v_member_id, p_attendance_id;
        END IF;
    ELSE
        -- Se não encontrou member_id, pode ser que o membro já foi removido da fila
        -- Nesse caso, não fazemos nada (atendimento já foi finalizado)
        RAISE NOTICE 'Membro não encontrado na fila para o atendimento %', p_attendance_id;
    END IF;
    
    -- Registrar evento
    INSERT INTO sistemaretiradas.queue_events (session_id, member_id, attendance_id, event_type, event_data, performed_by)
    VALUES (v_session_id, v_member_id, p_attendance_id, 'end_attendance', 
            jsonb_build_object('result', p_result, 'sale_value', p_sale_value), v_attendance.profile_id);
    
    RETURN v_outcome_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Comentários
COMMENT ON FUNCTION sistemaretiradas.start_attendance IS
'Inicia um atendimento, atualiza status do membro para em_atendimento (remove da lista Esperando) e cria registro de atendimento.';

COMMENT ON FUNCTION sistemaretiradas.end_attendance IS
'Finaliza um atendimento e SEMPRE move a colaboradora para o final da fila, independente da configuração.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

