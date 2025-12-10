-- =====================================================
-- CORREÇÃO: Garantir que coluna is_active existe em profiles
-- =====================================================
-- Esta migração garante que a coluna is_active existe
-- e corrige qualquer inconsistência

-- Adicionar coluna is_active se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'profiles' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE sistemaretiradas.profiles
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    
    -- Atualizar todos os registros existentes para TRUE
    UPDATE sistemaretiradas.profiles
    SET is_active = TRUE
    WHERE is_active IS NULL;
    
    RAISE NOTICE 'Coluna is_active adicionada à tabela profiles';
  ELSE
    RAISE NOTICE 'Coluna is_active já existe na tabela profiles';
  END IF;
END $$;

-- Atualizar todas as políticas RLS que usam profiles.active para usar profiles.is_active
-- ANTES de remover a coluna active

-- 1. Atualizar políticas de collaborator_off_days
DO $$
BEGIN
  -- Admin SELECT
  DROP POLICY IF EXISTS "admin_select_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "admin_select_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
      )
    );

  -- Loja SELECT
  DROP POLICY IF EXISTS "loja_select_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "loja_select_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'LOJA'
          AND is_active = true
      )
    );

  -- Admin INSERT
  DROP POLICY IF EXISTS "admin_insert_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "admin_insert_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
      )
    );

  -- Loja INSERT
  DROP POLICY IF EXISTS "loja_insert_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "loja_insert_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'LOJA'
          AND is_active = true
      )
    );

  -- Admin UPDATE
  DROP POLICY IF EXISTS "admin_update_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "admin_update_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
      )
    );

  -- Loja UPDATE
  DROP POLICY IF EXISTS "loja_update_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "loja_update_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'LOJA'
          AND is_active = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'LOJA'
          AND is_active = true
      )
    );

  -- Admin DELETE
  DROP POLICY IF EXISTS "admin_delete_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "admin_delete_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
      )
    );

  -- Loja DELETE
  DROP POLICY IF EXISTS "loja_delete_collaborator_off_days" ON sistemaretiradas.collaborator_off_days;
  CREATE POLICY "loja_delete_collaborator_off_days" ON sistemaretiradas.collaborator_off_days
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'LOJA'
          AND is_active = true
      )
    );

  RAISE NOTICE 'Políticas de collaborator_off_days atualizadas para usar is_active';
END $$;

-- 2. Atualizar políticas de daily_goal_checks
DO $$
BEGIN
  -- Admin pode ver todos os checks
  DROP POLICY IF EXISTS "ADMIN pode ver todos os checks" ON sistemaretiradas.daily_goal_checks;
  CREATE POLICY "ADMIN pode ver todos os checks" ON sistemaretiradas.daily_goal_checks
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
          AND role = 'ADMIN'
          AND is_active = true
      )
    );

  -- LOJA pode ver checks de sua loja
  DROP POLICY IF EXISTS "LOJA pode ver checks de sua loja" ON sistemaretiradas.daily_goal_checks;
  CREATE POLICY "LOJA pode ver checks de sua loja" ON sistemaretiradas.daily_goal_checks
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        JOIN sistemaretiradas.stores s ON s.admin_id = p.id
        WHERE p.id = auth.uid()
          AND p.role = 'LOJA'
          AND p.is_active = true
          AND daily_goal_checks.store_id = s.id
      )
    );

  RAISE NOTICE 'Políticas de daily_goal_checks atualizadas para usar is_active';
END $$;

-- 3. Agora podemos remover a coluna active (se existir)
-- Garantir que a coluna active não existe (se existir, remover)
-- O código deve usar apenas is_active
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'profiles' 
    AND column_name = 'active'
  ) THEN
    -- Se existir active mas não is_active, copiar valores
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'profiles' 
      AND column_name = 'is_active'
    ) THEN
      ALTER TABLE sistemaretiradas.profiles
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
      
      UPDATE sistemaretiradas.profiles
      SET is_active = COALESCE(active, TRUE);
    END IF;
    
    -- Remover coluna active (agora que todas as políticas foram atualizadas)
    ALTER TABLE sistemaretiradas.profiles
    DROP COLUMN active CASCADE;
    
    RAISE NOTICE 'Coluna active removida (substituída por is_active)';
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON sistemaretiradas.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_role_is_active ON sistemaretiradas.profiles(role, is_active);

COMMENT ON COLUMN sistemaretiradas.profiles.is_active IS 'Indica se o perfil está ativo (pode ser desativado por billing ou Super Admin)';

