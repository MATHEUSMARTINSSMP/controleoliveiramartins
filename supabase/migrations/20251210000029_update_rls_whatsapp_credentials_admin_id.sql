-- =====================================================
-- ATUALIZAR RLS POLICIES PARA USAR admin_id
-- =====================================================
-- Substitui uso de email por profile.id nas policies

-- Remover policies antigas
DROP POLICY IF EXISTS "whatsapp_credentials_admin_select_own" ON sistemaretiradas.whatsapp_credentials;
DROP POLICY IF EXISTS "whatsapp_credentials_admin_insert" ON sistemaretiradas.whatsapp_credentials;
DROP POLICY IF EXISTS "whatsapp_credentials_admin_update" ON sistemaretiradas.whatsapp_credentials;
DROP POLICY IF EXISTS "whatsapp_credentials_admin_delete" ON sistemaretiradas.whatsapp_credentials;

-- Policy: Admin pode ver apenas suas próprias credenciais (via admin_id = profile.id)
CREATE POLICY "whatsapp_credentials_admin_select_own" ON sistemaretiradas.whatsapp_credentials
  FOR SELECT USING (
    -- Admin pode ver credenciais onde admin_id = seu profile.id
    admin_id = auth.uid()
    OR
    -- Compatibilidade: se admin_id for NULL, usar customer_id (email) - DEPRECADO
    (admin_id IS NULL AND customer_id = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Policy: Admin pode inserir suas próprias credenciais
CREATE POLICY "whatsapp_credentials_admin_insert" ON sistemaretiradas.whatsapp_credentials
  FOR INSERT WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Admin pode atualizar suas próprias credenciais
CREATE POLICY "whatsapp_credentials_admin_update" ON sistemaretiradas.whatsapp_credentials
  FOR UPDATE USING (
    (admin_id = auth.uid())
    OR
    -- Compatibilidade: se admin_id for NULL, usar customer_id (email) - DEPRECADO
    (admin_id IS NULL AND customer_id = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid() 
      AND role = 'ADMIN'
    )
  );

-- Policy: Admin pode deletar suas próprias credenciais
CREATE POLICY "whatsapp_credentials_admin_delete" ON sistemaretiradas.whatsapp_credentials
  FOR DELETE USING (
    (admin_id = auth.uid())
    OR
    -- Compatibilidade: se admin_id for NULL, usar customer_id (email) - DEPRECADO
    (admin_id IS NULL AND customer_id = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

COMMENT ON POLICY "whatsapp_credentials_admin_select_own" ON sistemaretiradas.whatsapp_credentials IS 'Admin vê credenciais via admin_id (profile.id). Compatibilidade com customer_id (email) mantida.';
COMMENT ON POLICY "whatsapp_credentials_admin_insert" ON sistemaretiradas.whatsapp_credentials IS 'Admin insere credenciais com admin_id = profile.id';
COMMENT ON POLICY "whatsapp_credentials_admin_update" ON sistemaretiradas.whatsapp_credentials IS 'Admin atualiza credenciais via admin_id (profile.id). Compatibilidade com customer_id mantida.';
COMMENT ON POLICY "whatsapp_credentials_admin_delete" ON sistemaretiradas.whatsapp_credentials IS 'Admin deleta credenciais via admin_id (profile.id). Compatibilidade com customer_id mantida.';

