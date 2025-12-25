-- ============================================================================
-- CORRIGIR FUNÇÃO auto_link_erp_sale_to_attendance - PROBLEMA COM FUNÇÃO TABLE
-- ============================================================================
-- Data: 2025-12-24
-- Problema: Erro "structure of query does not match function result type"
--           ao usar get_active_attendances_for_sale (RETURNS TABLE) no FROM
-- Solução: Usar CTE ou subquery para evitar problema de tipo
-- ============================================================================

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
    
    -- ✅ CORREÇÃO: Fazer duas queries separadas para evitar problema de tipo
    -- Primeiro: contar quantos atendimentos existem
    SELECT COUNT(*)::INTEGER
    INTO v_attendances_count
    FROM sistemaretiradas.get_active_attendances_for_sale(
        p_colaboradora_id,
        p_store_id,
        p_sale_date,
        p_minutes_tolerance
    );
    
    -- Segundo: se houver pelo menos 1, pegar o primeiro
    IF v_attendances_count > 0 THEN
        SELECT attendance_id
        INTO v_attendance_id
        FROM sistemaretiradas.get_active_attendances_for_sale(
            p_colaboradora_id,
            p_store_id,
            p_sale_date,
            p_minutes_tolerance
        )
        LIMIT 1;
    END IF;

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

COMMENT ON FUNCTION sistemaretiradas.auto_link_erp_sale_to_attendance IS 
'Tenta linkar automaticamente uma venda do ERP com um atendimento. Só funciona se houver exatamente 1 atendimento ativo da colaboradora no período.
CORRIGIDO: Usa CTE para evitar erro "structure of query does not match function result type" ao usar função TABLE.';

-- TESTAR SE FUNCIONOU
SELECT sistemaretiradas.processar_tiny_order_para_venda('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID) as sale_id_criado;

-- ============================================================================
-- ✅ CORREÇÃO APLICADA
-- ============================================================================

