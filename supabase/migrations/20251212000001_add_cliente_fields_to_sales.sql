-- ============================================================================
-- MIGRATION: Adicionar campos cliente_id e cliente_nome à tabela sales
-- ============================================================================
-- Data: 2025-12-12
-- Descrição: Adiciona suporte a clientes nas vendas, permitindo vincular
--            vendas a clientes cadastrados (crm_contacts, contacts, tiny_contacts)
--            ou usar "Consumidor Final" como padrão.
-- ============================================================================

-- 1. Adicionar coluna cliente_id (UUID, opcional, referencia crm_contacts)
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES sistemaretiradas.crm_contacts(id) ON DELETE SET NULL;

-- 2. Adicionar coluna cliente_nome (TEXT, opcional)
-- Armazena o nome do cliente para exibição rápida e para casos onde
-- o cliente não está cadastrado (texto livre ou "Consumidor Final")
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

-- 3. Criar índice para busca rápida por cliente_id
CREATE INDEX IF NOT EXISTS idx_sales_cliente_id 
ON sistemaretiradas.sales(cliente_id) 
WHERE cliente_id IS NOT NULL;

-- 4. Criar índice para busca rápida por cliente_nome (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_sales_cliente_nome 
ON sistemaretiradas.sales(cliente_nome) 
WHERE cliente_nome IS NOT NULL;

-- 5. Comentários
COMMENT ON COLUMN sistemaretiradas.sales.cliente_id IS 
'ID do cliente cadastrado (crm_contacts). NULL para "Consumidor Final" ou clientes não cadastrados.';

COMMENT ON COLUMN sistemaretiradas.sales.cliente_nome IS 
'Nome do cliente para exibição. Pode ser texto livre ou "Consumidor Final". Se cliente_id estiver preenchido, deve conter o nome do cliente cadastrado.';

COMMENT ON INDEX sistemaretiradas.idx_sales_cliente_id IS 
'Índice para busca rápida de vendas por cliente cadastrado.';

COMMENT ON INDEX sistemaretiradas.idx_sales_cliente_nome IS 
'Índice para busca rápida de vendas por nome do cliente (case-insensitive).';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

