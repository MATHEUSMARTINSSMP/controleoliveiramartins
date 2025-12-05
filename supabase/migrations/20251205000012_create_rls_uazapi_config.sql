-- ============================================================================
-- Migration: RLS Policies para uazapi_config
-- Data: 2025-12-05
-- Descrição: Políticas de segurança para configuração global UazAPI
-- Schema: sistemaretiradas
-- ============================================================================

-- Habilitar RLS
ALTER TABLE sistemaretiradas.uazapi_config ENABLE ROW LEVEL SECURITY;

-- Policy: Apenas Admin pode ver configuração
DROP POLICY IF EXISTS "uazapi_config_admin_select" ON sistemaretiradas.uazapi_config;
CREATE POLICY "uazapi_config_admin_select" ON sistemaretiradas.uazapi_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Apenas Admin pode inserir configuração
DROP POLICY IF EXISTS "uazapi_config_admin_insert" ON sistemaretiradas.uazapi_config;
CREATE POLICY "uazapi_config_admin_insert" ON sistemaretiradas.uazapi_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Apenas Admin pode atualizar configuração
DROP POLICY IF EXISTS "uazapi_config_admin_update" ON sistemaretiradas.uazapi_config;
CREATE POLICY "uazapi_config_admin_update" ON sistemaretiradas.uazapi_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Apenas Admin pode deletar configuração
DROP POLICY IF EXISTS "uazapi_config_admin_delete" ON sistemaretiradas.uazapi_config;
CREATE POLICY "uazapi_config_admin_delete" ON sistemaretiradas.uazapi_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- Verificação
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'sistemaretiradas'
    AND tablename = 'uazapi_config'
    AND policyname = 'uazapi_config_admin_select'
  ) THEN
    RAISE NOTICE '✅ RLS Policies criadas com sucesso';
  ELSE
    RAISE NOTICE '⚠️ RLS Policies podem não ter sido criadas (verifique manualmente)';
  END IF;
END $$;

