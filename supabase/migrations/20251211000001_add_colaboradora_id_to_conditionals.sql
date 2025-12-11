-- Adicionar coluna colaboradora_id na tabela conditionals
ALTER TABLE sistemaretiradas.conditionals
ADD COLUMN IF NOT EXISTS colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_conditionals_colaboradora_id ON sistemaretiradas.conditionals(colaboradora_id);

-- Comentário
COMMENT ON COLUMN sistemaretiradas.conditionals.colaboradora_id IS 'Colaboradora responsável pela condicional';

