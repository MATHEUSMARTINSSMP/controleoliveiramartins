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
    
    -- Remover coluna active (não é mais usada)
    ALTER TABLE sistemaretiradas.profiles
    DROP COLUMN IF EXISTS active;
    
    RAISE NOTICE 'Coluna active removida (substituída por is_active)';
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON sistemaretiradas.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_role_is_active ON sistemaretiradas.profiles(role, is_active);

COMMENT ON COLUMN sistemaretiradas.profiles.is_active IS 'Indica se o perfil está ativo (pode ser desativado por billing ou Super Admin)';

