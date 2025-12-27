-- ============================================================================
-- Migration: Corrigir RLS policies de google_credentials para não usar auth.users
-- Data: 2025-12-27
-- Descrição: Substituir SELECT email FROM auth.users por email da tabela profiles
--            O cliente anon não tem permissão para ler auth.users
-- ============================================================================

-- Remover policies antigas que usam auth.users
DROP POLICY IF EXISTS "ADMIN pode ver google_credentials de suas lojas" ON sistemaretiradas.google_credentials;
DROP POLICY IF EXISTS "ADMIN pode gerenciar google_credentials" ON sistemaretiradas.google_credentials;

-- Policy: ADMIN pode ver todas as credenciais de suas lojas
-- Usar email da tabela profiles ao invés de auth.users
CREATE POLICY "ADMIN pode ver google_credentials de suas lojas"
  ON sistemaretiradas.google_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND (
        -- Se o customer_id é o email do admin (usando email do profile)
        customer_id = p.email
        OR
        -- Ou se o admin tem acesso à loja através do site_slug
        EXISTS (
          SELECT 1 FROM sistemaretiradas.stores s
          WHERE s.site_slug = google_credentials.site_slug
          AND s.id IN (
            SELECT store_id FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Policy: ADMIN pode inserir/atualizar credenciais
-- Usar email da tabela profiles ao invés de auth.users
CREATE POLICY "ADMIN pode gerenciar google_credentials"
  ON sistemaretiradas.google_credentials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = p.email
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'ADMIN'
      AND customer_id = p.email
    )
  );

COMMENT ON POLICY "ADMIN pode ver google_credentials de suas lojas" ON sistemaretiradas.google_credentials IS 
'Admin pode ver credenciais onde customer_id = email do profile. Não usa auth.users para evitar problemas de permissão.';

COMMENT ON POLICY "ADMIN pode gerenciar google_credentials" ON sistemaretiradas.google_credentials IS 
'Admin pode gerenciar credenciais onde customer_id = email do profile. Não usa auth.users para evitar problemas de permissão.';

