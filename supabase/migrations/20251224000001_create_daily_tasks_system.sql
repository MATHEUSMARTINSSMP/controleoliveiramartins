-- ============================================================================
-- MIGRATION: Sistema de Tarefas do Dia
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Sistema completo de gerenciamento de tarefas diárias por turno
-- ============================================================================

-- 1. TABELA: shifts (Turnos)
CREATE TABLE IF NOT EXISTS sistemaretiradas.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    start_time TIME,
    end_time TIME,
    display_order INTEGER DEFAULT 0,
    color VARCHAR(20) DEFAULT 'primary', -- Cor para visualização
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA: daily_tasks (Tarefas do Dia)
CREATE TABLE IF NOT EXISTS sistemaretiradas.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    shift_id UUID REFERENCES sistemaretiradas.shifts(id) ON DELETE SET NULL,
    due_time TIME, -- Horário limite (opcional)
    is_active BOOLEAN DEFAULT true,
    is_recurring BOOLEAN DEFAULT false, -- Tarefa recorrente diária
    display_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES sistemaretiradas.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: task_completions (Execuções de Tarefas)
CREATE TABLE IF NOT EXISTS sistemaretiradas.task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES sistemaretiradas.daily_tasks(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, profile_id, completion_date) -- Uma tarefa por colaboradora por dia
);

-- 4. Adicionar coluna tasks_ativo em stores
ALTER TABLE sistemaretiradas.stores 
ADD COLUMN IF NOT EXISTS tasks_ativo BOOLEAN DEFAULT false;

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_daily_tasks_store ON sistemaretiradas.daily_tasks(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_shift ON sistemaretiradas.daily_tasks(shift_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task ON sistemaretiradas.task_completions(task_id, completion_date);
CREATE INDEX IF NOT EXISTS idx_task_completions_profile ON sistemaretiradas.task_completions(profile_id, completion_date);
CREATE INDEX IF NOT EXISTS idx_task_completions_date ON sistemaretiradas.task_completions(completion_date);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE sistemaretiradas.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.task_completions ENABLE ROW LEVEL SECURITY;

-- Policies para shifts (todos podem ler, apenas admins podem modificar)
CREATE POLICY shifts_select_policy ON sistemaretiradas.shifts
    FOR SELECT
    USING (true); -- Todos podem ver turnos

CREATE POLICY shifts_modify_policy ON sistemaretiradas.shifts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Policies para daily_tasks
CREATE POLICY daily_tasks_select_policy ON sistemaretiradas.daily_tasks
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY daily_tasks_insert_policy ON sistemaretiradas.daily_tasks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND store_id = daily_tasks.store_id
        )
    );

CREATE POLICY daily_tasks_update_policy ON sistemaretiradas.daily_tasks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND store_id = daily_tasks.store_id
        )
    );

CREATE POLICY daily_tasks_delete_policy ON sistemaretiradas.daily_tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND store_id = daily_tasks.store_id
        )
    );

