-- Migration: Atualizar políticas RLS para a tabela stores com admin_id
-- Descrição: Garantir que usuários possam ler e atualizar stores com admin_id
-- Data: 2025-11-23

-- ============================================
-- 1. HABILITAR RLS NA TABELA stores (se ainda não estiver)
-- ============================================

ALTER TABLE sistemaretiradas.stores ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DROPAR POLÍTICAS EXISTENTES (se existirem)
-- ============================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "stores_select_policy" ON sistemaretiradas.stores;
DROP POLICY IF EXISTS "stores_insert_policy" ON sistemaretiradas.stores;
DROP POLICY IF EXISTS "stores_update_policy" ON sistemaretiradas.stores;
DROP POLICY IF EXISTS "stores_delete_policy" ON sistemaretiradas.stores;
DROP POLICY IF EXISTS "stores_admin_select_policy" ON sistemaretiradas.stores;
DROP POLICY IF EXISTS "stores_admin_update_policy" ON sistemaretiradas.stores;

-- ============================================
-- 3. POLÍTICAS DE SELECT (LEITURA)
-- ============================================

-- Permitir que todos os usuários autenticados vejam lojas ativas
CREATE POLICY "stores_select_policy"
ON sistemaretiradas.stores
FOR SELECT
TO authenticated
USING (active = true);

-- Permitir que ADMINS vejam todas as lojas (incluindo inativas)
CREATE POLICY "stores_admin_select_policy"
ON sistemaretiradas.stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- ============================================
-- 4. POLÍTICAS DE INSERT (CRIAÇÃO)
-- ============================================

-- Permitir que apenas ADMINS criem lojas
CREATE POLICY "stores_insert_policy"
ON sistemaretiradas.stores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- ============================================
-- 5. POLÍTICAS DE UPDATE (ATUALIZAÇÃO)
-- ============================================

-- Permitir que apenas ADMINS atualizem lojas
-- Um admin pode atualizar qualquer loja
CREATE POLICY "stores_update_policy"
ON sistemaretiradas.stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- Permitir que um admin atualize sua própria loja (baseado em admin_id)
-- Isso é redundante com a política acima, mas pode ser útil para granularidade
CREATE POLICY "stores_admin_update_own_policy"
ON sistemaretiradas.stores
FOR UPDATE
TO authenticated
USING (
  admin_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
)
WITH CHECK (
  admin_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- ============================================
-- 6. POLÍTICAS DE DELETE (EXCLUSÃO)
-- ============================================

-- Permitir que apenas ADMINS excluam lojas
CREATE POLICY "stores_delete_policy"
ON sistemaretiradas.stores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- ============================================
-- 7. VERIFICAÇÃO E LOG
-- ============================================

-- Criar uma função para logar alterações (opcional)
CREATE OR REPLACE FUNCTION sistemaretiradas.log_store_admin_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.admin_id IS DISTINCT FROM NEW.admin_id THEN
    RAISE NOTICE 'Store % admin_id changed from % to %', NEW.id, OLD.admin_id, NEW.admin_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para logar mudanças (opcional)
DROP TRIGGER IF EXISTS trigger_log_store_admin_changes ON sistemaretiradas.stores;
CREATE TRIGGER trigger_log_store_admin_changes
BEFORE UPDATE ON sistemaretiradas.stores
FOR EACH ROW
EXECUTE FUNCTION sistemaretiradas.log_store_admin_changes();

