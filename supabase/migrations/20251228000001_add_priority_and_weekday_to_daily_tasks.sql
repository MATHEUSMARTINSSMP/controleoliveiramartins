-- ============================================================================
-- Migration: Adicionar campos priority e weekday à tabela daily_tasks
-- Data: 2025-12-28
-- Descrição: Adiciona campos para prioridade e dia da semana fixo das tarefas
-- ============================================================================

-- Adicionar coluna priority
ALTER TABLE sistemaretiradas.daily_tasks
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MÉDIA' 
CHECK (priority IN ('ALTA', 'MÉDIA', 'BAIXA'));

COMMENT ON COLUMN sistemaretiradas.daily_tasks.priority IS 'Prioridade da tarefa: ALTA, MÉDIA ou BAIXA. Default: MÉDIA';

-- Adicionar coluna weekday (dia da semana fixo)
-- 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
-- NULL = tarefa aparece todos os dias
ALTER TABLE sistemaretiradas.daily_tasks
ADD COLUMN IF NOT EXISTS weekday INTEGER 
CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6));

COMMENT ON COLUMN sistemaretiradas.daily_tasks.weekday IS 'Dia da semana fixo (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado). NULL = tarefa aparece todos os dias';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_tasks_priority 
ON sistemaretiradas.daily_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_weekday 
ON sistemaretiradas.daily_tasks(weekday);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_store_weekday 
ON sistemaretiradas.daily_tasks(store_id, weekday, is_active) 
WHERE is_active = true;

-- Atualizar tarefas existentes: se is_recurring = true, weekday = NULL (todos os dias)
-- Se is_recurring = false, weekday = EXTRACT(DOW FROM created_at) (dia da semana em que foi criada)
UPDATE sistemaretiradas.daily_tasks
SET weekday = CASE
    WHEN is_recurring = true THEN NULL
    ELSE EXTRACT(DOW FROM created_at)::INTEGER
END
WHERE weekday IS NULL;

