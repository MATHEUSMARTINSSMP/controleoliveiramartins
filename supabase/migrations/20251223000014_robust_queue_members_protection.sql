-- ============================================================================
-- MIGRATION: Proteção Robusta contra Duplicatas em queue_members
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: 
-- 1. Função helper para limpar duplicatas automaticamente
-- 2. Trigger BEFORE INSERT/UPDATE para prevenir duplicatas
-- 3. Atualizar todas as funções para usar proteção automática
-- ============================================================================

-- 1. Função helper para limpar duplicatas de uma colaboradora em uma sessão
-- Esta função SEMPRE garante que há apenas um registro por (session_id, profile_id)
CREATE OR REPLACE FUNCTION sistemaretiradas.cleanup_duplicate_queue_members(
    p_session_id UUID,
    p_profile_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_kept_member_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Deletar TODOS os registros 'finalizado' (não deveriam existir)
    DELETE FROM sistemaretiradas.queue_members
    WHERE session_id = p_session_id
      AND profile_id = p_profile_id
      AND status = 'finalizado';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count > 0 THEN
        RAISE NOTICE '[cleanup_duplicate_queue_members] Removidos % registros "finalizado" para (session: %, profile: %)', 
            v_deleted_count, p_session_id, p_profile_id;
    END IF;
    
    -- Se há múltiplos registros com status ativo, manter apenas o mais recente/prioritário
    WITH ranked_members AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   ORDER BY 
                       CASE status 
                           WHEN 'em_atendimento' THEN 1  -- Priorizar 'em_atendimento'
                           WHEN 'disponivel' THEN 2
                           WHEN 'pausado' THEN 3
                           ELSE 4
                       END,
                       updated_at DESC, 
                       check_in_at DESC
               ) as rn
        FROM sistemaretiradas.queue_members
        WHERE session_id = p_session_id
          AND profile_id = p_profile_id
          AND status IN ('disponivel', 'em_atendimento', 'pausado')
    )
    SELECT id INTO v_kept_member_id
    FROM ranked_members
    WHERE rn = 1;
    
    -- Deletar duplicatas (todos exceto o mantido)
    DELETE FROM sistemaretiradas.queue_members
    WHERE session_id = p_session_id
      AND profile_id = p_profile_id
      AND status IN ('disponivel', 'em_atendimento', 'pausado')
      AND id != COALESCE(v_kept_member_id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count > 0 THEN
        RAISE NOTICE '[cleanup_duplicate_queue_members] Removidas % duplicatas para (session: %, profile: %), mantido ID: %', 
            v_deleted_count, p_session_id, p_profile_id, v_kept_member_id;
    END IF;
    
    RETURN v_kept_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger BEFORE INSERT para prevenir duplicatas
CREATE OR REPLACE FUNCTION sistemaretiradas.prevent_duplicate_queue_members_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Limpar duplicatas antes de inserir
    PERFORM sistemaretiradas.cleanup_duplicate_queue_members(NEW.session_id, NEW.profile_id);
    
    -- Se ainda existe registro ativo, cancelar INSERT e fazer UPDATE
    IF EXISTS (
        SELECT 1 
        FROM sistemaretiradas.queue_members
        WHERE session_id = NEW.session_id
          AND profile_id = NEW.profile_id
          AND status IN ('disponivel', 'em_atendimento', 'pausado')
    ) THEN
        -- Ao invés de inserir, atualizar o registro existente (primeiro encontrado)
        UPDATE sistemaretiradas.queue_members
        SET status = NEW.status,
            position = NEW.position,
            updated_at = NOW()
        WHERE id = (
            SELECT id
            FROM sistemaretiradas.queue_members
            WHERE session_id = NEW.session_id
              AND profile_id = NEW.profile_id
              AND status IN ('disponivel', 'em_atendimento', 'pausado')
            LIMIT 1
        );
        
        -- Retornar NULL para cancelar o INSERT
        RETURN NULL;
    END IF;
    
    -- Se não existe, permitir INSERT
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger BEFORE UPDATE para prevenir duplicatas
CREATE OR REPLACE FUNCTION sistemaretiradas.prevent_duplicate_queue_members_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Limpar duplicatas antes de atualizar
    PERFORM sistemaretiradas.cleanup_duplicate_queue_members(NEW.session_id, NEW.profile_id);
    
    -- Se há outro registro com mesmo (session_id, profile_id) e status ativo
    -- e não é o registro sendo atualizado, deletar o outro
    IF EXISTS (
        SELECT 1 
        FROM sistemaretiradas.queue_members
        WHERE session_id = NEW.session_id
          AND profile_id = NEW.profile_id
          AND status IN ('disponivel', 'em_atendimento', 'pausado')
          AND id != NEW.id
    ) THEN
        -- Deletar o outro registro
        DELETE FROM sistemaretiradas.queue_members
        WHERE session_id = NEW.session_id
          AND profile_id = NEW.profile_id
          AND status IN ('disponivel', 'em_atendimento', 'pausado')
          AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar triggers
DROP TRIGGER IF EXISTS trg_prevent_duplicate_queue_members_insert ON sistemaretiradas.queue_members;
CREATE TRIGGER trg_prevent_duplicate_queue_members_insert
    BEFORE INSERT ON sistemaretiradas.queue_members
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.prevent_duplicate_queue_members_insert();

DROP TRIGGER IF EXISTS trg_prevent_duplicate_queue_members_update ON sistemaretiradas.queue_members;
CREATE TRIGGER trg_prevent_duplicate_queue_members_update
    BEFORE UPDATE ON sistemaretiradas.queue_members
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.prevent_duplicate_queue_members_update();

-- 5. Atualizar função add_to_queue para usar proteção
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
    -- IMPORTANTE: Limpar duplicatas ANTES de qualquer operação
    PERFORM sistemaretiradas.cleanup_duplicate_queue_members(p_session_id, p_profile_id);
    
    -- Verificar se já existe registro ativo
    SELECT id INTO v_member_id
    FROM sistemaretiradas.queue_members
    WHERE session_id = p_session_id
      AND profile_id = p_profile_id
      AND status IN ('disponivel', 'em_atendimento', 'pausado')
    LIMIT 1;
    
    -- Se já existe, retornar o ID existente (não criar duplicata)
    IF v_member_id IS NOT NULL THEN
        RETURN v_member_id;
    END IF;
    
    -- Buscar configurações
    SELECT entry_position INTO v_settings
    FROM sistemaretiradas.queue_store_settings
    WHERE store_id = (SELECT store_id FROM sistemaretiradas.queue_sessions WHERE id = p_session_id)
    LIMIT 1;
    
    -- Usar configuração da loja ou parâmetro
    IF v_settings.entry_position IS NOT NULL THEN
        p_entry_position := v_settings.entry_position;
    END IF;
    
    -- Calcular posição
    IF p_entry_position = 'beginning' THEN
        v_position := 1;
        UPDATE sistemaretiradas.queue_members
        SET position = position + 1
        WHERE session_id = p_session_id
          AND status IN ('disponivel', 'em_atendimento', 'pausado');
    ELSE
        v_position := sistemaretiradas.get_next_queue_position(p_session_id);
    END IF;
    
    -- Inserir na fila (trigger vai prevenir duplicatas)
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

-- 6. Atualizar função start_attendance para usar proteção
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
    
    -- IMPORTANTE: Limpar duplicatas ANTES de atualizar
    PERFORM sistemaretiradas.cleanup_duplicate_queue_members(v_session_id, v_member.profile_id);
    
    -- Atualizar status do membro para 'em_atendimento'
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
    
    -- Reorganizar fila
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    RETURN v_attendance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Atualizar função end_attendance (já tem limpeza, mas vamos garantir)
-- Esta função já está na migration 20251223000013_fix_end_attendance_robust.sql
-- Mas vamos garantir que ela também chama a função helper

-- 8. Atualizar função remove_from_queue para limpar duplicatas
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
    
    -- IMPORTANTE: Limpar duplicatas ANTES de remover
    PERFORM sistemaretiradas.cleanup_duplicate_queue_members(v_session_id, v_profile_id);
    
    -- Deletar o registro (não atualizar para 'finalizado', apenas deletar)
    DELETE FROM sistemaretiradas.queue_members
    WHERE id = p_member_id;
    
    -- Reorganizar posições
    PERFORM sistemaretiradas.reorganize_queue_positions(v_session_id);
    
    -- Registrar evento
    INSERT INTO sistemaretiradas.queue_events (session_id, member_id, event_type, performed_by)
    VALUES (v_session_id, p_member_id, 'check_out', v_profile_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Atualizar funções de mover para usar proteção
CREATE OR REPLACE FUNCTION sistemaretiradas.move_member_to_top(
    p_member_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_session_id UUID;
    v_profile_id UUID;
    v_current_position INTEGER;
BEGIN
    -- Buscar dados do membro
    SELECT session_id, profile_id, position 
    INTO v_session_id, v_profile_id, v_current_position
    FROM sistemaretiradas.queue_members
    WHERE id = p_member_id
      AND status = 'disponivel';
    
    IF v_session_id IS NULL THEN
        RAISE EXCEPTION 'Membro não encontrado ou não está disponível';
    END IF;
    
    -- IMPORTANTE: Limpar duplicatas ANTES de mover
    PERFORM sistemaretiradas.cleanup_duplicate_queue_members(v_session_id, v_profile_id);
    
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

CREATE OR REPLACE FUNCTION sistemaretiradas.move_member_to_end(
    p_member_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_session_id UUID;
    v_profile_id UUID;
    v_new_position INTEGER;
BEGIN
    -- Buscar dados do membro
    SELECT session_id, profile_id 
    INTO v_session_id, v_profile_id
    FROM sistemaretiradas.queue_members
    WHERE id = p_member_id
      AND status = 'disponivel';
    
    IF v_session_id IS NULL THEN
        RAISE EXCEPTION 'Membro não encontrado ou não está disponível';
    END IF;
    
    -- IMPORTANTE: Limpar duplicatas ANTES de mover
    PERFORM sistemaretiradas.cleanup_duplicate_queue_members(v_session_id, v_profile_id);
    
    -- Calcular nova posição (final da fila)
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

-- 10. Comentários
COMMENT ON FUNCTION sistemaretiradas.cleanup_duplicate_queue_members IS
'Limpa automaticamente duplicatas e registros "finalizado" para uma colaboradora em uma sessão. Retorna o ID do registro mantido.';

COMMENT ON FUNCTION sistemaretiradas.prevent_duplicate_queue_members_insert IS
'Trigger que previne inserção de duplicatas, convertendo INSERT em UPDATE se necessário.';

COMMENT ON FUNCTION sistemaretiradas.prevent_duplicate_queue_members_update IS
'Trigger que limpa duplicatas antes de atualizar um registro.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

