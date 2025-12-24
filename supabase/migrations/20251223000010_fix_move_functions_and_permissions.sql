-- ============================================================================
-- MIGRATION: Corrigir funções de mover na fila e permissões
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: 
-- 1. Recriar funções de mover na fila com permissões corretas
-- 2. Garantir que funções estejam disponíveis no schema cache
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
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao mover para o topo: %', SQLERRM;
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
    SELECT COALESCE(MAX(position), 0) + 1 INTO v_new_position
    FROM sistemaretiradas.queue_members
    WHERE session_id = v_session_id
      AND status = 'disponivel';
    
    -- Mover para o final
    UPDATE sistemaretiradas.queue_members
    SET position = v_new_position,
        updated_at = NOW()
    WHERE id = p_member_id;
    
    -- Reorganizar fila
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao mover para o final: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir que funções tenham permissões corretas
GRANT EXECUTE ON FUNCTION sistemaretiradas.move_member_to_top(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.move_member_to_end(UUID) TO authenticated;

-- 4. Comentários
COMMENT ON FUNCTION sistemaretiradas.move_member_to_top IS
'Move uma colaboradora para o topo da fila (posição 1). Retorna true se sucesso.';

COMMENT ON FUNCTION sistemaretiradas.move_member_to_end IS
'Move uma colaboradora para o final da fila. Retorna true se sucesso.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

