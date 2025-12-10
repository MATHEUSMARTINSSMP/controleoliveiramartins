-- =====================================================
-- ADICIONAR RESTRIÇÕES DE ACESSO BASEADAS EM BILLING
-- =====================================================
-- Cria funções helper para verificar acesso em nível de ação

-- =====================================================
-- FUNÇÃO: Verificar se pode criar/editar (bloqueia se READ_ONLY ou BLOCKED)
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.can_admin_create_or_edit(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_access JSON;
    v_access_level TEXT;
BEGIN
    -- Verificar acesso
    SELECT * INTO v_access
    FROM sistemaretiradas.check_admin_access(p_admin_id);
    
    v_access_level := v_access->>'access_level';
    
    -- Permitir apenas se FULL ou WARNING
    RETURN v_access_level IN ('FULL', 'WARNING');
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.can_admin_create_or_edit IS 'Verifica se admin pode criar/editar (bloqueia em READ_ONLY e BLOCKED)';

GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_create_or_edit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_create_or_edit(UUID) TO anon;

-- =====================================================
-- FUNÇÃO: Verificar se pode visualizar (sempre permite, exceto BLOCKED)
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.can_admin_view(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_access JSON;
    v_access_level TEXT;
BEGIN
    -- Verificar acesso
    SELECT * INTO v_access
    FROM sistemaretiradas.check_admin_access(p_admin_id);
    
    v_access_level := v_access->>'access_level';
    
    -- Permitir visualização exceto se BLOCKED
    RETURN v_access_level != 'BLOCKED';
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.can_admin_view IS 'Verifica se admin pode visualizar (sempre permite exceto BLOCKED)';

GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.can_admin_view(UUID) TO anon;

