-- ============================================================================
-- MIGRATION: Permitir DELETE em tiny_orders para ADMIN
-- Data: 2025-01-31
-- Descrição: Adiciona política RLS para permitir que ADMIN delete pedidos
-- ============================================================================

-- Habilitar RLS na tabela se ainda não estiver habilitado
ALTER TABLE sistemaretiradas.tiny_orders ENABLE ROW LEVEL SECURITY;

-- Remover política de DELETE antiga se existir
DROP POLICY IF EXISTS "ADMIN pode deletar pedidos" ON sistemaretiradas.tiny_orders;

-- Criar política para ADMIN deletar pedidos
CREATE POLICY "ADMIN pode deletar pedidos"
ON sistemaretiradas.tiny_orders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

COMMENT ON POLICY "ADMIN pode deletar pedidos" ON sistemaretiradas.tiny_orders IS 
'Permite que usuários com role ADMIN deletem pedidos da tabela tiny_orders';

