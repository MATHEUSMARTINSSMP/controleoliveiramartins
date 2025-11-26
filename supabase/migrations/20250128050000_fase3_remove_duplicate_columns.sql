-- =============================================================================
-- Migration: FASE 3 - Remover colunas duplicadas de tiny_orders
-- Data: 2025-01-28
-- Descrição: Remove cliente_email e cliente_telefone após migração
--            Dados completos agora estão em tiny_contacts via FK
-- ⚠️ ATENÇÃO: Execute apenas após confirmar que cliente_id está populado
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- ✅ FASE 3.3: Remover colunas duplicadas
-- Dados completos do cliente (telefone, email) agora estão em tiny_contacts

-- Verificar se há pedidos sem cliente_id antes de remover colunas
DO $$
DECLARE
  pedidos_sem_cliente INTEGER;
BEGIN
  SELECT COUNT(*) INTO pedidos_sem_cliente
  FROM tiny_orders
  WHERE cliente_id IS NULL
    AND (cliente_email IS NOT NULL OR cliente_telefone IS NOT NULL);
  
  IF pedidos_sem_cliente > 0 THEN
    RAISE WARNING '⚠️ Existem % pedidos sem cliente_id mas com dados de cliente. Considere migrar antes de remover colunas.', pedidos_sem_cliente;
  ELSE
    RAISE NOTICE '✅ Todos os pedidos com dados de cliente têm cliente_id. Seguro para remover colunas.';
  END IF;
END $$;

-- Remover colunas duplicadas
-- ⚠️ COMENTADO POR SEGURANÇA - Descomente após confirmar migração
-- ALTER TABLE tiny_orders
--   DROP COLUMN IF EXISTS cliente_email,
--   DROP COLUMN IF EXISTS cliente_telefone;

-- Comentário explicativo
COMMENT ON COLUMN tiny_orders.cliente_id IS 'FK para tiny_contacts - Use JOIN para obter telefone, email e outros dados completos';
COMMENT ON COLUMN tiny_orders.cliente_nome IS 'Nome do cliente (mantido para exibição rápida sem JOIN)';
COMMENT ON COLUMN tiny_orders.cliente_cpf_cnpj IS 'CPF/CNPJ do cliente (mantido para histórico rápido sem JOIN)';

-- ⚠️ NOTA: As colunas cliente_email e cliente_telefone foram mantidas temporariamente
-- para compatibilidade com dados existentes. Remova-as manualmente após confirmar
-- que todos os componentes estão usando JOIN com tiny_contacts.

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

