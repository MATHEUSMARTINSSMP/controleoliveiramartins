-- =============================================================================
-- Migration: Adicionar campo de pré-requisitos aos bônus
-- =============================================================================
-- Este campo permite definir pré-requisitos que devem ser atendidos
-- para que o bônus seja válido (ex: "Válido apenas se a loja bater a meta mensal")
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Adicionar campo de pré-requisitos
ALTER TABLE bonuses 
  ADD COLUMN IF NOT EXISTS pre_requisitos TEXT;

-- Comentário para documentação
COMMENT ON COLUMN bonuses.pre_requisitos IS 'Pré-requisitos que devem ser atendidos para o bônus ser válido (ex: "Válido apenas se a loja bater a meta mensal")';

