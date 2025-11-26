-- =============================================================================
-- Migration: Adicionar FK cliente_id em tiny_orders
-- Data: 2025-01-28
-- Descrição: FASE 2 - Criar relação FK entre pedidos e clientes
--            Remove duplicação de dados (telefone, email agora só em tiny_contacts)
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- ✅ FASE 2: Adicionar FK cliente_id em tiny_orders
ALTER TABLE tiny_orders
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES tiny_contacts(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de JOINs
CREATE INDEX IF NOT EXISTS idx_tiny_orders_cliente_id ON tiny_orders(cliente_id) WHERE cliente_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN tiny_orders.cliente_id IS 'FK para tiny_contacts - Dados completos do cliente (telefone, email, endereço) estão em tiny_contacts';
COMMENT ON COLUMN tiny_orders.cliente_nome IS 'Nome do cliente (mantido para exibição rápida sem JOIN)';
COMMENT ON COLUMN tiny_orders.cliente_cpf_cnpj IS 'CPF/CNPJ do cliente (mantido para histórico rápido sem JOIN)';

-- ⚠️ NOTA: cliente_email e cliente_telefone serão removidos na FASE 3
-- Por enquanto, mantemos para compatibilidade com dados existentes
-- Novos pedidos não preencherão esses campos (dados completos via FK)

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

