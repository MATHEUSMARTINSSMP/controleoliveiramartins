-- ============================================================================
-- MIGRAÇÃO: Criar tabela de templates de jornada global
-- Data: 2025-12-09
-- Descrição: Templates de jornada que podem ser atribuídos a múltiplas colaboradoras
-- ============================================================================

-- Criar tabela de templates de jornada
CREATE TABLE IF NOT EXISTS sistemaretiradas.work_schedule_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    hora_entrada TIME NOT NULL DEFAULT '08:00:00',
    hora_intervalo_saida TIME NOT NULL DEFAULT '12:00:00',
    hora_intervalo_retorno TIME NOT NULL DEFAULT '13:00:00',
    hora_saida TIME NOT NULL DEFAULT '18:00:00',
    dias_semana INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    carga_horaria_diaria NUMERIC(4,2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (hora_intervalo_saida - hora_entrada)) / 3600 +
        EXTRACT(EPOCH FROM (hora_saida - hora_intervalo_retorno)) / 3600
    ) STORED,
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

-- POLÍTICA 1: Admin pode gerenciar APENAS seus próprios templates (INSERT, UPDATE, DELETE)
-- Restrição: admin_id da row DEVE ser igual ao usuário autenticado
CREATE POLICY "work_schedule_templates_manage_own"
ON sistemaretiradas.work_schedule_templates
FOR ALL
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- POLÍTICA 2: Colaboradoras podem VER templates ativos do admin da sua loja
-- Isso permite que colaboradoras vejam os templates disponíveis para atribuição
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
COMMENT ON TABLE sistemaretiradas.work_schedule_templates IS 'Templates de jornada de trabalho reutilizáveis';
COMMENT ON COLUMN sistemaretiradas.work_schedule_templates.nome IS 'Nome do template (ex: 6x1 - 6h)';
COMMENT ON COLUMN sistemaretiradas.work_schedule_templates.dias_semana IS 'Dias da semana (0=Dom, 1=Seg, ..., 6=Sab)';
COMMENT ON COLUMN sistemaretiradas.work_schedule_templates.is_global IS 'Se true, disponível para todas as lojas do admin';
COMMENT ON COLUMN sistemaretiradas.colaboradora_work_schedules.template_id IS 'Referência ao template usado (null se customizado)';
COMMENT ON COLUMN sistemaretiradas.colaboradora_work_schedules.is_custom IS 'true = jornada customizada, false = baseada em template';
