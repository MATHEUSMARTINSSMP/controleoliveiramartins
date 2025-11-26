-- =============================================================================
-- Migration: FASE 3 - Popular cliente_id em pedidos existentes
-- Data: 2025-01-28
-- Descrição: Migra dados existentes para usar FK cliente_id
--            Baseado em matching de CPF/CNPJ e nome
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- ✅ FASE 3.1: Popular cliente_id em pedidos existentes baseado em CPF/CNPJ
-- Primeiro, tentar match por CPF/CNPJ (mais confiável)
UPDATE tiny_orders o
SET cliente_id = c.id
FROM tiny_contacts c
WHERE o.cliente_id IS NULL
  AND o.cliente_cpf_cnpj IS NOT NULL
  AND o.cliente_cpf_cnpj != ''
  AND c.cpf_cnpj IS NOT NULL
  AND c.cpf_cnpj != ''
  AND o.cliente_cpf_cnpj = c.cpf_cnpj
  AND o.store_id = c.store_id;

-- Log de quantos foram atualizados por CPF
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM tiny_orders
  WHERE cliente_id IS NOT NULL;
  
  RAISE NOTICE '✅ Pedidos atualizados com cliente_id (via CPF/CNPJ): %', updated_count;
END $$;

-- ✅ FASE 3.2: Popular cliente_id baseado em nome (fallback)
-- Apenas para pedidos que ainda não têm cliente_id
-- Usar match exato de nome + mesma loja
UPDATE tiny_orders o
SET cliente_id = c.id
FROM tiny_contacts c
WHERE o.cliente_id IS NULL
  AND o.cliente_nome IS NOT NULL
  AND o.cliente_nome != ''
  AND c.nome IS NOT NULL
  AND c.nome != ''
  AND LOWER(TRIM(o.cliente_nome)) = LOWER(TRIM(c.nome))
  AND o.store_id = c.store_id
  -- Evitar matches ambíguos: só se houver apenas 1 match
  AND (
    SELECT COUNT(*)
    FROM tiny_contacts c2
    WHERE LOWER(TRIM(c2.nome)) = LOWER(TRIM(o.cliente_nome))
      AND c2.store_id = o.store_id
  ) = 1;

-- Log final
DO $$
DECLARE
  total_with_cliente_id INTEGER;
  total_without_cliente_id INTEGER;
  total_orders INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_orders FROM tiny_orders;
  SELECT COUNT(*) INTO total_with_cliente_id FROM tiny_orders WHERE cliente_id IS NOT NULL;
  SELECT COUNT(*) INTO total_without_cliente_id FROM tiny_orders WHERE cliente_id IS NULL;
  
  RAISE NOTICE '📊 RESUMO DA MIGRAÇÃO:';
  RAISE NOTICE '   Total de pedidos: %', total_orders;
  RAISE NOTICE '   Pedidos com cliente_id: %', total_with_cliente_id;
  RAISE NOTICE '   Pedidos sem cliente_id: %', total_without_cliente_id;
  
  IF total_without_cliente_id > 0 THEN
    RAISE WARNING '⚠️ Alguns pedidos não puderam ser vinculados a clientes. Verifique manualmente.';
  END IF;
END $$;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

