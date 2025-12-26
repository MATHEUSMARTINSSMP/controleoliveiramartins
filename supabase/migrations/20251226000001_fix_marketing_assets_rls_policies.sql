-- ============================================================================
-- MIGRATION: Correção de Políticas RLS para marketing_assets
-- ============================================================================
-- Data: 2025-12-26
-- Descrição: Corrige políticas RLS para permitir que ADMINs vejam assets de suas lojas
--            e suporta diferentes tipos de usuários (ADMIN, LOJA, COLABORADORA)
-- ============================================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view marketing assets from their store" ON sistemaretiradas.marketing_assets;
DROP POLICY IF EXISTS "Users can insert marketing assets for their store" ON sistemaretiradas.marketing_assets;
DROP POLICY IF EXISTS "Users can update marketing assets from their store" ON sistemaretiradas.marketing_assets;
DROP POLICY IF EXISTS "Users can delete marketing assets from their store" ON sistemaretiradas.marketing_assets;

-- ============================================================================
-- NOVAS POLÍTICAS RLS (mais robustas)
-- ============================================================================

-- Política de SELECT: Permite ver assets se:
-- 1. ADMIN: store_id está em lojas gerenciadas por ele (stores.admin_id)
-- 2. LOJA: store_id = profiles.store_id OU store_id = profiles.store_default
-- 3. COLABORADORA: store_id = profiles.store_id
CREATE POLICY "marketing_assets_select_policy"
  ON sistemaretiradas.marketing_assets FOR SELECT
  USING (
    -- ADMIN: pode ver assets de lojas que ele gerencia
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.id = marketing_assets.store_id
      AND s.admin_id = auth.uid()
    )
    OR
    -- LOJA: pode ver assets da sua loja (store_id ou store_default)
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND (
        p.store_id = marketing_assets.store_id
        OR p.store_default::UUID = marketing_assets.store_id
      )
    )
    OR
    -- COLABORADORA: pode ver assets da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
      AND p.store_id = marketing_assets.store_id
    )
  );

-- Política de INSERT: Permite criar assets se:
-- 1. ADMIN: store_id está em lojas gerenciadas por ele
-- 2. LOJA: store_id = profiles.store_id OU store_id = profiles.store_default
-- 3. COLABORADORA: store_id = profiles.store_id
-- E user_id = auth.uid() (se o campo existir)
CREATE POLICY "marketing_assets_insert_policy"
  ON sistemaretiradas.marketing_assets FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND (
      -- ADMIN: pode criar assets em lojas que ele gerencia
      EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = marketing_assets.store_id
        AND s.admin_id = auth.uid()
      )
      OR
      -- LOJA: pode criar assets na sua loja
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND (
          p.store_id = marketing_assets.store_id
          OR p.store_default::UUID = marketing_assets.store_id
        )
      )
      OR
      -- COLABORADORA: pode criar assets na sua loja
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = marketing_assets.store_id
      )
    )
  );

-- Política de UPDATE: Permite atualizar assets se:
-- 1. ADMIN: store_id está em lojas gerenciadas por ele
-- 2. LOJA: store_id = profiles.store_id OU store_id = profiles.store_default
-- 3. COLABORADORA: store_id = profiles.store_id
CREATE POLICY "marketing_assets_update_policy"
  ON sistemaretiradas.marketing_assets FOR UPDATE
  USING (
    -- ADMIN: pode atualizar assets de lojas que ele gerencia
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.id = marketing_assets.store_id
      AND s.admin_id = auth.uid()
    )
    OR
    -- LOJA: pode atualizar assets da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND (
        p.store_id = marketing_assets.store_id
        OR p.store_default::UUID = marketing_assets.store_id
      )
    )
    OR
    -- COLABORADORA: pode atualizar assets da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
      AND p.store_id = marketing_assets.store_id
    )
  );

-- Política de DELETE: Permite deletar assets se:
-- 1. ADMIN: store_id está em lojas gerenciadas por ele
-- 2. LOJA: store_id = profiles.store_id OU store_id = profiles.store_default
-- 3. COLABORADORA: store_id = profiles.store_id
CREATE POLICY "marketing_assets_delete_policy"
  ON sistemaretiradas.marketing_assets FOR DELETE
  USING (
    -- ADMIN: pode deletar assets de lojas que ele gerencia
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.id = marketing_assets.store_id
      AND s.admin_id = auth.uid()
    )
    OR
    -- LOJA: pode deletar assets da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND (
        p.store_id = marketing_assets.store_id
        OR p.store_default::UUID = marketing_assets.store_id
      )
    )
    OR
    -- COLABORADORA: pode deletar assets da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
      AND p.store_id = marketing_assets.store_id
    )
  );

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON POLICY "marketing_assets_select_policy" ON sistemaretiradas.marketing_assets IS 
  'Permite que ADMINs vejam assets de lojas gerenciadas, LOJAs vejam assets da sua loja, e COLABORADORAs vejam assets da sua loja';

COMMENT ON POLICY "marketing_assets_insert_policy" ON sistemaretiradas.marketing_assets IS 
  'Permite criar assets respeitando as mesmas regras de acesso por role';

COMMENT ON POLICY "marketing_assets_update_policy" ON sistemaretiradas.marketing_assets IS 
  'Permite atualizar assets respeitando as mesmas regras de acesso por role';

COMMENT ON POLICY "marketing_assets_delete_policy" ON sistemaretiradas.marketing_assets IS 
  'Permite deletar assets respeitando as mesmas regras de acesso por role';

