-- ============================================================================
-- Migration: Permitir usuário dev acessar todas as lojas
-- Data: 2025-12-05
-- Descrição: Adicionar exceção RLS para usuário dev@dev.com ver todas as lojas
-- ============================================================================

-- Atualizar policy de SELECT para permitir usuário dev ver todas as lojas
DROP POLICY IF EXISTS "stores_admin_select_own" ON sistemaretiradas.stores;

CREATE POLICY "stores_admin_select_own" ON sistemaretiradas.stores
  FOR SELECT USING (
    -- Usuário dev pode ver TODAS as lojas
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid() 
      AND p.email = 'dev@dev.com'
    )
    OR
    -- Admin só vê suas próprias lojas
    admin_id = auth.uid()
    OR
    -- Colaboradoras podem ver dados básicos da sua loja (sem credenciais sensíveis)
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'COLABORADORA'
      AND p.store_id = stores.id
    )
    OR
    -- Usuários LOJA podem ver dados básicos da sua loja (sem credenciais sensíveis)
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'LOJA'
      AND p.store_id = stores.id
    )
  );

-- Atualizar policy de UPDATE para permitir usuário dev editar todas as lojas
DROP POLICY IF EXISTS "stores_admin_update_own" ON sistemaretiradas.stores;

CREATE POLICY "stores_admin_update_own" ON sistemaretiradas.stores
  FOR UPDATE USING (
    -- Usuário dev pode editar TODAS as lojas
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid() 
      AND p.email = 'dev@dev.com'
    )
    OR
    (
      admin_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid() AND role = 'ADMIN'
      )
    )
  );

