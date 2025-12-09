-- ============================================================================
-- MIGRAÇÃO: Criar tabela de templates de jornada global
-- Data: 2025-12-09
-- Descrição: Templates de jornada flexíveis baseados em carga horária
-- Horários e dias são definidos ao atribuir à colaboradora
-- ============================================================================

-- Criar tabela de templates de jornada
CREATE TABLE IF NOT EXISTS sistemaretiradas.work_schedule_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    -- Campos flexíveis (apenas carga horária e intervalo)
    carga_horaria_diaria NUMERIC(4,2) NOT NULL DEFAULT 6.0,
    tempo_intervalo_minutos INTEGER NOT NULL DEFAULT 60,
    is_global BOOLEAN DEFAULT true,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna para referenciar template na tabela de jornadas das colaboradoras
ALTER TABLE sistemaretiradas.colaboradora_work_schedules
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES sistemaretiradas.work_schedule_templates(id) ON DELETE SET NULL;

-- Adicionar coluna para identificar se é jornada customizada ou baseada em template
ALTER TABLE sistemaretiradas.colaboradora_work_schedules
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT true;

-- Índices
CREATE INDEX IF NOT EXISTS idx_work_schedule_templates_admin ON sistemaretiradas.work_schedule_templates(admin_id);
CREATE INDEX IF NOT EXISTS idx_work_schedule_templates_ativo ON sistemaretiradas.work_schedule_templates(ativo);
CREATE INDEX IF NOT EXISTS idx_colaboradora_work_schedules_template ON sistemaretiradas.colaboradora_work_schedules(template_id);

-- RLS
ALTER TABLE sistemaretiradas.work_schedule_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin pode gerenciar seus templates de jornada" ON sistemaretiradas.work_schedule_templates;
DROP POLICY IF EXISTS "Colaboradoras podem ver templates ativos" ON sistemaretiradas.work_schedule_templates;
DROP POLICY IF EXISTS "work_schedule_templates_admin_policy" ON sistemaretiradas.work_schedule_templates;
DROP POLICY IF EXISTS "work_schedule_templates_read_policy" ON sistemaretiradas.work_schedule_templates;
DROP POLICY IF EXISTS "work_schedule_templates_manage_own" ON sistemaretiradas.work_schedule_templates;
DROP POLICY IF EXISTS "work_schedule_templates_colaboradora_read" ON sistemaretiradas.work_schedule_templates;

-- POLÍTICA 1: Admin pode gerenciar APENAS seus próprios templates
CREATE POLICY "work_schedule_templates_manage_own"
ON sistemaretiradas.work_schedule_templates
FOR ALL
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- POLÍTICA 2: Colaboradoras podem VER templates ativos do admin da sua loja
CREATE POLICY "work_schedule_templates_colaboradora_read"
ON sistemaretiradas.work_schedule_templates
FOR SELECT
TO authenticated
USING (
    ativo = true 
    AND admin_id IN (
        SELECT s.admin_id 
        FROM sistemaretiradas.stores s
        INNER JOIN sistemaretiradas.profiles p ON p.store_id = s.id
        WHERE p.id = auth.uid()
    )
);

-- Comentários
COMMENT ON TABLE sistemaretiradas.work_schedule_templates IS 'Templates flexíveis de jornada - apenas carga horária e intervalo, horários/dias definidos por colaboradora';
COMMENT ON COLUMN sistemaretiradas.work_schedule_templates.carga_horaria_diaria IS 'Carga horária diária em horas (ex: 6.0 para 6 horas)';
COMMENT ON COLUMN sistemaretiradas.work_schedule_templates.tempo_intervalo_minutos IS 'Tempo de intervalo em minutos (ex: 60 para 1 hora)';
