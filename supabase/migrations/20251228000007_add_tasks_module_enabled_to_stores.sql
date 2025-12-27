-- ============================================================================
-- Migration: Adicionar flag para ativar/desativar módulo de tarefas
-- Data: 2025-12-28
-- Descrição: Permite ativar/desativar o módulo de tarefas por loja no dashboard admin
-- ============================================================================

-- Adicionar coluna para controlar se o módulo de tarefas está habilitado
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS tasks_module_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN sistemaretiradas.stores.tasks_module_enabled IS 'Controla se o módulo de tarefas está habilitado para esta loja. Default: true (habilitado).';

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_stores_tasks_module_enabled 
ON sistemaretiradas.stores(tasks_module_enabled)
WHERE tasks_module_enabled = true;

-- Atualizar todas as lojas existentes para ter o módulo habilitado por padrão
UPDATE sistemaretiradas.stores
SET tasks_module_enabled = true
WHERE tasks_module_enabled IS NULL;

