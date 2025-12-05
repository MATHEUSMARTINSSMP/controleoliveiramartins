-- ============================================================================
-- Migration: RLS Policies para whatsapp_credentials
-- Data: 2025-12-05
-- Descrição: Políticas de segurança para acesso às credenciais WhatsApp
-- Schema: sistemaretiradas
-- ============================================================================

-- Habilitar RLS
ALTER TABLE sistemaretiradas.whatsapp_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Admin pode ver apenas suas próprias credenciais (via customer_id = email do admin)
DROP POLICY IF EXISTS "whatsapp_credentials_admin_select_own" ON sistemaretiradas.whatsapp_credentials;
CREATE POLICY "whatsapp_credentials_admin_select_own" ON sistemaretiradas.whatsapp_credentials
  FOR SELECT USING (
    -- Admin pode ver credenciais onde customer_id = seu email
    customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- Ou se for admin e tiver permissão
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Admin pode inserir suas próprias credenciais
DROP POLICY IF EXISTS "whatsapp_credentials_admin_insert" ON sistemaretiradas.whatsapp_credentials;
CREATE POLICY "whatsapp_credentials_admin_insert" ON sistemaretiradas.whatsapp_credentials
  FOR INSERT WITH CHECK (
    customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Admin pode atualizar suas próprias credenciais
DROP POLICY IF EXISTS "whatsapp_credentials_admin_update" ON sistemaretiradas.whatsapp_credentials;
CREATE POLICY "whatsapp_credentials_admin_update" ON sistemaretiradas.whatsapp_credentials
  FOR UPDATE USING (
    customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Admin pode deletar suas próprias credenciais
DROP POLICY IF EXISTS "whatsapp_credentials_admin_delete" ON sistemaretiradas.whatsapp_credentials;
CREATE POLICY "whatsapp_credentials_admin_delete" ON sistemaretiradas.whatsapp_credentials
  FOR DELETE USING (
    customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND EXISTS (
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
    AND tablename = 'whatsapp_credentials'
    AND policyname = 'whatsapp_credentials_admin_select_own'
  ) THEN
    RAISE NOTICE '✅ RLS Policies criadas com sucesso';
  ELSE
    RAISE NOTICE '⚠️ RLS Policies podem não ter sido criadas (verifique manualmente)';
  END IF;
END $$;

