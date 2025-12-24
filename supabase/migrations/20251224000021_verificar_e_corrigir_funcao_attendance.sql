-- ============================================================================
-- VERIFICAR E CORRIGIR FUNÇÃO auto_link_erp_sale_to_attendance
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Verifica se a função foi corrigida e, se não, corrige agora
-- ============================================================================

-- 1. VERIFICAR SE A FUNÇÃO TEM MAX(attendance_id) (ERRO)
-- ============================================================================
-- Procura por SELECT com MAX(attendance_id) no código (não em comentários)
SELECT 
    CASE 
        WHEN pg_get_functiondef(p.oid) ~ 'SELECT.*COUNT\(\*\).*MAX\(attendance_id\)' 
        THEN '❌ FUNÇÃO AINDA TEM ERRO MAX(uuid) - PRECISA CORRIGIR'
        WHEN pg_get_functiondef(p.oid) ~ 'SELECT.*MAX\(attendance_id\)' AND pg_get_functiondef(p.oid) !~ '--.*MAX\(attendance_id\)'
        THEN '❌ FUNÇÃO AINDA TEM ERRO MAX(uuid) - PRECISA CORRIGIR'
        ELSE '✅ FUNÇÃO NÃO TEM MAX(attendance_id) NO CÓDIGO - OK'
    END as status_funcao,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'auto_link_erp_sale_to_attendance'
LIMIT 1;

-- 2. CORRIGIR FUNÇÃO SE AINDA TIVER O ERRO
-- ============================================================================
-- Esta é a mesma correção da migration 20251224000015
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
    
    -- ✅ CORREÇÃO: Contar atendimentos e pegar o primeiro (mais próximo) se houver exatamente 1
    -- MAX(attendance_id) não funciona com UUID, então usamos duas queries separadas
    -- Primeiro: contar quantos atendimentos existem
    SELECT COUNT(*)::INTEGER
    INTO v_attendances_count
    FROM sistemaretiradas.get_active_attendances_for_sale(
        p_colaboradora_id,
        p_store_id,
        p_sale_date,
        p_minutes_tolerance
    );
    
    -- Se houver pelo menos 1, pegar o primeiro (mais próximo, já está ordenado)
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
Agora também finaliza o atendimento e move para final da fila.
CORRIGIDO: Substituído MAX(attendance_id) por LIMIT 1 em query separada já que MAX() não funciona com UUID.';

-- 3. VERIFICAR NOVAMENTE APÓS CORREÇÃO
-- ============================================================================
-- Procura por SELECT com MAX(attendance_id) no código (não em comentários)
SELECT 
    CASE 
        WHEN pg_get_functiondef(p.oid) ~ 'SELECT.*COUNT\(\*\).*MAX\(attendance_id\)' 
        THEN '❌ AINDA TEM ERRO'
        WHEN pg_get_functiondef(p.oid) ~ 'SELECT.*MAX\(attendance_id\)' AND pg_get_functiondef(p.oid) !~ '--.*MAX\(attendance_id\)'
        THEN '❌ AINDA TEM ERRO'
        ELSE '✅ CORRIGIDO - SEM MAX(attendance_id) NO CÓDIGO'
    END as status_apos_correcao
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'auto_link_erp_sale_to_attendance'
LIMIT 1;

-- ============================================================================
-- ✅ SCRIPT PARA GARANTIR QUE A FUNÇÃO ESTÁ CORRIGIDA
-- ============================================================================

