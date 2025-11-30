-- Adicionar coluna cashback_ativo à tabela stores
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS cashback_ativo BOOLEAN DEFAULT false;

-- Comentário para a nova coluna
COMMENT ON COLUMN sistemaretiradas.stores.cashback_ativo IS 'Indica se o módulo de cashback está ativo para esta loja. Controlado pelo admin.';

-- Criar índice para performance em consultas
CREATE INDEX IF NOT EXISTS idx_stores_cashback_ativo ON sistemaretiradas.stores (cashback_ativo);

