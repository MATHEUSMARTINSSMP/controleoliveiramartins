-- =============================================================================
-- Migration: FASE 3 - Criar índices para otimizar JOINs
-- Data: 2025-01-28
-- Descrição: Índices para melhorar performance de consultas com JOIN
--            entre tiny_orders e tiny_contacts
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- ✅ FASE 3.4: Índices para otimizar JOINs

-- Índice composto para JOIN tiny_orders -> tiny_contacts
-- Usado quando fazemos: tiny_orders JOIN tiny_contacts ON cliente_id
CREATE INDEX IF NOT EXISTS idx_tiny_orders_cliente_id_store_id 
  ON tiny_orders(cliente_id, store_id) 
  WHERE cliente_id IS NOT NULL;

-- Índice para buscar pedidos por cliente (útil para histórico de compras)
CREATE INDEX IF NOT EXISTS idx_tiny_orders_cliente_id_data 
  ON tiny_orders(cliente_id, data_pedido DESC) 
  WHERE cliente_id IS NOT NULL;

-- Índice para tiny_contacts (já deve existir, mas garantimos)
CREATE INDEX IF NOT EXISTS idx_tiny_contacts_store_id_cpf 
  ON tiny_contacts(store_id, cpf_cnpj) 
  WHERE cpf_cnpj IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tiny_contacts_store_id_nome 
  ON tiny_contacts(store_id, nome) 
  WHERE nome IS NOT NULL;

-- Comentários
COMMENT ON INDEX idx_tiny_orders_cliente_id_store_id IS 'Otimiza JOIN tiny_orders -> tiny_contacts por cliente_id e store_id';
COMMENT ON INDEX idx_tiny_orders_cliente_id_data IS 'Otimiza busca de histórico de pedidos por cliente ordenado por data';
COMMENT ON INDEX idx_tiny_contacts_store_id_cpf IS 'Otimiza busca de cliente por CPF/CNPJ e loja';
COMMENT ON INDEX idx_tiny_contacts_store_id_nome IS 'Otimiza busca de cliente por nome e loja';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