-- Policies para task_completions
CREATE POLICY task_completions_select_policy ON sistemaretiradas.task_completions
    FOR SELECT
    USING (
        task_id IN (
            SELECT id FROM sistemaretiradas.daily_tasks
            WHERE store_id IN (
                SELECT store_id FROM sistemaretiradas.profiles
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY task_completions_insert_policy ON sistemaretiradas.task_completions
    FOR INSERT
    WITH CHECK (
        profile_id = auth.uid()
        AND task_id IN (
            SELECT id FROM sistemaretiradas.daily_tasks
            WHERE store_id IN (
                SELECT store_id FROM sistemaretiradas.profiles
                WHERE id = auth.uid()
            )
            AND is_active = true
        )
    );

CREATE POLICY task_completions_update_policy ON sistemaretiradas.task_completions
    FOR UPDATE
    USING (
        profile_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- ============================================================================
-- TURNOS PADRÃO
-- ============================================================================
INSERT INTO sistemaretiradas.shifts (name, start_time, end_time, display_order, color)
VALUES
    ('Manhã', '06:00:00', '12:00:00', 1, 'amber'),
    ('Tarde', '12:00:00', '18:00:00', 2, 'orange'),
    ('Noite', '18:00:00', '23:00:00', 3, 'purple'),
    ('Integral', '00:00:00', '23:59:59', 4, 'blue')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- FUNÇÕES RPC
-- ============================================================================

-- Função para buscar tarefas do dia ordenadas por turno
CREATE OR REPLACE FUNCTION sistemaretiradas.get_daily_tasks(
    p_store_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    title VARCHAR,
    description TEXT,
    shift_id UUID,
    shift_name VARCHAR,
    shift_start_time TIME,
    shift_end_time TIME,
    shift_color VARCHAR,
    due_time TIME,
    is_active BOOLEAN,
    is_recurring BOOLEAN,
    display_order INTEGER,
    created_at TIMESTAMPTZ,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    completion_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.id,
        dt.store_id,
        dt.title,
        dt.description,
        dt.shift_id,
        s.name as shift_name,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        s.color as shift_color,
        dt.due_time,
        dt.is_active,
        dt.is_recurring,
        dt.display_order,
        dt.created_at,
        tc.profile_id as completed_by,
        tc.completed_at,
        tc.notes as completion_notes
    FROM sistemaretiradas.daily_tasks dt
    LEFT JOIN sistemaretiradas.shifts s ON s.id = dt.shift_id
    LEFT JOIN sistemaretiradas.task_completions tc ON tc.task_id = dt.id 
        AND tc.completion_date = p_date
        AND tc.profile_id = auth.uid()
    WHERE dt.store_id = p_store_id
      AND dt.is_active = true
    ORDER BY 
        COALESCE(s.display_order, 999),
        dt.display_order,
        dt.due_time NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar tarefa como completa
CREATE OR REPLACE FUNCTION sistemaretiradas.complete_task(
    p_task_id UUID,
    p_profile_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_completion_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    v_completion_id UUID;
BEGIN
    -- Verificar se a tarefa existe e está ativa
    IF NOT EXISTS (
        SELECT 1 FROM sistemaretiradas.daily_tasks
        WHERE id = p_task_id
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Tarefa não encontrada ou inativa';
    END IF;

    -- Inserir ou atualizar execução
    INSERT INTO sistemaretiradas.task_completions (
        task_id,
        profile_id,
        notes,
        completion_date
    ) VALUES (
        p_task_id,
        p_profile_id,
        p_notes,
        p_completion_date
    )
    ON CONFLICT (task_id, profile_id, completion_date)
    DO UPDATE SET
        completed_at = NOW(),
        notes = COALESCE(p_notes, task_completions.notes)
    RETURNING id INTO v_completion_id;

    RETURN v_completion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para desmarcar tarefa (remover execução)
CREATE OR REPLACE FUNCTION sistemaretiradas.uncomplete_task(
    p_task_id UUID,
    p_profile_id UUID,
    p_completion_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM sistemaretiradas.task_completions
    WHERE task_id = p_task_id
      AND profile_id = p_profile_id
      AND completion_date = p_completion_date;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas de tarefas
CREATE OR REPLACE FUNCTION sistemaretiradas.get_task_statistics(
    p_store_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    v_total_tasks INTEGER;
    v_completed_tasks INTEGER;
    v_completion_rate DECIMAL;
    v_top_performers JSONB;
BEGIN
    -- Total de tarefas ativas
    SELECT COUNT(*) INTO v_total_tasks
    FROM sistemaretiradas.daily_tasks
    WHERE store_id = p_store_id
      AND is_active = true;

    -- Tarefas completas (pelo menos uma execução)
    SELECT COUNT(DISTINCT task_id) INTO v_completed_tasks
    FROM sistemaretiradas.task_completions tc
    JOIN sistemaretiradas.daily_tasks dt ON dt.id = tc.task_id
    WHERE dt.store_id = p_store_id
      AND tc.completion_date = p_date;

    -- Taxa de conclusão
    IF v_total_tasks > 0 THEN
        v_completion_rate := (v_completed_tasks::DECIMAL / v_total_tasks::DECIMAL) * 100;
    ELSE
        v_completion_rate := 0;
    END IF;

    -- Top performers (quem mais fez tarefas)
    SELECT jsonb_agg(
        jsonb_build_object(
            'profile_id', profile_id,
            'profile_name', profile_name,
            'tasks_completed', tasks_completed
        ) ORDER BY tasks_completed DESC
    ) INTO v_top_performers
    FROM (
        SELECT 
            tc.profile_id,
            p.name as profile_name,
            COUNT(*) as tasks_completed
        FROM sistemaretiradas.task_completions tc
        JOIN sistemaretiradas.daily_tasks dt ON dt.id = tc.task_id
        JOIN sistemaretiradas.profiles p ON p.id = tc.profile_id
        WHERE dt.store_id = p_store_id
          AND tc.completion_date = p_date
        GROUP BY tc.profile_id, p.name
        ORDER BY tasks_completed DESC
        LIMIT 10
    ) top;

    RETURN jsonb_build_object(
        'total_tasks', v_total_tasks,
        'completed_tasks', v_completed_tasks,
        'pending_tasks', v_total_tasks - v_completed_tasks,
        'completion_rate', ROUND(v_completion_rate, 2),
        'top_performers', COALESCE(v_top_performers, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar tarefa
CREATE OR REPLACE FUNCTION sistemaretiradas.create_daily_task(
    p_store_id UUID,
    p_title VARCHAR,
    p_description TEXT DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL,
    p_due_time TIME DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT false,
    p_display_order INTEGER DEFAULT 0,
    p_created_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
    v_task_id UUID;
BEGIN
    INSERT INTO sistemaretiradas.daily_tasks (
        store_id,
        title,
        description,
        shift_id,
        due_time,
        is_recurring,
        display_order,
        created_by
    ) VALUES (
        p_store_id,
        p_title,
        p_description,
        p_shift_id,
        p_due_time,
        p_is_recurring,
        p_display_order,
        p_created_by
    )
    RETURNING id INTO v_task_id;

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar tarefa
CREATE OR REPLACE FUNCTION sistemaretiradas.update_daily_task(
    p_task_id UUID,
    p_title VARCHAR DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_shift_id UUID DEFAULT NULL,
    p_due_time TIME DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT NULL,
    p_display_order INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sistemaretiradas.daily_tasks
    SET 
        title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        shift_id = COALESCE(p_shift_id, shift_id),
        due_time = COALESCE(p_due_time, due_time),
        is_active = COALESCE(p_is_active, is_active),
        is_recurring = COALESCE(p_is_recurring, is_recurring),
        display_order = COALESCE(p_display_order, display_order),
        updated_at = NOW()
    WHERE id = p_task_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para deletar tarefa
CREATE OR REPLACE FUNCTION sistemaretiradas.delete_daily_task(
    p_task_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM sistemaretiradas.daily_tasks
    WHERE id = p_task_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shifts_updated_at
    BEFORE UPDATE ON sistemaretiradas.shifts
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

CREATE TRIGGER update_daily_tasks_updated_at
    BEFORE UPDATE ON sistemaretiradas.daily_tasks
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_updated_at_column();

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON TABLE sistemaretiradas.shifts IS 'Turnos do dia (Manhã, Tarde, Noite, Integral)';
COMMENT ON TABLE sistemaretiradas.daily_tasks IS 'Tarefas diárias configuradas pelo admin';
COMMENT ON TABLE sistemaretiradas.task_completions IS 'Execuções de tarefas por colaboradoras';
COMMENT ON COLUMN sistemaretiradas.daily_tasks.is_recurring IS 'Se true, tarefa se repete todos os dias';
COMMENT ON COLUMN sistemaretiradas.daily_tasks.due_time IS 'Horário limite para completar a tarefa';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

