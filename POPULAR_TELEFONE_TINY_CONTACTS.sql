-- =============================================================================
-- Script: Popular telefone em tiny_contacts a partir de tiny_orders
-- Data: 2025-01-28
-- Descrição: Preenche telefone em tiny_contacts usando cliente_telefone de tiny_orders
--            quando o contato não tem telefone mas existe telefone em pedidos
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- ✅ Popular telefone em tiny_contacts a partir de tiny_orders.cliente_telefone
-- Busca o telefone mais recente de pedidos para cada cliente
UPDATE tiny_contacts tc
SET telefone = (
  SELECT DISTINCT ON (to_.cliente_cpf_cnpj, to_.cliente_nome) 
    to_.cliente_telefone
  FROM tiny_orders to_
  WHERE (
    (to_.cliente_cpf_cnpj IS NOT NULL AND to_.cliente_cpf_cnpj = tc.cpf_cnpj)
    OR (to_.cliente_nome IS NOT NULL AND LOWER(TRIM(to_.cliente_nome)) = LOWER(TRIM(tc.nome)))
  )
    AND to_.store_id = tc.store_id
    AND to_.cliente_telefone IS NOT NULL
    AND to_.cliente_telefone != ''
  ORDER BY to_.cliente_cpf_cnpj, to_.cliente_nome, to_.data_pedido DESC NULLS LAST
  LIMIT 1
)
WHERE tc.telefone IS NULL
  OR tc.telefone = '';

-- Log de quantos foram atualizados
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM tiny_contacts
  WHERE telefone IS NOT NULL AND telefone != '';
  
  RAISE NOTICE '✅ Contatos com telefone após atualização: %', updated_count;
END $$;

-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================

