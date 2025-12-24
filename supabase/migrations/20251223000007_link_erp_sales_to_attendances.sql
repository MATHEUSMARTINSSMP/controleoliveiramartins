-- ============================================================================
-- MIGRATION: Linkar Vendas do ERP com Atendimentos da Lista da Vez
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: Sistema flexível para linkar vendas do ERP com atendimentos,
--            permitindo linkagem automática quando possível e manual quando necessário
-- ============================================================================

-- 1. Função para buscar atendimentos ativos de uma colaboradora
--    Útil para linkagem automática ou seleção manual
CREATE OR REPLACE FUNCTION sistemaretiradas.get_active_attendances_for_sale(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_sale_date TIMESTAMPTZ,
    p_minutes_tolerance INTEGER DEFAULT 30
)
RETURNS TABLE (
    attendance_id UUID,
    profile_id UUID,
    profile_name TEXT,
    started_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    time_diff_minutes INTEGER,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as attendance_id,
        a.profile_id,
        p.name as profile_name,
        a.started_at,
        COALESCE(
            CASE 
                WHEN a.duration_seconds IS NOT NULL 
                THEN a.duration_seconds / 60
                ELSE EXTRACT(EPOCH FROM (NOW() - a.started_at)) / 60
            END,
            0
        )::INTEGER as duration_minutes,
        ABS(EXTRACT(EPOCH FROM (p_sale_date - a.started_at)) / 60)::INTEGER as time_diff_minutes,
        a.status
    FROM sistemaretiradas.attendances a
    JOIN sistemaretiradas.profiles p ON p.id = a.profile_id
    WHERE a.profile_id = p_colaboradora_id
      AND a.store_id = p_store_id
      AND a.status = 'em_andamento'
      AND a.started_at >= p_sale_date - (p_minutes_tolerance || ' minutes')::INTERVAL
      AND a.started_at <= p_sale_date + (p_minutes_tolerance || ' minutes')::INTERVAL
    ORDER BY 
        ABS(EXTRACT(EPOCH FROM (p_sale_date - a.started_at))), -- Mais próximo primeiro
        a.started_at DESC; -- Mais recente primeiro
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para tentar linkar automaticamente uma venda do ERP
--    Retorna o attendance_id se conseguir linkar, NULL caso contrário
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
BEGIN
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
        -- Linkar venda com atendimento
        UPDATE sistemaretiradas.sales
        SET attendance_id = v_attendance_id
        WHERE id = p_sale_id
          AND attendance_id IS NULL; -- Apenas se ainda não estiver linkado

        -- Atualizar attendance_outcome se existir
        UPDATE sistemaretiradas.attendance_outcomes
        SET sale_id = p_sale_id
        WHERE attendance_id = v_attendance_id
          AND sale_id IS NULL
          AND result = 'venda';

        RETURN v_attendance_id;
    END IF;

    -- Se houver múltiplos ou nenhum, retornar NULL (requer linkagem manual)
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para linkar manualmente uma venda com um atendimento
CREATE OR REPLACE FUNCTION sistemaretiradas.link_sale_to_attendance_manual(
    p_sale_id UUID,
    p_attendance_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_sale RECORD;
    v_attendance RECORD;
BEGIN
    -- Validar que a venda existe e não está linkada
    SELECT * INTO v_sale
    FROM sistemaretiradas.sales
    WHERE id = p_sale_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venda não encontrada';
    END IF;

    -- Validar que o atendimento existe
    SELECT * INTO v_attendance
    FROM sistemaretiradas.attendances
    WHERE id = p_attendance_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Atendimento não encontrado';
    END IF;

    -- Validar que colaboradora e loja coincidem
    IF v_sale.colaboradora_id != v_attendance.profile_id THEN
        RAISE WARNING 'Colaboradora da venda (%) não coincide com colaboradora do atendimento (%)',
            v_sale.colaboradora_id, v_attendance.profile_id;
        -- Não bloquear, apenas avisar (pode ser caso especial)
    END IF;

    IF v_sale.store_id != v_attendance.store_id THEN
        RAISE EXCEPTION 'Loja da venda não coincide com loja do atendimento';
    END IF;

    -- Linkar venda com atendimento
    UPDATE sistemaretiradas.sales
    SET attendance_id = p_attendance_id
    WHERE id = p_sale_id;

    -- Atualizar ou criar attendance_outcome
    INSERT INTO sistemaretiradas.attendance_outcomes (
        attendance_id,
        result,
        sale_id,
        sale_value
    )
    VALUES (
        p_attendance_id,
        'venda',
        p_sale_id,
        v_sale.valor
    )
    ON CONFLICT (attendance_id) 
    DO UPDATE SET
        sale_id = p_sale_id,
        sale_value = v_sale.valor,
        result = 'venda';

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para tentar linkagem automática quando venda do ERP é criada
CREATE OR REPLACE FUNCTION sistemaretiradas.try_auto_link_erp_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_attendance_id UUID;
BEGIN
    -- Apenas tentar linkar se:
    -- 1. Venda veio do ERP (tem external_order_id ou order_source)
    -- 2. Não tem attendance_id ainda
    -- 3. Tem colaboradora_id e store_id
    IF (NEW.external_order_id IS NOT NULL OR NEW.order_source IS NOT NULL)
       AND NEW.attendance_id IS NULL
       AND NEW.colaboradora_id IS NOT NULL
       AND NEW.store_id IS NOT NULL THEN
        
        -- Tentar linkagem automática
        v_attendance_id := sistemaretiradas.auto_link_erp_sale_to_attendance(
            NEW.id,
            NEW.colaboradora_id,
            NEW.store_id,
            NEW.data_venda,
            30 -- 30 minutos de tolerância
        );

        -- Se conseguiu linkar, logar
        IF v_attendance_id IS NOT NULL THEN
            RAISE NOTICE 'Venda % linkada automaticamente com atendimento %', NEW.id, v_attendance_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_try_auto_link_erp_sale ON sistemaretiradas.sales;
CREATE TRIGGER trigger_try_auto_link_erp_sale
    AFTER INSERT ON sistemaretiradas.sales
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.try_auto_link_erp_sale();

-- 5. Comentários
COMMENT ON FUNCTION sistemaretiradas.get_active_attendances_for_sale IS
'Busca atendimentos ativos de uma colaboradora em um período de tempo, útil para linkagem de vendas do ERP.';

COMMENT ON FUNCTION sistemaretiradas.auto_link_erp_sale_to_attendance IS
'Tenta linkar automaticamente uma venda do ERP com um atendimento. Só funciona se houver exatamente 1 atendimento ativo da colaboradora no período.';

COMMENT ON FUNCTION sistemaretiradas.link_sale_to_attendance_manual IS
'Linka manualmente uma venda com um atendimento. Valida colaboradora e loja, mas permite casos especiais.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

