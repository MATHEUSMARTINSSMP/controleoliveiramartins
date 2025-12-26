-- ============================================================================
-- MIGRATION: Correção de Políticas RLS para marketing_jobs
-- ============================================================================
-- Data: 2025-12-25
-- Descrição: Corrige políticas RLS para permitir que ADMINs vejam jobs de suas lojas
--            e suporta diferentes tipos de usuários (ADMIN, LOJA, COLABORADORA)
-- ============================================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view marketing jobs from their store" ON sistemaretiradas.marketing_jobs;
DROP POLICY IF EXISTS "Users can insert marketing jobs for their store" ON sistemaretiradas.marketing_jobs;
DROP POLICY IF EXISTS "Users can update marketing jobs from their store" ON sistemaretiradas.marketing_jobs;

-- ============================================================================
-- NOVAS POLÍTICAS RLS (mais robustas)
-- ============================================================================

-- Política de SELECT: Permite ver jobs se:
-- 1. ADMIN: store_id está em lojas gerenciadas por ele (stores.admin_id)
-- 2. LOJA: store_id = profiles.store_id OU store_id = profiles.store_default
-- 3. COLABORADORA: store_id = profiles.store_id
CREATE POLICY "marketing_jobs_select_policy"
  ON sistemaretiradas.marketing_jobs FOR SELECT
  USING (
    -- ADMIN: pode ver jobs de lojas que ele gerencia
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.id = marketing_jobs.store_id
      AND s.admin_id = auth.uid()
    )
    OR
    -- LOJA: pode ver jobs da sua loja (store_id ou store_default)
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND (
        p.store_id = marketing_jobs.store_id
        OR p.store_default::UUID = marketing_jobs.store_id
      )
    )
    OR
    -- COLABORADORA: pode ver jobs da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
      AND p.store_id = marketing_jobs.store_id
    )
  );

-- Política de INSERT: Permite criar jobs se:
-- 1. ADMIN: store_id está em lojas gerenciadas por ele
-- 2. LOJA: store_id = profiles.store_id OU store_id = profiles.store_default
-- 3. COLABORADORA: store_id = profiles.store_id
-- E user_id = auth.uid()
CREATE POLICY "marketing_jobs_insert_policy"
  ON sistemaretiradas.marketing_jobs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- ADMIN: pode criar jobs em lojas que ele gerencia
      EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = marketing_jobs.store_id
        AND s.admin_id = auth.uid()
      )
      OR
      -- LOJA: pode criar jobs na sua loja
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'LOJA'
        AND (
          p.store_id = marketing_jobs.store_id
          OR p.store_default::UUID = marketing_jobs.store_id
        )
      )
      OR
      -- COLABORADORA: pode criar jobs na sua loja
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'COLABORADORA'
        AND p.store_id = marketing_jobs.store_id
      )
    )
  );

-- Política de UPDATE: Permite atualizar jobs se:
-- 1. ADMIN: store_id está em lojas gerenciadas por ele
-- 2. LOJA: store_id = profiles.store_id OU store_id = profiles.store_default
-- 3. COLABORADORA: store_id = profiles.store_id
CREATE POLICY "marketing_jobs_update_policy"
  ON sistemaretiradas.marketing_jobs FOR UPDATE
  USING (
    -- ADMIN: pode atualizar jobs de lojas que ele gerencia
    EXISTS (
      SELECT 1 FROM sistemaretiradas.stores s
      WHERE s.id = marketing_jobs.store_id
      AND s.admin_id = auth.uid()
    )
    OR
    -- LOJA: pode atualizar jobs da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'LOJA'
      AND (
        p.store_id = marketing_jobs.store_id
        OR p.store_default::UUID = marketing_jobs.store_id
      )
    )
    OR
    -- COLABORADORA: pode atualizar jobs da sua loja
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'COLABORADORA'
      AND p.store_id = marketing_jobs.store_id
    )
  );

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON POLICY "marketing_jobs_select_policy" ON sistemaretiradas.marketing_jobs IS 
  'Permite que ADMINs vejam jobs de lojas gerenciadas, LOJAs vejam jobs da sua loja, e COLABORADORAs vejam jobs da sua loja';

COMMENT ON POLICY "marketing_jobs_insert_policy" ON sistemaretiradas.marketing_jobs IS 
  'Permite criar jobs respeitando as mesmas regras de acesso por role';

COMMENT ON POLICY "marketing_jobs_update_policy" ON sistemaretiradas.marketing_jobs IS 
  'Permite atualizar jobs respeitando as mesmas regras de acesso por role';

