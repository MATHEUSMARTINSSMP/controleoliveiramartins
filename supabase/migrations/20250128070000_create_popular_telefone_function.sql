-- =============================================================================
-- Migration: Criar função para popular telefone em tiny_contacts
-- Data: 2025-01-28
-- Descrição: Função para popular telefone em tiny_contacts a partir de tiny_orders
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- ✅ Função para popular telefone em tiny_contacts a partir de tiny_orders
CREATE OR REPLACE FUNCTION popular_telefone_de_pedidos(p_store_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Popular telefone em tiny_contacts usando cliente_telefone de tiny_orders
  -- Busca o telefone mais recente de pedidos para cada cliente sem telefone
  UPDATE tiny_contacts tc
  SET telefone = subquery.cliente_telefone,
      updated_at = NOW()
  FROM (
    SELECT DISTINCT ON (tc2.id)
      tc2.id as contact_id,
      to_.cliente_telefone
    FROM tiny_contacts tc2
    LEFT JOIN tiny_orders to_ ON (
      (to_.cliente_cpf_cnpj IS NOT NULL AND to_.cliente_cpf_cnpj = tc2.cpf_cnpj)
      OR (to_.cliente_nome IS NOT NULL AND LOWER(TRIM(to_.cliente_nome)) = LOWER(TRIM(tc2.nome)))
    )
    WHERE (tc2.telefone IS NULL OR tc2.telefone = '')
      AND to_.cliente_telefone IS NOT NULL
      AND to_.cliente_telefone != ''
      AND to_.store_id = COALESCE(p_store_id, tc2.store_id)
      AND to_.store_id = tc2.store_id
    ORDER BY tc2.id, to_.data_pedido DESC NULLS LAST
  ) subquery
  WHERE tc.id = subquery.contact_id
    AND (tc.telefone IS NULL OR tc.telefone = '');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;

-- Comentário
COMMENT ON FUNCTION popular_telefone_de_pedidos IS 'Popula telefone em tiny_contacts usando cliente_telefone de tiny_orders para contatos sem telefone';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

